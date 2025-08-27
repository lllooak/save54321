/*
  # Fix requests and creator_profiles relationship

  1. Changes
    - Drop existing foreign key if it exists
    - Create new foreign key relationship between requests.creator_id and creator_profiles.id

  2. Security
    - No changes to RLS policies
*/

DO $$ 
BEGIN
  -- Drop existing foreign key if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'requests_creator_id_fkey'
    AND table_schema = 'public'
    AND table_name = 'requests'
  ) THEN
    ALTER TABLE requests DROP CONSTRAINT requests_creator_id_fkey;
  END IF;

  -- Create new foreign key relationship
  ALTER TABLE requests
  ADD CONSTRAINT requests_creator_id_fkey
  FOREIGN KEY (creator_id)
  REFERENCES creator_profiles(id);
END $$;
