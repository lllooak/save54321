/*
  # Add affiliate system tables and functions

  1. New Tables
    - `affiliate_links`: Stores affiliate links and codes
    - `affiliate_tracking`: Logs affiliate link visits and conversions
    - `affiliate_commissions`: Tracks commissions earned by affiliates
    - `affiliate_payouts`: Records payout requests and their status

  2. New Columns
    - Add `referrer_id` to users table to track who referred each user
    - Add `is_affiliate` to users table to mark users as affiliates

  3. Functions
    - Create functions to calculate affiliate commissions
    - Create functions to track referrals
    - Create functions to manage affiliate payouts
*/

-- Add affiliate-related columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS referrer_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_affiliate boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS affiliate_tier text DEFAULT 'bronze',
ADD COLUMN IF NOT EXISTS affiliate_code text UNIQUE,
ADD COLUMN IF NOT EXISTS affiliate_joined_at timestamptz;

-- Create affiliate_links table
CREATE TABLE IF NOT EXISTS affiliate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  code text NOT NULL UNIQUE,
  landing_page text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create affiliate_tracking table
CREATE TABLE IF NOT EXISTS affiliate_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES auth.users(id) NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('visit', 'signup', 'booking')),
  visitor_id uuid,
  ip_address text,
  user_agent text,
  referral_url text,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

-- Create affiliate_commissions table
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES auth.users(id) NOT NULL,
  referred_user_id uuid REFERENCES auth.users(id),
  request_id uuid REFERENCES requests(id),
  amount numeric NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid', 'cancelled')),
  commission_type text NOT NULL CHECK (commission_type IN ('signup', 'booking', 'recurring')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

-- Create affiliate_payouts table
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES auth.users(id) NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payout_method text NOT NULL CHECK (payout_method IN ('paypal', 'bank_transfer', 'wallet_credit')),
  payout_details jsonb,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  reference_id text,
  notes text
);

-- Enable RLS on all tables
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Affiliate links policies
CREATE POLICY "Users can view their own affiliate links"
  ON affiliate_links
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own affiliate links"
  ON affiliate_links
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own affiliate links"
  ON affiliate_links
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Affiliate tracking policies
CREATE POLICY "Affiliates can view their own tracking data"
  ON affiliate_tracking
  FOR SELECT
  TO authenticated
  USING (affiliate_id = auth.uid());

CREATE POLICY "System can insert tracking data"
  ON affiliate_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Affiliate commissions policies
CREATE POLICY "Affiliates can view their own commissions"
  ON affiliate_commissions
  FOR SELECT
  TO authenticated
  USING (affiliate_id = auth.uid());

CREATE POLICY "System can insert and update commissions"
  ON affiliate_commissions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Affiliate payouts policies
CREATE POLICY "Affiliates can view their own payouts"
  ON affiliate_payouts
  FOR SELECT
  TO authenticated
  USING (affiliate_id = auth.uid());

CREATE POLICY "Affiliates can request payouts"
  ON affiliate_payouts
  FOR INSERT
  TO authenticated
  WITH CHECK (affiliate_id = auth.uid());

CREATE POLICY "Admins can manage all payouts"
  ON affiliate_payouts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_affiliate_links_user_id ON affiliate_links(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_code ON affiliate_links(code);
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_affiliate_id ON affiliate_tracking(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_event_type ON affiliate_tracking(event_type);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status ON affiliate_commissions(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate_id ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status ON affiliate_payouts(status);
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id);
CREATE INDEX IF NOT EXISTS idx_users_is_affiliate ON users(is_affiliate);

-- Create function to generate unique affiliate code
CREATE OR REPLACE FUNCTION generate_affiliate_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
  v_exists boolean;
  v_attempts integer := 0;
  v_max_attempts integer := 10;
  v_user_name text;
BEGIN
  -- Get user's name or email
  SELECT COALESCE(name, email) INTO v_user_name
  FROM users
  WHERE id = p_user_id;
  
  -- Generate base code from user name
  v_code := LOWER(REGEXP_REPLACE(SPLIT_PART(v_user_name, '@', 1), '[^a-zA-Z0-9]', '', 'g'));
  
  -- Ensure code is at least 4 characters
  IF LENGTH(v_code) < 4 THEN
    v_code := v_code || SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR (4 - LENGTH(v_code)));
  END IF;
  
  -- Truncate to max 10 characters
  v_code := SUBSTRING(v_code FROM 1 FOR 10);
  
  -- Check if code exists and append random digits if needed
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM affiliate_links WHERE code = v_code
    ) INTO v_exists;
    
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
    
    -- Append random digits
    v_code := SUBSTRING(v_code FROM 1 FOR 6) || SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 4);
    v_attempts := v_attempts + 1;
    
    -- Exit after max attempts
    IF v_attempts >= v_max_attempts THEN
      RETURN 'aff' || SUBSTRING(MD5(p_user_id::text) FROM 1 FOR 7);
    END IF;
  END LOOP;
