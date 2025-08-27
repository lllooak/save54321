/*
  # Add affiliate system tables and functionality
  
  1. New Tables
    - `affiliate_links` - Stores affiliate links and codes
    - `affiliate_tracking` - Tracks affiliate visits and events
    - `affiliate_commissions` - Records commissions earned by affiliates
    - `affiliate_payouts` - Tracks payout requests and processing
    - `purchases` - Simple table for tracking purchases
    - `affiliate_conversions` - Tracks successful conversions
  
  2. Changes
    - Add affiliate-related columns to users table
    - Create indexes for performance
    - Add RLS policies for security
  
  3. Functions
    - `update_affiliate_tier` - Updates affiliate tier based on earnings
    - `confirm_booking_commission` - Handles commission when bookings are completed
*/

-- Add affiliate fields to users table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_affiliate'
  ) THEN
    ALTER TABLE users ADD COLUMN is_affiliate BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'affiliate_tier'
  ) THEN
    ALTER TABLE users ADD COLUMN affiliate_tier TEXT DEFAULT 'bronze';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'affiliate_code'
  ) THEN
    ALTER TABLE users ADD COLUMN affiliate_code TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'affiliate_joined_at'
  ) THEN
    ALTER TABLE users ADD COLUMN affiliate_joined_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'affiliate_earnings'
  ) THEN
    ALTER TABLE users ADD COLUMN affiliate_earnings NUMERIC DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'referrer_id'
  ) THEN
    ALTER TABLE users ADD COLUMN referrer_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Create index on affiliate-related columns
CREATE INDEX IF NOT EXISTS idx_users_is_affiliate ON users(is_affiliate);
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_affiliate_code_key ON users(affiliate_code) WHERE affiliate_code IS NOT NULL;

-- Create affiliate_links table if it doesn't exist
CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  code TEXT NOT NULL UNIQUE,
  landing_page TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for affiliate_links
