-- Function: nps_render_pois(character varying)

-- DROP FUNCTION nps_render_pois(character varying);

CREATE OR REPLACE FUNCTION nps_render_pois(character varying)
  RETURNS bigint[] AS
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
  v_extent geometry[];
BEGIN
 -- provide a buffered start time so don't miss anything
  v_start_time := NOW()::timestamp without time zone;

  -- Get the last time that this specific task was run from the task list
  SELECT
    COALESCE(max(run_time) - '5 second'::interval, TIMESTAMP WITH TIME ZONE 'epoch')
  FROM
    render_log
  WHERE
    render_id = (
      SELECT COALESCE(max(render_id), -1) FROM render_log WHERE task_name = v_task_name
    ) AND
    task_name = v_task_name
  INTO
    v_last_run;

  -----------------------
  -- Update the tables --
  -----------------------
  -- This pulls from pgs_points which is a foreign data wrapper for the planet_osm_point table in the pgs database

  -- Get the list of nodes that have been updated since the last run
  SELECT
    array_agg(osm_id)
  FROM
    render_park_pois
  WHERE osm_id IN (
    SELECT
      osm_id
    FROM
      pgs_points
    WHERE
      pgs_points.created > v_last_run)
  INTO
     v_updated_nodes;

  -- Delete points that have been removed from the db
  -- TODO: Maybe this query can be improved to not take as long to run

  -- Get the list of nodes that have been removed
  SELECT
    array_agg(osm_id)
  FROM
    render_park_pois
  WHERE osm_id NOT IN (
    SELECT
      osm_id
    FROM
      pgs_points
    WHERE
      pgs_points.tags <> ''::hstore AND
      pgs_points.tags IS NOT NULL)
  INTO
     v_deleted_nodes;

  -- Get the original Bounds (the bounds of the points that we're going to update or delete)
  SELECT
    ST_Envelope(
        ST_Buffer(
          way, 1, 2 --Buffering the point by 1 meter makes a point a polygon
        )
    )
  FROM
    render_park_pois
  WHERE
    osm_id = ANY(v_updated_nodes || v_deleted_nodes)
  INTO
    v_extent;

  -- Remove the updated and deleted nodes from the table
  DELETE FROM
    render_park_pois
  WHERE
    osm_id = ANY(v_updated_nodes);

  DELETE FROM
    render_park_pois
  WHERE
    osm_id = ANY(v_deleted_nodes);

  ------------------------
  -- Update the records --
  ------------------------
  -- Insert the records that have been created
  INSERT INTO render_park_pois SELECT
  pgs_points.osm_id AS osm_id,
  pgs_points.fcat AS "FCategory",
    pgs_points.tags -> 'name'::text AS name,
    pgs_points.tags -> 'nps:alphacode'::text AS unit_code,
    pgs_points.tags,
    pgs_points.z_order,
    pgs_points.way,
    pgs_points.created,
    100 as minzoompoly
  FROM
    pgs_points
  WHERE
    pgs_points.created > v_last_run AND
    pgs_points.tags <> ''::hstore AND
    pgs_points.tags IS NOT NULL;

  ---------------------------------------------
  -- Special post processing for the records --
  ---------------------------------------------
  -- Spatial Join the Records with their alphacodes (so all points have an alphacode)
  -- The projection for OSM is 900913, although we use 3857, and they are identical
  -- PostGIS requires a 'transform' between these two SRIDs when doing a comparison,
  -- this is why we use ST_Transform in this step
  UPDATE
    render_park_pois
  SET
    unit_code = render_park_polys.unit_code
  FROM
    render_park_polys
  WHERE
    created > v_last_run AND
    (ST_Transform(render_park_pois.way, 3857) && render_park_polys.poly_geom) AND ST_CONTAINS(render_park_polys.poly_geom, ST_Transform(render_park_pois.way, 3857));

  -- Minzoompoly
  -- So all points have a minzoompoly field
  UPDATE
    render_park_pois
  SET
    minzoompoly = render_park_polys.minzoompoly
  FROM
    render_park_polys
  WHERE
    created > v_last_run AND
    render_park_pois.unit_code = render_park_polys.unit_code;

  ---------------------------
  -- Build the render list --
  ---------------------------
  -- Get all records created since the last time this script ran
  -- This includes
  --   1) new nodes that have been created since the last run
  --   2) nodes that have been updated since the last run
  SELECT
    ARRAY_AGG(osm_id)
  FROM
    render_park_pois
  WHERE
    created > v_last_run
  INTO
    v_nodes;

  -- Add the new nodes to the extent calculation
  SELECT
    array_agg(ST_Envelope(
        ST_Buffer(
          way, 1, 2 --Buffering the point by 1 meter makes a point a polygon
        )
      )
    ) || v_extent
  FROM
    render_park_pois
  WHERE
    osm_id = ANY(v_nodes)
  INTO
    v_extent;

  -- Get the id of the row referring to the previous run
  SELECT
    COALESCE(MAX(render_id),0)
  FROM
    render_log
  WHERE
    task_name = v_task_name
  INTO
    v_rowid;

  -- Check the last TWO occurances for updates
  -- (probably could do this with nest / unnest, but this seems to be faster)
  -- Check the previous row (Add in updated and deleted nodes)
  SELECT
    updated_nodes || deleted_nodes
  FROM
    render_log
  WHERE
    render_id = v_rowid
  INTO
    v_last_nodes;

  -- Add in nodes from the row one before the previous row
  SELECT
    v_last_nodes || updated_nodes || deleted_nodes
  FROM
    render_log
  WHERE
    render_id = v_rowid-1
  INTO
    v_last_nodes;

  -- Only write to the log when there is a change since the last run
  -- (this keeps us from having a ton of empty log records in the db)
  IF (v_rowid < 1) OR (v_last_nodes IS NOT NULL OR (v_nodes || v_deleted_nodes) IS NOT NULL)
  THEN
    INSERT INTO render_log (
    render_id,
    task_name,
    run_time,
    updated_nodes,
    deleted_nodes,
    extent
    ) VALUES (
      v_rowid + 1,
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
  return v_nodes || v_deleted_nodes;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;
ALTER FUNCTION nps_render_pois(character varying)
  OWNER TO osm;
