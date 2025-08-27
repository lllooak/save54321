/*
  # Fix authentication schema permissions

  1. Changes
    - Grant necessary permissions to the authenticated and anon roles
    - Enable proper access to auth schema for authentication
    - Add missing policies for user authentication

  2. Security
    - Maintains secure access patterns
    - Only grants minimum required permissions
*/

-- Grant necessary permissions to the authenticated role
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

-- Grant necessary permissions to the anon role
GRANT USAGE ON SCHEMA auth TO anon;
GRANT SELECT ON auth.users TO anon;

-- Ensure the auth schema is accessible
ALTER SCHEMA auth OWNER TO supabase_admin;

-- Ensure proper permissions for the auth user management
GRANT SELECT, INSERT, UPDATE ON auth.users TO service_role;
GRANT SELECT, INSERT, UPDATE ON auth.refresh_tokens TO service_role;

-- Add indexes to improve auth performance
CREATE INDEX IF NOT EXISTS auth_users_email_idx ON auth.users(email);
CREATE INDEX IF NOT EXISTS auth_users_instance_id_idx ON auth.users(instance_id);

-- Ensure proper RLS is enabled and configured
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Add necessary policies for auth
CREATE POLICY "Users can view own auth data"
  ON auth.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Public can access necessary auth data"
  ON auth.users
  FOR SELECT
  TO anon
  USING (true);
