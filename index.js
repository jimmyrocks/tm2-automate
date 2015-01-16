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

// This is the task runner
var executeTasks = function(config, startTime) {

  // Q will run all the tasks added to its array
  // it returns the results in an array (called r in this case), the first task is index 0, second one is index 1
  Q.all([
    // * refresh the rendered data
    // * This function updates the render table in the database, it does not need to return anything other than and error and a callback when it has finished
    tasks.database.renderData(config, startTime),
    // * Create a list of the required tiles
    tasks.database.getBounds(config, startTime),
  ]).catch(function(e) {
    throw new Error(e);
  }).then(function(r) {
    // Once the two tasks are done:

    // Check if there are new tiles that can be updated
    if (r[1].tileListFile) {

      // * Download the last version of mbtiles
      Q.all([
        config.mbtiles.downloadFromServer ? tasks.mbtiles.downloadTiles(config.mbtiles.mbtilesDir, config.mbtiles.mapboxId) : null
      ]).catch(function(e) {
        // Catch any errors with the download task
        console.log('Download Error');
        throw new Error(e);
      }).then(function() {
        // * Remove the tiles from our source sqlite file that we are going to update
        // (This is required because tilelive will not copy/replace new blank tiles over existing tiles)
        tasks.mbtiles.removeTiles(r[1], config.mbtiles.mbtilesDir, config.mbtiles.mapboxId, config.tilemill2.projectPath, function(removalResult) {
          console.log(removalResult ? "Removal was successful" : "Removal Failure");
          if (removalResult) {
            // Copy over the new tiles with tileliveCopy
            console.log('=================================');
            console.log(r[1], config.mbtiles.mbtilesDir, config.mbtiles.mapboxId, config.tilemill2.projectPath);
            console.log('=================================');
            tasks.mbtiles.updateTiles(r[1], config.mbtiles.mbtilesDir, config.mbtiles.mapboxId, config.tilemill2.projectPath, function(taskResult) {
              if (taskResult.code === 0) {
                // Upload the tiles to mapbox
                if (config.mbtiles.uploadToServer) {
                  console.log('Uploading tiles');
                  tasks.mbtiles.uploadTiles(config.mbtiles.mbtilesDir + '/' + config.mbtiles.mapboxId + '.mbtiles', config.mbtiles.mapboxId, function() {
                    // Full task is complete
                    tasks.exitProcess('done', r[1], 0);
                  });
                } else {
                  tasks.exitProcess('done, without upload to mapbox', r[1], 0);
                }
              } else {
                tasks.exitProcess('mbtiles update error', r[1], taskResult.code);
              }
            });
          } else {
            tasks.exitProcess('Removal Failure', r[1], 1);
          }
        });
      });
    } else {
      tasks.exitProcess('No New tiles', r[1], 0);
    }
  });
};

tasks.validateArgs(argv, executeTasks);
