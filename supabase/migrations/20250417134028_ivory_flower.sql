-- Ensure platform_config table has the necessary columns
ALTER TABLE platform_config
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_platform_config_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_platform_config_timestamp
  BEFORE UPDATE ON platform_config
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_config_timestamp();

-- Add or update site configuration defaults
INSERT INTO platform_config (key, value)
VALUES (
  'site_config',
  jsonb_build_object(
    'site_name', 'Mystar.co.il',
    'site_name_hebrew', 'מיי סטאר',
    'logo_url', '',
    'favicon_url', '/vite.svg',
    'meta_description', 'Get personalized videos from your favorite creators',
    'meta_keywords', ARRAY['personalized videos', 'creator content', 'custom messages', 'video greetings'],
    'og_image', '',
    'og_title', 'Mystar.co.il - מיי סטאר',
    'og_description', 'Get personalized videos from your favorite creators',
    'google_analytics_id', ''
  )
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value
WHERE platform_config.key = 'site_config';
