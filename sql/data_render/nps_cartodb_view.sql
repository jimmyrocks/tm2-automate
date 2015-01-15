CREATE OR REPLACE VIEW public.nps_cartodb_view AS
SELECT
  "planet_osm_point"."osm_id" AS "cartodb_id",
  "planet_osm_point"."tags" -> 'name'::text AS "name",
  "planet_osm_point"."tags" -> 'nps:places_id'::text AS "places_id",
  "planet_osm_point"."tags" -> 'nps:unit_code'::text AS "unit_code",
  "planet_osm_point"."fcat" AS "type",
  "planet_osm_point"."tags"::json::text AS tags,
  "planet_osm_point"."way" AS the_geom
FROM "planet_osm_point";
