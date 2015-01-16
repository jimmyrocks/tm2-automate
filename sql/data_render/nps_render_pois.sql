-- Function: nps_render_pois(character varying)

-- DROP FUNCTION nps_render_pois(character varying);

CREATE OR REPLACE FUNCTION nps_render_pois(character varying)
  RETURNS bigint AS
$BODY$
DECLARE
  v_task_name ALIAS FOR $1;
  v_last_run timestamp without time zone;
  v_nodes bigint[];
  v_updated_nodes bigint[];
  v_deleted_nodes bigint[];
  v_start_time timestamp without time zone;
  v_last_nodes bigint[];
  v_rowid bigint;
  v_new_rowid bigint;
  v_extent geometry[];
BEGIN

 -- provide a buffered start time so don't miss anything
  v_start_time := NOW()::timestamp without time zone;

  -- Get the last time that this specific task was run from the task list
  SELECT
    COALESCE(max(run_time) - '5 second'::interval, TIMESTAMP WITH TIME ZONE 'epoch')
  FROM
    "nps_render_log"
  WHERE
    "render_id" = (
      SELECT
        COALESCE(
          MAX("render_id"),
          -1
        )
      FROM
        "nps_render_log"
      WHERE
        "task_name" = v_task_name
    ) AND
    "task_name" = v_task_name
  INTO
    v_last_run;

  -------------------------
  -- Get the change list --
  -------------------------

  -- Get the list of points that have been updated since the last run
  SELECT
    array_agg("osm_id")
  FROM
    "planet_osm_point"
  WHERE
    "planet_osm_point"."created" > v_last_run
  INTO
     v_updated_nodes;

  -- Get the list of nodes that have been removed
  SELECT
    array_agg("id")
  FROM
    "nodes"
  WHERE
    "osm_id" NOT IN (
      SELECT
        "osm_id"
      FROM
        "planet_osm_point"
    )
  INTO
     v_deleted_nodes;

  -- Get the original Points
  SELECT
    array_agg("way") AS "way_array"
  FROM
    "render_park_pois"
  WHERE
    "osm_id" = ANY(v_updated_nodes || v_deleted_nodes)
  INTO
    v_extent;

  -- Remove the updated and deleted nodes from the table
  DELETE FROM
    "render_park_pois"
  WHERE
    "osm_id" = ANY(v_updated_nodes);

  DELETE FROM
    "render_park_pois"
  WHERE
    "osm_id" = ANY(v_deleted_nodes);

  ------------------------
  -- Update the records --
  ------------------------
  -- Insert the records that have been created
  INSERT INTO "render_park_pois" SELECT
    "planet_osm_point"."osm_id" AS "osm_id",
    "planet_osm_point"."type" AS "type",
    "planet_osm_point"."tags" -> 'name'::text AS "name",
    "planet_osm_point"."tags" -> 'nps:unit_code'::text AS "unit_code",
    "planet_osm_point"."tags",
    "planet_osm_point"."z_order",
    "planet_osm_point"."way",
    "planet_osm_point"."created",
    100 as "minzoompoly"
  FROM
    "planet_osm_point"
  WHERE
    "planet_osm_point"."created" > v_last_run;

  ---------------------------------------------
  -- Special post processing for the records --
  ---------------------------------------------
  -- Spatial Join the Records with their alphacodes (so all points have an alphacode)
  -- The projection for OSM is 900913, although we use 3857, and they are identical
  -- PostGIS requires a 'transform' between these two SRIDs when doing a comparison,
  -- this is why we use ST_Transform in this step
  UPDATE
    "render_park_pois"
  SET
    "unit_code" = "render_park_polys"."unit_code"
  FROM
    "render_park_polys"
  WHERE
    "render_park_pois"."created" > v_last_run AND
    "render_park_pois"."unit_code" IS NULL AND
    (
      ST_Transform("render_park_pois"."way", 3857) && "render_park_polys"."poly_geom") AND
    ST_Contains(
      "render_park_polys"."poly_geom",
      ST_Transform("render_park_pois"."way", 3857)
    );

  -- Minzoompoly
  -- So all points have a minzoompoly field
  UPDATE
    "render_park_pois"
  SET
    "render_park_pois"."minzoompoly" = "render_park_polys"."minzoompoly"
  FROM
    "render_park_polys"
  WHERE
    "render_park_pois"."created" > v_last_run AND
    "render_park_pois"."unit_code" = "render_park_polys"."unit_code";

  ---------------------------
  -- Build the render list --
  ---------------------------
  -- Get all records created since the last time this script ran
  -- This includes
  --   1) new nodes that have been created since the last run
  --   2) nodes that have been updated since the last run
  SELECT
    ARRAY_AGG("osm_id")
  FROM
    "render_park_pois"
  WHERE
    "render_park_pois"."created" > v_last_run
  INTO
    v_nodes;

  -- Add the new nodes to the extent calculation
  SELECT
    array_agg("render_park_pois"."way") || v_extent
  FROM
    "render_park_pois"
  WHERE
    "render_park_pois"."osm_id" = ANY(v_nodes)
  INTO
    v_extent;

  -- Get the id of the row referring to the previous run
  SELECT
    COALESCE(MAX("nps_render_log"."render_id"),0)
  FROM
    "nps_render_log"
  WHERE
    "nps_render_log"."task_name" = v_task_name
  INTO
    v_rowid;

  -- Get an id for the next (possible) render log entry
  SELECT
    v_rowid + 1
  INTO
    v_new_rowid;

  -- Check the last TWO occurances for updates
  -- (probably could do this with nest / unnest, but this seems to be faster)
  -- Check the previous row (Add in updated and deleted nodes)
  SELECT
    "nps_render_log"."updated_nodes" || "nps_render_log"."deleted_nodes"
  FROM
    "nps_render_log"
  WHERE
    "nps_render_log"."render_id" = v_rowid
  INTO
    v_last_nodes;

  -- Add in nodes from the row one before the previous row
  SELECT
    v_last_nodes || "nps_render_log"."updated_nodes" || "nps_render_log"."deleted_nodes"
  FROM
    "nps_render_log"
  WHERE
    "nps_render_log"."render_id" = v_rowid-1
  INTO
    v_last_nodes;

  -- Only write to the log when there is a change since the last run
  -- (this keeps us from having a ton of empty log records in the db)
  IF (v_rowid < 1) OR (v_last_nodes IS NOT NULL OR (v_nodes || v_deleted_nodes) IS NOT NULL)
  THEN
    INSERT INTO "nps_render_log" (
      "nps_render_log"."render_id",
      "nps_render_log"."task_name",
      "nps_render_log"."run_time",
      "nps_render_log"."updated_nodes",
      "nps_render_log"."deleted_nodes",
      "nps_render_log"."extent"
    ) VALUES (
      v_new_rowid,
      v_task_name,
      v_start_time,
      v_nodes,
      v_deleted_nodes,
      v_extent
    );
  END IF;

  -- Return a concatenated array of the nodes that have been updated and nodes that have been deleted
  -- this list of nodes can be used to determine where changes need to be made
  -- basically, we need to re-run all tiles that have either had a node updated or deleted
  return v_new_rowid;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;
ALTER FUNCTION nps_render_pois(character varying)
  OWNER TO osm;
