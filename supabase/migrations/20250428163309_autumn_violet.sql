-- Fix NULL values in auth.users table that cause schema errors
-- This migration addresses the error: "converting NULL to string is unsupported"

-- First, update any NULL confirmation_token values to empty strings
UPDATE auth.users
SET confirmation_token = ''
WHERE confirmation_token IS NULL;

-- Update any NULL email_change values to empty strings
UPDATE auth.users
SET email_change = ''
WHERE email_change IS NULL;

-- Update any other potentially problematic NULL string fields
UPDATE auth.users
SET phone_change = ''
WHERE phone_change IS NULL;

UPDATE auth.users
SET email_change_token_new = ''
WHERE email_change_token_new IS NULL;

UPDATE auth.users
SET email_change_token_current = ''
WHERE email_change_token_current IS NULL;

UPDATE auth.users
SET phone_change_token = ''
WHERE phone_change_token IS NULL;

UPDATE auth.users
SET recovery_token = ''
WHERE recovery_token IS NULL;

-- Create a function to handle NULL string values during authentication
CREATE OR REPLACE FUNCTION auth.handle_null_string_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Set all potentially NULL string fields to empty strings
  NEW.confirmation_token := COALESCE(NEW.confirmation_token, '');
  NEW.email_change := COALESCE(NEW.email_change, '');
  NEW.phone_change := COALESCE(NEW.phone_change, '');
  NEW.email_change_token_new := COALESCE(NEW.email_change_token_new, '');
  NEW.email_change_token_current := COALESCE(NEW.email_change_token_current, '');
  NEW.phone_change_token := COALESCE(NEW.phone_change_token, '');
  NEW.recovery_token := COALESCE(NEW.recovery_token, '');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to handle NULL string fields
DROP TRIGGER IF EXISTS handle_null_string_fields_trigger ON auth.users;
CREATE TRIGGER handle_null_string_fields_trigger
BEFORE INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auth.handle_null_string_fields();

-- Log the change
INSERT INTO audit_logs (
  action,
  entity,
  entity_id,
  details
) VALUES (
  'fix_auth_schema_errors',
  'auth.users',
  NULL,
  jsonb_build_object(
    'description', 'Fixed NULL string fields in auth.users table that were causing schema errors',
    'timestamp', now(),
    'fields_fixed', ARRAY['confirmation_token', 'email_change', 'phone_change', 'email_change_token_new', 'email_change_token_current', 'phone_change_token', 'recovery_token']
  )
);
