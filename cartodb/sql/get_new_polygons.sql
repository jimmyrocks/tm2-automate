-- Get all of the updates
SELECT
  "nps_cartodb_polygon_view"."cartodb_id",
  "nps_cartodb_polygon_view"."version",
  "nps_cartodb_polygon_view"."name",
  "nps_cartodb_polygon_view"."places_id",
  "nps_cartodb_polygon_view"."tags",
  "nps_cartodb_polygon_view"."type",
  "nps_cartodb_polygon_view"."unit_code",
  ST_AsGeoJSON(ST_Transform("nps_cartodb_polygon_view"."the_geom", 4326))::text AS "the_geom"
FROM
  "nps_cartodb_polygon_view"
WHERE
  "nps_cartodb_polygon_view"."cartodb_id" = ANY({{changes}});

