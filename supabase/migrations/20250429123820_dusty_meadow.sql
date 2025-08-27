-- Update creator profiles with missing or invalid categories
UPDATE creator_profiles
SET 
  category = CASE 
    WHEN category IS NULL OR category = '' THEN 'musician'
    WHEN category NOT IN ('musician', 'actor', 'comedian', 'athlete', 'influencer', 'artist') THEN
      CASE 
        WHEN LOWER(category) LIKE '%music%' OR LOWER(category) LIKE '%sing%' OR LOWER(category) LIKE '%מוזיק%' THEN 'musician'
        WHEN LOWER(category) LIKE '%act%' OR LOWER(category) LIKE '%שחק%' THEN 'actor'
        WHEN LOWER(category) LIKE '%comed%' OR LOWER(category) LIKE '%funny%' OR LOWER(category) LIKE '%קומיק%' THEN 'comedian'
        WHEN LOWER(category) LIKE '%sport%' OR LOWER(category) LIKE '%athlet%' OR LOWER(category) LIKE '%ספורט%' THEN 'athlete'
        WHEN LOWER(category) LIKE '%influenc%' OR LOWER(category) LIKE '%social%' OR LOWER(category) LIKE '%משפיע%' THEN 'influencer'
        WHEN LOWER(category) LIKE '%art%' OR LOWER(category) LIKE '%אמן%' THEN 'artist'
        ELSE 'musician' -- Default to musician if no match
      END
    ELSE category
  END,
  updated_at = NOW()
WHERE 
  category IS NULL OR 
  category = '' OR 
  category NOT IN ('musician', 'actor', 'comedian', 'athlete', 'influencer', 'artist');

-- Log the change
INSERT INTO audit_logs (
  action,
  entity,
  entity_id,
  details
) VALUES (
  'update_creator_categories',
  'creator_profiles',
  NULL,
  jsonb_build_object(
    'description', 'Updated creator profiles to have valid categories',
    'timestamp', now()
  )
);
