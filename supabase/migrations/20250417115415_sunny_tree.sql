/*
  # User Management Updates

  1. Changes
    - Add status and last_sign_in_at columns to users table
    - Add indexes for better query performance
    - Add check constraint for status values

  2. Security
    - Update RLS policies for user management
*/

-- Add new columns to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'::text,
ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;

-- Add check constraint for status if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_status_check 
    CHECK (status IN ('active', 'pending', 'banned'));
  END IF;
END $$;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS users_status_idx ON users(status);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users(created_at);

-- Update RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own non-sensitive data" ON users;

-- Recreate policies
CREATE POLICY "Admins can manage all users"
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

CREATE POLICY "Users can read own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own non-sensitive data"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  role IS NOT DISTINCT FROM (
    SELECT role FROM users WHERE id = auth.uid()
  )
);
