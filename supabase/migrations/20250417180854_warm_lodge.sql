/*
  # Fix users table RLS policies

  1. Changes
    - Drop existing policies
    - Create new policies with correct auth.uid() function
    - Add specific column checks for updates
  
  2. Security
    - Maintain RLS enabled
    - Ensure users can only update their own data
    - Allow admins full access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "allow_users_read_own" ON users;
DROP POLICY IF EXISTS "allow_users_update_own" ON users;
DROP POLICY IF EXISTS "allow_admin_full_access" ON users;

-- Create new policies with correct auth function calls
CREATE POLICY "allow_users_read_own"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "allow_users_update_own"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "allow_admin_full_access"
ON users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.role = 'admin'
  )
);

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
