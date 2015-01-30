var sqlite3 = require('sqlite3'),
  Bluebird = require('bluebird');

module.exports = function(sqliteFile) {
  var isOpen = true,
    querylist = [],
    query = {
      add: function(sql) {
        if (isOpen) {
          querylist.push(sql);
          return true;
        } else {
          return false;
        }
      },
      run: function(callback) {
        var sqliteDb;
        if (isOpen) {
          sqliteDb = new sqlite3.Database(sqliteFile);
          Bluebird.all(querylist.map(function(sql) {
            return runCommand(sql, sqliteDb);
          })).then(function(res) {
            isOpen = false;
            callback(null, res);
          }).catch(function(err) {
            isOpen = false;
            callback(err);
          });
        } else {
          callback('connection closed');
        }
      }
    },
    runCommand = function(sql, sqliteDb) {
      return new Bluebird(function(fulfill) {
        var returnObj = {};
        sqliteDb.all(sql, function(err, rows) {
          returnObj = {
            err: err,
            rows: rows
          };
          fulfill(returnObj);
        });
      });
    };
  return query;
};
