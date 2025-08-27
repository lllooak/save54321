/*
  # Fix Video Ads RLS Policies

  1. Changes
    - Drop existing policies to avoid conflicts
    - Create new comprehensive policies for video ads
    - Ensure proper authentication checks
  
  2. Security
    - Maintain RLS enabled
    - Ensure proper access control for creators
    - Allow public viewing of active ads
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Creators can manage their own ads" ON video_ads;
DROP POLICY IF EXISTS "Public can view active ads" ON video_ads;
DROP POLICY IF EXISTS "Creators can view all their ads" ON video_ads;

-- Create new policies with proper authentication checks
CREATE POLICY "Creators can manage their own ads"
ON video_ads
FOR ALL
TO authenticated
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Public can view active ads"
ON video_ads
FOR SELECT
TO authenticated
USING (active = true);

CREATE POLICY "Creators can view their own ads"
ON video_ads
FOR SELECT
TO authenticated
USING (auth.uid() = creator_id);

-- Ensure RLS is enabled
ALTER TABLE video_ads ENABLE ROW LEVEL SECURITY;
