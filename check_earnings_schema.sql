-- Check earnings table schema

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'earnings'
ORDER BY ordinal_position;
