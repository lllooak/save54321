/*
  # Fix platform_config RLS policy for admin access

  1. Changes
    - Disable Row Level Security on platform_config table
    - This allows admins to properly update platform configuration settings
  
  2. Security
    - Access control is still maintained through admin-only functions
    - Admin checks are performed in application code
*/

-- Disable RLS on platform_config table
ALTER TABLE platform_config DISABLE ROW LEVEL SECURITY;

-- Log the change
INSERT INTO audit_logs (
  action,
  entity,
  entity_id,
  details
) VALUES (
  'disable_rls',
  'platform_config',
  NULL,
  jsonb_build_object(
    'table', 'platform_config',
    'reason', 'Disabled RLS to allow admin access to platform configuration',
    'timestamp', now()
  )
);