CREATE INDEX IF NOT EXISTS idx_affiliate_links_user_id ON affiliate_links(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_code ON affiliate_links(code);

-- Enable RLS on affiliate_links if not already enabled
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts and recreate them
DO $$
BEGIN
  -- Drop policies if they exist
  DROP POLICY IF EXISTS "Allow all users to read affiliate links" ON affiliate_links;
  DROP POLICY IF EXISTS "Users can create their own affiliate links" ON affiliate_links;
  DROP POLICY IF EXISTS "Users can update their own affiliate links" ON affiliate_links;
  DROP POLICY IF EXISTS "Users can view their own affiliate links" ON affiliate_links;
END $$;

-- Create policies for affiliate_links
CREATE POLICY "Allow all users to read affiliate links" 
  ON affiliate_links FOR SELECT TO public USING (true);

CREATE POLICY "Users can create their own affiliate links" 
  ON affiliate_links FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own affiliate links" 
  ON affiliate_links FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own affiliate links" 
  ON affiliate_links FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Create affiliate_tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS affiliate_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('visit', 'signup', 'booking')),
  visitor_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  referral_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for affiliate_tracking
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_affiliate_id ON affiliate_tracking(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_event_type ON affiliate_tracking(event_type);

-- Enable RLS on affiliate_tracking
ALTER TABLE affiliate_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts and recreate them
DO $$
BEGIN
  -- Drop policies if they exist
  DROP POLICY IF EXISTS "Affiliates can view their own tracking data" ON affiliate_tracking;
  DROP POLICY IF EXISTS "System can insert tracking data" ON affiliate_tracking;
END $$;

-- Create policies for affiliate_tracking
CREATE POLICY "Affiliates can view their own tracking data" 
  ON affiliate_tracking FOR SELECT TO authenticated USING (affiliate_id = auth.uid());

CREATE POLICY "System can insert tracking data" 
  ON affiliate_tracking FOR INSERT TO authenticated WITH CHECK (true);

-- Create affiliate_commissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES auth.users(id),
  referred_user_id UUID REFERENCES auth.users(id),
  request_id UUID REFERENCES requests(id),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid', 'cancelled')),
  commission_type TEXT NOT NULL CHECK (commission_type IN ('signup', 'booking', 'recurring')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- Create indexes for affiliate_commissions
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_referred_user_id ON affiliate_commissions(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status ON affiliate_commissions(status);

-- Enable RLS on affiliate_commissions
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts and recreate them
DO $$
BEGIN
  -- Drop policies if they exist
  DROP POLICY IF EXISTS "Affiliates can view their own commissions" ON affiliate_commissions;
  DROP POLICY IF EXISTS "Allow users to view their own commissions" ON affiliate_commissions;
  DROP POLICY IF EXISTS "System can insert and update commissions" ON affiliate_commissions;
END $$;

-- Create policies for affiliate_commissions
CREATE POLICY "Affiliates can view their own commissions" 
  ON affiliate_commissions FOR SELECT TO authenticated USING (affiliate_id = auth.uid());

CREATE POLICY "Allow users to view their own commissions" 
  ON affiliate_commissions FOR SELECT TO public USING ((auth.uid() = affiliate_id) OR (auth.uid() = referred_user_id));

CREATE POLICY "System can insert and update commissions" 
  ON affiliate_commissions FOR ALL TO authenticated WITH CHECK (true);

-- Create affiliate_payouts table if it doesn't exist
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payout_method TEXT NOT NULL CHECK (payout_method IN ('paypal', 'bank_transfer', 'wallet_credit')),
  payout_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  reference_id TEXT,
  notes TEXT
);

-- Create indexes for affiliate_payouts
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate_id ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status ON affiliate_payouts(status);

-- Enable RLS on affiliate_payouts
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts and recreate them
DO $$
BEGIN
  -- Drop policies if they exist
  DROP POLICY IF EXISTS "Affiliates can view their own payouts" ON affiliate_payouts;
  DROP POLICY IF EXISTS "Affiliates can request payouts" ON affiliate_payouts;
  DROP POLICY IF EXISTS "Admins can manage all payouts" ON affiliate_payouts;
END $$;

-- Create policies for affiliate_payouts
CREATE POLICY "Affiliates can view their own payouts" 
  ON affiliate_payouts FOR SELECT TO authenticated USING (affiliate_id = auth.uid());

CREATE POLICY "Affiliates can request payouts" 
  ON affiliate_payouts FOR INSERT TO authenticated WITH CHECK (affiliate_id = auth.uid());

CREATE POLICY "Admins can manage all payouts" 
  ON affiliate_payouts FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Create purchases table if it doesn't exist (for tracking conversions)
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES users(id),
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Create affiliate_conversions table for tracking successful conversions if it doesn't exist
CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_code TEXT REFERENCES affiliate_links(code),
  purchased_by UUID REFERENCES users(id),
  purchase_id UUID REFERENCES purchases(id),
  commission_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Enable RLS on affiliate_conversions
ALTER TABLE affiliate_conversions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts and recreate them
DO $$
BEGIN
  -- Drop policies if they exist
  DROP POLICY IF EXISTS "Allow insert on affiliate_conversions" ON affiliate_conversions;
  DROP POLICY IF EXISTS "Allow user to see own conversions" ON affiliate_conversions;
END $$;

-- Create policies for affiliate_conversions
CREATE POLICY "Allow insert on affiliate_conversions" 
  ON affiliate_conversions FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow user to see own conversions" 
  ON affiliate_conversions FOR SELECT TO public USING (
    (auth.uid() = purchased_by) OR 
    (affiliate_code IN (SELECT code FROM affiliate_links WHERE user_id = auth.uid()))
  );

-- Create or replace trigger function to update affiliate tier based on earnings
CREATE OR REPLACE FUNCTION update_affiliate_tier()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if the status changed to 'confirmed'
  IF NEW.status = 'confirmed' AND OLD.status <> 'confirmed' THEN
    -- Update the affiliate's tier based on total confirmed commissions
    UPDATE users
    SET affiliate_tier = 
      CASE 
        WHEN (
          SELECT SUM(amount) 
          FROM affiliate_commissions 
          WHERE affiliate_id = NEW.affiliate_id AND status = 'confirmed'
        ) >= 5000 THEN 'platinum'
        WHEN (
          SELECT SUM(amount) 
          FROM affiliate_commissions 
          WHERE affiliate_id = NEW.affiliate_id AND status = 'confirmed'
        ) >= 2000 THEN 'gold'
        WHEN (
          SELECT SUM(amount) 
          FROM affiliate_commissions 
          WHERE affiliate_id = NEW.affiliate_id AND status = 'confirmed'
        ) >= 500 THEN 'silver'
        ELSE 'bronze'
      END
    WHERE id = NEW.affiliate_id;
    
    -- Update the affiliate's total earnings
    UPDATE users
    SET affiliate_earnings = (
      SELECT COALESCE(SUM(amount), 0)
      FROM affiliate_commissions
      WHERE affiliate_id = NEW.affiliate_id AND status = 'confirmed'
    )
    WHERE id = NEW.affiliate_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace trigger to update affiliate tier
DROP TRIGGER IF EXISTS affiliate_tier_update_trigger ON affiliate_commissions;
CREATE TRIGGER affiliate_tier_update_trigger
AFTER UPDATE OF status ON affiliate_commissions
FOR EACH ROW
EXECUTE FUNCTION update_affiliate_tier();

-- Create or replace function to confirm booking commission
CREATE OR REPLACE FUNCTION confirm_booking_commission()
RETURNS TRIGGER AS $$
BEGIN
  -- If a request is completed, confirm any pending commissions related to it
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    -- Get the fan's referrer
    DECLARE
      fan_referrer_id UUID;
    BEGIN
      SELECT referrer_id INTO fan_referrer_id
      FROM users
      WHERE id = NEW.fan_id;
      
      -- If the fan has a referrer, create or update a commission
      IF fan_referrer_id IS NOT NULL THEN
        -- Calculate commission (10% of the request price)
        DECLARE
          commission_amount NUMERIC;
        BEGIN
          commission_amount := NEW.price * 0.1;
          
          -- Check if a commission already exists for this request
          IF EXISTS (
            SELECT 1 FROM affiliate_commissions 
            WHERE request_id = NEW.id AND commission_type = 'booking'
          ) THEN
            -- Update existing commission
            UPDATE affiliate_commissions
            SET 
              amount = commission_amount,
              status = 'confirmed',
              updated_at = now()
            WHERE request_id = NEW.id AND commission_type = 'booking';
          ELSE
            -- Create new commission
            INSERT INTO affiliate_commissions (
              affiliate_id,
              referred_user_id,
              request_id,
              amount,
              status,
              commission_type
            ) VALUES (
              fan_referrer_id,
              NEW.fan_id,
              NEW.id,
              commission_amount,
              'confirmed',
              'booking'
            );
          END IF;
        END;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace trigger for booking commission
DROP TRIGGER IF EXISTS affiliate_commission_trigger ON requests;
CREATE TRIGGER affiliate_commission_trigger
AFTER UPDATE OF status ON requests
FOR EACH ROW
EXECUTE FUNCTION confirm_booking_commission();