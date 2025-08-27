/*
  # Create creator-images bucket and fix storage permissions

  1. Changes
    - Create creator-images bucket for creator profile images
    - Add proper RLS policies for creator image uploads
    - Fix permissions for avatar and banner uploads
  
  2. Security
    - Enable RLS on storage.objects
    - Add policies for creators to manage their own images
    - Allow public access to view creator images
*/

-- Create creator-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('creator-images', 'creator-images', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies for creator-images bucket with unique names to avoid conflicts
DO $$ 
DECLARE
  policy_exists boolean;
BEGIN
  -- Check if policy exists before creating
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'creator_images_insert_policy' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF NOT policy_exists THEN
    CREATE POLICY "creator_images_insert_policy"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'creator-images' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
  
  -- Check if policy exists before creating
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'creator_images_all_policy' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF NOT policy_exists THEN
    CREATE POLICY "creator_images_all_policy"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
      bucket_id = 'creator-images' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
  
  -- Check if policy exists before creating
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'creator_images_select_policy' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) INTO policy_exists;
  
  IF NOT policy_exists THEN
    CREATE POLICY "creator_images_select_policy"
    ON storage.objects
    FOR SELECT
    TO public
    USING (
      bucket_id = 'creator-images'
    );
  END IF;
END $$;
