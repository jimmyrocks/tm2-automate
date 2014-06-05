var config = require('../config'),
  pg = require('pg'),
  fs = require('fs'),
  Q = require('q'),
  connect = function(callback) {
    var connectionString = 'postgres://' +
      config.database.username + ':' +
      config.database.password + '@' +
      config.database.hostname + '/' +
      config.database.dbname;
    pg.connect(connectionString, callback);
  };

module.exports = {
  runQuery: function(query, params, callback) {
    connect(function(err, client, done) {
      if (err) {
        return console.error('error fetching client from pool', err);
      }
      client.query(query, params, function(err, result) {
        done();
        if (err) {
          return console.error('error running query', err, query);
        }
        callback(err, result);
      });
    });
  },
  runScript: function(filename, callback) {
    fs.readFile(filename, 'utf8', function(err, res) {
      var queries = res.split(';');
      if (err) {
        callback(err);
      } else {
        module.exports.runQueryList(queries, callback);
      }
    });
  },
  runQueryList: function(queryObj, callback) {
    var results = [],
      queryIndex = -1,
      next = function() {
        queryIndex++;
        if (queryIndex < queryObj.length) {
          runQuery(queryIndex);
        } else {
          done();
        }
      },
      runQuery = function(i) {
        var result = {
          'query': queryObj[i]
        };
        module.exports.runQuery(
          queryObj[i].query ? queryObj[i].query : queryObj[i].toString(),
          queryObj[i].params ? queryObj[i].params : null,
          function(e, r) {
            result.err = e;
            result.result = r;
            results.push(result);
            next();
          });
      },
      done = function() {
        callback(null, results);
      };
    next();
  },
  runQueryListAsync: function(queries, callback) {
    qRunQuery = function(queryObj) {
      var deferred = Q.defer();
      module.exports.runQuery(
        queryObj.query ? queryObj.query : queryObj.toString(),
        queryObj.params ? queryObj.params : null,
        function(e, r) {
          deferred.resolve(e, r);
        });
      return deferred.promise;
    };
    Q.all(queries.map(qRunQuery))
      .done(function(e, r) {
        callback(e, r);
      });
  }
};
