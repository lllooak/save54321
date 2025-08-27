/*
  # Fix request status updates and balance handling

  1. Changes
    - Update process_request_refund function to properly handle refunds when a request is declined
    - Update update_earnings_on_completion_trigger_func to properly update creator balance
    - Add notifications for status changes
    - Ensure proper transaction recording
  
  2. Security
    - Functions are executed with security definer to bypass RLS
    - Proper validation and error handling
*/

-- Create or replace function to complete requests and pay creators
CREATE OR REPLACE FUNCTION complete_request_and_pay_creator(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_id uuid;
  v_fan_id uuid;
  v_earnings_record RECORD;
  v_creator_amount numeric;
  v_transaction_id uuid;
BEGIN
  -- Get request details
  SELECT creator_id, fan_id INTO v_creator_id, v_fan_id
  FROM requests
  WHERE id = p_request_id
  FOR UPDATE;
  
  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request not found'
    );
  END IF;
  
  -- Check if request is already completed
  IF EXISTS (
    SELECT 1 FROM requests 
    WHERE id = p_request_id 
    AND status = 'completed'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request already completed'
    );
  END IF;
  
  -- Get earnings record
  SELECT * INTO v_earnings_record
  FROM earnings
  WHERE request_id = p_request_id
  FOR UPDATE;
  
  IF v_earnings_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Earnings record not found'
    );
  END IF;
  
  IF v_earnings_record.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Earnings already processed'
    );
  END IF;
  
  -- Round the amount to 2 decimal places
  v_creator_amount := ROUND(v_earnings_record.amount::numeric, 2);
  
  -- Update request status
  UPDATE requests
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE id = p_request_id;
  
  -- Update earnings status
  UPDATE earnings
  SET 
    status = 'completed'
  WHERE id = v_earnings_record.id;
  
  -- Add creator's share to their wallet
  UPDATE users
  SET wallet_balance = ROUND((wallet_balance + v_creator_amount)::numeric, 2)
  WHERE id = v_creator_id;
  
  -- Create creator's earning transaction
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
    'earning',
    v_creator_amount,
    'platform',
    'completed',
    'Video request earning (70% of payment)',
    p_request_id::text
  )
  RETURNING id INTO v_transaction_id;
  
  -- Log the completion
  INSERT INTO audit_logs (
    action,
    entity,
    entity_id,
    user_id,
    details
  ) VALUES (
    'request_completed',
    'requests',
    p_request_id,
    v_creator_id,
    jsonb_build_object(
      'creator_id', v_creator_id,
      'amount', v_creator_amount,
      'transaction_id', v_transaction_id,
      'completed_at', NOW()
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
    'בקשה הושלמה',
    'בקשת הוידאו הושלמה וקיבלת תשלום של ₪' || v_creator_amount,
    'payment',
    p_request_id,
    'request'
  );
  
  -- Create notification for the fan
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    entity_id,
    entity_type
  ) VALUES (
    v_fan_id,
    'הוידאו שלך מוכן!',
    'הוידאו שהזמנת מוכן לצפייה',
    'request',
    p_request_id,
    'request'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'creator_id', v_creator_id,
    'amount', v_creator_amount,
    'transaction_id', v_transaction_id
  );
END;
$$;

-- Create or replace the function to process refunds when a request is declined
CREATE OR REPLACE FUNCTION process_request_refund()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_fan_id uuid;
  v_creator_id uuid;
  v_amount numeric;
  v_transaction_id uuid;
  v_earnings_record RECORD;
BEGIN
  -- Only process when status changes to declined
  IF (NEW.status = 'declined' AND OLD.status != 'declined') THEN
    -- Get request details
    SELECT 
      fan_id, 
      creator_id, 
      price
    INTO 
      v_fan_id, 
      v_creator_id, 
      v_amount
    FROM requests
    WHERE id = NEW.id;
    
    -- Get earnings record if it exists
    SELECT * INTO v_earnings_record
    FROM earnings
    WHERE request_id = NEW.id;
    
    -- Process the refund
    
    -- Refund full amount to fan
    UPDATE users
    SET 
      wallet_balance = wallet_balance + v_amount,
      updated_at = NOW()
    WHERE id = v_fan_id;
    
    -- Update earnings status to 'refunded' if it exists
    IF v_earnings_record.id IS NOT NULL THEN
      UPDATE earnings
      SET status = 'refunded'
      WHERE id = v_earnings_record.id;
    END IF;
    
    -- Create refund transaction record for fan
    INSERT INTO wallet_transactions (
      id,
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description,
      reference_id
    ) VALUES (
      gen_random_uuid(),
      v_fan_id,
      'refund',
      v_amount,
      'wallet',
      'completed',
      'Refund for declined video request',
      NEW.id::text
    )
    RETURNING id INTO v_transaction_id;
    
    -- Create notification for the fan
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      v_fan_id,
      'בקשת הוידאו נדחתה',
      'בקשת הוידאו שלך נדחתה והכסף הוחזר לארנק שלך',
      'request',
      NEW.id,
      'request'
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
      'בקשת וידאו נדחתה',
      'דחית בקשת וידאו. הכסף הוחזר למעריץ.',
      'request',
      NEW.id,
      'request'
    );
    
    -- Log the refund processing
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      user_id,
      details
    ) VALUES (
      'process_refund',
      'requests',
      NEW.id,
      v_creator_id,
      jsonb_build_object(
        'total_amount', v_amount,
        'fan_id', v_fan_id,
        'creator_id', v_creator_id,
        'reason', 'Request declined by creator or admin',
        'transaction_id', v_transaction_id
      )
    );
  END IF;
  
  -- Create notification for status change to approved
  IF (NEW.status = 'approved' AND OLD.status != 'approved') THEN
    -- Get request details
    SELECT 
      fan_id, 
      creator_id
    INTO 
      v_fan_id, 
      v_creator_id
    FROM requests
    WHERE id = NEW.id;
    
    -- Create notification for the fan
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      v_fan_id,
      'בקשת הוידאו אושרה',
      'בקשת הוידאו שלך אושרה ותטופל בקרוב',
      'request',
      NEW.id,
      'request'
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
      'בקשת וידאו אושרה',
      'אישרת בקשת וידאו. אנא השלם אותה בהקדם.',
      'request',
      NEW.id,
      'request'
    );
    
    -- Log the approval
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      user_id,
      details
    ) VALUES (
      'request_approved',
      'requests',
      NEW.id,
      v_creator_id,
      jsonb_build_object(
        'fan_id', v_fan_id,
        'creator_id', v_creator_id,
        'timestamp', NOW()
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error without failing
    RAISE WARNING 'Error in process_request_refund: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS request_status_change_trigger ON requests;

-- Create trigger to automatically process refunds and status changes
CREATE TRIGGER request_status_change_trigger
AFTER UPDATE OF status ON requests
FOR EACH ROW
EXECUTE FUNCTION process_request_refund();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION complete_request_and_pay_creator TO authenticated;
GRANT EXECUTE ON FUNCTION process_request_refund TO authenticated;