END;
$$;

-- Create function to register user as affiliate
CREATE OR REPLACE FUNCTION register_as_affiliate(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affiliate_code text;
  v_affiliate_link_id uuid;
BEGIN
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Check if user is already an affiliate
  IF EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND is_affiliate = true) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User is already an affiliate'
    );
  END IF;
  
  -- Generate affiliate code
  v_affiliate_code := generate_affiliate_code(p_user_id);
  
  -- Update user as affiliate
  UPDATE users
  SET 
    is_affiliate = true,
    affiliate_tier = 'bronze',
    affiliate_code = v_affiliate_code,
    affiliate_joined_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Create affiliate link
  INSERT INTO affiliate_links (
    user_id,
    code,
    landing_page,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    v_affiliate_code,
    '/',
    true,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_affiliate_link_id;
  
  -- Log the affiliate registration
  INSERT INTO audit_logs (
    action,
    entity,
    entity_id,
    user_id,
    details
  ) VALUES (
    'affiliate_registration',
    'users',
    p_user_id,
    p_user_id,
    jsonb_build_object(
      'affiliate_code', v_affiliate_code,
      'affiliate_tier', 'bronze',
      'affiliate_link_id', v_affiliate_link_id,
      'registered_at', NOW()
    )
  );
  
  -- Create notification for the user
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    entity_id,
    entity_type
  ) VALUES (
    p_user_id,
    'ברוך הבא לתוכנית השותפים!',
    'הצטרפת בהצלחה לתוכנית השותפים. קוד ההפניה שלך הוא: ' || v_affiliate_code,
    'system',
    p_user_id,
    'affiliate'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'affiliate_code', v_affiliate_code,
    'affiliate_tier', 'bronze',
    'affiliate_link_id', v_affiliate_link_id
  );
END;
$$;

-- Create function to track affiliate link visit
CREATE OR REPLACE FUNCTION track_affiliate_visit(
  p_affiliate_code text,
  p_visitor_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_referral_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affiliate_id uuid;
  v_tracking_id uuid;
BEGIN
  -- Find affiliate by code
  SELECT user_id INTO v_affiliate_id
  FROM affiliate_links
  WHERE code = p_affiliate_code
  AND is_active = true;
  
  IF v_affiliate_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or inactive affiliate code'
    );
  END IF;
  
  -- Record the visit
  INSERT INTO affiliate_tracking (
    affiliate_id,
    event_type,
    visitor_id,
    ip_address,
    user_agent,
    referral_url,
    created_at,
    metadata
  ) VALUES (
    v_affiliate_id,
    'visit',
    p_visitor_id,
    p_ip_address,
    p_user_agent,
    p_referral_url,
    NOW(),
    jsonb_build_object(
      'affiliate_code', p_affiliate_code
    )
  )
  RETURNING id INTO v_tracking_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'tracking_id', v_tracking_id,
    'affiliate_id', v_affiliate_id
  );
END;
$$;

