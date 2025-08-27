-- First ensure the affiliate_id columns exist and are of type uuid
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'affiliate_commissions' AND column_name = 'affiliate_id'
  ) THEN
    ALTER TABLE affiliate_commissions ADD COLUMN affiliate_id uuid;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'affiliate_payouts' AND column_name = 'affiliate_id'
  ) THEN
    ALTER TABLE affiliate_payouts ADD COLUMN affiliate_id uuid;
  END IF;
END $$;

-- Drop existing foreign key constraints if they exist
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'affiliate_commissions_affiliate_id_fkey'
  ) THEN
    ALTER TABLE affiliate_commissions DROP CONSTRAINT affiliate_commissions_affiliate_id_fkey;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'affiliate_payouts_affiliate_id_fkey'
  ) THEN
    ALTER TABLE affiliate_payouts DROP CONSTRAINT affiliate_payouts_affiliate_id_fkey;
  END IF;
END $$;

-- Add foreign key constraints
ALTER TABLE affiliate_commissions
  ADD CONSTRAINT affiliate_commissions_affiliate_id_fkey 
  FOREIGN KEY (affiliate_id) 
  REFERENCES users(id);

ALTER TABLE affiliate_payouts
  ADD CONSTRAINT affiliate_payouts_affiliate_id_fkey 
  FOREIGN KEY (affiliate_id) 
  REFERENCES users(id);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id 
  ON affiliate_commissions(affiliate_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate_id 
  ON affiliate_payouts(affiliate_id);