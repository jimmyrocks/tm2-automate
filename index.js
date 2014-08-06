var configFile = require('./config'),
  argv = require('minimist')(process.argv.slice(2));

var startProcess = function(config, startTime) {
  // First we need to start three tasks:
  //   * refresh the rendered data
  //   * retrieve the updated points
  //     * Create the list of tiles the change
  //     * De-duplicate the list
  //   * Download the last version of mbtiles
  // Once the three tasks are done:
  // Copy in the new tiles with tileliveCopy
  // Upload the tiles to mapbox
 
  return [config, startTime];
};

var validateArgs = function(args) {
  if (
      args.i &&
      args.d &&
      configFile.interfaces[args.i] &&
      args.d) {
    // We will need to check these args at some point
    startProcess(configFile.interfaces[args.i], args.d);
  } else {
    console.log('invalid args (requires -i for interface and -d with date');
  }
};

validateArgs(argv);
