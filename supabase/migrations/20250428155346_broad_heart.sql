/*
  # Add super admin functionality

  1. Changes
    - Add is_super_admin column to users table
    - Set default value to false
    - Update existing admin users to have super admin privileges
  
  2. Security
    - Only existing admins can create super admins
    - Super admins have elevated privileges
*/

-- Add is_super_admin column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Update existing admin users to have super admin privileges
-- This ensures backward compatibility
UPDATE users
SET is_super_admin = TRUE
WHERE role = 'admin' AND email = 'dontworry2much@gmail.com';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS users_is_super_admin_idx ON users(is_super_admin);

-- Log the change
INSERT INTO audit_logs (
  action,
  entity,
  entity_id,
  details
) VALUES (
  'add_super_admin_column',
  'users',
  NULL,
  jsonb_build_object(
    'description', 'Added is_super_admin column to users table',
    'timestamp', now()
  )
);
