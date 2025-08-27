/*
  # Update creator profiles with consistent categories

  1. Changes
    - Update creator_profiles with standardized category values
    - Map existing categories to the standard set
    - Ensure all creators have a valid category
  
  2. Security
    - No changes to RLS policies
*/

-- Update creator profiles with missing or invalid categories
UPDATE creator_profiles
SET 
  category = CASE 
    WHEN category IS NULL OR category = '' THEN 'musician'
    WHEN category NOT IN ('musician', 'actor', 'comedian', 'athlete', 'influencer', 'artist') THEN
      CASE 
        WHEN LOWER(category) LIKE '%music%' OR LOWER(category) LIKE '%sing%' OR LOWER(category) LIKE '%מוזיק%' OR LOWER(category) LIKE '%זמר%' THEN 'musician'
        WHEN LOWER(category) LIKE '%act%' OR LOWER(category) LIKE '%שחק%' OR LOWER(category) LIKE '%תיאטרון%' THEN 'actor'
        WHEN LOWER(category) LIKE '%comed%' OR LOWER(category) LIKE '%funny%' OR LOWER(category) LIKE '%קומיק%' OR LOWER(category) LIKE '%סטנדאפ%' THEN 'comedian'
        WHEN LOWER(category) LIKE '%sport%' OR LOWER(category) LIKE '%athlet%' OR LOWER(category) LIKE '%ספורט%' THEN 'athlete'
        WHEN LOWER(category) LIKE '%influenc%' OR LOWER(category) LIKE '%social%' OR LOWER(category) LIKE '%משפיע%' OR LOWER(category) LIKE '%רשת%' THEN 'influencer'
        WHEN LOWER(category) LIKE '%art%' OR LOWER(category) LIKE '%אמן%' OR LOWER(category) LIKE '%יצירה%' THEN 'artist'
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
