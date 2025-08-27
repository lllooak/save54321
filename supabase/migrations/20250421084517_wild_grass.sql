-- Create storage bucket for downloadable videos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('downloadable-videos', 'downloadable-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Creators can upload downloadable videos' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) THEN
    DROP POLICY "Creators can upload downloadable videos" ON storage.objects;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Creators can manage their uploaded videos' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) THEN
    DROP POLICY "Creators can manage their uploaded videos" ON storage.objects;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Fans can view and download their videos' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) THEN
    DROP POLICY "Fans can view and download their videos" ON storage.objects;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Public can access downloadable videos' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) THEN
    DROP POLICY "Public can access downloadable videos" ON storage.objects;
  END IF;
END $$;

-- Create new policies with unique names
CREATE POLICY "creators_upload_downloadable_videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'downloadable-videos' AND
  EXISTS (
    SELECT 1 FROM requests
    WHERE requests.id::text = (storage.foldername(name))[1]
    AND requests.creator_id = auth.uid()
  )
);

CREATE POLICY "creators_manage_uploaded_videos"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'downloadable-videos' AND
  EXISTS (
    SELECT 1 FROM requests
    WHERE requests.id::text = (storage.foldername(name))[1]
    AND requests.creator_id = auth.uid()
  )
);

CREATE POLICY "fans_view_download_videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'downloadable-videos' AND
  EXISTS (
    SELECT 1 FROM requests
    WHERE requests.id::text = (storage.foldername(name))[1]
    AND requests.fan_id = auth.uid()
  )
);

CREATE POLICY "public_access_downloadable_videos"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'downloadable-videos'
);
