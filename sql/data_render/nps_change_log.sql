-- Keeps track of geometries that have been updated or deleted
CREATE TABLE nps_change_log (
  osm_id bigint,
  version integer,
  member_type character,
  way geometry,
  created timestamp without time zone,
  change_time timestamp without time zone
);
