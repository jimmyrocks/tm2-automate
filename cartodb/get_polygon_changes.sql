SELECT
  array_agg("new_and_changed"."osm_id") AS "ids"
FROM
(
  SELECT
    "osm_id"
  FROM
    "nps_render_polygon",
   (SELECT
      COALESCE(
        (SELECT "run_time"
        FROM "nps_render_log"
        WHERE "render_id" = (SELECT max("render_id")
          FROM "nps_render_log"
          WHERE "task_name" = 'automated_task')
       ),
       NOW()::timestamp without time zone
     ) AS "end_time",
     COALESCE(
      (SELECT "run_time"
      FROM "nps_render_log"
      WHERE "render_id" = (SELECT max("render_id")-1
        FROM "nps_render_log"
        WHERE "task_name" = 'automated_task')
      ),
      '2010-01-01'::timestamp without time zone
    ) as "start_time") "render_time"
  WHERE
    "nps_render_polygon"."rendered" >= "render_time"."start_time" AND
    "nps_render_polygon"."rendered" <= "render_time"."end_time"
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
          WHERE "task_name" = 'automated_task')
       ),
       NOW()::timestamp without time zone
     ) AS "end_time",
     COALESCE(
      (SELECT "run_time"
      FROM "nps_render_log"
      WHERE "render_id" = (SELECT max("render_id")-1
        FROM "nps_render_log"
        WHERE "task_name" = 'automated_task')
      ),
      '2010-01-01'::timestamp without time zone
    ) as "start_time") "render_time"
  WHERE
    "nps_change_log"."change_time" >= "render_time"."start_time" AND
    "nps_change_log"."change_time" <= "render_time"."end_time" AND
    "nps_change_log"."member_type" = 'N'
) "new_and_changed";
