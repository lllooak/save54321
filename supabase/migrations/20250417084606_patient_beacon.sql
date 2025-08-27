/*
  # Fix Video Ads RLS Policies

  1. Changes
    - Drop existing RLS policies on video_ads table
    - Create new, more specific policies for:
      - Creators managing their own ads
      - Users viewing active ads
      - Creators viewing their own inactive ads
  
  2. Security
    - Maintains row-level security
    - Ensures creators can only manage their own ads
    - Allows authenticated users to view active ads
    - Allows creators to view their own inactive ads
*/

-- Drop existing policies
DROP POLICY IF EXISTS "creators_manage_own_ads" ON video_ads;
DROP POLICY IF EXISTS "view_active_ads" ON video_ads;

-- Create new policies
CREATE POLICY "creators_can_insert_own_ads" 
ON video_ads FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "creators_can_update_own_ads" 
ON video_ads FOR UPDATE 
TO authenticated
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "creators_can_delete_own_ads" 
ON video_ads FOR DELETE 
TO authenticated
USING (auth.uid() = creator_id);

CREATE POLICY "users_can_view_active_ads" 
ON video_ads FOR SELECT 
TO authenticated
USING (
  active = true OR -- Anyone can view active ads
  auth.uid() = creator_id -- Creator can view their own ads (active or inactive)
);
