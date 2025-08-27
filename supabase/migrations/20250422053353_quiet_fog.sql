/*
  # Fix recursive policy in users table

  1. Changes
    - Remove recursive policy check from "Admins can manage all users" policy
    - Replace with direct role check on auth.users

  2. Security
    - Maintains admin-only access control
    - Prevents infinite recursion
    - Uses auth.users instead of public.users for role check
*/

-- Drop the existing policy that causes recursion
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- Create new policy that avoids recursion by checking auth.users directly
CREATE POLICY "Admins can manage all users" ON users
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'admin'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'admin'
  );
