/*
  # Fix users table permissions

  1. Changes
    - Drop existing policies
    - Create new simplified policies for user data access
    - Add policy for users to update their own profile data
  
  2. Security
    - Enable RLS on users table
    - Add policies for authenticated users
    - Add policy for admins
*/

-- Drop existing policies
DROP POLICY IF EXISTS "users_read_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "admins_manage_all" ON users;

-- Create new policies
CREATE POLICY "allow_read_own_user"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "allow_update_own_user"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "allow_admin_all"
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

-- Create function to safely update user profile
CREATE OR REPLACE FUNCTION update_user_profile(
  user_id uuid,
  new_name text DEFAULT NULL,
  new_birth_date date DEFAULT NULL,
  new_phone text DEFAULT NULL,
  new_bio text DEFAULT NULL,
  new_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = user_id THEN
    UPDATE users
    SET
      name = COALESCE(new_name, name),
      birth_date = COALESCE(new_birth_date, birth_date),
      phone = COALESCE(new_phone, phone),
      bio = COALESCE(new_bio, bio),
      metadata = COALESCE(new_metadata, metadata),
      updated_at = now()
    WHERE id = user_id;
  END IF;
END;
$$;
