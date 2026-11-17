-- Keep the static demo data current: shift every score/progress timestamp
-- forward so the newest data point is always "yesterday".
-- The backend's leaderboard and dashboard compare CURRENT_DATE()-relative
-- weeks, so without this the demo goes blank ~2 weeks after seeding.
-- Idempotent: a no-op when the data is already current.
-- Tables are unqualified so they resolve to the project running the query.
DECLARE shift INT64 DEFAULT
  DATE_DIFF(CURRENT_DATE(), (SELECT DATE(MAX(timestamp)) FROM student_db.student_scores), DAY) - 1;

IF shift > 0 THEN
  UPDATE student_db.student_scores
  SET timestamp = TIMESTAMP_ADD(timestamp, INTERVAL shift DAY) WHERE TRUE;
  UPDATE student_db.student_progress
  SET timestamp = TIMESTAMP_ADD(timestamp, INTERVAL shift DAY) WHERE TRUE;
END IF;

SELECT GREATEST(IFNULL(shift, 0), 0) AS days_shifted;
