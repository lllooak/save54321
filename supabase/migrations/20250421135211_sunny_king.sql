/*
  # Enable RLS on users table

  1. Changes
    - Enable Row Level Security on users table
    - Add policies for users to view and update their own data
    - Add policy for admins to manage all users
  
  2. Security
    - Ensures users can only access their own data
    - Allows admins full access to all user data
    - Prevents unauthorized access to user information
*/

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own data
CREATE POLICY "Users can view own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create policy for users to update their own data
CREATE POLICY "Users can update own data"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Create policy for admins to manage all users
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

-- Add index for better performance
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
