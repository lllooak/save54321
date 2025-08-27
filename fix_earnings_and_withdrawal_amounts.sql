-- Fix earnings and withdrawal amounts to reflect net earnings (70% after 30% platform fee)
-- This script will:
-- 1. Identify earnings records with incorrect amounts
-- 2. Update earnings records to correct net amounts
-- 3. Recalculate creator wallet balances based on corrected earnings

BEGIN;

-- Create a temporary table to store the corrections needed
CREATE TEMP TABLE earnings_corrections AS
SELECT 
    e.id as earnings_id,
    e.creator_id,
    r.id as request_id,
    r.price as full_request_price,
    e.amount as current_earnings_amount,
    ROUND((r.price * 0.70)::numeric, 2) as correct_net_amount,
    ROUND((r.price * 0.70)::numeric, 2) - e.amount as adjustment_amount,
    e.status as earnings_status
FROM earnings e
JOIN requests r ON e.request_id = r.id
WHERE e.amount != ROUND((r.price * 0.70)::numeric, 2)  -- Only records with incorrect amounts
AND e.amount = r.price;  -- Only records that have full amount instead of net amount

-- Display what will be corrected
DO $$
DECLARE
    correction_count integer;
    rec RECORD;
BEGIN
    SELECT COUNT(*) INTO correction_count FROM earnings_corrections;
    RAISE NOTICE 'Found % earnings records that need correction', correction_count;
    
    IF correction_count > 0 THEN
        RAISE NOTICE 'Sample corrections needed:';
        FOR rec IN 
            SELECT * FROM earnings_corrections LIMIT 5
        LOOP
            RAISE NOTICE 'Request ID: %, Current: %, Should be: %, Adjustment: %', 
                rec.request_id, rec.current_earnings_amount, rec.correct_net_amount, rec.adjustment_amount;
        END LOOP;
    END IF;
END $$;

-- Update earnings records to correct net amounts
UPDATE earnings 
SET amount = ec.correct_net_amount
FROM earnings_corrections ec
WHERE earnings.id = ec.earnings_id;

-- For completed earnings, we need to adjust the creator wallet balances
-- Calculate the total adjustment needed per creator
CREATE TEMP TABLE wallet_adjustments AS
SELECT 
    ec.creator_id,
    SUM(ec.adjustment_amount) as total_adjustment
FROM earnings_corrections ec
WHERE ec.earnings_status = 'completed'
GROUP BY ec.creator_id;

-- Update creator wallet balances with the adjustment
UPDATE users 
SET wallet_balance = ROUND((wallet_balance + wa.total_adjustment)::numeric, 2)
FROM wallet_adjustments wa
WHERE users.id = wa.creator_id;

-- Create wallet transaction records for the adjustments
INSERT INTO wallet_transactions (
    user_id,
    amount,
    type,
    payment_status,
    description
)
SELECT 
    wa.creator_id,
    wa.total_adjustment,
    'adjustment',
    'completed',
    'Earnings correction - Platform fee adjustment to reflect net earnings (70%)'
FROM wallet_adjustments wa
WHERE wa.total_adjustment != 0;

-- Display summary of changes made
DO $$
DECLARE
    updated_earnings integer;
    updated_wallets integer;
    total_adjustment_sum numeric;
BEGIN
    SELECT COUNT(*) INTO updated_earnings FROM earnings_corrections;
    SELECT COUNT(*) INTO updated_wallets FROM wallet_adjustments;
    SELECT COALESCE(SUM(wa.total_adjustment), 0) INTO total_adjustment_sum FROM wallet_adjustments wa;
    
    RAISE NOTICE 'SUMMARY:';
    RAISE NOTICE 'Updated % earnings records to correct net amounts', updated_earnings;
    RAISE NOTICE 'Adjusted % creator wallet balances', updated_wallets;
    RAISE NOTICE 'Total wallet adjustment amount: %', total_adjustment_sum;
    
    IF total_adjustment_sum < 0 THEN
        RAISE NOTICE 'WARNING: Negative total adjustment means wallets will be reduced. This is expected if earnings were previously showing full amounts.';
    END IF;
END $$;

-- Verify the corrections
SELECT 
    'After correction' as status,
    COUNT(*) as total_earnings,
    SUM(CASE WHEN e.amount = r.price THEN 1 ELSE 0 END) as full_amount_records,
    SUM(CASE WHEN e.amount = ROUND((r.price * 0.70)::numeric, 2) THEN 1 ELSE 0 END) as net_amount_records
FROM earnings e
JOIN requests r ON e.request_id = r.id;

COMMIT;

-- Final verification query to show corrected earnings
SELECT 
    'Final check - Recent earnings' as info,
    e.id as earnings_id,
    r.price as request_price,
    e.amount as earnings_amount,
    ROUND((r.price * 0.70)::numeric, 2) as expected_net,
    CASE 
        WHEN e.amount = ROUND((r.price * 0.70)::numeric, 2) THEN '✓ CORRECT'
        ELSE '✗ STILL INCORRECT'
    END as status
FROM earnings e
JOIN requests r ON e.request_id = r.id
ORDER BY r.created_at DESC
LIMIT 10;
