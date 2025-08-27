/*
  # Fix Video Ads RLS Policies

  1. Changes
    - Drop existing policies
    - Create new comprehensive policies for video ads
    - Ensure creators can manage their own ads
    - Allow public viewing of active ads
  
  2. Security
    - Maintain RLS enabled
    - Ensure proper access control
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Creators can manage their own ads" ON video_ads;
DROP POLICY IF EXISTS "Anyone can view active ads" ON video_ads;
DROP POLICY IF EXISTS "Creators can view all their own ads" ON video_ads;

-- Create new policies
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
