/*
  # Disable RLS for platform config table

  1. Changes
    - Disable RLS on platform_config table
    - Drop existing RLS policies
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage platform config" ON platform_config;
DROP POLICY IF EXISTS "Authenticated users can read platform config" ON platform_config;

-- Disable RLS
ALTER TABLE platform_config DISABLE ROW LEVEL SECURITY;
