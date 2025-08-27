/*
  # Add active column to creator_profiles table

  1. Changes
    - Add `active` boolean column to `creator_profiles` table with default value true
    - Update existing rows to have active=true
    - Add index on active column for better query performance

  2. Security
    - No changes to RLS policies needed as existing policies will cover the new column
*/

-- Add active column with default value true
ALTER TABLE creator_profiles 
ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- Create index for the active column
CREATE INDEX IF NOT EXISTS idx_creator_profiles_active 
ON creator_profiles(active);

-- Set all existing profiles to active
UPDATE creator_profiles 
SET active = true 
WHERE active IS NULL;
