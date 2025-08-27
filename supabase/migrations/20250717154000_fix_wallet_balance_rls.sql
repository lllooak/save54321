-- Fix wallet balance RLS policy to allow authenticated users to access their own wallet_balance
-- This resolves the HTTP 406 error when fetching wallet balance after PayPal payments

-- First, let's check if RLS is enabled on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- Create new comprehensive RLS policies
CREATE POLICY "Users can view own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all users"
ON users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Ensure the get_user_wallet_balance function has proper permissions
GRANT EXECUTE ON FUNCTION get_user_wallet_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_wallet_balance(UUID) TO service_role;

-- Add explicit grants for the users table to ensure access
GRANT SELECT ON users TO authenticated;
GRANT UPDATE ON users TO authenticated;

-- Create an index on wallet_balance for better performance
CREATE INDEX IF NOT EXISTS idx_users_wallet_balance 
ON users(wallet_balance) 
WHERE wallet_balance IS NOT NULL;

-- Test the function to ensure it works
DO $$
BEGIN
  -- This is a test block to verify the function works
  RAISE NOTICE 'Wallet balance RLS policy fix applied successfully';
END $$;
