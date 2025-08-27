-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('request-videos', 'request-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "request_videos_creator_upload" ON storage.objects;
DROP POLICY IF EXISTS "request_videos_creator_read" ON storage.objects;
DROP POLICY IF EXISTS "request_videos_fan_view" ON storage.objects;
DROP POLICY IF EXISTS "request_videos_admin_manage" ON storage.objects;
DROP POLICY IF EXISTS "request_videos_public_view" ON storage.objects;

-- Policy for creators to upload videos for their requests
CREATE POLICY "request_videos_creator_upload"
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
CREATE POLICY "request_videos_creator_read"
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
CREATE POLICY "request_videos_fan_view"
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
CREATE POLICY "request_videos_admin_manage"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'request-videos' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Add public access policy for request videos
CREATE POLICY "request_videos_public_view"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'request-videos'
);
