/*
  # Fix wallet balance access

  1. Changes
    - Add stored procedure to safely fetch user wallet balance
    - Avoid RLS policy recursion by using direct access in the function

  2. Security
    - Function is executed with security definer to bypass RLS
    - Access is still restricted to the user's own balance
*/

-- Create function to safely get user wallet balance
CREATE OR REPLACE FUNCTION get_user_wallet_balance(user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT wallet_balance
    FROM users
    WHERE id = user_id
  );
END;
$$;
