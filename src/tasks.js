 var configFile = require('../config'),
   database = require('./database'),
   download = require('./download'),
   exec = require('shelljs').exec,
   fs = require('fs'),
   mapboxUpload = require('mapbox-upload'),
   Q = require('q'),
   tilelive = require('tilelive'),
   tileMath = require('./tilemath'),
   yaml = require('js-yaml');

 var tasks = module.exports = {
   database: {
     renderData: function(config, startTime) {
       var deferred = Q.defer();
       database(config, config.database.scripts.render.dbname).runScript(config.database.scripts.render.sql, {
         lastUpdate: startTime
       }, function(e, r) {
         deferred.resolve(r);
       });
       return deferred.promise;
     },
     getBounds: function(config, startTime) {
       var deferred = Q.defer();
       var innerTaskList = {
         getProjectYML: function() {
           var innerDeferred = Q.defer();
           fs.readFile(config.tilemill2.projectPath + '/data.yml', function(e, r) {
             if (e) throw e;
             innerDeferred.resolve(yaml.load(r));
           });
           return innerDeferred.promise;
         },
         getTiles: function() {
           var innerDeferred = Q.defer();
           database(config, config.database.scripts.bounds.dbname).runScript(config.database.scripts.bounds.sql, {
             lastUpdate: startTime
           }, function(err, res) {
             innerDeferred.resolve(res);
           });
           return innerDeferred.promise;
         }
       };
       Q.all([
         innerTaskList.getProjectYML(),
         innerTaskList.getTiles()
       ]).done(function(res) {
         var returnValue = {},
           tiles = [];
         returnValue.minZoom = res[0].minzoom;
         returnValue.maxZoom = res[0].maxzoom;
         returnValue.extent = tasks.mbtiles.parseBounds(res[0].Layer);
         console.log(JSON.stringify(res[0], null, 2));
         for (var layerIndex = 0; layerIndex < res[0].Layer.length; layerIndex++) {
           var bufferSize = res[0].Layer[layerIndex].properties['buffer-size'];
           if (bufferSize && ((returnValue.bufferSize && bufferSize > returnValue.bufferSize) || !returnValue.bufferSize)) {
             returnValue.bufferSize = bufferSize;
           }
         }
         returnValue.bounds = {
           raw: {
             north: '-90',
             south: '90',
             east: '-180',
             west: '180'
           }
         };
         if (res[1][0].rowCount === 0) {
           console.log('No Updates');
         }
         for (var row in res[1][0].result.rows) {
           var currentRow = res[1][0].result.rows[row],
             currentBounds = {
               north: parseFloat(currentRow.maxlat, 10),
               south: parseFloat(currentRow.minlat, 10),
               east: parseFloat(currentRow.maxlon, 10),
               west: parseFloat(currentRow.minlon, 10)
             };
           // Find the min/max
           returnValue.bounds.raw.north = currentBounds.north > returnValue.bounds.raw.north ? currentBounds.north : returnValue.bounds.raw.north;
           returnValue.bounds.raw.south = currentBounds.south < returnValue.bounds.raw.south ? currentBounds.south : returnValue.bounds.raw.south;
           returnValue.bounds.raw.east = currentBounds.east > returnValue.bounds.raw.east ? currentBounds.east : returnValue.bounds.raw.east;
           returnValue.bounds.raw.west = currentBounds.west < returnValue.bounds.raw.west ? currentBounds.west : returnValue.bounds.raw.west;

           returnValue.bounds.render = tasks.tiles.getRenderBoundsFromBounds(
             returnValue.bounds.raw,
             parseFloat(res[0].minzoom, 10),
             returnValue.bufferSize
           );

           // Calculate the tiles
           tiles = tiles.concat(tasks.tiles.getTilesFromBounds(
             currentBounds,
             parseFloat(res[0].minzoom, 10),
             parseFloat(res[0].maxzoom, 10),
             returnValue.bufferSize
           ));
         }
         returnValue.tileListFile = config.mbtiles.mbtilesDir + '/' + config.mbtiles.mapboxId  + '.list';
         fs.writeFile(returnValue.tileListFile, tasks.deduplicate(tiles).join('\n'), function(writeErr) {
           if (writeErr) throw writeErr;
           deferred.resolve(returnValue);
         });
       });
       return deferred.promise;
     }
   },
   deduplicate: function(array) {
     return array.filter(function(item, position, base) {
       return (base.indexOf(item) === position);
     });
   },
   mbtiles: {
     downloadTiles: function(dir, mapboxId) {
       var deferred = Q.defer(),
         path = dir + '/' + mapboxId + '.mbtiles';
       download(
         'http://a.tiles.mapbox.com/v3/' + mapboxId + '.mbtiles',
         path,
         function(e) {
           if (e) throw e;
           deferred.resolve(path);
         });
       return deferred.promise;
     },
     getInfo: function(mbtilesFile, callback) {
       tilelive.info(mbtilesFile, function(err, res) {
         if (err) throw err;
         callback(res);
       });
     },
     parseBounds: function(layers) {
       var bounds = {
         'east': -20037508.34,
         'north': -20037508.34,
         'south': 20037508.34,
         'west': 20037508.34
       },
       boundsArray = [bounds.west, bounds.south, bounds.east, bounds.north],
       boundsArrayWgs84 = [];
       layers.map(function(layer) {
         var layerBoundsArray;
         if (layer.Datasource && layer.Datasource.extent) {
           layerBoundsArray = layer.Datasource.extent.split(',');
           boundsArray[0] = boundsArray[0] > layerBoundsArray[0] ? layerBoundsArray[0] : boundsArray[0];
           boundsArray[1] = boundsArray[1] > layerBoundsArray[1] ? layerBoundsArray[1] : boundsArray[1];
           boundsArray[2] = boundsArray[2] < layerBoundsArray[2] ? layerBoundsArray[2] : boundsArray[2];
           boundsArray[3] = boundsArray[3] < layerBoundsArray[3] ? layerBoundsArray[3] : boundsArray[3];
         }
       });
       console.log('aa', boundsArray);
       boundsArrayWgs84[0] = tileMath.toWgs84(boundsArray[0], boundsArray[1]).lon;
       boundsArrayWgs84[1] = tileMath.toWgs84(boundsArray[0], boundsArray[1]).lat;
       boundsArrayWgs84[2] = tileMath.toWgs84(boundsArray[2], boundsArray[3]).lon;
       boundsArrayWgs84[3] = tileMath.toWgs84(boundsArray[2], boundsArray[3]).lat;
       return boundsArrayWgs84.join(',');
     },
     updateTiles: function(tileInfo, dir, mapboxId, tm2ProjectPath, callback) {
       console.log('Updating the Tiles');
       var mbtilesFile = dir + '/' + mapboxId + '.mbtiles';
       var command = [
         ' --scheme=', 'list',
         ' --list=', tileInfo.tileListFile,
         ' --concurrency=', '16', ' ',
         'bridge://' + tm2ProjectPath, '/data.xml', ' ',
         'mbtiles://' + mbtilesFile
       ].join('');
       tasks.mbtiles._tileliveCopy(command, callback);
     },
     updateAllTiles: function(tileInfo, dir, mapboxId, tm2ProjectPath, callback) {
       console.log('Updating All the Tiles');
       var mbtilesFile = dir + '/' + mapboxId + '.mbtiles';
       var command = [
         ' --scheme ', 'scanline',
         ' --minzoom ', tileInfo.minZoom,
         ' --maxzoom ', tileInfo.maxZoom,
         ' -b', tileInfo.extent, ' ',
         'bridge://' + tm2ProjectPath, '/data.xml', ' ',
         'mbtiles://' + mbtilesFile
       ].join('');
       tasks.mbtiles._tileliveCopy(command, callback);
     },
     _tileliveCopy: function(command, callback) {
       var tileliveCopyPath = __dirname + '/../node_modules/tilelive/bin/tilelive-copy';
       callback(exec(tileliveCopyPath + ' ' + command));
     },
     uploadTiles: function(mbtilesFile, mapboxId, callback) {
       mapboxUpload({
         account: configFile.mapbox.account,
         accesstoken: configFile.mapbox.accesstoken,
         file: mbtilesFile,
         mapid: mapboxId
       }, callback);
     }
   },
   tiles: {
     getRenderBoundsFromBounds: function(bounds, minZoom, bufferPx) {
       return {
         north: tileMath.tile2lat(tileMath.lat2tile(bounds.north, minZoom, bufferPx), minZoom),
         south: tileMath.tile2lat((tileMath.lat2tile(bounds.south, minZoom, bufferPx * -1) + 1), minZoom),
         east: tileMath.tile2long((tileMath.long2tile(bounds.east, minZoom, bufferPx) + 1), minZoom),
         west: tileMath.tile2long(tileMath.long2tile(bounds.west, minZoom, bufferPx * -1), minZoom)
       };
     },
     getTilesFromBounds: function(bounds, minZoom, maxZoom, bufferPx) {
       var tiles = [],
         tms = {};
       for (var zoom = minZoom; zoom <= maxZoom; zoom++) {
         tms[zoom] = {
           minX: tileMath.long2tile(bounds.west, zoom, bufferPx * -1),
           minY: tileMath.lat2tile(bounds.south, zoom, bufferPx * -1),
           maxX: tileMath.long2tile(bounds.east, zoom, bufferPx),
           maxY: tileMath.lat2tile(bounds.north, zoom, bufferPx)
         };
         for (var xRow = tms[zoom].minX; xRow <= tms[zoom].maxX; xRow++) {
           for (var yRow = tms[zoom].minY; yRow <= tms[zoom].maxY; yRow++) {
             tiles.push([zoom, xRow, yRow].join('/'));
           }
         }
       }
       return tiles;
     }
   },
   validateArgs: function(args, callback) {
     if (
       args.project &&
       args.startTime &&
       configFile.projects[args.project] &&
       args.startTime) {
       // We will need to check these args at some point
       callback(configFile.projects[args.project], args.startTime);
     } else {
       console.log('invalid args (requires -p for project and -d with datetime');
       console.log('Valid projects are:');
       for (var projectName in configFile.projects) {
         console.log('  * ' + projectName);
       }
       console.log('');
     }
   }
 };
