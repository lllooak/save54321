/*
  # Fix video ads relationship with creator profiles

  1. Changes
    - Add foreign key constraint from video_ads.creator_id to creator_profiles.id
    - Update video_ads RLS policies to allow proper access

  2. Security
    - Enable RLS on video_ads table
    - Add policy for public viewing of active video ads
    - Add policy for creators to manage their own video ads
*/

-- Enable RLS on video_ads table if not already enabled
ALTER TABLE video_ads ENABLE ROW LEVEL SECURITY;

-- Drop existing foreign key if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'video_ads_creator_id_fkey' 
    AND table_name = 'video_ads'
  ) THEN
    ALTER TABLE video_ads DROP CONSTRAINT video_ads_creator_id_fkey;
  END IF;
END $$;

-- Add correct foreign key constraint
ALTER TABLE video_ads
ADD CONSTRAINT video_ads_creator_id_fkey
FOREIGN KEY (creator_id) REFERENCES creator_profiles(id);

-- Add RLS policies
CREATE POLICY "Anyone can view active video ads"
ON video_ads
FOR SELECT
TO public
USING (active = true);

CREATE POLICY "Creators can manage their own video ads"
ON video_ads
FOR ALL
TO authenticated
USING (creator_id = auth.uid())
WITH CHECK (creator_id = auth.uid());
