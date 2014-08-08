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
    // Upload the tiles to mapbox
    console.log('done');
    console.log(JSON.stringify(r[1], null, 2));
    process.exit(0);
  });
};

tasks.validateArgs(argv, executeTasks);
