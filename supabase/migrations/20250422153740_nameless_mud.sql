/*
  # Update earnings functions and avoid duplicate triggers

  1. Changes
    - Create or replace function to update earnings when a request is completed
    - Create RPC function to call from client
    - Drop existing trigger before creating a new one
  
  2. Security
    - Function is executed with security definer to bypass RLS
    - Ensures proper earnings calculation and recording
*/

-- Create function to update earnings when a request is completed
CREATE OR REPLACE FUNCTION update_earnings_on_completion()
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
    
    -- Calculate fee and creator amounts
    v_fee_amount := (v_amount * v_platform_fee / 100)::numeric(10,2);
    v_creator_amount := (v_amount - v_fee_amount)::numeric(10,2);
    
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
    RAISE WARNING 'Error in update_earnings_on_completion: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create RPC function to call from client
CREATE OR REPLACE FUNCTION update_earnings_on_completion(p_request_id uuid)
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
  
  -- Calculate fee and creator amounts
  v_fee_amount := (v_amount * v_platform_fee / 100)::numeric(10,2);
  v_creator_amount := (v_amount - v_fee_amount)::numeric(10,2);
  
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_earnings_on_completion_trigger ON requests;

-- Create trigger to automatically update earnings when request is completed
CREATE TRIGGER update_earnings_on_completion_trigger
AFTER UPDATE OF status ON requests
FOR EACH ROW
WHEN ((NEW.status = 'completed') AND (OLD.status <> 'completed'))
EXECUTE FUNCTION update_earnings_on_completion();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_earnings_on_completion(uuid) TO authenticated;
