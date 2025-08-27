/*
  # Fix Video Ads RLS Policies

  1. Changes
    - Drop existing policies
    - Create new comprehensive policies for video ads
    - Ensure creators can manage their own ads
    - Allow public viewing of active ads
    - Add creator-specific view policy
  
  2. Security
    - Maintain RLS enabled
    - Ensure proper access control
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Creators can manage their own ads" ON video_ads;
DROP POLICY IF EXISTS "Public can view active ads" ON video_ads;
DROP POLICY IF EXISTS "Creators can view all their ads" ON video_ads;

-- Create new policies with proper permissions
CREATE POLICY "Creators can manage their own ads"
ON video_ads
FOR ALL
TO authenticated
USING (creator_id = auth.uid())
WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Public can view active ads"
ON video_ads
FOR SELECT
TO authenticated
USING (active = true);

CREATE POLICY "Creators can view all their ads"
ON video_ads
FOR SELECT
TO authenticated
USING (creator_id = auth.uid());

-- Ensure RLS is enabled
ALTER TABLE video_ads ENABLE ROW LEVEL SECURITY;
