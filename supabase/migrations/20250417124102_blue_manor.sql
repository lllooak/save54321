/*
  # Fix platform config RLS policy

  1. Changes
    - Drop existing RLS policy for platform_config table
    - Create new RLS policy that properly checks for admin role
    - Ensure initial featured_creators config exists

  2. Security
    - Enable RLS on platform_config table
    - Add policy for admins to manage platform config
    - Add policy for authenticated users to read platform config
*/

-- First ensure RLS is enabled
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Admins can manage platform config" ON platform_config;

-- Create new policies
CREATE POLICY "Admins can manage platform config"
ON platform_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Add read-only policy for authenticated users
CREATE POLICY "Authenticated users can read platform config"
ON platform_config
FOR SELECT
TO authenticated
USING (true);

-- Ensure the featured_creators config exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM platform_config
    WHERE key = 'featured_creators'
  ) THEN
    INSERT INTO platform_config (key, value)
    VALUES ('featured_creators', '{"creator_ids": []}'::jsonb);
  END IF;
END $$;
