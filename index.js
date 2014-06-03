 var database = require('./src/database'),
   config = require('./config'),
   http = require('http');

 //var tileMath = require('./src/tilemath');
 //console.log(tileMath.toWgs84(tileMath.toWebMercator(-105,39.75).lat, tileMath.toWebMercator(-105,39.75).lon));

 var getBounds = function(callback) {
   database.runScript('./sql/getNewBounds.sql', callback);
 },
   exit = function(e) {
     process.exit(e ? 1 : 0);
   },
   getTm2Source = function(callback) {
     var options = {
       headers: {
         'user-agent': 'Linux Mozilla/5.0'
       },
       host: 'localhost',
       port: 3000,
       path: config.idSourcePath,
       method: 'GET'
     }, req = http.get(options, function(res) {
         var data = '';
         res.setEncoding('utf8');
         res.on('error', function(e) {
           callback(e, null);
         });
         res.on('data', function(chunk) {
           data += chunk;
         });
         res.on('end', function() {
           callback(null, data);
         });
       });
     req.end();
   };

 getBounds(function(e, r) {
   var col = 'st_asgeojson',
     newBounds = JSON.parse(r[0].result.rows[0][col]).coordinates[0],
     bounds = {
       'minLon': newBounds[0][1],
       'maxLon': newBounds[1][1],
       'minLat': newBounds[0][0],
       'maxLat': newBounds[2][0]
     },
     boundStr = [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat].join(',');
   getTm2Source(function(e, r) {
     console.log(JSON.stringify(bounds, null, 2));
     console.log(JSON.stringify(boundStr, null, 2));
     console.log(JSON.stringify(JSON.parse(r).Layer[0].Datasource.extent, null, 2));
     exit();
   });
 });
