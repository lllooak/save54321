/*
  # Add foreign key relationship for wallet transactions

  1. Changes
    - Add foreign key constraint between wallet_transactions.user_id and auth.users.id
    - This enables joining wallet_transactions with users table to get user details

  2. Security
    - No changes to RLS policies required
    - Existing policies continue to protect data access
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'wallet_transactions_user_id_fkey'
  ) THEN
    ALTER TABLE public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id);
  END IF;
END $$;
