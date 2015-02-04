-- Get a list of all the ids that have changed since the last run
SELECT
  array_agg("new_and_changed"."osm_id") AS "ids"
FROM
(
  SELECT
    "osm_id"
  FROM
    "nps_render_point",
   (SELECT
      COALESCE(
        (SELECT "run_time"
        FROM "nps_render_log"
        WHERE "render_id" = (SELECT max("render_id")
          FROM "nps_render_log"
          WHERE "task_name" = {{taskName}})
       ),
       NOW()::timestamp without time zone
     ) AS "end_time",
     COALESCE(
      (SELECT "run_time"
      FROM "nps_render_log"
      WHERE "render_id" = (SELECT max("render_id")
        FROM "nps_render_log"
        WHERE "task_name" = {{taskName}}
          AND "nps_render_log"."render_id" < (SELECT max(b."render_id") FROM "nps_render_log" b WHERE "task_name" = {{taskName}}))
      ),
      '2010-01-01'::timestamp without time zone
    ) as "start_time") "render_time"
  WHERE
    "nps_render_point"."rendered" >= "render_time"."start_time" AND
    "nps_render_point"."rendered" <= "render_time"."end_time"
  UNION ALL
  SELECT 
    "osm_id"
  FROM
    "nps_change_log",
    (SELECT
      COALESCE(
        (SELECT "run_time"
        FROM "nps_render_log"
        WHERE "render_id" = (SELECT max("render_id")
          FROM "nps_render_log"
          WHERE "task_name" = {{taskName}})
       ),
       NOW()::timestamp without time zone
     ) AS "end_time",
     COALESCE(
      (SELECT "run_time"
      FROM "nps_render_log"
      WHERE "render_id" = (SELECT max("render_id")
        FROM "nps_render_log"
        WHERE "task_name" = {{taskName}}
          AND "nps_render_log"."render_id" < (SELECT max(b."render_id") FROM "nps_render_log" b WHERE "task_name" = {{taskName}}))
      ),
      '2010-01-01'::timestamp without time zone
    ) as "start_time") "render_time"
  WHERE
    "nps_change_log"."change_time" >= "render_time"."start_time" AND
    "nps_change_log"."change_time" <= "render_time"."end_time" AND
    "nps_change_log"."member_type" = 'N'
) "new_and_changed";
