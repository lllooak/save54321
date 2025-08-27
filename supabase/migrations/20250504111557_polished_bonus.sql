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
