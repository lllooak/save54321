-- Temporary: Disable wallet balance trigger to isolate PayPal doubling issue
-- This will help us identify if the trigger is causing the problem

-- Drop the existing trigger temporarily
DROP TRIGGER IF EXISTS update_wallet_balance_trigger ON wallet_transactions;

-- Create a new, more robust trigger with safeguards
CREATE OR REPLACE FUNCTION update_wallet_balance_safe()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if the payment status changed from non-completed to completed
  IF OLD.payment_status != 'completed' AND NEW.payment_status = 'completed' THEN
    -- Add logging to track trigger execution
    INSERT INTO public.logs (level, message, created_at) VALUES (
      'info', 
      'Wallet balance trigger executed for transaction: ' || NEW.id::text || ', amount: ' || NEW.amount::text,
      NOW()
    ) ON CONFLICT DO NOTHING;
    
    -- Only update wallet balance for top_up transactions
    IF NEW.type = 'top_up' THEN
      UPDATE users 
      SET wallet_balance = COALESCE(wallet_balance, 0) + NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.user_id;
    ELSIF NEW.type = 'purchase' THEN
      UPDATE users 
      SET wallet_balance = COALESCE(wallet_balance, 0) - NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.user_id;
    ELSIF NEW.type = 'refund' THEN
      UPDATE users 
      SET wallet_balance = COALESCE(wallet_balance, 0) + NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.user_id;
    END IF;
    
    -- Log the wallet update
    INSERT INTO public.logs (level, message, created_at) VALUES (
      'info', 
      'Wallet balance updated for user: ' || NEW.user_id::text || ', transaction: ' || NEW.id::text,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the new trigger with the safer function
CREATE TRIGGER update_wallet_balance_trigger_safe
AFTER UPDATE OF payment_status ON wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION update_wallet_balance_safe();

-- Create logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.logs (
  id SERIAL PRIMARY KEY,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on logs table
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Create policy for logs
CREATE POLICY "Allow all operations on logs" ON public.logs FOR ALL USING (true);