-- Create function to record user signup via affiliate
CREATE OR REPLACE FUNCTION record_affiliate_signup(
  p_user_id uuid,
  p_affiliate_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affiliate_id uuid;
  v_tracking_id uuid;
  v_commission_id uuid;
  v_commission_amount numeric := 10.00; -- Default signup bonus
  v_affiliate_tier text;
BEGIN
  -- Find affiliate by code
  SELECT user_id INTO v_affiliate_id
  FROM affiliate_links
  WHERE code = p_affiliate_code
  AND is_active = true;
  
  IF v_affiliate_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or inactive affiliate code'
    );
  END IF;
  
  -- Prevent self-referral
  IF v_affiliate_id = p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Self-referral is not allowed'
    );
  END IF;
  
  -- Get affiliate tier to adjust commission
  SELECT affiliate_tier INTO v_affiliate_tier
  FROM users
  WHERE id = v_affiliate_id;
  
  -- Adjust commission based on tier
  IF v_affiliate_tier = 'silver' THEN
    v_commission_amount := 15.00;
  ELSIF v_affiliate_tier = 'gold' THEN
    v_commission_amount := 20.00;
  END IF;
  
  -- Update user with referrer
  UPDATE users
  SET 
    referrer_id = v_affiliate_id,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Record the signup event
  INSERT INTO affiliate_tracking (
    affiliate_id,
    event_type,
    visitor_id,
    created_at,
    metadata
  ) VALUES (
    v_affiliate_id,
    'signup',
    p_user_id,
    NOW(),
    jsonb_build_object(
      'affiliate_code', p_affiliate_code,
      'user_id', p_user_id
    )
  )
  RETURNING id INTO v_tracking_id;
  
  -- Create commission record
  INSERT INTO affiliate_commissions (
    affiliate_id,
    referred_user_id,
    amount,
    status,
    commission_type,
    created_at,
    updated_at
  ) VALUES (
    v_affiliate_id,
    p_user_id,
    v_commission_amount,
    'confirmed', -- Signup bonuses are confirmed immediately
    'signup',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_commission_id;
  
  -- Add commission to affiliate's wallet
  UPDATE users
  SET 
    wallet_balance = wallet_balance + v_commission_amount,
    updated_at = NOW()
  WHERE id = v_affiliate_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    user_id,
    type,
    amount,
    payment_method,
    payment_status,
    description,
    reference_id
  ) VALUES (
    v_affiliate_id,
    'earning',
    v_commission_amount,
    'platform',
    'completed',
    'Affiliate signup bonus',
    p_user_id::text
  );
  
  -- Create notification for the affiliate
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    entity_id,
    entity_type
  ) VALUES (
    v_affiliate_id,
    'הפנית משתמש חדש!',
    'הפנית משתמש חדש וקיבלת עמלה של ₪' || v_commission_amount,
    'payment',
    p_user_id,
    'affiliate'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'tracking_id', v_tracking_id,
    'affiliate_id', v_affiliate_id,
    'commission_id', v_commission_id,
    'commission_amount', v_commission_amount
  );
END;
$$;

-- Create function to calculate booking commission
CREATE OR REPLACE FUNCTION calculate_booking_commission(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fan_id uuid;
  v_creator_id uuid;
  v_referrer_id uuid;
  v_amount numeric;
  v_commission_amount numeric;
  v_commission_id uuid;
  v_affiliate_tier text;
  v_commission_rate numeric := 0.10; -- Default 10%
BEGIN
  -- Get request details
  SELECT 
    fan_id, 
    creator_id, 
    price
  INTO 
    v_fan_id, 
    v_creator_id, 
    v_amount
  FROM requests
  WHERE id = p_request_id;
  
  IF v_fan_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request not found'
    );
  END IF;
  
  -- Get referrer ID
  SELECT referrer_id INTO v_referrer_id
  FROM users
  WHERE id = v_fan_id;
  
  -- If no referrer, exit
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User has no referrer'
    );
  END IF;
  
  -- Check if referrer is an affiliate
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = v_referrer_id
    AND is_affiliate = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Referrer is not an affiliate'
    );
  END IF;
  
  -- Get affiliate tier to adjust commission rate
  SELECT affiliate_tier INTO v_affiliate_tier
  FROM users
  WHERE id = v_referrer_id;
  
  -- Adjust commission rate based on tier
  IF v_affiliate_tier = 'silver' THEN
    v_commission_rate := 0.15; -- 15%
  ELSIF v_affiliate_tier = 'gold' THEN
    v_commission_rate := 0.20; -- 20%
  END IF;
  
  -- Calculate commission amount
  v_commission_amount := ROUND((v_amount * v_commission_rate)::numeric, 2);
  
  -- Record the booking event
  INSERT INTO affiliate_tracking (
    affiliate_id,
    event_type,
    visitor_id,
    created_at,
    metadata
  ) VALUES (
    v_referrer_id,
    'booking',
    v_fan_id,
    NOW(),
    jsonb_build_object(
      'request_id', p_request_id,
      'amount', v_amount,
      'commission_amount', v_commission_amount
    )
  );
  
  -- Create commission record
  INSERT INTO affiliate_commissions (
    affiliate_id,
    referred_user_id,
    request_id,
    amount,
    status,
    commission_type,
    created_at,
    updated_at
  ) VALUES (
    v_referrer_id,
    v_fan_id,
    p_request_id,
    v_commission_amount,
    'pending', -- Will be confirmed when request is completed
    'booking',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_commission_id;
  
  -- Create notification for the affiliate
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    entity_id,
    entity_type
  ) VALUES (
    v_referrer_id,
    'עמלת הפניה חדשה!',
    'המשתמש שהפנית ביצע הזמנה. עמלה בסך ₪' || v_commission_amount || ' ממתינה לאישור.',
    'payment',
    p_request_id,
    'affiliate'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'affiliate_id', v_referrer_id,
    'commission_id', v_commission_id,
    'commission_amount', v_commission_amount,
    'commission_rate', v_commission_rate
  );
