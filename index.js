var argv = require('minimist')(process.argv.slice(2), {
    alias: {
      d: 'startTime',
      date: 'startTime',
      t: 'startTime',
      time: 'startTime',
      p: 'project',
      i: 'project'
    }
  }),
  tasks = require('./src/tasks.js'),
  Q = require('q');

var executeTasks = function(config, startTime) {

  Q.all([
    // * refresh the rendered data
    tasks.database.renderData(config, startTime),
    // * Create a list of the required tiles
    tasks.database.getBounds(config, startTime),
    // * Download the last version of mbtiles
    config.mbtiles.downloadFromServer ? tasks.mbtiles.downloadTiles(config.mbtiles.mbtilesDir, config.mbtiles.mapboxId) : null
  ]).done(function(r) {
    // Once the three tasks are done:
    // Copy in the new tiles with tileliveCopy
    //updateTiles: function(mbtilesFile, tileList, tm2ProjectPath, callback) {¶
    tasks.mbtiles.updateTiles(r[1], config.mbtiles.mbtilesDir, config.mbtiles.mapboxId, config.tilemill2.projectPath, function(taskResult) {
      if (taskResult.code === 0) {
        // Upload the tiles to mapbox
        if (config.mbtiles.uploadToServer) {
          console.log('Uploading tiles');
          tasks.mbtiles.uploadTiles(config.mbtiles.mbtilesDir + '/' + config.mbtiles.mapboxId + '.mbtiles', config.mbtiles.mapboxId, function() {
            console.log(JSON.stringify(r[1], null, 2));
            console.log('done');
            process.exit(0);
          });
        } else {
          console.log(JSON.stringify(r[1], null, 2));
          process.exit(0);
        }
      } else {
        process.exit(taskResult.code);
      }
    });
  });
};

tasks.validateArgs(argv, executeTasks);
