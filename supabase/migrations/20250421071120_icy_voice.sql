-- Drop existing foreign key if it exists
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

  -- Drop existing foreign key if it exists
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

-- Add foreign key constraints
ALTER TABLE requests
ADD CONSTRAINT requests_creator_id_fkey
FOREIGN KEY (creator_id)
REFERENCES creator_profiles(id);

ALTER TABLE requests
ADD CONSTRAINT requests_fan_id_fkey
FOREIGN KEY (fan_id)
REFERENCES auth.users(id);

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Fans can view their requests" ON requests;
  DROP POLICY IF EXISTS "Creators can view and manage their requests" ON requests;
EXCEPTION
  WHEN undefined_object THEN 
    NULL;
END $$;

-- Add policies for fans to view their requests
CREATE POLICY "Fans can view their requests"
ON requests
FOR SELECT
TO authenticated
USING (fan_id = auth.uid());

-- Add policy for creators to view and manage requests assigned to them
CREATE POLICY "Creators can view and manage their requests"
ON requests
FOR ALL
TO authenticated
USING (creator_id = auth.uid())
WITH CHECK (creator_id = auth.uid());

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS requests_fan_id_idx ON requests(fan_id);
CREATE INDEX IF NOT EXISTS requests_creator_id_idx ON requests(creator_id);
CREATE INDEX IF NOT EXISTS requests_status_idx ON requests(status);
CREATE INDEX IF NOT EXISTS requests_created_at_idx ON requests(created_at);
