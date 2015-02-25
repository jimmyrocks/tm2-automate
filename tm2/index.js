var config = require('./config');
var fandlebars = require('fandlebars');
var tools = require('./src/tools');


var tasks = [
  // Create the list of tiles that need to be updated
  'getTiles',
  // Download the latest version of the tiles from the server
  'downloadMbtiles',
  // Read the mapbox-studio project to get the min/max Zooms, buffer size, and other params
  'readStudioFile',
  // Remove the tiles that have been updated from the mbtiles file (if we don't delete them there are sometimes errors with tileliveCopy)
  'removeTiles',
  // Generate (only) the new tiles into the mbtiles file using tileliveCopy
  'generateTiles',
  // Upload the tiles to mapbox
  'uploadMBtiles',
  // Complete task
  'completeTask'
];

var runNextTask = function(taskList, results, callback) {
  results = results ? results : {
    'config': fandlebars.obj(config, global.process),
    'settings': {
      'type': 'places_points'
    }
  };
  if (taskList.length) {
    console.log('Running Task', taskList[0]);
    tools[taskList[0]](results)
      .then(function(res) {
        results[taskList[0]] = res;
        if (res && res.stop) {
          if (callback) callback(res.errors, results);
        } else {
          runNextTask(taskList.slice(1), results, callback);
        }
      })
      .catch(function(err) {
        console.log(JSON.stringify(err, null, 2));
        throw (err.stack ? err : new Error(err));
      });
  } else {
    if (callback) callback(results.errors, results);
  }
};


runNextTask(tasks, null, function(e, r) {
  console.log(e, r);
  process.exit(e ? 1 : 0);
});
