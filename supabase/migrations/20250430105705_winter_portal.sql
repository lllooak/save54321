-- Create or replace function to get available withdrawal amount
CREATE OR REPLACE FUNCTION get_available_withdrawal_amount(p_creator_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_balance numeric;
  v_pending_withdrawals numeric;
BEGIN
  -- Get creator's current wallet balance
  SELECT wallet_balance INTO v_wallet_balance
  FROM users
  WHERE id = p_creator_id;
  
  -- Get sum of pending withdrawal requests
  SELECT COALESCE(SUM(amount), 0) INTO v_pending_withdrawals
  FROM withdrawal_requests
  WHERE creator_id = p_creator_id
  AND status = 'pending';
  
  -- Return available amount (wallet balance minus pending withdrawals)
  RETURN GREATEST(0, COALESCE(v_wallet_balance, 0) - COALESCE(v_pending_withdrawals, 0));
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_available_withdrawal_amount TO authenticated;
