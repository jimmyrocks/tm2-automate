-- Get all of the updates
SELECT
  "nps_cartodb_point_view"."cartodb_id",
  "nps_cartodb_point_view"."version",
  "nps_cartodb_point_view"."name",
  "nps_cartodb_point_view"."places_id",
  "nps_cartodb_point_view"."tags",
  "nps_cartodb_point_view"."type",
  "nps_cartodb_point_view"."unit_code",
  ST_AsGeoJSON(ST_Transform("nps_cartodb_point_view"."the_geom", 4326))::text AS "the_geom"
FROM
  "nps_cartodb_point_view"
WHERE
  "nps_cartodb_point_view"."cartodb_id" = ANY({{changes}});

