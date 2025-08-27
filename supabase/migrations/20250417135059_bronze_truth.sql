-- Create storage bucket for site assets if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('public', 'public')
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for site assets
CREATE POLICY "Admins can manage site assets"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'public' AND
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'public' AND
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.role = 'admin'
  )
);

-- Allow public read access to site assets
CREATE POLICY "Public can read site assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'public');
