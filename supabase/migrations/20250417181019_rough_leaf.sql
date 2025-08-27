/*
  # Disable RLS on users table
  
  1. Changes
    - Disable row level security for users table
    - Drop all existing policies
    - Create function for safe profile operations
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "allow_users_read_own" ON users;
DROP POLICY IF EXISTS "allow_users_update_own" ON users;
DROP POLICY IF EXISTS "allow_admin_full_access" ON users;

-- Disable RLS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Create function for safe profile operations
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
AS $$
BEGIN
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
END;
$$;
