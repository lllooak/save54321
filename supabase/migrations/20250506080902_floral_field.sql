/*
  # Add recipient column to requests table

  1. Changes
     - Add a `recipient` column to the `requests` table to store information about who the video is for
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'recipient'
  ) THEN
    ALTER TABLE requests ADD COLUMN recipient text;
  END IF;
END $$;
