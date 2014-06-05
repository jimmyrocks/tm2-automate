 var database = require('./src/database'),
   config = require('./config'),
   tileMath = require('./src/tilemath'),
   tilelive = require('tilelive');
 tilelive.protocols['mbtiles:'] = require('mbtiles');
 //console.log(tileMath.toWgs84(tileMath.toWebMercator(-105,39.75).lat, tileMath.toWebMercator(-105,39.75).lon));

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

 dbUpdate.getTiles(function(e, r) {
   r.map(function(tile) {
     console.log(tile.join('/'));
   });
   process.exit(e ? 1 : 0);
 });
