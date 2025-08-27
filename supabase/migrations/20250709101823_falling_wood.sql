/*
  # Create wallet balance update function

  1. New Functions
    - `update_user_wallet_balance` - Safely updates user wallet balance
    - `get_user_wallet_balance` - Gets current user wallet balance

  2. Security
    - Functions use SECURITY DEFINER to bypass RLS
    - Input validation to prevent negative balances
    - Proper error handling
*/

-- Function to safely update user wallet balance
CREATE OR REPLACE FUNCTION update_user_wallet_balance(
  user_id UUID,
  amount_to_add NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate inputs
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  IF amount_to_add IS NULL OR amount_to_add <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Update the wallet balance
  UPDATE users 
  SET 
    wallet_balance = COALESCE(wallet_balance, 0) + amount_to_add,
    updated_at = now()
  WHERE id = user_id;
  
  -- Check if user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

-- Function to get user wallet balance
CREATE OR REPLACE FUNCTION get_user_wallet_balance(
  user_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  balance NUMERIC;
BEGIN
  -- Validate input
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;

  -- Get the wallet balance
  SELECT COALESCE(wallet_balance, 0) 
  INTO balance
  FROM users 
  WHERE id = user_id;
  
  -- Check if user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  RETURN balance;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION update_user_wallet_balance(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_wallet_balance(UUID) TO authenticated;

-- Grant execute permissions to service role for edge functions
GRANT EXECUTE ON FUNCTION update_user_wallet_balance(UUID, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_wallet_balance(UUID) TO service_role;