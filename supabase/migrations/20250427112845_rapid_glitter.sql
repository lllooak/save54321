/*
  # Add metadata column to creator_profiles table

  1. Changes
    - Add `metadata` JSONB column to `creator_profiles` table with default empty object
    - Set default value to ensure backward compatibility
    - Make column nullable to avoid issues with existing records

  2. Security
    - No changes to RLS policies needed as this follows existing table permissions
*/

ALTER TABLE creator_profiles 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Update existing rows to have the default value
UPDATE creator_profiles 
SET metadata = '{}'::jsonb 
WHERE metadata IS NULL;
