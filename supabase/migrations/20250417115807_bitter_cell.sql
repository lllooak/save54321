/*
  # User Management System Update

  1. New Columns
    - Add audit columns to users table
    - Add additional user metadata columns
  
  2. Functions
    - Add function to track user activity
    - Add function to update user last seen
  
  3. Triggers
    - Add trigger for user activity tracking
    - Add trigger for last seen updates
*/

-- Add new columns for better user tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Create function to track user activity
CREATE OR REPLACE FUNCTION update_user_activity()
RETURNS trigger AS $$
BEGIN
  NEW.last_seen_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user activity
DROP TRIGGER IF EXISTS user_activity_trigger ON users;
CREATE TRIGGER user_activity_trigger
  BEFORE UPDATE ON users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION update_user_activity();

-- Create function to handle user authentication events
CREATE OR REPLACE FUNCTION handle_auth_user_activity()
RETURNS trigger AS $$
BEGIN
  -- Update login count and reset failed attempts on successful login
  IF TG_OP = 'UPDATE' AND NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE users
    SET 
      login_count = COALESCE(login_count, 0) + 1,
      failed_login_attempts = 0,
      last_seen_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auth events
DROP TRIGGER IF EXISTS auth_user_activity_trigger ON users;
CREATE TRIGGER auth_user_activity_trigger
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user_activity();

-- Add RLS policies for admin access to user activity data
CREATE POLICY "Admins can view user activity"
ON users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.role = 'admin'
  )
);
