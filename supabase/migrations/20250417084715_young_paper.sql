/*
  # Fix Video Ads RLS Policies

  1. Changes
    - Drop existing policies to avoid conflicts
    - Create separate policies for each operation type
    - Ensure proper authentication checks
    - Allow creators to manage their own ads
    - Allow viewing of active ads
  
  2. Security
    - Maintains row-level security
    - Ensures creators can only manage their own ads
    - Allows viewing of active ads by all authenticated users
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "creators_can_insert_own_ads" ON video_ads;
DROP POLICY IF EXISTS "creators_can_update_own_ads" ON video_ads;
DROP POLICY IF EXISTS "creators_can_delete_own_ads" ON video_ads;
DROP POLICY IF EXISTS "users_can_view_active_ads" ON video_ads;

-- Create separate policies for each operation
CREATE POLICY "creators_can_insert_own_ads"
ON video_ads FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = creator_id
);

CREATE POLICY "creators_can_update_own_ads"
ON video_ads FOR UPDATE
TO authenticated
USING (
  auth.uid() = creator_id
)
WITH CHECK (
  auth.uid() = creator_id
);

CREATE POLICY "creators_can_delete_own_ads"
ON video_ads FOR DELETE
TO authenticated
USING (
  auth.uid() = creator_id
);

CREATE POLICY "users_can_view_ads"
ON video_ads FOR SELECT
TO authenticated
USING (
  active = true OR -- Anyone can view active ads
  auth.uid() = creator_id -- Creator can view their own ads (active or inactive)
);

-- Ensure RLS is enabled
ALTER TABLE video_ads ENABLE ROW LEVEL SECURITY;
