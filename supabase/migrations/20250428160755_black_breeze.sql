/*
  # Fix users table RLS and policies

  1. Changes
    - Enable RLS on users table
    - Add policies for user authentication
    - Add policies for admin access

  2. Security
    - Enable RLS on users table
    - Add policy for users to read their own data
    - Add policy for admins to read all user data
*/

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Add policy for users to read their own data
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Add policy for admins to read all user data
CREATE POLICY "Admins can read all user data"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users AS u
      WHERE u.id = auth.uid()
      AND (u.role = 'admin' OR u.is_super_admin = true)
    )
  );

-- Add policy for users to update their own data
CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
