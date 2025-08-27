/*
  # Fix infinite recursion in users table RLS policies

  1. Changes
    - Drop existing RLS policies on users table that cause recursion
    - Create new policies that avoid self-referencing
    - Use direct auth.uid() checks instead of subqueries that reference the users table
  
  2. Security
    - Maintain same level of access control
    - Prevent infinite recursion errors
    - Ensure proper user data protection
*/

-- First disable RLS to ensure we can modify policies
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on users table
DO $$ 
BEGIN
  -- Drop all policies on the users table to start fresh
  DROP POLICY IF EXISTS "Users can read own data" ON users;
  DROP POLICY IF EXISTS "Users can update own data" ON users;
  DROP POLICY IF EXISTS "Admins can read all user data" ON users;
  DROP POLICY IF EXISTS "Admins can manage all users" ON users;
  DROP POLICY IF EXISTS "allow_users_read_own" ON users;
  DROP POLICY IF EXISTS "allow_users_update_own" ON users;
  DROP POLICY IF EXISTS "allow_admin_full_access" ON users;
END $$;

-- Enable RLS again
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create new policies that avoid recursion
-- Policy for users to view their own data
CREATE POLICY "users_view_own"
ON users
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Policy for users to update their own data
CREATE POLICY "users_update_own"
ON users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy for admins to view all users
-- This uses a direct JWT check instead of querying the users table
CREATE POLICY "admins_view_all"
ON users
FOR SELECT
TO authenticated
USING (
  -- Check if user has admin role in JWT claims
  (auth.jwt() ->> 'role' = 'admin') OR
  -- Or check if user is a super admin
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'is_super_admin' = 'true'
  )
);

-- Policy for admins to manage all users
-- This uses a direct JWT check instead of querying the users table
CREATE POLICY "admins_manage_all"
ON users
FOR ALL
TO authenticated
USING (
  -- Check if user has admin role in JWT claims
  (auth.jwt() ->> 'role' = 'admin') OR
  -- Or check if user is a super admin
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'is_super_admin' = 'true'
  )
);

-- Log the change
INSERT INTO audit_logs (
  action,
  entity,
  entity_id,
  details
) VALUES (
  'fix_users_rls_recursion',
  'users',
  NULL,
  jsonb_build_object(
    'description', 'Fixed infinite recursion in users table RLS policies',
    'timestamp', now()
  )
);
