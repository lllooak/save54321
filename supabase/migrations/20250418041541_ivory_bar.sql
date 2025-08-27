/*
  # Create get_creator_stats function

  1. New Function
    - `get_creator_stats`: Returns statistics for a creator
      - Input: creator_id (uuid)
      - Output: JSON object containing:
        - completedRequests (integer)
        - averageRating (numeric)
        - totalEarnings (numeric)

  2. Security
    - Function is accessible to authenticated users
    - Each creator can only view their own stats
*/

CREATE OR REPLACE FUNCTION public.get_creator_stats(creator_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  completed_requests integer;
  average_rating numeric;
  total_earnings numeric;
BEGIN
  -- Get number of completed requests
  SELECT COUNT(*)
  INTO completed_requests
  FROM requests
  WHERE creator_id = $1 
  AND status = 'completed';

  -- Get average rating
  SELECT COALESCE(AVG(rating), 0)
  INTO average_rating
  FROM reviews
  WHERE creator_id = $1;

  -- Get total earnings
  SELECT COALESCE(SUM(amount), 0)
  INTO total_earnings
  FROM earnings
  WHERE creator_id = $1 
  AND status = 'completed';

  -- Return stats as JSON
  RETURN json_build_object(
    'completedRequests', completed_requests,
    'averageRating', ROUND(average_rating::numeric, 1),
    'totalEarnings', total_earnings
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_creator_stats(uuid) TO authenticated;
