/*
  # Disable RLS for video_ads table
  
  1. Changes
    - Disable row level security for video_ads table
    - Drop all existing policies
  
  2. Security
    - Removes all RLS restrictions
    - Allows full access to the table
*/

-- Drop existing policies
DROP POLICY IF EXISTS "creators_can_insert_own_ads" ON video_ads;
DROP POLICY IF EXISTS "creators_can_update_own_ads" ON video_ads;
DROP POLICY IF EXISTS "creators_can_delete_own_ads" ON video_ads;
DROP POLICY IF EXISTS "users_can_view_ads" ON video_ads;

-- Disable RLS
ALTER TABLE video_ads DISABLE ROW LEVEL SECURITY;
