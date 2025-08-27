-- Drop existing trigger first
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_earnings_on_completion_trigger') THEN
    DROP TRIGGER IF EXISTS update_earnings_on_completion_trigger ON requests;
  END IF;
END $$;

-- Now it's safe to drop the function
DROP FUNCTION IF EXISTS update_earnings_on_completion() CASCADE;
DROP FUNCTION IF EXISTS update_earnings_on_completion(uuid) CASCADE;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS process_request_payment;

-- Create updated function with proper decimal handling
CREATE OR REPLACE FUNCTION process_request_payment(
  p_request_id uuid,
  p_fan_id uuid,
  p_creator_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_platform_fee numeric := 30; -- Hardcoded 30% platform fee
  v_fee_amount numeric;
  v_creator_amount numeric;
  v_fan_balance numeric;
  v_admin_id uuid;
  v_earnings_id uuid;
BEGIN
  -- Round the input amount to 2 decimal places
  p_amount := ROUND(p_amount::numeric, 2);
  
  -- Calculate fee and creator amounts with proper rounding
  v_fee_amount := ROUND((p_amount * v_platform_fee / 100)::numeric, 2);
  v_creator_amount := ROUND((p_amount - v_fee_amount)::numeric, 2);

  -- Get fan's current balance
  SELECT wallet_balance INTO v_fan_balance
  FROM users
  WHERE id = p_fan_id
  FOR UPDATE;

  -- Check if fan has sufficient balance
  IF v_fan_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance'
    );
  END IF;

  -- Get admin user id
  SELECT id INTO v_admin_id
  FROM users
  WHERE role = 'admin'
  LIMIT 1;

  -- Begin transaction
  BEGIN
    -- Deduct amount from fan's wallet
    UPDATE users
    SET wallet_balance = ROUND((wallet_balance - p_amount)::numeric, 2)
    WHERE id = p_fan_id;

    -- Create earnings record with pending status
    INSERT INTO earnings (
      creator_id,
      request_id,
      amount,
      status
    ) VALUES (
      p_creator_id,
      p_request_id,
      v_creator_amount,
      'pending'
    )
    RETURNING id INTO v_earnings_id;

    -- Create transaction records
    -- Fan's purchase transaction
    INSERT INTO wallet_transactions (
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description
    ) VALUES (
      p_fan_id,
      'purchase',
      p_amount,
      'wallet',
      'completed',
      'Video request payment'
    );

    -- Platform fee transaction
    IF v_admin_id IS NOT NULL THEN
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount,
        payment_method,
        payment_status,
        description
      ) VALUES (
        v_admin_id,
        'fee',
        v_fee_amount,
        'platform',
        'completed',
        'Platform fee (30% of payment)'
      );
      
      -- Add platform fee to admin's wallet
      UPDATE users
      SET wallet_balance = ROUND((wallet_balance + v_fee_amount)::numeric, 2)
      WHERE id = v_admin_id;
    END IF;

    -- Update request status
    UPDATE requests
    SET status = 'pending'
    WHERE id = p_request_id;

    -- Log the payment processing
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      user_id,
      details
    ) VALUES (
      'process_payment',
      'requests',
      p_request_id,
      p_fan_id,
      jsonb_build_object(
        'total_amount', p_amount,
        'platform_fee_percentage', v_platform_fee,
        'platform_fee_amount', v_fee_amount,
        'creator_amount', v_creator_amount,
        'fan_id', p_fan_id,
        'creator_id', p_creator_id,
        'earnings_id', v_earnings_id,
        'earnings_status', 'pending'
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'total_amount', p_amount,
      'platform_fee_percentage', v_platform_fee,
      'platform_fee_amount', v_fee_amount,
      'creator_amount', v_creator_amount,
      'earnings_id', v_earnings_id,
      'earnings_status', 'pending'
    );
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'Error in process_request_payment: %', SQLERRM;
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
      );
  END;
END;
$$;