END;
$$;

-- Create function to confirm booking commission when request is completed
CREATE OR REPLACE FUNCTION confirm_booking_commission()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_commission_record RECORD;
  v_affiliate_id uuid;
BEGIN
  -- Only process when status changes to completed
  IF (NEW.status = 'completed' AND OLD.status <> 'completed') THEN
    -- Find commission record for this request
    SELECT * INTO v_commission_record
    FROM affiliate_commissions
    WHERE request_id = NEW.id
    AND status = 'pending'
    FOR UPDATE;
    
    -- If no commission record, exit
    IF v_commission_record IS NULL THEN
      RETURN NEW;
    END IF;
    
    v_affiliate_id := v_commission_record.affiliate_id;
    
    -- Update commission status
    UPDATE affiliate_commissions
    SET 
      status = 'confirmed',
      updated_at = NOW()
    WHERE id = v_commission_record.id;
    
    -- Add commission to affiliate's wallet
    UPDATE users
    SET 
      wallet_balance = wallet_balance + v_commission_record.amount,
      updated_at = NOW()
    WHERE id = v_affiliate_id;
    
    -- Create transaction record
    INSERT INTO wallet_transactions (
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description,
      reference_id
    ) VALUES (
      v_affiliate_id,
      'earning',
      v_commission_record.amount,
      'platform',
      'completed',
      'Affiliate booking commission',
      NEW.id::text
    );
    
    -- Create notification for the affiliate
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      v_affiliate_id,
      'עמלת הפניה אושרה!',
      'עמלת ההפניה שלך בסך ₪' || v_commission_record.amount || ' אושרה והתווספה לארנק שלך.',
      'payment',
      NEW.id,
      'affiliate'
    );
    
    -- Log the commission confirmation
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      user_id,
      details
    ) VALUES (
      'affiliate_commission_confirmed',
      'affiliate_commissions',
      v_commission_record.id,
      v_affiliate_id,
      jsonb_build_object(
        'request_id', NEW.id,
        'commission_amount', v_commission_record.amount,
        'confirmed_at', NOW()
      )
    );
  END IF;
  
  -- Handle request cancellation/decline
  IF (NEW.status = 'declined' AND OLD.status <> 'declined') THEN
    -- Find commission record for this request
    SELECT * INTO v_commission_record
    FROM affiliate_commissions
    WHERE request_id = NEW.id
    AND status = 'pending'
    FOR UPDATE;
    
    -- If no commission record, exit
    IF v_commission_record IS NULL THEN
      RETURN NEW;
    END IF;
    
    v_affiliate_id := v_commission_record.affiliate_id;
    
    -- Update commission status
    UPDATE affiliate_commissions
    SET 
      status = 'cancelled',
      updated_at = NOW()
    WHERE id = v_commission_record.id;
    
    -- Create notification for the affiliate
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      v_affiliate_id,
      'עמלת הפניה בוטלה',
      'עמלת ההפניה שלך בסך ₪' || v_commission_record.amount || ' בוטלה עקב ביטול ההזמנה.',
      'payment',
      NEW.id,
      'affiliate'
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error without failing
    RAISE WARNING 'Error in confirm_booking_commission: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for commission confirmation
