/*
  # Disable RLS on platform_config table

  1. Changes
    - Disable Row Level Security on platform_config table
    - Drop any existing RLS policies for clean state

  2. Security
    - Remove RLS restrictions to allow direct access to platform configuration
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage platform config" ON platform_config;
DROP POLICY IF EXISTS "Authenticated users can read platform config" ON platform_config;

-- Disable RLS on platform_config table
ALTER TABLE platform_config DISABLE ROW LEVEL SECURITY;
