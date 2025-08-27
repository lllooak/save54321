/*
  # Fix platform config RLS and initialization

  1. Changes
    - Drop and recreate RLS policies for platform_config table
    - Add proper initialization for featured_creators config
    - Add admin role check function for better reusability

  2. Security
    - Enable RLS on platform_config table
    - Add policy for admins to manage platform config
    - Add policy for authenticated users to read platform config
*/

-- Create admin check function for reusability
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- First ensure RLS is enabled
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Admins can manage platform config" ON platform_config;
DROP POLICY IF EXISTS "Authenticated users can read platform config" ON platform_config;

-- Create new policies using the admin check function
CREATE POLICY "Admins can manage platform config"
ON platform_config
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Add read-only policy for authenticated users
CREATE POLICY "Authenticated users can read platform config"
ON platform_config
FOR SELECT
TO authenticated
USING (true);

-- Ensure the featured_creators config exists with proper initialization
INSERT INTO platform_config (key, value)
VALUES ('featured_creators', '{"creator_ids": []}'::jsonb)
ON CONFLICT (key) 
DO UPDATE SET value = COALESCE(platform_config.value, '{"creator_ids": []}'::jsonb)
WHERE platform_config.key = 'featured_creators';
