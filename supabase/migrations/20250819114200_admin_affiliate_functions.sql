-- Create service role functions for affiliate management admin operations
-- These functions bypass RLS for admin users to manage affiliate data

-- Function to get all affiliate users with details
CREATE OR REPLACE FUNCTION admin_get_all_affiliates()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  is_affiliate boolean,
  affiliate_code text,
  affiliate_tier text,
  affiliate_earnings numeric,
  affiliate_joined_at timestamp with time zone,
  payment_method text,
  payment_details jsonb
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY 
  SELECT 
    u.id,
    u.name,
    u.email,
    u.is_affiliate,
    u.affiliate_code,
    u.affiliate_tier,
    u.affiliate_earnings,
    u.affiliate_joined_at,
    u.payment_method,
    u.payment_details
  FROM users u
  WHERE u.is_affiliate = true
  ORDER BY u.affiliate_joined_at DESC;
END;
$$;

-- Function to get affiliate details by ID
CREATE OR REPLACE FUNCTION admin_get_affiliate_details(p_affiliate_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  email text
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY 
  SELECT 
    u.id,
    u.name,
    u.email
  FROM users u
  WHERE u.id = p_affiliate_id;
END;
$$;

-- Function to reset affiliate earnings
CREATE OR REPLACE FUNCTION admin_reset_affiliate_earnings(
  p_affiliate_id uuid
)
RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  UPDATE users 
  SET affiliate_earnings = 0, updated_at = NOW()
  WHERE id = p_affiliate_id;
  
  RETURN jsonb_build_object('success', true, 'affiliate_id', p_affiliate_id, 'earnings_reset', true);
END;
$$;

-- Function to get commissions with affiliate and user details
CREATE OR REPLACE FUNCTION admin_get_all_commissions()
RETURNS TABLE (
  id uuid,
  affiliate_id uuid,
  referred_user_id uuid,
  commission_type text,
  amount numeric,
  status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  paid_at timestamp with time zone,
  notes text,
  affiliate_name text,
  affiliate_email text,
  referred_user_name text,
  referred_user_email text
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY 
  SELECT 
    ac.id,
    ac.affiliate_id,
    ac.referred_user_id,
    ac.commission_type,
    ac.amount,
    ac.status,
    ac.created_at,
    ac.updated_at,
    ac.paid_at,
    ac.notes,
    affiliate.name as affiliate_name,
    affiliate.email as affiliate_email,
    referred_user.name as referred_user_name,
    referred_user.email as referred_user_email
  FROM affiliate_commissions ac
  LEFT JOIN users affiliate ON ac.affiliate_id = affiliate.id
  LEFT JOIN users referred_user ON ac.referred_user_id = referred_user.id
  ORDER BY ac.created_at DESC;
END;
$$;

-- Function to get payouts with affiliate details
CREATE OR REPLACE FUNCTION admin_get_all_payouts()
RETURNS TABLE (
  id uuid,
  affiliate_id uuid,
  amount numeric,
  payout_method text,
  payout_details jsonb,
  status text,
  created_at timestamp with time zone,
  processed_at timestamp with time zone,
  notes text,
  affiliate_name text,
  affiliate_email text
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY 
  SELECT 
    ap.id,
    ap.affiliate_id,
    ap.amount,
    ap.payout_method,
    ap.payout_details,
    ap.status,
    ap.created_at,
    ap.processed_at,
    ap.notes,
    affiliate.name as affiliate_name,
    affiliate.email as affiliate_email
  FROM affiliate_payouts ap
  LEFT JOIN users affiliate ON ap.affiliate_id = affiliate.id
  ORDER BY ap.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_get_all_affiliates TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_affiliate_details TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_affiliate_earnings TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_all_commissions TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_all_payouts TO authenticated;
