/*
  # Fix requests table foreign key relationship

  1. Changes
    - Drop existing foreign key constraint that references public.users
    - Add new foreign key constraint that references auth.users
*/

-- Drop existing foreign key if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'requests_fan_id_fkey'
    AND table_schema = 'public'
    AND table_name = 'requests'
  ) THEN
    ALTER TABLE requests DROP CONSTRAINT requests_fan_id_fkey;
  END IF;
END $$;

-- Add new foreign key constraint referencing auth.users
ALTER TABLE requests
ADD CONSTRAINT requests_fan_id_fkey
FOREIGN KEY (fan_id) REFERENCES auth.users(id);
