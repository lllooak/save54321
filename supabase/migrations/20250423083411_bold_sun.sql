/*
  # Fix storage buckets for video uploads and downloads

  1. Changes
    - Create request-videos bucket if it doesn't exist
    - Set proper public access settings
    - Add RLS policies for creators and fans
  
  2. Security
    - Enable RLS on storage.objects
    - Add policies for creators to upload videos
    - Add policies for fans to view their videos
*/

-- Create request-videos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('request-videos', 'request-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
DECLARE
  policy_exists boolean;
BEGIN
  -- Check if policy exists before dropping
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'request_videos_insert_policy' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    DROP POLICY "request_videos_insert_policy" ON storage.objects;
  END IF;
  
  -- Check if policy exists before dropping
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'request_videos_select_policy' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    DROP POLICY "request_videos_select_policy" ON storage.objects;
  END IF;
END $$;

-- Create policies for request-videos bucket
CREATE POLICY "request_videos_insert_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'request-videos' AND
  EXISTS (
    SELECT 1 FROM requests
    WHERE requests.id::text = (storage.foldername(name))[1]
    AND requests.creator_id = auth.uid()
  )
);

CREATE POLICY "request_videos_select_policy"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'request-videos' AND
  (
    -- Creators can view their own uploads
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id::text = (storage.foldername(name))[1]
      AND requests.creator_id = auth.uid()
    )
    OR
    -- Fans can view videos for their requests
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id::text = (storage.foldername(name))[1]
      AND requests.fan_id = auth.uid()
    )
  )
);

-- Add policy for public access to request videos
CREATE POLICY "public_access_request_videos"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'request-videos'
);
