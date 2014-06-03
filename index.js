 var database = require('./src/database'),
   http = require('http'),
   config = require('./config'),
   tileMath = require('./src/tilemath');

 //console.log(tileMath.toWgs84(tileMath.toWebMercator(-105,39.75).lat, tileMath.toWebMercator(-105,39.75).lon));

 var getBounds = function(callback) {
   database.runScript('./sql/getNewBounds.sql', callback);
 };
 var exit = function(e) {
   process.exit(e ? 1 : 0);
 };
 var getTm2Source = function() {
   var options = {
     headers: {'user-agent': 'Linux Mozilla/5.0'},
     host: 'localhost',
     port: 3000,
     path: '/source?id=tmsource:///home/vagrant/Development/tilemill_sources/nps_places_poi_2.tm2',
     method: 'GET'
   };
   var req = http.get(options, function(res) {
     var data = '';
     res.setEncoding('utf8');
     res.on('error', function(e) {
       console.log('e', e);
     });
     res.on('data', function(chunk) {
       data += chunk;
     });
     res.on('end', function() {
       console.log(data, data);
     });
   });
   req.end();
 };
 getTm2Source();
 /*getBounds(function(e, r) {
   console.log('e:', e);
   console.log('r:', JSON.stringify(r, null, 2));
 });*/
