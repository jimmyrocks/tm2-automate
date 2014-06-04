 var database = require('./src/database'),
   config = require('./config'),
   http = require('http');

 //var tileMath = require('./src/tilemath');
 //console.log(tileMath.toWgs84(tileMath.toWebMercator(-105,39.75).lat, tileMath.toWebMercator(-105,39.75).lon));

 var dbUpdate = {
   getBounds: function(callback) {
     database.runScript('./sql/getNewBounds.sql', callback);
   }
 },
   exit = function(e) {
     process.exit(e ? 1 : 0);
   },
   runTm2 = {
     options: {
       headers: {
         'user-agent': 'Linux Mozilla/5.0',
         'Content-Type': 'application/json'
       },
       host: 'localhost',
       port: 3000
     },
     updateDatasource: function(options, callback) {
       runTm2.changeDatasource(options, function(e, r) {
         if (e) {
           callback(e, null);
         } else {
           runTm2.writeSource(r, callback);
         }
       });
     },
     writeSource: function(source, callback) {
       var options = runTm2.options;
       options.path = config.idSourcePath;
       options.method = 'PUT';
       var req = http.request(options, function(res) {
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
       //console.log(JSON.stringify(source, null,2));
       req.write(JSON.stringify(source));
       req.end();
     },
     changeDatasource: function(options, callback) {
       runTm2.getSource(function(e, r) {
         if (e) {
           callback(e, null);
         } else {
           //callback(e, JSON.parse(r).Layer[0].Datasource.extent, null, 2);
           var source = JSON.parse(r);
           source.Layer.map(function(layer) {
             for (var option in options) {
               if (layer && layer.Datasource) {
                 layer.Datasource[option] = options[option];
               }
             }
           });
           callback(null, source);
         }
       });
     },
     getSource: function(callback) {
       var options = runTm2.options;
       options.path = config.idSourcePath;
       options.method = 'GET';
       var req = http.get(options, function(res) {
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
     },
     getExtent: function(callback) {
       runTm2.getSource(function(e, r) {
         callback(e, JSON.parse(r).Layer[0].Datasource.extent, null, 2);
       });
     }
   };

 dbUpdate.getBounds(function(e, r) {
   var col = 'st_asgeojson',
     newBounds = JSON.parse(r[0].result.rows[0][col]).coordinates[0],
     bounds = {
       'minLon': newBounds[0][1],
       'maxLon': newBounds[1][1],
       'minLat': newBounds[0][0],
       'maxLat': newBounds[2][0]
     },
     boundStr = [bounds.minLat, bounds.minLon, bounds.maxLat, bounds.maxLon].join(',');
   //boundStrWgs84 = [tileMath.toWgs84(bounds.minLat, bounds.minLon).lat, tileMath.toWgs84(bounds.minLat, bounds.minLon).lon, tileMath.toWgs84(bounds.maxLat, bounds.maxLon).lat, tileMath.toWgs84(bounds.maxLat, bounds.maxLon).lon].join(',');
   //console.log(JSON.stringify(bounds, null, 2));
   console.log(JSON.stringify(boundStr, null, 2));
   runTm2.updateDatasource({
     'extent': boundStr
   }, function(e, r) {
     console.log('x', e, r);
     runTm2.getExtent(function(e, r) {
       console.log('new', r);
       exit();
     });
   });
 });
