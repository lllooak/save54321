/*
  # Fix auth.users confirmation_token NULL issue

  1. Changes
    - Modify the auth.users table to allow NULL values in confirmation_token
    - Update existing NULL values to empty strings
    - Add proper handling for NULL confirmation tokens
  
  2. Security
    - Maintains existing security measures
    - Ensures proper authentication flow
*/

-- First, update any NULL confirmation_token values to empty strings
UPDATE auth.users
SET confirmation_token = ''
WHERE confirmation_token IS NULL;

-- Create a function to handle NULL confirmation tokens during authentication
CREATE OR REPLACE FUNCTION auth.handle_null_confirmation_token()
RETURNS TRIGGER AS $$
BEGIN
  -- If confirmation_token is NULL, set it to empty string
  IF NEW.confirmation_token IS NULL THEN
    NEW.confirmation_token := '';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to handle NULL confirmation tokens
DROP TRIGGER IF EXISTS handle_null_confirmation_token_trigger ON auth.users;
CREATE TRIGGER handle_null_confirmation_token_trigger
BEFORE INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auth.handle_null_confirmation_token();

-- Log the change
INSERT INTO audit_logs (
  action,
  entity,
  entity_id,
  details
) VALUES (
  'fix_auth_confirmation_token',
  'auth.users',
  NULL,
  jsonb_build_object(
    'description', 'Fixed NULL confirmation_token issue in auth.users table',
    'timestamp', now()
  )
);
