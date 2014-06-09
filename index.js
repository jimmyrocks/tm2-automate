 var database = require('./src/database'),
   config = require('./config'),
   tileMath = require('./src/tilemath'),
   tileliveCopy = require('./src/copy.js'),
   mbtilesFile = 'mbtiles://' + config.tm2MbtilesOutput,
   bridge = 'bridge://' + config.tm2ProjectPath + '/data.xml';

 config.tileliveNodeScripts = (__dirname + '/node_modules/tilelive');
 config.currentJob = (__dirname + '/tiles/tm2-automate-' + Date.now() + '.job');

 var dbUpdate = {
   getBounds: function(callback) {
     database.runScript('./sql/getBounds.sql', callback);
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
   if (r && r.length > 0) {
     // Create the tile list
     var tileList = [];
     r.map(function(tile) {
       tileList.push(tile.join('/'));
     });
     // Copy The Tiles
     tileliveCopy({
         '_': [bridge, mbtilesFile],
         'scheme': 'raw',
         'raw': tileList.join('\n'),
         'job': config.currentJob
       }, config.tileliveNodeScripts,
       function(copyE, copyR) {
         console.log(copyE ? '**** Error ****' : 'Success!');
         console.log(copyE ? JSON.stringify(copyE, null, 2) : copyR);
         if (copyE) throw copyE;
         process.exit(copyE ? 1 : 0);
       }
     );
   } else {
     console.log(e ? '**** Error ****' : 'Nothing to Update!');
     if (e) throw e;
     process.exit(e ? 1 : 0);
   }
 });
