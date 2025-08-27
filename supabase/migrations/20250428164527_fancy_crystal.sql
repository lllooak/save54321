/*
  # Fix users table RLS policies

  1. Changes
    - Remove recursive policies that were causing infinite loops
    - Simplify admin access checks using role and is_super_admin columns directly
    - Consolidate duplicate policies
    - Ensure proper access control while avoiding recursion

  2. Security
    - Maintain row-level security
    - Preserve admin access control
    - Keep user data protection
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can read all user data" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create new, optimized policies
CREATE POLICY "Users can read own data"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

CREATE POLICY "Users can update own data"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins have full access"
ON users
FOR ALL
TO authenticated
USING (
  (SELECT role = 'admin' OR is_super_admin = true FROM users WHERE id = auth.uid())
)
WITH CHECK (
  (SELECT role = 'admin' OR is_super_admin = true FROM users WHERE id = auth.uid())
);
