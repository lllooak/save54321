/*
  # Add RLS policies for video ads

  1. Changes
    - Add RLS policies for video_ads table to ensure creators can only:
      - View their own video ads
      - Create new video ads with their ID as creator_id
      - Update their own video ads
      - Delete their own video ads
    - Allow public access to view active video ads

  2. Security
    - Enable RLS on video_ads table
    - Add policies for CRUD operations
    - Ensure creators can only manage their own ads
*/

-- Enable RLS
ALTER TABLE video_ads ENABLE ROW LEVEL SECURITY;

-- Allow creators to select their own video ads
CREATE POLICY "Creators can view own video ads"
ON video_ads
FOR SELECT
TO authenticated
USING (creator_id = auth.uid());

-- Allow creators to insert new video ads
CREATE POLICY "Creators can create video ads"
ON video_ads
FOR INSERT
TO authenticated
WITH CHECK (creator_id = auth.uid());

-- Allow creators to update their own video ads
CREATE POLICY "Creators can update own video ads"
ON video_ads
FOR UPDATE
TO authenticated
USING (creator_id = auth.uid())
WITH CHECK (creator_id = auth.uid());

-- Allow creators to delete their own video ads
CREATE POLICY "Creators can delete own video ads"
ON video_ads
FOR DELETE
TO authenticated
USING (creator_id = auth.uid());

-- Allow public to view active video ads
CREATE POLICY "Public can view active video ads"
ON video_ads
FOR SELECT
TO public
USING (active = true);
