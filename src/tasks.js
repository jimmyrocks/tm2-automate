 var configFile = require('../config'),
  database = require('./database'),
  fs = require('fs'),
  tileMath = require('./tilemath'),
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
        for (var row in res[1][0].result.rows) {
          var currentRow = res[1][0].result.rows[row];
          tiles = tiles.concat(tasks.tiles.getTilesFromBounds(
            parseFloat(currentRow.minlon, 10),
            parseFloat(currentRow.maxlon, 10),
            parseFloat(currentRow.minlat, 10),
            parseFloat(currentRow.maxlat, 10),
            parseFloat(res[0].minzoom, 10),
            parseFloat(res[0].maxzoom, 10),
            returnValue.bufferSize
          ));
        }
        returnValue.tileListFile = config.tilemill2.projectPath + '/.newtiles.list';
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
    getInfo: function(mbtilesFile, callback) {
      tilelive.info(mbtilesFile, function(err, res) {
        if (err) throw err;
        callback(res);
      });
    },
    updateTiles: function(mbtilesFile, tileList, tm2ProjectPath, callback) {
      return [mbtilesFile, tileList, tm2ProjectPath, callback];
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
    getTilesFromBounds: function(minLon, maxLon, minLat, maxLat, minZoom, maxZoom, bufferPx) {
      var tiles = [],
        tms = {};
      for (var zoom = minZoom; zoom <= maxZoom; zoom++) {
        tms[zoom] = {
          minX: tileMath.long2tile(minLon, zoom, bufferPx * -1),
          minY: tileMath.lat2tms(minLat, zoom, bufferPx * -1),
          maxX: tileMath.long2tile(maxLon, zoom, bufferPx),
          maxY: tileMath.lat2tms(maxLat, zoom, bufferPx)
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
    }
  }
};
