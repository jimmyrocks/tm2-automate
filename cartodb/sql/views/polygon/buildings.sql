TRUNCATE "buildings";
INSERT INTO
  "buildings" (
    "cartodb_id",
    "the_geom",
    "name",
    "places_id",
    "type",
    "unit_code",
    "version",
    "created_at",
    "updated_at",
    "the_geom_webmercator"
  )
SELECT
  "cartodb_id",
  "the_geom",
  "name",
  "places_id",
  "type",
  "unit_code",
  "version",
  "created_at",
  "updated_at",
  "the_geom_webmercator"
FROM
  "places_polygons"
WHERE
  ("places_polygons"."tags"::json ->> 'building') IS NOT NULL;
