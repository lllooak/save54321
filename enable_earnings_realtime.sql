-- Enable real-time on earnings table
-- Run this when SQL Editor connectivity is restored

-- Method 1: Enable replica identity (required for realtime)
ALTER TABLE public.earnings REPLICA IDENTITY FULL;

-- Method 2: Alternative approach - set replica identity to DEFAULT if FULL fails
-- ALTER TABLE public.earnings REPLICA IDENTITY DEFAULT;

-- Verify the change
SELECT 'Earnings table replica identity status:' as info;
SELECT relname, relreplident,
       CASE relreplident
         WHEN 'd' THEN 'DEFAULT (using primary key) - REALTIME ENABLED'
         WHEN 'n' THEN 'NOTHING (realtime disabled)'  
         WHEN 'f' THEN 'FULL (all columns) - REALTIME ENABLED'
         WHEN 'i' THEN 'USING INDEX'
         ELSE 'UNKNOWN'
       END as replica_identity_status
FROM pg_class 
WHERE relname = 'earnings' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

SELECT 'Real-time should now be enabled on earnings table!' as result;
