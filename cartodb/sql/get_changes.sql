-- Get a list of all the ids that have changed since the last run
SELECT 
  ARRAY_AGG(DISTINCT "osm_id")
FROM
  "nps_change_log",
  (SELECT
    COALESCE(
      (SELECT "run_time"
      FROM "nps_render_log"
      WHERE "render_id" = (SELECT max("render_id")
        FROM "nps_render_log"
        WHERE "task_name" = 'main_render_task')
     ),
     NOW()::timestamp without time zone
   ) AS "end_time",
   COALESCE(
    (SELECT "run_time"
    FROM "nps_render_log"
    WHERE "render_id" = (SELECT max("render_id")-1
      FROM "nps_render_log"
      WHERE "task_name" = 'main_render_task')
    ),
    '2010-01-01'::timestamp without time zone
  ) as "start_time") "render_time"
WHERE
  "nps_change_log"."change_time" >= "render_time"."start_time" AND
  "nps_change_log"."change_time" <= "render_time"."end_time" AND
  "nps_change_log"."member_type" = 'N';
