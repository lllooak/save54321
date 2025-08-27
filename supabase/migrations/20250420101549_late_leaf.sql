-- Create storage bucket for request videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('request-videos', 'request-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Add policy for creators to upload videos
CREATE POLICY "Creators can upload request videos"
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

-- Add video_url column to requests table
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS video_url text;
