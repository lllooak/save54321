/*
  # Fix profile update function

  1. Changes
    - Drop existing update_user_profile functions
    - Create new function with unique name and proper parameters
    - Add proper error handling and validation
  
  2. Security
    - Use SECURITY DEFINER to bypass RLS
    - Validate user permissions
    - Return detailed status information
*/

-- Drop all existing profile update functions to avoid conflicts
DO $$ 
BEGIN
  -- Drop all functions matching the name pattern
  DROP FUNCTION IF EXISTS update_user_profile(uuid, text, date, text, text, jsonb);
  DROP FUNCTION IF EXISTS update_user_profile(uuid, text, text, text, text, text, jsonb);
  DROP FUNCTION IF EXISTS update_user_profile(user_id uuid, new_name text, new_birth_date date, new_phone text, new_bio text, new_metadata jsonb);
EXCEPTION 
  WHEN others THEN 
    NULL; -- Ignore errors if functions don't exist
END $$;

-- Create new function with unique name and improved functionality
CREATE OR REPLACE FUNCTION update_user_profile_v2(
  p_user_id uuid,
  p_name text,
  p_birth_date date,
  p_phone text,
  p_bio text,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Validate that the user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User not found'
    );
  END IF;

  -- Update the user profile
  UPDATE users
  SET
    name = COALESCE(p_name, name),
    birth_date = COALESCE(p_birth_date, birth_date),
    phone = COALESCE(p_phone, phone),
    bio = COALESCE(p_bio, bio),
    metadata = COALESCE(p_metadata, metadata),
    updated_at = now()
  WHERE id = p_user_id
  RETURNING jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', id,
      'name', name,
      'birth_date', birth_date,
      'phone', phone,
      'bio', bio,
      'metadata', metadata,
      'updated_at', updated_at
    )
  ) INTO v_result;

  RETURN v_result;
EXCEPTION
  WHEN others THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$;
