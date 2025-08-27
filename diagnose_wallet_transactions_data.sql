-- Diagnose and fix wallet_transactions data before applying constraint
-- First, let's see what invalid type values exist

-- 1. Check all existing type values
SELECT DISTINCT type, COUNT(*) as count
FROM wallet_transactions 
GROUP BY type
ORDER BY count DESC;

-- 2. Find rows with invalid types (not in allowed list)
SELECT *
FROM wallet_transactions 
WHERE type NOT IN ('top_up', 'purchase', 'refund')
ORDER BY created_at DESC;

-- 3. Check if there are any NULL type values
SELECT COUNT(*) as null_type_count
FROM wallet_transactions 
WHERE type IS NULL;

-- 4. OPTION A: Update invalid types to valid ones
-- If we find 'earnings' type, we can temporarily change it to 'top_up' or create a more generic type
-- Uncomment the line below AFTER checking what invalid data exists:
-- UPDATE wallet_transactions SET type = 'top_up' WHERE type NOT IN ('top_up', 'purchase', 'refund');

-- 5. OPTION B: Delete invalid rows (if they're test/invalid data)
-- Uncomment the line below ONLY if you want to delete invalid rows:
-- DELETE FROM wallet_transactions WHERE type NOT IN ('top_up', 'purchase', 'refund');

-- 6. After cleaning up, then apply the constraint fix:
-- ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
-- ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK (type IN ('top_up', 'purchase', 'refund', 'earnings'));