DROP TRIGGER IF EXISTS affiliate_commission_trigger ON requests;
CREATE TRIGGER affiliate_commission_trigger
AFTER UPDATE OF status ON requests
FOR EACH ROW
EXECUTE FUNCTION confirm_booking_commission();

-- Create function to request affiliate payout
CREATE OR REPLACE FUNCTION request_affiliate_payout(
  p_affiliate_id uuid,
  p_amount numeric,
  p_payout_method text,
  p_payout_details jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_balance numeric;
  v_payout_id uuid;
  v_min_payout numeric := 50.00; -- Minimum payout amount
BEGIN
  -- Check if user is an affiliate
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = p_affiliate_id
    AND is_affiliate = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User is not an affiliate'
    );
  END IF;
  
  -- Get affiliate's wallet balance
  SELECT wallet_balance INTO v_wallet_balance
  FROM users
  WHERE id = p_affiliate_id;
  
  -- Check if affiliate has enough balance
  IF v_wallet_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'available_balance', v_wallet_balance,
      'requested_amount', p_amount
    );
  END IF;
  
  -- Check minimum payout amount
  IF p_amount < v_min_payout THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Minimum payout amount is ₪' || v_min_payout,
      'minimum_amount', v_min_payout,
      'requested_amount', p_amount
    );
  END IF;
  
  -- Validate payout method
  IF p_payout_method NOT IN ('paypal', 'bank_transfer', 'wallet_credit') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid payout method'
    );
  END IF;
  
  -- Create payout request
  INSERT INTO affiliate_payouts (
    affiliate_id,
    amount,
    status,
    payout_method,
    payout_details,
    created_at
  ) VALUES (
    p_affiliate_id,
    p_amount,
    'pending',
    p_payout_method,
    p_payout_details,
    NOW()
  )
  RETURNING id INTO v_payout_id;
  
  -- Create notification for the affiliate
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    entity_id,
    entity_type
  ) VALUES (
    p_affiliate_id,
    'בקשת משיכת עמלות',
    'בקשת המשיכה שלך בסך ₪' || p_amount || ' התקבלה ונמצאת בטיפול.',
    'payment',
    v_payout_id,
    'affiliate_payout'
  );
  
  -- Create notification for admins
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    entity_id,
    entity_type
  )
  SELECT 
    id,
    'בקשת משיכת עמלות חדשה',
    'התקבלה בקשת משיכת עמלות חדשה בסך ₪' || p_amount,
    'system',
    v_payout_id,
    'affiliate_payout'
  FROM users
  WHERE role = 'admin';
  
  -- Log the payout request
  INSERT INTO audit_logs (
    action,
    entity,
    entity_id,
    user_id,
    details
  ) VALUES (
    'affiliate_payout_requested',
    'affiliate_payouts',
    v_payout_id,
    p_affiliate_id,
    jsonb_build_object(
      'amount', p_amount,
      'payout_method', p_payout_method,
      'requested_at', NOW()
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'amount', p_amount,
    'status', 'pending'
  );
END;
$$;

-- Create function to process affiliate payout
CREATE OR REPLACE FUNCTION process_affiliate_payout(
  p_payout_id uuid,
  p_status text,
  p_reference_id text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payout_record RECORD;
  v_affiliate_id uuid;
  v_amount numeric;
  v_wallet_balance numeric;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only administrators can process payouts'
    );
  END IF;
  
  -- Get payout details
  SELECT * INTO v_payout_record
  FROM affiliate_payouts
  WHERE id = p_payout_id
  FOR UPDATE;
  
  IF v_payout_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payout request not found'
    );
  END IF;
  
  -- Check if payout is already processed
  IF v_payout_record.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payout has already been processed',
      'current_status', v_payout_record.status
    );
  END IF;
  
  v_affiliate_id := v_payout_record.affiliate_id;
  v_amount := v_payout_record.amount;
  
  -- Get affiliate's wallet balance
  SELECT wallet_balance INTO v_wallet_balance
  FROM users
  WHERE id = v_affiliate_id
  FOR UPDATE;
  
  -- Check if affiliate still has enough balance
  IF v_wallet_balance < v_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'available_balance', v_wallet_balance,
      'requested_amount', v_amount
    );
  END IF;
  
  -- Process based on status
  IF p_status = 'completed' THEN
    -- Deduct amount from affiliate's wallet
    UPDATE users
    SET 
      wallet_balance = wallet_balance - v_amount,
      updated_at = NOW()
    WHERE id = v_affiliate_id;
    
    -- Create transaction record
    INSERT INTO wallet_transactions (
      user_id,
      type,
      amount,
      payment_method,
      payment_status,
      description,
      reference_id
    ) VALUES (
      v_affiliate_id,
      'purchase',
      v_amount,
      v_payout_record.payout_method,
      'completed',
      'Affiliate commission payout',
      p_payout_id::text
    );
    
    -- Create notification for the affiliate
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      v_affiliate_id,
      'בקשת המשיכה אושרה',
      'בקשת המשיכה שלך בסך ₪' || v_amount || ' אושרה והכסף הועבר אליך.',
      'payment',
      p_payout_id,
      'affiliate_payout'
    );
  ELSIF p_status = 'failed' THEN
    -- Create notification for the affiliate
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      v_affiliate_id,
      'בקשת המשיכה נכשלה',
      'בקשת המשיכה שלך בסך ₪' || v_amount || ' נכשלה. אנא צור קשר עם התמיכה.',
      'payment',
      p_payout_id,
      'affiliate_payout'
    );
  END IF;
  
  -- Update payout record
  UPDATE affiliate_payouts
  SET 
    status = p_status,
    processed_at = NOW(),
    reference_id = p_reference_id,
    notes = p_notes
  WHERE id = p_payout_id;
  
  -- Log the payout processing
  INSERT INTO audit_logs (
    action,
    entity,
    entity_id,
    user_id,
    details
  ) VALUES (
    'affiliate_payout_processed',
    'affiliate_payouts',
    p_payout_id,
    auth.uid(),
    jsonb_build_object(
      'affiliate_id', v_affiliate_id,
      'amount', v_amount,
      'status', p_status,
      'reference_id', p_reference_id,
      'processed_at', NOW()
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'payout_id', p_payout_id,
    'status', p_status,
    'processed_at', NOW()
  );
END;
$$;

-- Create function to get affiliate statistics
CREATE OR REPLACE FUNCTION get_affiliate_stats(p_affiliate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_visits integer;
  v_total_signups integer;
  v_total_bookings integer;
  v_total_earnings numeric;
  v_pending_earnings numeric;
  v_paid_earnings numeric;
  v_conversion_rate numeric;
  v_affiliate_tier text;
  v_affiliate_code text;
  v_affiliate_joined_at timestamptz;
BEGIN
  -- Check if user is an affiliate
  SELECT 
    affiliate_tier,
    affiliate_code,
    affiliate_joined_at
  INTO 
    v_affiliate_tier,
    v_affiliate_code,
    v_affiliate_joined_at
  FROM users
  WHERE id = p_affiliate_id
  AND is_affiliate = true;
  
  IF v_affiliate_tier IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User is not an affiliate'
    );
  END IF;
  
  -- Get total visits
  SELECT COUNT(*) INTO v_total_visits
  FROM affiliate_tracking
  WHERE affiliate_id = p_affiliate_id
  AND event_type = 'visit';
  
  -- Get total signups
  SELECT COUNT(*) INTO v_total_signups
  FROM affiliate_tracking
  WHERE affiliate_id = p_affiliate_id
  AND event_type = 'signup';
  
  -- Get total bookings
  SELECT COUNT(*) INTO v_total_bookings
  FROM affiliate_tracking
  WHERE affiliate_id = p_affiliate_id
  AND event_type = 'booking';
  
  -- Get total earnings
  SELECT COALESCE(SUM(amount), 0) INTO v_total_earnings
  FROM affiliate_commissions
  WHERE affiliate_id = p_affiliate_id
  AND status IN ('confirmed', 'paid');
  
  -- Get pending earnings
  SELECT COALESCE(SUM(amount), 0) INTO v_pending_earnings
  FROM affiliate_commissions
  WHERE affiliate_id = p_affiliate_id
  AND status = 'pending';
  
  -- Get paid earnings
  SELECT COALESCE(SUM(amount), 0) INTO v_paid_earnings
  FROM affiliate_commissions
  WHERE affiliate_id = p_affiliate_id
  AND status = 'paid';
  
  -- Calculate conversion rate
  IF v_total_visits > 0 THEN
    v_conversion_rate := (v_total_signups::numeric / v_total_visits::numeric) * 100;
  ELSE
    v_conversion_rate := 0;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'affiliate_id', p_affiliate_id,
    'affiliate_code', v_affiliate_code,
    'affiliate_tier', v_affiliate_tier,
    'joined_at', v_affiliate_joined_at,
    'total_visits', v_total_visits,
    'total_signups', v_total_signups,
    'total_bookings', v_total_bookings,
    'total_earnings', v_total_earnings,
    'pending_earnings', v_pending_earnings,
    'paid_earnings', v_paid_earnings,
    'conversion_rate', ROUND(v_conversion_rate, 2)
  );
