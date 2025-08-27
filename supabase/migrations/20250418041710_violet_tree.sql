/*
  # Fix creator stats function

  1. Changes
    - Drop existing function first
    - Recreate function with proper parameter name
    - Add security definer and proper permissions
*/

-- First drop the existing function
DROP FUNCTION IF EXISTS public.get_creator_stats(uuid);

-- Create new function with proper parameter name
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
  WHERE creator_id = creator_id 
  AND status = 'completed';

  -- Get average rating
  SELECT COALESCE(AVG(rating), 0)
  INTO average_rating
  FROM reviews
  WHERE creator_id = creator_id;

  -- Get total earnings
  SELECT COALESCE(SUM(amount), 0)
  INTO total_earnings
  FROM earnings
  WHERE creator_id = creator_id 
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
