 var configFile = require('../config'),
   database = require('./database'),
   // download = require('./download'),
   exec = require('shelljs').exec,
   fs = require('fs'),
   mapboxUpload = require('mapbox-upload'),
   Q = require('q'),
   // sqliteDb = require('./sqliteDb'),
   tileMath = require('./tilemath'),
   // tilelive = require('tilelive'),
   yaml = require('js-yaml'),
   tasks = module.exports = {
     database: {
       renderData: function(config, startTime) {
         // This function runs SQL that will update the SQL database, there is no need to return anything from this function other than an error if it fails
         console.log('Getting the render data');
         var deferred = Q.defer();
         database(config, config.database.dbname).runScript(config.database.updateSql, {
           lastUpdate: startTime
         }, function(e, r) {
           console.log((e ? 'Error' : 'Finished') + ' getting the render data', e ? e : '');
           if (e) {
             deferred.reject(e);
           } else {
             deferred.resolve(r);
           }
         });
         return deferred.promise;
       },
       getBounds: function(config, startTime) {
         console.log('Getting the bounds data');
         var deferred = Q.defer();
         var innerTaskList = {
           getProjectYML: function() {
             console.log('Getting proj yml');
             var innerDeferred = Q.defer();
             fs.readFile(config.tilemill2.projectPath + '/data.yml', function(e, r) {
               console.log((e ? 'Error' : 'Finished') + ' getting the proj yml', e ? e : '');
               if (e) {
                 console.log('Error getting proj yml');
                 innerDeferred.reject(e);
               } else {
                 console.log('Finished getting proj yml');
                 innerDeferred.resolve(yaml.load(r));
               }
             });
             return innerDeferred.promise;
           },
           getTiles: function() {
             console.log('Getting the tiles');
             var innerDeferred = Q.defer();
             database(config, config.database.dbname).runScript(config.database.getBounds, {
               lastUpdate: startTime
             }, function(e, r) {
               console.log((e ? 'Error' : 'Finished') + ' getting the tiles', e ? e : '');
               if (e) {
                 innerDeferred.reject(e);
               } else {
                 innerDeferred.resolve(r);
               }
             });
             return innerDeferred.promise;
           }
         };
         Q.all([
           innerTaskList.getProjectYML(),
           innerTaskList.getTiles()
         ]).catch(function(e) {
             deferred.reject(e);
           }).then(function(res) {
             var returnValue = {},
               tiles = [];
             returnValue.minZoom = res[0].minzoom;
             returnValue.maxZoom = res[0].maxzoom;
             returnValue.extent = tasks.mbtiles.parseBounds(res[0].Layer);
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
             if (tiles.length > 0) {
               returnValue.tileListFile = config.mbtiles.mbtilesDir + '/' + config.mbtiles.mapboxId + '.list';
               returnValue.tileList = tiles;
               fs.writeFile(returnValue.tileListFile, tasks.deduplicate(tiles).join('\n'), function(writeErr) {
                 console.log((writeErr ? 'Error' : 'Finished') + ' writing the tile list', writeErr ? writeErr : '');
                 if (writeErr) {
                   deferred.reject(writeErr);
                 } else {
                   deferred.resolve(returnValue);
                 }
               });
             } else {
               // No updates!
               returnValue.tileListFile = false;
               deferred.resolve(returnValue);
             }
           });
           console.log('Getting the bounds');
           return deferred.promise;
         }
       },
       deduplicate: function(array) {
         return array.filter(function(item, position, base) {
           return (base.indexOf(item) === position);
         });
       },
       exitProcess: function(message, data, code) {
         if (data.tileList) {
           delete data.tileList;
         }
         removeImages.run(function(iE, iR) {
           console.log(iR);
           console.log('Finished removing the Old Tiles (images)');
           removeMaps.run(function(mE, mR) {
             console.log(mR);
             console.log('Finished removing the Old Tiles (map)');
             console.log('Finished removing the Old Tiles');
             callback(true);
           });
         });
       },
       _tileliveCopy: function(command, callback) {
         var tileliveCopyPath = __dirname + '/../node_modules/tilelive/bin/tilelive-copy';
         console.log('realcmd');
         console.log(tileliveCopyPath + ' ' + command);
         callback(exec(tileliveCopyPath + ' ' + command));
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
         console.log('COMMAND');
         console.log(command);
         console.log('COMMAND');
         tasks.mbtiles._tileliveCopy(command, callback);
       },
       uploadTiles: function(mbtilesFile, mapboxId, callback) {
         mapboxUpload({
           account: configFile.mapbox.account,
           accesstoken: configFile.mapbox.accesstoken,
           file: mbtilesFile,
           mapid: mapboxId
         }, callback);
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
               tileBounds = [];
             for (var zoom = minZoom; zoom <= maxZoom; zoom++) {
               tileBounds[zoom] = {
                 minX: tileMath.long2tile(bounds.west, zoom, bufferPx * -1),
                 minY: tileMath.lat2tile(bounds.south, zoom, bufferPx * -1),
                 maxX: tileMath.long2tile(bounds.east, zoom, bufferPx),
                 maxY: tileMath.lat2tile(bounds.north, zoom, bufferPx)
               };
               for (var xRow = tileBounds[zoom].minX; xRow <= tileBounds[zoom].maxX; xRow++) {
                 for (var yRow = tileBounds[zoom].minY; yRow <= tileBounds[zoom].maxY; yRow++) {
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
       }
     };
