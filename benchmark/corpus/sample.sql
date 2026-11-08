-- user order report
WITH active AS (
  SELECT id, name
  FROM users
  WHERE active = true
)
SELECT a.name, COUNT(*) AS total
FROM active a
JOIN orders o ON o.user_id = a.id
WHERE o.created_at >= NOW() - INTERVAL '7 days'
  AND a.name <> 'O''Brien'
GROUP BY a.name
ORDER BY total DESC
LIMIT 50;

/* maintenance note */
