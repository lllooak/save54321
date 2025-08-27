/*
  # Create storage buckets for media files

  1. New Buckets
    - media-uploads: General bucket for all media uploads
    - profile-images: For user profile images
    - video-content: For video content uploads
    - thumbnails: For video thumbnails and preview images
  
  2. Security
    - Enable RLS on storage.objects
    - Add policies for authenticated users to manage their own files
    - Allow public access to view media where appropriate
*/

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('media-uploads', 'media-uploads', false),
  ('profile-images', 'profile-images', true),
  ('video-content', 'video-content', false),
  ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$ 
DECLARE
  policy_exists boolean;
BEGIN
  -- Check and drop policies for media-uploads bucket
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can upload their own media' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    DROP POLICY "Users can upload their own media" ON storage.objects;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can manage their own media' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    DROP POLICY "Users can manage their own media" ON storage.objects;
  END IF;
  
  -- Check and drop policies for profile-images bucket
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can upload their own profile images' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    DROP POLICY "Users can upload their own profile images" ON storage.objects;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can manage their own profile images' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    DROP POLICY "Users can manage their own profile images" ON storage.objects;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Anyone can view profile images' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    DROP POLICY "Anyone can view profile images" ON storage.objects;
  END IF;
  
  -- Check and drop policies for video-content bucket
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Creators can upload videos' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    DROP POLICY "Creators can upload videos" ON storage.objects;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Creators can manage their own videos' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    DROP POLICY "Creators can manage their own videos" ON storage.objects;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can view purchased videos' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    DROP POLICY "Users can view purchased videos" ON storage.objects;
  END IF;
  
  -- Check and drop policies for thumbnails bucket
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can upload thumbnails' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    DROP POLICY "Users can upload thumbnails" ON storage.objects;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can manage their own thumbnails' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    DROP POLICY "Users can manage their own thumbnails" ON storage.objects;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Anyone can view thumbnails' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    DROP POLICY "Anyone can view thumbnails" ON storage.objects;
  END IF;
END $$;

-- Create policies with unique names to avoid conflicts
CREATE POLICY "media_uploads_insert_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "media_uploads_all_policy"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'media-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policies for profile-images bucket
CREATE POLICY "profile_images_insert_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "profile_images_all_policy"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "profile_images_select_policy"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'profile-images'
);

-- Create policies for video-content bucket
CREATE POLICY "video_content_insert_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'video-content' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM creator_profiles
    WHERE creator_profiles.id = auth.uid()
  )
);

CREATE POLICY "video_content_all_policy"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'video-content' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM creator_profiles
    WHERE creator_profiles.id = auth.uid()
  )
);

CREATE POLICY "video_content_select_policy"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'video-content' AND
  EXISTS (
    SELECT 1 FROM requests
    WHERE requests.fan_id = auth.uid() AND
    requests.status = 'completed' AND
    requests.creator_id::text = (storage.foldername(name))[1]
  )
);

-- Create policies for thumbnails bucket
CREATE POLICY "thumbnails_insert_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'thumbnails' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "thumbnails_all_policy"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'thumbnails' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "thumbnails_select_policy"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'thumbnails'
);

-- Create helper function to get public URL for media
CREATE OR REPLACE FUNCTION get_public_url(bucket_id text, file_path text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_url text;
BEGIN
  -- Get the Supabase project URL from environment
  SELECT current_setting('app.settings.supabase_url', true) INTO base_url;
  
  -- If not available, use a default format
  IF base_url IS NULL THEN
    base_url := 'https://[project-ref].supabase.co';
  END IF;
  
  -- Return the constructed URL
  RETURN base_url || '/storage/v1/object/public/' || bucket_id || '/' || file_path;
END;
$$;
