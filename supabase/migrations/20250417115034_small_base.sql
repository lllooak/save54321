/*
  # Add index for wallet transactions

  1. Changes
    - Add index on user_id column for better query performance
    - Skip foreign key constraint since it already exists

  Note: The foreign key constraint wallet_transactions_user_id_fkey already exists,
  so we only need to create the index.
*/

-- Add index for better performance
CREATE INDEX IF NOT EXISTS wallet_transactions_user_id_idx ON wallet_transactions(user_id);
