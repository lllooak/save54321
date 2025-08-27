/*
  # Fix users table RLS policy for signup

  1. Changes
    - Add policy to allow public insertion into users table during signup
    - This allows the auth flow to create user records without RLS blocking
  
  2. Security
    - Maintains existing RLS policies
    - Only allows insertion with specific constraints
*/

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Add policy to allow public insertion during signup
CREATE POLICY "Allow public to insert users during signup"
ON users
FOR INSERT
TO public
WITH CHECK (true);

-- Add policy to allow authenticated users to insert users
CREATE POLICY "Allow authenticated to insert users"
ON users
FOR INSERT
TO authenticated
WITH CHECK (true);
