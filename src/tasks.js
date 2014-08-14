 var configFile = require('../config'),
   database = require('./database'),
   download = require('./download'),
   exec = require('child_process').exec,
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
         returnValue.tileListFile = config.mbtiles.mbtilesDir + '/.newtiles.list';
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
     updateTiles: function(tileInfo, dir, mapboxId, tm2ProjectPath, callback) {
       var mbtilesFile = dir + '/' + mapboxId + '.mbtiles';
       var tileliveCopyPath = __dirname + '/../node_modules/tilelive/bin/tilelive-copy';
       var command = [
         ' --scheme ', 'list',
         ' --list ', tileInfo.tileListFile,
         ' --minzoom ', tileInfo.minZoom,
         ' --maxzoom ', tileInfo.maxZoom,
         ' --b', [tileInfo.bounds.render.west, tileInfo.bounds.render.south, tileInfo.bounds.render.east, tileInfo.bounds.render.north].join(','), ' ',
         'mbtiles://' + mbtilesFile, ' ',
         'bridge://' + tm2ProjectPath, '/data.xml'
       ].join('');
       callback(null, tileliveCopyPath + ' ' + command);
       /*exec(tileliveCopyPath + ' ' + command, function(error, stdout, stderr) {
         if (!error && !stderr) {
           callback(stdout);
         } else {
           console.log('error', error, stderr);
         }
       });*/
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
           minY: tileMath.lat2tms(bounds.south, zoom, bufferPx * -1),
           maxX: tileMath.long2tile(bounds.east, zoom, bufferPx),
           maxY: tileMath.lat2tms(bounds.north, zoom, bufferPx)
         };
         for (var xRow = tms[zoom].minX; xRow <= tms[zoom].maxX; xRow++) {
           for (var yRow = tms[zoom].minY; yRow >= tms[zoom].maxY; yRow--) {
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
