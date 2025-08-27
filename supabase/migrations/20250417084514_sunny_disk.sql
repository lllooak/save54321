/*
  # Fix Video Ads RLS Policies

  1. Changes
    - Drop all existing policies to avoid conflicts
    - Create new comprehensive policies with proper auth checks
    - Ensure proper access control for creators and viewers
  
  2. Security
    - Maintain RLS enabled
    - Ensure proper authentication checks using auth.uid()
    - Allow public viewing of active ads
*/

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Creators can manage their own ads" ON video_ads;
DROP POLICY IF EXISTS "Public can view active ads" ON video_ads;
DROP POLICY IF EXISTS "Creators can view their own ads" ON video_ads;
DROP POLICY IF EXISTS "Creators can view all their ads" ON video_ads;

-- Create new comprehensive policies
CREATE POLICY "creators_manage_own_ads"
ON video_ads
FOR ALL 
TO authenticated
USING (
  auth.uid() = creator_id
)
WITH CHECK (
  auth.uid() = creator_id
);

CREATE POLICY "view_active_ads"
ON video_ads
FOR SELECT
TO authenticated
USING (
  active = true OR auth.uid() = creator_id
);

-- Ensure RLS is enabled
ALTER TABLE video_ads ENABLE ROW LEVEL SECURITY;
