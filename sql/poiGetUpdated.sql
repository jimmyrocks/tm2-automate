SELECT
  minLon/10000000::float as minLon,
  maxLon/10000000::float as maxLon,
  minLat/10000000::float as minLat,
  maxLat/10000000::float as maxLat
FROM
(
  -- NODES
  SELECT
    nodes.changeset_id, 
    (nodes.latitude) as minLat,
    (nodes.latitude) as maxLat,
    (nodes.longitude) as minLon,
    (nodes.longitude) as maxLon,
    nodes.node_id as obj_id,
    'Node' as obj_type
  FROM
    nodes JOIN changesets ON nodes.changeset_id = changesets.id
  WHERE
    changesets.created_at > {{lastUpdate}}
  UNION
  -- WAYS
  SELECT
    nodes.changeset_id, 
    min(nodes.latitude) as minLat,
    max(nodes.latitude) as maxLat,
    min(nodes.longitude) as minLon,
    max(nodes.longitude) as maxLon,
    way_nodes.way_id as obj_id,
    'Way' as obj_type
  FROM
    nodes JOIN way_nodes ON nodes.node_id = way_nodes.node_id JOIN changesets ON nodes.changeset_id = changesets.id
  WHERE
    changesets.created_at > {{lastUpdate}}
  GROUP BY
    nodes.changeset_id, way_nodes.way_id
) updated_points;
