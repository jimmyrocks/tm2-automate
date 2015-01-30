SELECT
  ST_YMax(the_geom) AS maxLat,
  ST_YMin(the_geom) AS minLat,
  ST_XMax(the_geom) AS maxLon,
  ST_XMin(the_geom) AS minLon,
  osm_id
FROM (
  SELECT
    "osm_id",
    ST_Transform(the_geom, 4326) the_geom
  FROM
    "nps_render_point",
    (SELECT
      COALESCE(
        (SELECT "run_time"
        FROM "nps_render_log"
        WHERE "render_id" = (
          SELECT MAX("render_id")
          FROM "nps_render_log"
          WHERE "task_name" = {{taskName}})
       ),
       NOW()::timestamp without time zone
     ) AS "end_time",
     COALESCE(
      (SELECT "run_time"
      FROM "nps_render_log"
      WHERE "render_id" = (SELECT max("render_id")-1
        FROM "nps_render_log"
        WHERE "task_name" = {{taskName}})
      ),
      '2010-01-01'::timestamp without time zone
    ) as "start_time") "render_time"
  WHERE
    "nps_render_point"."rendered" >= "render_time"."start_time" AND
    "nps_render_point"."rendered" <= "render_time"."end_time"
  UNION ALL
  SELECT
   "osm_id",
    ST_Transform(way, 4326) the_geom
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
      WHERE "render_id" = (SELECT max("render_id")-1
        FROM "nps_render_log"
        WHERE "task_name" = {{taskName}})
      ),
      '2010-01-01'::timestamp without time zone
    ) as "start_time") "render_time"
  WHERE
    "nps_change_log"."change_time" >= "render_time"."start_time" AND
    "nps_change_log"."change_time" <= "render_time"."end_time" AND
    "nps_change_log"."member_type" = 'N'
) "new_and_changed"
WHERE
  the_geom IS NOT NULL;
