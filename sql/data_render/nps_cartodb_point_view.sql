CREATE OR REPLACE VIEW public.nps_cartodb_point_view AS
SELECT
  "nps_render_point"."osm_id" AS "cartodb_id",
  "nps_render_point"."tags" -> 'name'::text AS "name",
  "nps_render_point"."tags" -> 'nps:places_id'::text AS "places_id",
  "nps_render_point"."unit_code" AS "unit_code",
  "nps_render_point"."type" AS "type",
  "nps_render_point"."tags"::json::text AS tags,
  "nps_render_point"."way" AS the_geom
FROM "nps_render_point";;
COMMENT ON VIEW public.nps_cartodb_point_view
  IS 'This view is designed to transform our internal nps_render_point table into the table we maintain in cartodb.';