END;
$$;

-- Create function to update affiliate tier
CREATE OR REPLACE FUNCTION update_affiliate_tier()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_earnings numeric;
  v_new_tier text := 'bronze';
BEGIN
  -- Only process when commission status changes to confirmed
  IF (NEW.status = 'confirmed' AND OLD.status = 'pending') THEN
    -- Calculate total earnings
    SELECT COALESCE(SUM(amount), 0) INTO v_total_earnings
    FROM affiliate_commissions
    WHERE affiliate_id = NEW.affiliate_id
    AND status IN ('confirmed', 'paid');
    
    -- Determine new tier based on total earnings
    IF v_total_earnings >= 1000 THEN
      v_new_tier := 'gold';
    ELSIF v_total_earnings >= 500 THEN
      v_new_tier := 'silver';
    ELSE
      v_new_tier := 'bronze';
    END IF;
    
    -- Update affiliate tier if changed
    UPDATE users
    SET 
      affiliate_tier = v_new_tier,
      updated_at = NOW()
    WHERE id = NEW.affiliate_id
    AND affiliate_tier <> v_new_tier;
    
    -- If tier changed, create notification
    IF EXISTS (
      SELECT 1 FROM users
      WHERE id = NEW.affiliate_id
      AND affiliate_tier = v_new_tier
      AND affiliate_tier <> 'bronze'
    ) THEN
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        entity_id,
        entity_type
      ) VALUES (
        NEW.affiliate_id,
        'קידום דרגת שותף!',
        'ברכות! הדרגה שלך בתוכנית השותפים עודכנה ל-' || 
        CASE 
          WHEN v_new_tier = 'silver' THEN 'כסף'
          WHEN v_new_tier = 'gold' THEN 'זהב'
          ELSE v_new_tier
        END,
        'system',
        NEW.affiliate_id,
        'affiliate'
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error without failing
    RAISE WARNING 'Error in update_affiliate_tier: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for affiliate tier updates
CREATE TRIGGER affiliate_tier_update_trigger
AFTER UPDATE OF status ON affiliate_commissions
FOR EACH ROW
EXECUTE FUNCTION update_affiliate_tier();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_affiliate_code TO authenticated;
GRANT EXECUTE ON FUNCTION register_as_affiliate TO authenticated;
GRANT EXECUTE ON FUNCTION track_affiliate_visit TO authenticated;
GRANT EXECUTE ON FUNCTION record_affiliate_signup TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_booking_commission TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_booking_commission TO authenticated;
GRANT EXECUTE ON FUNCTION request_affiliate_payout TO authenticated;
GRANT EXECUTE ON FUNCTION process_affiliate_payout TO authenticated;
GRANT EXECUTE ON FUNCTION get_affiliate_stats TO authenticated;
GRANT EXECUTE ON FUNCTION update_affiliate_tier TO authenticated;
