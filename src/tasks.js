var database = require('./database'),
  configFile = require('../config'),
  Q = require('q'),
  request = require('request');

module.exports = {
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
    var innerDeferred = Q.defer();
    var innerTaskList = {
      getZoom: function() {
        request({
          url: 'http://a.tiles.mapbox.com/v3/' + config.mbtiles.mapboxId + '.json',
          json: true
        }, function(err, res, body) {
          innerDeferred.resolve(body);
        });
        return innerDeferred.promise;
      },
      getTiles: function() {
        database(config).runScript(config.database.updateSql, {
          lastUpdate: startTime
        }, function(err, res) {
          innerDeferred.resolve(res);
        });
        return innerDeferred.promise;
      }
    };
    Q.all([
      innerTaskList.getZoom() //,
      //        innerTaskList.getTiles()
    ]).done(deferred.resolve);
    return deferred.promise;
  },
  validateArgs: function(args, callback) {
    if (
      args.i &&
      args.d &&
      configFile.interfaces[args.i] &&
      args.d) {
      // We will need to check these args at some point
      callback(configFile.interfaces[args.i], args.d);
    } else {
      console.log('invalid args (requires -i for interface and -d with date');
    }
  }
};
