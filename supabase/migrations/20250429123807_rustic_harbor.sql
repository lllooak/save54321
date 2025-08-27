-- Insert default categories if they don't exist
INSERT INTO platform_config (key, value)
VALUES (
  'categories',
  jsonb_build_object(
    'categories', jsonb_build_array(
      jsonb_build_object(
        'id', '1',
        'name', 'מוזיקאי',
        'icon', '🎵',
        'description', 'אמנים ומבצעים מוזיקליים',
        'order', 1,
        'active', true
      ),
      jsonb_build_object(
        'id', '2',
        'name', 'שחקן',
        'icon', '🎭',
        'description', 'שחקני קולנוע, טלוויזיה ותיאטרון',
        'order', 2,
        'active', true
      ),
      jsonb_build_object(
        'id', '3',
        'name', 'קומיקאי',
        'icon', '😂',
        'description', 'סטנדאפיסטים ובדרנים',
        'order', 3,
        'active', true
      ),
      jsonb_build_object(
        'id', '4',
        'name', 'ספורטאי',
        'icon', '⚽',
        'description', 'ספורטאים מקצועיים',
        'order', 4,
        'active', true
      ),
      jsonb_build_object(
        'id', '5',
        'name', 'משפיען',
        'icon', '📱',
        'description', 'יוצרי תוכן ברשתות חברתיות',
        'order', 5,
        'active', true
      ),
      jsonb_build_object(
        'id', '6',
        'name', 'אמן',
        'icon', '🎨',
        'description', 'אמנים ויוצרים',
        'order', 6,
        'active', true
      )
    )
  )
)
ON CONFLICT (key) 
DO UPDATE SET
  value = CASE 
    WHEN platform_config.value IS NULL OR platform_config.value->>'categories' IS NULL THEN 
      jsonb_build_object(
        'categories', jsonb_build_array(
          jsonb_build_object(
            'id', '1',
            'name', 'מוזיקאי',
            'icon', '🎵',
            'description', 'אמנים ומבצעים מוזיקליים',
            'order', 1,
            'active', true
          ),
          jsonb_build_object(
            'id', '2',
            'name', 'שחקן',
            'icon', '🎭',
            'description', 'שחקני קולנוע, טלוויזיה ותיאטרון',
            'order', 2,
            'active', true
          ),
          jsonb_build_object(
            'id', '3',
            'name', 'קומיקאי',
            'icon', '😂',
            'description', 'סטנדאפיסטים ובדרנים',
            'order', 3,
            'active', true
          ),
          jsonb_build_object(
            'id', '4',
            'name', 'ספורטאי',
            'icon', '⚽',
            'description', 'ספורטאים מקצועיים',
            'order', 4,
            'active', true
          ),
          jsonb_build_object(
            'id', '5',
            'name', 'משפיען',
            'icon', '📱',
            'description', 'יוצרי תוכן ברשתות חברתיות',
            'order', 5,
            'active', true
          ),
          jsonb_build_object(
            'id', '6',
            'name', 'אמן',
            'icon', '🎨',
            'description', 'אמנים ויוצרים',
            'order', 6,
            'active', true
          )
        )
      )
    ELSE platform_config.value
  END
WHERE platform_config.key = 'categories';

-- Log the change
INSERT INTO audit_logs (
  action,
  entity,
  entity_id,
  details
) VALUES (
  'add_default_categories',
  'platform_config',
  NULL,
  jsonb_build_object(
    'description', 'Added default categories configuration',
    'timestamp', now()
  )
);
