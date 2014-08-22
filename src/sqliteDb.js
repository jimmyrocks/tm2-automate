var sqlite3 = require('sqlite3'),
  Q = require('q');

module.exports = function(sqliteFile) {
  var isOpen = true;
  querylist = [];
  query = {
    add: function(sql) {
      if (isOpen) {
        querylist.push(sql)
        return true;
      } else {
        return false;
      }
    },
    run: function(callback) {
      if (isOpen) {
        sqliteDb = new sqlite3.Database(sqliteFile);
        Q.all(querylist.map(function(sql) {
            return runCommand(sql, sqliteDb);
          })).done(function(res) {
            isOpen = false;
            callback(null, res);
          });
        } else {
          callback("connection closed");
        }
      }
    },
    runCommand = function(sql, sqliteDb) {
      var deferred = Q.defer(),
        returnObj = {};
      sqliteDb.all(sql, function(err, rows) {
        returnObj = {
          err: err,
          rows: rows
        };
        deferred.resolve(returnObj);
      });
      return deferred.promise;
    };
    return query;
  }
