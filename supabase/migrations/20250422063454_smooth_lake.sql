/*
  # Disable RLS for users table

  1. Changes
    - Disable Row Level Security for the users table
    - Drop existing policies to avoid conflicts
  
  2. Security
    - This will allow direct access to the users table without RLS restrictions
    - Use with caution as this removes access control at the database level
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Drop all policies on the users table
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND schemaname = 'public'
  ) THEN
    DROP POLICY IF EXISTS "Users can view own data" ON users;
    DROP POLICY IF EXISTS "Users can update own data" ON users;
    DROP POLICY IF EXISTS "Admins can manage all users" ON users;
    DROP POLICY IF EXISTS "Users can read own data" ON users;
    DROP POLICY IF EXISTS "Users can update own non-sensitive data" ON users;
    DROP POLICY IF EXISTS "Allow PayPal balance updates" ON users;
    DROP POLICY IF EXISTS "Allow public to insert users during signup" ON users;
    DROP POLICY IF EXISTS "Allow authenticated to insert users" ON users;
    DROP POLICY IF EXISTS "users_read_own" ON users;
    DROP POLICY IF EXISTS "users_update_own" ON users;
    DROP POLICY IF EXISTS "admins_manage_all" ON users;
    DROP POLICY IF EXISTS "allow_read_own_user" ON users;
    DROP POLICY IF EXISTS "allow_update_own_user" ON users;
    DROP POLICY IF EXISTS "allow_admin_all" ON users;
    DROP POLICY IF EXISTS "allow_users_read_own" ON users;
    DROP POLICY IF EXISTS "allow_users_update_own" ON users;
    DROP POLICY IF EXISTS "allow_admin_full_access" ON users;
  END IF;
END $$;

-- Disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Log the change
INSERT INTO audit_logs (
  action,
  entity,
  entity_id,
  details
) VALUES (
  'disable_rls',
  'users',
  NULL,
  jsonb_build_object(
    'table', 'users',
    'reason', 'Disabled RLS to fix authentication issues',
    'timestamp', now()
  )
);
