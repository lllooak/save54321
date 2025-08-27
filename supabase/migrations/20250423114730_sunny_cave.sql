-- Create the storage bucket if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('request-videos', 'request-videos', true)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Fans can view their request videos' AND tablename = 'objects' AND schemaname = 'storage') THEN
    DROP POLICY "Fans can view their request videos" ON storage.objects;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Creators can upload request videos' AND tablename = 'objects' AND schemaname = 'storage') THEN
    DROP POLICY "Creators can upload request videos" ON storage.objects;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Creators can view their request videos' AND tablename = 'objects' AND schemaname = 'storage') THEN
    DROP POLICY "Creators can view their request videos" ON storage.objects;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all videos' AND tablename = 'objects' AND schemaname = 'storage') THEN
    DROP POLICY "Admins can manage all videos" ON storage.objects;
  END IF;
END $$;

-- Policy for creators to upload videos for their requests
CREATE POLICY "creators_upload_request_videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'request-videos' AND
  EXISTS (
    SELECT 1 FROM requests r
    JOIN creator_profiles cp ON cp.id = r.creator_id
    WHERE 
      cp.id = auth.uid() AND
      r.id::text = split_part(name, '/', 1)
  )
);

-- Policy for creators to read their uploaded videos
CREATE POLICY "creators_read_request_videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'request-videos' AND
  EXISTS (
    SELECT 1 FROM requests r
    JOIN creator_profiles cp ON cp.id = r.creator_id
    WHERE 
      cp.id = auth.uid() AND
      r.id::text = split_part(name, '/', 1)
  )
);

-- Policy for fans to view videos for their requests
CREATE POLICY "fans_view_request_videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'request-videos' AND
  EXISTS (
    SELECT 1 FROM requests r
    WHERE 
      r.fan_id = auth.uid() AND
      r.id::text = split_part(name, '/', 1)
  )
);

-- Policy for admins to manage all videos
CREATE POLICY "admins_manage_request_videos"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'request-videos' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Add public access policy for request videos
CREATE POLICY "public_view_request_videos"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'request-videos'
);
