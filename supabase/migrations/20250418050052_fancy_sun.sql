-- Create function to get creator stats with default values
CREATE OR REPLACE FUNCTION get_creator_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'completedRequests', COALESCE((
      SELECT COUNT(*) 
      FROM requests 
      WHERE creator_id = auth.uid() AND status = 'completed'
    ), 0),
    'averageRating', COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM reviews 
      WHERE creator_id = auth.uid()
    ), 0),
    'totalEarnings', COALESCE((
      SELECT SUM(amount) 
      FROM earnings 
      WHERE creator_id = auth.uid() AND status = 'completed'
    ), 0)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_creator_stats() TO authenticated;
