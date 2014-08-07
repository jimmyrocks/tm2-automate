var fandlebars = require('./fandlebars'),
  fs = require('fs'),
  pg = require('pg'),
  Q = require('q');

module.exports = function(config) {
  var connect = function(callback) {
      var connectionString = 'postgres://' +
        config.database.username + ':' +
        config.database.password + '@' +
        config.database.hostname + '/' +
        config.database.dbname;
      pg.connect(connectionString, callback);
    },
    db = {
      readParams: function(rawQuery, objParams) {
        var returnValue = {
          query: rawQuery,
          params: [],
          tempParams: {}
        };
        if (objParams && Object.prototype.toString.call(objParams) === '[object Object]') {
          for (var paramIndex in objParams) {
            returnValue.tempParams[paramIndex] = '$' + (returnValue.params.push(objParams[paramIndex]));
          }
          returnValue.query = fandlebars(rawQuery, returnValue.tempParams);
          console.log('ret', returnValue);
          delete returnValue.tempParams;
        }
        return returnValue;
      },
      runQuery: function(query, params, callback) {
        console.log(params);
        console.log('type', typeof(params));
        if (params && Object.prototype.toString.call(params) === '[object Object]') {
          var newParams = db.readParams(query, params);
          query = newParams.query;
          params = newParams.params;
        }
        console.log('params', params);
        console.log('query', query);
        callback(null, {});
        /*
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
        */
      },
      runScript: function(filename, params, callback) {
        fs.readFile(filename, 'utf8', function(err, res) {
          var queries = [];
          if (err) {
            callback(err);
          } else {
            res.split(';').map(function(queryText) {
              if (queryText.replace(/[\s\r\n]/g, '').length > 0) {
                queries.push({
                  query: queryText.toString(),
                  params: params
                });
              }
            });
            db.runQueryList(queries, callback);
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
            db.runQuery(
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
        var qRunQuery = function(queryObj) {
          var deferred = Q.defer();
          db.runQuery(
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
  return db;
};
