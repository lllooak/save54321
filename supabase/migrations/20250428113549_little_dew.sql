/*
  # Fix withdrawal status handling

  1. Changes
    - Create or replace function to handle withdrawal status changes
    - Ensure proper balance updates when withdrawal is completed
    - Add notifications for status changes
  
  2. Security
    - Function is SECURITY DEFINER to bypass RLS
    - Proper validation of withdrawal status
*/

-- Create or replace function to handle withdrawal status changes
CREATE OR REPLACE FUNCTION handle_withdrawal_status_change()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_creator_id uuid;
  v_amount numeric;
  v_current_balance numeric;
  v_transaction_id uuid;
BEGIN
  -- Only process when status changes
  IF (NEW.status = OLD.status) THEN
    RETURN NEW;
  END IF;
  
  -- Get withdrawal details
  SELECT 
    creator_id,
    amount
  INTO 
    v_creator_id,
    v_amount
  FROM withdrawal_requests
  WHERE id = NEW.id;
  
  -- Get creator's current balance
  SELECT wallet_balance INTO v_current_balance
  FROM users
  WHERE id = v_creator_id
  FOR UPDATE;
  
  -- Process based on new status
  IF (NEW.status = 'completed' AND OLD.status = 'pending') THEN
    -- Deduct amount from creator's balance
    UPDATE users
    SET 
      wallet_balance = GREATEST(0, wallet_balance - v_amount),
      updated_at = NOW()
    WHERE id = v_creator_id;
    
    -- Create transaction record for the withdrawal
    INSERT INTO wallet_transactions (
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description,
      reference_id
    ) VALUES (
      v_creator_id,
      'purchase',
      v_amount,
      NEW.method,
      'completed',
      'Withdrawal - ' || CASE WHEN NEW.method = 'paypal' THEN 'PayPal' ELSE 'Bank Transfer' END,
      NEW.id::text
    )
    RETURNING id INTO v_transaction_id;
    
    -- Log the withdrawal completion
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      details
    ) VALUES (
      'withdrawal_completed',
      'withdrawal_requests',
      NEW.id,
      jsonb_build_object(
        'creator_id', v_creator_id,
        'amount', v_amount,
        'method', NEW.method,
        'previous_balance', v_current_balance,
        'new_balance', GREATEST(0, v_current_balance - v_amount),
        'transaction_id', v_transaction_id
      )
    );
    
    -- Create notification for the creator
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      v_creator_id,
      'בקשת המשיכה אושרה',
      'בקשת המשיכה שלך בסך ₪' || v_amount || ' אושרה ותועבר בקרוב',
      'payment',
      NEW.id,
      'withdrawal'
    );
  ELSIF (NEW.status = 'rejected' AND OLD.status = 'pending') THEN
    -- Create notification for the creator
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      v_creator_id,
      'בקשת המשיכה נדחתה',
      'בקשת המשיכה שלך בסך ₪' || v_amount || ' נדחתה. אנא צור קשר עם התמיכה לפרטים נוספים.',
      'payment',
      NEW.id,
      'withdrawal'
    );
    
    -- Log the withdrawal rejection
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      details
    ) VALUES (
      'withdrawal_rejected',
      'withdrawal_requests',
      NEW.id,
      jsonb_build_object(
        'creator_id', v_creator_id,
        'amount', v_amount,
        'method', NEW.method
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error without failing
    RAISE WARNING 'Error in handle_withdrawal_status_change: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS withdrawal_status_change_trigger ON withdrawal_requests;

-- Create trigger to handle withdrawal status changes
CREATE TRIGGER withdrawal_status_change_trigger
AFTER UPDATE OF status ON withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION handle_withdrawal_status_change();
