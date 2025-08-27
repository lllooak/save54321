/*
  # Set up request videos storage bucket and policies

  1. Changes
    - Create storage bucket for request videos
    - Add RLS policies for video uploads and access if they don't exist
    
  2. Security
    - Enable RLS on storage bucket
    - Add policies for creators to upload videos
    - Add policies for fans to view videos
*/

-- Create the storage bucket if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('request-videos', 'request-videos', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Check if policies exist before creating them
DO $$
DECLARE
  policy_exists boolean;
BEGIN
  -- Check for creator upload policy
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Creators can upload videos for their requests' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF NOT policy_exists THEN
    -- Policy for creators to upload videos for their requests
    EXECUTE 'CREATE POLICY "Creators can upload videos for their requests"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = ''request-videos'' AND
      EXISTS (
        SELECT 1 FROM requests r
        JOIN creator_profiles cp ON cp.id = r.creator_id
        WHERE 
          cp.id = auth.uid() AND
          r.id::text = split_part(storage.objects.name, ''/'', 1)
      )
    )';
  END IF;

  -- Check for creator read policy
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Creators can read their uploaded videos' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF NOT policy_exists THEN
    -- Policy for creators to read their uploaded videos
    EXECUTE 'CREATE POLICY "Creators can read their uploaded videos"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = ''request-videos'' AND
      EXISTS (
        SELECT 1 FROM requests r
        JOIN creator_profiles cp ON cp.id = r.creator_id
        WHERE 
          cp.id = auth.uid() AND
          r.id::text = split_part(storage.objects.name, ''/'', 1)
      )
    )';
  END IF;

  -- Check for fan view policy
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Fans can view their request videos' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF NOT policy_exists THEN
    -- Policy for fans to view videos for their requests
    EXECUTE 'CREATE POLICY "Fans can view their request videos"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = ''request-videos'' AND
      EXISTS (
        SELECT 1 FROM requests r
        WHERE 
          r.fan_id = auth.uid() AND
          r.id::text = split_part(storage.objects.name, ''/'', 1)
      )
    )';
  END IF;

  -- Check for admin policy
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Admins can manage all videos' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF NOT policy_exists THEN
    -- Policy for admins to manage all videos
    EXECUTE 'CREATE POLICY "Admins can manage all videos"
    ON storage.objects FOR ALL TO authenticated
    USING (
      bucket_id = ''request-videos'' AND
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid() AND users.role = ''admin''
      )
    )';
  END IF;
END $$;
