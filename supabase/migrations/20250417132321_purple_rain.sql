-- Add site_config to platform_config if it doesn't exist
INSERT INTO platform_config (key, value)
VALUES (
  'site_config',
  jsonb_build_object(
    'site_name', 'Mystar.co.il',
    'site_name_hebrew', 'מיי סטאר',
    'logo_url', '',
    'favicon_url', '',
    'meta_description', '',
    'meta_keywords', ARRAY[]::text[],
    'og_image', '',
    'og_title', '',
    'og_description', '',
    'google_analytics_id', ''
  )
)
ON CONFLICT (key) DO NOTHING;
