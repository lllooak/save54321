-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage site assets" ON storage.objects;
DROP POLICY IF EXISTS "Public can read site assets" ON storage.objects;

-- Create site-assets bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy for admin management of site assets
CREATE POLICY "Admins can manage site assets"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'site-assets' AND
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'site-assets' AND
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.role = 'admin'
  )
);

-- Create policy for public read access to site assets
CREATE POLICY "Public can read site assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'site-assets');
