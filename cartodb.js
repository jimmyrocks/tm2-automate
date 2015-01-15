// In order to update the data on cartodb
//
// run the update script on the data_render database
// SELECT * FROM nps_render_pois('cartodb');
//
// We need to delete the extent geometries so they don't take up too much space (these aren't needed for a cartodb update)
// UPDATE render_log SET extent = null WHERE render_id = (SELECT max(render_id) FROM render_log WHERE task_name = 'cartodb');
//
// Get the list of nodes that have been modified
// SELECT unnest(deleted_nodes) FROM render_log WHERE render_id = (SELECT max(render_id) FROM render_log WHERE task_name = 'cartodb');
//
// Get the list of new records for CartoDB
// SELECT * FROM render_park_pois WHERE osm_id IN (SELECT unnest(updated_nodes) FROM render_log WHERE render_id = (SELECT max(render_id) FROM render_log WHERE task_name = 'cartodb'));
//
// Get the list of nodes from CartoDB that already exist
// SELECT id FROM places_points WHERE in IN ($LIST OF UPDATED NODES$)
//
// Delete the nodes from CartoDB
// DELETE FROM places_points WHERE id IN ($LIST OF DELETED NODES$)o
//
// UPDATE the nodes in CartoDB that already exist
// UPDATE places_points SET (...) WHERE id = osm_id
//
// INSERT the nodes that are new to CartoDB
// INSERT INTO places_points (...) VALUES (...);
