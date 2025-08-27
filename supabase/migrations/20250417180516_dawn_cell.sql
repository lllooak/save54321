/*
  # Fix users table RLS policies

  1. Changes
    - Drop existing policies
    - Create simplified RLS policies without NEW/OLD references
    - Add RPC function for profile updates
  
  2. Security
    - Maintain RLS protection
    - Allow users to read and update their own profiles
    - Allow admins full access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "allow_read_own_user" ON users;
DROP POLICY IF EXISTS "allow_update_own_user" ON users;
DROP POLICY IF EXISTS "allow_admin_all" ON users;

-- Create simplified policies
CREATE POLICY "allow_users_read_own"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "allow_users_update_own"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "allow_admin_full_access"
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

-- Create function for safe profile updates
CREATE OR REPLACE FUNCTION update_user_profile(
  p_user_id uuid,
  p_name text DEFAULT NULL,
  p_birth_date date DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is updating their own profile
  IF auth.uid() = p_user_id THEN
    UPDATE users
    SET
      name = COALESCE(p_name, name),
      birth_date = COALESCE(p_birth_date, birth_date),
      phone = COALESCE(p_phone, phone),
      bio = COALESCE(p_bio, bio),
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      metadata = COALESCE(p_metadata, metadata),
      updated_at = now()
    WHERE id = p_user_id;
    RETURN FOUND;
  END IF;
  RETURN false;
END;
$$;
