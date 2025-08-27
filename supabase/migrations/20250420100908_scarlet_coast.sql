/*
  # Add insert policy for requests table

  1. Changes
    - Add new RLS policy to allow fans to create requests
    - Policy ensures fans can only create requests where they are the fan_id
    - Maintains security by preventing users from creating requests for other users

  2. Security
    - Only authenticated users can create requests
    - Users can only set themselves as the fan_id
    - Preserves existing policies for other operations
*/

-- Add policy to allow fans to create requests
CREATE POLICY "Fans can create requests"
  ON requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Ensure the fan_id matches the authenticated user's ID
    fan_id = auth.uid() AND
    -- Ensure request_type is not null
    request_type IS NOT NULL AND
    -- Ensure price is not null and positive
    price IS NOT NULL AND price > 0 AND
    -- Ensure deadline is not null and in the future
    deadline IS NOT NULL AND deadline > now()
  );
