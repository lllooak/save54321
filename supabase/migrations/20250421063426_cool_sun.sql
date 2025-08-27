-- Create storage bucket for downloadable videos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('downloadable-videos', 'downloadable-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Add policy for fans to download their videos
CREATE POLICY "Fans can download their videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'downloadable-videos' AND
  EXISTS (
    SELECT 1 FROM requests
    WHERE requests.id::text = (storage.foldername(name))[1]
    AND requests.fan_id = auth.uid()
    AND requests.status = 'completed'
  )
);

-- Add policy for creators to upload downloadable videos
CREATE POLICY "Creators can upload downloadable videos"
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

-- Create function to generate downloadable video URL
CREATE OR REPLACE FUNCTION generate_downloadable_video_url(
  p_request_id uuid,
  p_video_url text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_download_url text;
  v_creator_id uuid;
  v_fan_id uuid;
BEGIN
  -- Get request details
  SELECT creator_id, fan_id
  INTO v_creator_id, v_fan_id
  FROM requests
  WHERE id = p_request_id;
  
  -- Verify request exists
  IF v_creator_id IS NULL OR v_fan_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  -- Verify caller is either the creator or the fan
  IF auth.uid() != v_creator_id AND auth.uid() != v_fan_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Return the original URL for now
  -- In a production environment, you might want to:
  -- 1. Copy the video to a downloadable bucket
  -- 2. Generate a signed URL with download headers
  -- 3. Track download attempts
  v_download_url := p_video_url;
  
  RETURN v_download_url;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_downloadable_video_url TO authenticated;
