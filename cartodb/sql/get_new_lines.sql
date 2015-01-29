-- Get all of the updates
SELECT
  "nps_cartodb_line_view"."cartodb_id",
  "nps_cartodb_line_view"."version",
  "nps_cartodb_line_view"."name",
  "nps_cartodb_line_view"."places_id",
  "nps_cartodb_line_view"."tags",
  "nps_cartodb_line_view"."type",
  "nps_cartodb_line_view"."unit_code",
  ST_AsGeoJSON(ST_Transform("nps_cartodb_line_view"."the_geom", 4326))::text AS "the_geom"
FROM
  "nps_cartodb_line_view"
WHERE
  "nps_cartodb_line_view"."cartodb_id" = ANY({{changes}});

