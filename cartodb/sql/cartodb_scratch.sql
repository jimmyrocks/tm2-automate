-- In order to update the data on cartodb
--
--- Write to the table that we're running the script
-- We do this first to capture changes that happen while it's running
INSERT INTO "nps_render_log" VALUES ((SELECT COALESCE(MAX("render_id"),0)+1 FROM "nps_render_log"), 'main_render_task', NOW()::timestamp without time zone);
--
-- Get a list of all the ids that have changed since the last run
SELECT ARRAY_AGG(DISTINCT "osm_id") FROM "nps_change_log", (SELECT
  COALESCE((SELECT "run_time" FROM "nps_render_log" WHERE "render_id" = (SELECT max("render_id") FROM "nps_render_log" WHERE "task_name" = 'main_render_task')),NOW()::timestamp without time zone) AS "end_time",
  COALESCE((SELECT "run_time" FROM "nps_render_log" WHERE "render_id" = (SELECT max("render_id")-1 FROM "nps_render_log" WHERE "task_name" = 'main_render_task')),'2010-01-01'::timestamp without time zone) as "start_time")
  "render_time"
WHERE
  "nps_change_log"."change_time" >= "render_time"."start_time" AND
  "nps_change_log"."change_time" <= "render_time"."end_time" AND
  "nps_change_log"."member_type" = 'N';

-- Get all of the updates
SELECT
  "nps_cartodb_point_view"."cartodb_id",
  "nps_cartodb_point_view"."version",
  "nps_cartodb_point_view"."name",
  "nps_cartodb_point_view"."places_id",
  "nps_cartodb_point_view"."tags",
  "nps_cartodb_point_view"."type",
  "nps_cartodb_point_view"."unit_code"
FROM
  "nps_cartodb_point_view"
WHERE
  "nps_cartodb_point_view"."cartodb_id" = ANY(ARRAY[$VALUES]);

-- CartoDB Queries
-- run DELETES on CartoDB for all of these features
DELETE FROM "points_of_interest" WHERE "cartodb_id" = ANY(ARRAY[$VALUES]);
--
INSERT INTO "points_of_interest" (
  "cartodb_id"
  "version",
  "name",
  "places_id",
  "tags",
  "type",
  "unit_code"
) VALUES ($1,$2,$3,$4,$5,$6,$7);
