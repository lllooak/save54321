-- Very basic requests check

-- Just show recent requests
SELECT id, status, price, created_at FROM requests ORDER BY created_at DESC LIMIT 5;

-- Count by status
SELECT status, COUNT(*) FROM requests GROUP BY status;
