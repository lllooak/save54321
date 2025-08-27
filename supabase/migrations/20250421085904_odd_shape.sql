-- Create storage bucket for request videos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('request-videos', 'request-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Creators can upload request videos" ON storage.objects;
DROP POLICY IF EXISTS "Fans can view their request videos" ON storage.objects;
DROP POLICY IF EXISTS "Creators can view their request videos" ON storage.objects;

-- Add policy for creators to upload and manage videos
CREATE POLICY "Creators can manage request videos"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'request-videos' AND
  EXISTS (
    SELECT 1 FROM requests
    WHERE requests.id::text = (storage.foldername(name))[1]
    AND requests.creator_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'request-videos' AND
  EXISTS (
    SELECT 1 FROM requests
    WHERE requests.id::text = (storage.foldername(name))[1]
    AND requests.creator_id = auth.uid()
  )
);

-- Add policy for fans to view their videos
CREATE POLICY "Fans can view their request videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'request-videos' AND
  EXISTS (
    SELECT 1 FROM requests
    WHERE requests.id::text = (storage.foldername(name))[1]
    AND requests.fan_id = auth.uid()
  )
);

-- Add video_url column to requests table if it doesn't exist
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS video_url text;
