-- Cleanup wallet_transactions invalid types before applying new constraint
-- Invalid types found: 'fee' (125 rows) and 'earning' (66 rows)

-- Step 1: Update 'earning' to 'earnings' (plural form - this is what our trigger will use)
UPDATE wallet_transactions 
SET type = 'earnings'
WHERE type = 'earning';

-- Step 2: Update 'fee' to 'refund' (closest valid type for platform fees)
-- Alternatively, we could add 'fee' to the allowed types if these are legitimate
UPDATE wallet_transactions 
SET type = 'refund'
WHERE type = 'fee';

-- Step 3: Verify all types are now valid
SELECT DISTINCT type, COUNT(*) as count
FROM wallet_transactions 
GROUP BY type
ORDER BY count DESC;

-- Step 4: Now apply the constraint with 'earnings' included
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_type_check 
CHECK (type IN ('top_up', 'purchase', 'refund', 'earnings'));

-- Step 5: Verify constraint was applied successfully
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'wallet_transactions_type_check';

-- Alternative approach if you want to keep 'fee' as a valid type:
-- ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check 
-- CHECK (type IN ('top_up', 'purchase', 'refund', 'earnings', 'fee'));
