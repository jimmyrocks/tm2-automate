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
  ]).done(function(r) {
    // Once the two tasks are done:
    // Copy in the new tiles with tileliveCopy
    if (r[1].tileListFile) {
      Q.all([
        // * Download the last version of mbtiles
        config.mbtiles.downloadFromServer ? tasks.mbtiles.downloadTiles(config.mbtiles.mbtilesDir, config.mbtiles.mapboxId) : null
      ]).done(function(r2) {
        tasks.mbtiles.removeTiles(r[1], config.mbtiles.mbtilesDir, config.mbtiles.mapboxId, config.tilemill2.projectPath, function(removalResult) {
          tasks.mbtiles.updateTiles(r[1], config.mbtiles.mbtilesDir, config.mbtiles.mapboxId, config.tilemill2.projectPath, function(taskResult) {
            if (taskResult.code === 0) {
              // Upload the tiles to mapbox
              if (config.mbtiles.uploadToServer) {
                console.log('Uploading tiles');
                tasks.mbtiles.uploadTiles(config.mbtiles.mbtilesDir + '/' + config.mbtiles.mapboxId + '.mbtiles', config.mbtiles.mapboxId, function() {
                  tasks.exitProcess('done', r[1], 0);
                });
              } else {
                tasks.exitProcess('', r[1], 0);
              }
            } else {
              tasks.exitProcess('mbtiles update error', r[1], taskResult.code);
            }
          });
        });
      });
    } else {
      tasks.exitProcess('No New tiles', r[1], 0);
    }
  });
};

tasks.validateArgs(argv, executeTasks);
