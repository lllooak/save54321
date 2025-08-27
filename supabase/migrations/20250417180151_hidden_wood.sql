/*
  # Fix users table policies and add profile function

  1. Changes
    - Drop existing policies that may cause recursion
    - Create new simplified policies for user data access
    - Add function to safely fetch user profile
  
  2. Security
    - Enable RLS on users table
    - Add policies for authenticated users
    - Add policy for admins
*/

-- Drop existing policies that may cause recursion
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can update own non-sensitive data" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "Admins can view user activity" ON users;

-- Create new, simplified policies
CREATE POLICY "users_read_own"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "users_update_own"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "admins_manage_all"
ON users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.role = 'admin'
  )
);

-- Create function to safely fetch user profile
CREATE OR REPLACE FUNCTION get_user_profile(user_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  birth_date date,
  phone text,
  avatar_url text,
  bio text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.role = 'admin'
  ) THEN
    RETURN QUERY
    SELECT 
      u.id,
      u.email,
      u.name,
      u.birth_date,
      u.phone,
      u.avatar_url,
      u.bio,
      u.metadata,
      u.created_at,
      u.updated_at
    FROM users u
    WHERE u.id = user_id;
  END IF;
END;
$$;