-- Create trigger function with proper decimal handling and a unique name
CREATE OR REPLACE FUNCTION update_earnings_on_completion_trigger_func()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_creator_id uuid;
  v_amount numeric;
  v_platform_fee numeric := 30; -- Hardcoded 30% platform fee
  v_fee_amount numeric;
  v_creator_amount numeric;
BEGIN
  -- Only process when status changes to completed
  IF (NEW.status = 'completed' AND OLD.status <> 'completed') THEN
    -- Get request details
    SELECT 
      creator_id, 
      price
    INTO 
      v_creator_id, 
      v_amount
    FROM requests
    WHERE id = NEW.id;
    
    -- Round the amount to 2 decimal places
    v_amount := ROUND(v_amount::numeric, 2);
    
    -- Calculate fee and creator amounts with proper rounding
    v_fee_amount := ROUND((v_amount * v_platform_fee / 100)::numeric, 2);
    v_creator_amount := ROUND((v_amount - v_fee_amount)::numeric, 2);
    
    -- Create or update earnings record
    INSERT INTO earnings (
      creator_id,
      request_id,
      amount,
      status
    ) VALUES (
      v_creator_id,
      NEW.id,
      v_creator_amount,
      'completed'
    )
    ON CONFLICT (request_id) 
    DO UPDATE SET
      amount = v_creator_amount,
      status = 'completed';
    
    -- Log the earnings update
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      user_id,
      details
    ) VALUES (
      'update_earnings',
      'requests',
      NEW.id,
      v_creator_id,
      jsonb_build_object(
        'total_amount', v_amount,
        'platform_fee_percentage', v_platform_fee,
        'platform_fee_amount', v_fee_amount,
        'creator_amount', v_creator_amount,
        'creator_id', v_creator_id,
        'request_id', NEW.id
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error without failing
    RAISE WARNING 'Error in update_earnings_on_completion_trigger_func: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger with the new function name
CREATE TRIGGER update_earnings_on_completion_trigger
AFTER UPDATE OF status ON requests
FOR EACH ROW
WHEN ((NEW.status = 'completed') AND (OLD.status <> 'completed'))
EXECUTE FUNCTION update_earnings_on_completion_trigger_func();

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS complete_request_and_pay_creator;

-- Create function to complete request and pay creator with proper decimal handling
CREATE OR REPLACE FUNCTION complete_request_and_pay_creator(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_id uuid;
  v_earnings_record RECORD;
  v_creator_amount numeric;
  v_transaction_id uuid;
BEGIN
  -- Get request details
  SELECT creator_id INTO v_creator_id
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
  
  RETURN jsonb_build_object(
    'success', true,
    'creator_id', v_creator_id,
    'amount', v_creator_amount,
    'transaction_id', v_transaction_id
  );
END;
$$;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS admin_adjust_user_balance;

-- Create function for admins to adjust user balances with proper decimal handling
CREATE OR REPLACE FUNCTION admin_adjust_user_balance(
  p_user_id uuid,
  p_amount numeric,
  p_reason text DEFAULT 'Manual balance adjustment by admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_record RECORD;
  v_current_balance numeric;
  v_new_balance numeric;
  v_admin_id uuid;
  v_transaction_id uuid;
  v_admin_role text;
BEGIN
  -- Get the current user ID
  v_admin_id := auth.uid();
  
  -- Check if the current user exists and is an admin
  SELECT role INTO v_admin_role
  FROM users
  WHERE id = v_admin_id;
  
  IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'רק מנהלים יכולים לעדכן יתרות משתמשים'
    );
  END IF;

  -- Round the amount to 2 decimal places
  p_amount := ROUND(p_amount::numeric, 2);

  -- Get user details
  SELECT id, email, name, role, wallet_balance
  INTO v_user_record
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF v_user_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Store current balance
  v_current_balance := COALESCE(v_user_record.wallet_balance, 0);
  
  -- Calculate new balance with proper rounding
  v_new_balance := ROUND((v_current_balance + p_amount)::numeric, 2);
  
  -- Prevent negative balance
  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot set balance below zero',
      'current_balance', v_current_balance,
      'requested_adjustment', p_amount,
      'minimum_allowed_adjustment', -v_current_balance
    );
  END IF;
  
  -- Update user balance
  UPDATE users
  SET 
    wallet_balance = v_new_balance,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    user_id,
    type,
    amount,
    payment_method,
    payment_status,
    description,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    CASE 
      WHEN p_amount > 0 THEN 'top_up'
      ELSE 'purchase'
    END,
    ABS(p_amount),
    'admin',
    'completed',
    p_reason,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_transaction_id;
  
  -- Log the adjustment in audit logs
  INSERT INTO audit_logs (
    action,
    entity,
    entity_id,
    user_id,
    details
  ) VALUES (
    'admin_balance_adjustment',
    'users',
    p_user_id,
    v_admin_id,
    jsonb_build_object(
      'user_id', p_user_id,
      'user_email', v_user_record.email,
      'user_name', v_user_record.name,
      'user_role', v_user_record.role,
      'previous_balance', v_current_balance,
      'adjustment_amount', p_amount,
      'new_balance', v_new_balance,
      'reason', p_reason,
      'transaction_id', v_transaction_id,
      'admin_id', v_admin_id
    )
  );
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'user_email', v_user_record.email,
    'user_name', v_user_record.name,
    'user_role', v_user_record.role,
    'previous_balance', v_current_balance,
    'adjustment_amount', p_amount,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure response
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Create a function with a unique name for updating earnings by request ID
CREATE OR REPLACE FUNCTION update_earnings_by_request_id(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_id uuid;
  v_amount numeric;
  v_platform_fee numeric := 30; -- Hardcoded 30% platform fee
  v_fee_amount numeric;
  v_creator_amount numeric;
BEGIN
  -- Get request details
  SELECT 
    creator_id, 
    price
  INTO 
    v_creator_id, 
    v_amount
  FROM requests
  WHERE id = p_request_id;
  
  -- Verify request exists
  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request not found'
    );
  END IF;
  
  -- Round the amount to 2 decimal places
  v_amount := ROUND(v_amount::numeric, 2);
  
  -- Calculate fee and creator amounts with proper rounding
  v_fee_amount := ROUND((v_amount * v_platform_fee / 100)::numeric, 2);
  v_creator_amount := ROUND((v_amount - v_fee_amount)::numeric, 2);
  
  -- Create or update earnings record
  INSERT INTO earnings (
    creator_id,
    request_id,
    amount,
    status
  ) VALUES (
    v_creator_id,
    p_request_id,
    v_creator_amount,
    'completed'
  )
  ON CONFLICT (request_id) 
  DO UPDATE SET
    amount = v_creator_amount,
    status = 'completed';
  
  -- Log the earnings update
  INSERT INTO audit_logs (
    action,
    entity,
    entity_id,
    user_id,
    details
  ) VALUES (
    'update_earnings',
    'requests',
    p_request_id,
    v_creator_id,
    jsonb_build_object(
      'total_amount', v_amount,
      'platform_fee_percentage', v_platform_fee,
      'platform_fee_amount', v_fee_amount,
      'creator_amount', v_creator_amount,
      'creator_id', v_creator_id,
      'request_id', p_request_id
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'creator_id', v_creator_id,
    'request_id', p_request_id,
    'amount', v_creator_amount
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_request_payment TO authenticated;
GRANT EXECUTE ON FUNCTION update_earnings_on_completion_trigger_func TO authenticated;
GRANT EXECUTE ON FUNCTION complete_request_and_pay_creator TO authenticated;
GRANT EXECUTE ON FUNCTION admin_adjust_user_balance TO authenticated;
GRANT EXECUTE ON FUNCTION update_earnings_by_request_id TO authenticated;
