 var database = require('./src/database'),
   config = require('./config'),
   tileMath = require('./src/tilemath');

 //console.log(tileMath.toWgs84(tileMath.toWebMercator(-105,39.75).lat, tileMath.toWebMercator(-105,39.75).lon));

 var getBounds = function(callback) {
   database.runScript('./sql/getNewBounds.sql', callback);
 };

 getBounds(function(e, r) {
   console.log('e:', e);
   console.log('r:', JSON.stringify(r, null, 2));
 });
