 var configFile = require('./config'),
   tileMath = require('./src/tilemath'),
   download = require('./src/download'),
   mbtiles = require('mbtiles'),
   tilelive = require('tilelive'),
   tileliveCopy = require('./src/copy.js'),
   util = require('util'),
   readline = require('readline'),
   argv = require('minimist')(process.argv.slice(2)),
   mapboxUpload = require('mapbox-upload');
 tilelive.protocols['mbtiles:'] = mbtiles;

 var updateTiles = function(config) {
   var database = require('./src/database')(config),
     mbtilesFile = 'mbtiles://' + config.mbtiles.mbtilesPath,
     bridge = 'bridge://' + config.tilemill2.projectPath + '/data.xml';
   config.tileliveNodeScripts = (__dirname + '/node_modules/tilelive');
   config.currentJob = (__dirname + '/tiles/tm2-automate-' + config.mbtiles.mapboxId + '-' + Date.now().toString() + '.job');

   var dbUpdate = {
     getBounds: function(callback) {
       database.runScript(config.database.updateSql, callback);
     },
     getCoords: function(callback) {
       dbUpdate.getBounds(function(e, r) {
         if (e) {
           callback(e);
           return;
         }
         var col = 'st_asgeojson';
         var coords = [];
         for (var row in r[0].result.rows) {
           coords.push(JSON.parse(r[0].result.rows[row][col]).coordinates[0]);
         }
         callback(null, coords);
       });
     },
     getTiles: function(callback, minTile, maxTile) {
       var tiles = [];
       minTile = minTile || 5;
       maxTile = maxTile || 11;
       dbUpdate.getCoords(function(e, r) {
         if (e || !r) {
           callback(e);
           return;
         }
         r.map(function(coord) {
           var bounds = {
             'minLon': parseFloat(coord[0][0]),
             'maxLon': parseFloat(coord[2][0]),
             'minLat': parseFloat(coord[0][1]),
             'maxLat': parseFloat(coord[1][1])
           };
           for (var zoom = minTile; zoom <= maxTile; zoom++) {
             var minTmsX = tileMath.long2tile(bounds.minLon, zoom),
               minTmsY = tileMath.lat2tms(bounds.minLat, zoom),
               maxTmsX = tileMath.long2tile(bounds.maxLon, zoom),
               maxTmsY = tileMath.lat2tms(bounds.maxLat, zoom);
             for (var xRow = minTmsX; xRow <= maxTmsX; xRow++) {
               for (var yRow = minTmsY; yRow <= maxTmsY; yRow++) {
                 tiles.push([zoom, xRow, yRow]);
               }
             }
           }
         });
         callback(null, tiles);
       });
     }
   };


   // Determine the tiles that have changed
   dbUpdate.getTiles(function(e, r) {
     var copyTiles = function() {
       // Display the status of the MBtiles file
       tilelive.info(mbtilesFile, function(tileliveE) {
         if (tileliveE) throw tileliveE;
         console.log('Verified mbtiles file: ' + mbtilesFile);
         // Copy The Tiles
         tileliveCopy({
             '_': [bridge, mbtilesFile],
             'scheme': 'raw',
             'raw': tileList.join('\n'),
             'job': config.currentJob
           }, config.tileliveNodeScripts,
           function(copyE, copyR) {
             console.log(copyE ? '**** Copy Error ****' : ' Copy Success!');
             console.log(copyE ? JSON.stringify(copyE, null, 2) : copyR);
             if (copyE) {
               throw copyE;
            } else {
              mapboxUpload({
                file: config.mbtiles.mbtilesPath,
                account: configFile.mapbox.account,
                accesstoken: configFile.mapbox.accesstoken,
                mapid: config.mbtiles.mapboxId
              }, function(uploadErr, uploadRes) {

                console.log(uploadErr ? '**** Upload Error ****' : ' Upload Begin!');
                uploadRes.once('end', function() {
                  console.log('Upload Success!');
                  process.exit(uploadErr ? 1 : 0);
                });
              });
            }
           }
         );
       });
     };

     if (r && r.length > 0) {
       // Create the tile list
       var tileList = [];
       r.map(function(tile) {
         tileList.push(tile.join('/'));
       });
       // Download the tiles from mapbox
       if (config.mbtiles.downloadFromServer) {
         console.log('Starting download');
         download('http://a.tiles.mapbox.com/v3/' + config.mbtiles.mapboxId + '.mbtiles', config.mbtiles.mbtilesPath, function(e) {
           if (e) throw e;
           copyTiles();
         });
       } else {
         copyTiles();
       }
     } else {
       console.log(e ? '**** Error ****' : 'Nothing to Update!');
       if (e) throw e;
       process.exit(e ? 1 : 0);
     }
   });
 };

 var startProcess = function(selectedConfig) {
   if (configFile.interfaces[selectedConfig]) {
     updateTiles(configFile.interfaces[selectedConfig]);
   } else {
     if (selectedConfig) {
       util.puts('"' + selectedConfig + '" not found\r');
     }
     var rl = readline.createInterface({
       input: process.stdin,
       output: process.stdout
     });
     util.puts('Which update would you like to run?\r');
     util.puts('-----------------------------------\r');
     for (var configName in configFile.interfaces) {
       util.puts(configName + '\r');
     }
     util.puts('-----------------------------------\r');
     rl.question('please type in the interface name: ', function(answer) {
       rl.close();
       startProcess(answer);
     });
   }
 };

 startProcess(argv._ ? argv._[0] : null);
