/*
  # Create storage bucket for video thumbnails

  1. Changes
    - Create a new storage bucket for video thumbnails
    - Set appropriate permissions for creators to upload images
    - Allow public access to view thumbnails

  2. Security
    - Enable RLS on storage.objects
    - Add policies for creators to upload and manage their thumbnails
    - Allow public access to view thumbnails
*/

-- Create storage bucket for video thumbnails if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('video-thumbnails', 'video-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Add policy for creators to upload thumbnails
CREATE POLICY "Creators can upload video thumbnails"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'video-thumbnails' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Add policy for creators to manage their thumbnails
CREATE POLICY "Creators can manage their thumbnails"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'video-thumbnails' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Add policy for public access to thumbnails
CREATE POLICY "Public can view video thumbnails"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'video-thumbnails'
);
