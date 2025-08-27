-- Fix withdrawal admin function to work with existing data
-- Run this in Supabase SQL Editor

-- Create working admin_get_withdrawal_requests function
CREATE OR REPLACE FUNCTION admin_get_withdrawal_requests(
  p_status_filter text DEFAULT 'all',
  p_search_query text DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  creator_id uuid,
  amount numeric,
  method text,
  paypal_email text,
  bank_details text,
  status text,
  created_at timestamp with time zone,
  processed_at timestamp with time zone,
  creator_name text,
  creator_email text,
  creator_avatar_url text
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Return data with LEFT JOINs to handle missing users gracefully
  RETURN QUERY 
  SELECT 
    wr.id,
    wr.creator_id,
    wr.amount,
    wr.method,
    wr.paypal_email,
    wr.bank_details,
    wr.status,
    wr.created_at,
    wr.processed_at,
    COALESCE(u.name, u.email, 'Unknown User') as creator_name,
    COALESCE(u.email, 'no-email@example.com') as creator_email,
    ''::text as creator_avatar_url
  FROM withdrawal_requests wr
  LEFT JOIN users u ON wr.creator_id = u.id
  WHERE 
    (p_status_filter = 'all' OR wr.status = p_status_filter)
  ORDER BY wr.created_at DESC;
END;
$$;

-- Replace admin_update_withdrawal_status to not use audit_logs
CREATE OR REPLACE FUNCTION admin_update_withdrawal_status(
  p_withdrawal_id uuid,
  p_new_status text
)
RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  admin_user_id uuid;
  withdrawal_record record;
  creator_balance numeric;
BEGIN
  -- Check if user is admin
  SELECT id INTO admin_user_id FROM users 
  WHERE id = auth.uid() AND role = 'admin';
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Validate status
  IF p_new_status NOT IN ('completed', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status. Must be completed or rejected';
  END IF;
  
  -- Get withdrawal details
  SELECT * INTO withdrawal_record
  FROM withdrawal_requests
  WHERE id = p_withdrawal_id AND status = 'pending';
  
  IF withdrawal_record IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;
  
  -- If rejecting, add the amount back to creator's balance
  IF p_new_status = 'rejected' THEN
    -- Get current creator balance
    SELECT COALESCE(wallet_balance, 0) INTO creator_balance
    FROM users WHERE id = withdrawal_record.creator_id;
    
    -- Add back the withdrawal amount
    UPDATE users 
    SET wallet_balance = creator_balance + withdrawal_record.amount,
        updated_at = NOW()
    WHERE id = withdrawal_record.creator_id;
    
    -- Create a transaction record for the refund
    INSERT INTO wallet_transactions (
      user_id, type, amount, payment_method, payment_status, description
    ) VALUES (
      withdrawal_record.creator_id,
      'refund',
      withdrawal_record.amount,
      'platform',
      'completed',
      'החזר עקב דחיית בקשת משיכה'
    );
  END IF;
  
  -- Update withdrawal status
  UPDATE withdrawal_requests 
  SET 
    status = p_new_status,
    processed_at = NOW()
  WHERE id = p_withdrawal_id;
  
  -- Skip audit_logs insert for now
  
  RETURN jsonb_build_object(
    'success', true, 
    'withdrawal_id', p_withdrawal_id,
    'status', p_new_status,
    'processed_at', NOW()
  );
END;
$$;

SELECT 'Admin withdrawal functions updated to work without audit_logs' as result;
