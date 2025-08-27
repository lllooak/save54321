/*
  # Fix Video Ads RLS Policies

  1. Changes
    - Add new RLS policy to allow creators to view all their own video ads (both active and inactive)
    - Keep existing policies intact
  
  2. Security
    - Maintains existing RLS policies
    - Adds specific policy for creators to view their own ads
    - Ensures creators can only see their own ads in the dashboard
*/

-- Add policy for creators to view their own ads (both active and inactive)
CREATE POLICY "Creators can view all their own ads"
ON video_ads
FOR SELECT
TO authenticated
USING (creator_id = auth.uid());
