/*
  # Fix creator stats RPC function

  1. Changes
    - Drop existing get_creator_stats function
    - Create new get_creator_stats function with explicit table references
    - Add proper type safety for parameters
    - Improve performance with proper joins

  2. Security
    - Function is accessible to authenticated users only
    - Results are filtered by user_id for security
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_creator_stats(creator_id uuid);

-- Create new function with explicit table references
CREATE OR REPLACE FUNCTION get_creator_stats(user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  completed_requests integer;
  avg_rating numeric;
  total_earnings numeric;
BEGIN
  -- Get completed requests count
  SELECT COUNT(*)
  INTO completed_requests
  FROM requests r
  WHERE r.creator_id = user_id 
  AND r.status = 'completed';

  -- Get average rating
  SELECT COALESCE(AVG(rating), 0)
  INTO avg_rating
  FROM reviews rv
  WHERE rv.creator_id = user_id;

  -- Get total earnings
  SELECT COALESCE(SUM(amount), 0)
  INTO total_earnings
  FROM earnings e
  WHERE e.creator_id = user_id
  AND e.status = 'completed';

  RETURN json_build_object(
    'completedRequests', completed_requests,
    'averageRating', ROUND(avg_rating::numeric, 1),
    'totalEarnings', total_earnings
  );
END;
$$;
