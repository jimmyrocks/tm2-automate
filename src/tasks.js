var database = require('./database'),
  configFile = require('../config'),
  tileMath = require('./tilemath'),
  mapboxUpload = require('mapbox-upload'),
  Q = require('q'),
  request = require('request'),
  tilelive = require('tilelive');

module.exports = {
  database: {
    renderData: function(config, startTime) {
      var deferred = Q.defer();
      database(config).runScript(config.database.renderData, {
        lastUpdate: startTime
      }, function(e, r) {
        deferred.resolve(r);
      });
      return deferred.promise;
    },
    getBounds: function(config, startTime) {
      var deferred = Q.defer();
      var innerTaskList = {
        getZoom: function() {
          var innerDeferred = Q.defer();
          request({
            url: 'http://a.tiles.mapbox.com/v3/' + config.mbtiles.mapboxId + '.json',
            json: true
          }, function(err, res, body) {
            innerDeferred.resolve(body);
          });
          return innerDeferred.promise;
        },
        getTiles: function() {
          var innerDeferred = Q.defer();
          database(config).runScript(config.database.updateSql, {
            lastUpdate: startTime
          }, function(err, res) {
            innerDeferred.resolve(res);
          });
          return innerDeferred.promise;
        }
      };
      Q.all([
        innerTaskList.getZoom(),
        innerTaskList.getTiles()
      ]).done(function(res) {
        var returnValue = {};
        returnValue.minZoom = res[0].minzoom;
        returnValue.maxZoom = res[0].maxzoom;
        // TODO START HERE

        deferred.resolve(returnValue);
      });
      return deferred.promise;
    }
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
    getTilesFromBounds: function(minLon, maxLon, minLat, maxLat, minZoom, maxZoom) {
      var tiles = [],
        tms = {};
      for (var zoom = minZoom; zoom <= maxZoom; zoom++) {
        tms[zoom] = {
            minX: tileMath.long2tile(minLon, zoom),
            minY: tileMath.lat2tms(minLat, zoom),
            maxX: tileMath.long2tile(maxLon, zoom),
            maxY: tileMath.lat2tms(maxLat, zoom)
        };
        for (var xRow = tms[zoom].minX; xRow <= tms[zoom].maxX; xRow++) {
          for (var yRow = tms[zoom].minY; yRow <= tms[zoom].maxY; yRow++) {
            tiles.push([zoom, xRow, yRow]);
          }
        }
      }
    }
  },
  validateArgs: function(args, callback) {
    if (
      args.project &&
      args.startTime &&
      configFile.interfaces[args.project] &&
      args.startTime) {
      // We will need to check these args at some point
      callback(configFile.interfaces[args.project], args.startTime);
    } else {
      console.log('invalid args (requires -p for project and -d with datetime');
    }
  }
};
