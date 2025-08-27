-- Debug withdrawal creation - check if withdrawal requests are being inserted
-- Run this in Supabase SQL Editor after doing a withdrawal test

-- 1. Check if withdrawal request was inserted
SELECT 'Recent withdrawal requests in last hour:' as info;
SELECT 
  id,
  creator_id,
  amount,
  method,
  paypal_email,
  status,
  created_at,
  (created_at > NOW() - INTERVAL '1 hour') as is_recent
FROM withdrawal_requests 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Check wallet transactions for withdrawal
SELECT 'Recent withdrawal transactions:' as info;
SELECT 
  id,
  user_id,
  type,
  amount,
  description,
  created_at,
  (created_at > NOW() - INTERVAL '1 hour') as is_recent
FROM wallet_transactions 
WHERE type IN ('withdrawal', 'withdrawal_request', 'withdraw')
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Check creator wallet balance
SELECT 'Creator wallet balances:' as info;
SELECT 
  u.id,
  u.display_name,
  u.email,
  COALESCE(SUM(CASE WHEN wt.type = 'credit' THEN wt.amount ELSE -wt.amount END), 0) as wallet_balance
FROM users u
LEFT JOIN wallet_transactions wt ON u.id = wt.user_id
WHERE u.role = 'creator'
GROUP BY u.id, u.display_name, u.email
ORDER BY wallet_balance DESC
LIMIT 5;

-- 4. Now let's fix the admin function to return real data instead of empty results
CREATE OR REPLACE FUNCTION admin_get_withdrawal_requests(
  p_status_filter text DEFAULT 'all',
  p_search_query text DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  creator_id uuid,
  amount numeric,
  method text,
  paypal_email text,
  bank_details text,
  status text,
  created_at timestamp with time zone,
  processed_at timestamp with time zone,
  creator_name text,
  creator_email text,
  creator_avatar_url text
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wr.id,
    wr.creator_id,
    wr.amount,
    wr.method,
    wr.paypal_email,
    wr.bank_details,
    wr.status,
    wr.created_at,
    wr.processed_at,
    COALESCE(u.display_name, u.email) as creator_name,
    u.email as creator_email,
    u.avatar_url as creator_avatar_url
  FROM withdrawal_requests wr
  LEFT JOIN users u ON wr.creator_id = u.id
  WHERE 
    (p_status_filter = 'all' OR wr.status = p_status_filter)
    AND (
      p_search_query = '' 
      OR u.display_name ILIKE '%' || p_search_query || '%'
      OR u.email ILIKE '%' || p_search_query || '%'
    )
  ORDER BY wr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_withdrawal_requests TO authenticated;

SELECT 'Admin function updated to return real data' as result;
