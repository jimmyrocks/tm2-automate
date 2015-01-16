-- Write to the table that we're running the script
-- We do this first to capture changes that happen while it's running
INSERT INTO
  "nps_render_log"
VALUES (
  (SELECT
    COALESCE(
      MAX("render_id"),
      0
    )+1
  FROM
    "nps_render_log"
  ),
  {{taskName}},
  NOW()::timestamp without time zone
);
