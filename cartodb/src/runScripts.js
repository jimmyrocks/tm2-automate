var Bluebird = require('bluebird');
var config = require('../config');
var database = require('datawrap')(config.database.poi_pgs, config.database.defaults);
var fandlebars = require('fandlebars');
var request = Bluebird.promisify(require('request'));
var fs = require('fs');

module.exports = {
  database: function(file, params) {
    return new Bluebird(function(resolve, reject) {
      database.runQuery('file:///' + file, params, function(e, r) {
        if (e) {
          reject(e);
        } else {
          resolve(r);
        }
      });
    });
  },
  server: function(sql, params) {
    return new Bluebird(function(resolve, reject) {
      var queries = [];

      if (!Array.isArray(sql)) {
        sql = [sql];
      }
      sql.map(function(query) {
        var queryText;
        console.log(query);
        if (query.substr(0, 7) === 'file://') {
          queryText = fs.readFileSync(__dirname + '/../sql' + query.substr(7), 'utf8').split(';');
          if (params.singleTransaction) {
            queries.push(queryText);
          } else {
            queryText.map(function(q) {
              queries.push(q + ';');
            });
          }
        } else {
          queries.push(query);
        }
      });

      console.log('queries', queries, sql);

      var runQuery = function(query) {
        return new Bluebird(function(queryResolve, queryReject) {
          var cleanedSql = fandlebars(query, params).replace(/\'null\'/g, 'null');
          var requestPath = 'https://' + config.cartodb.account + '.cartodb.com/api/v2/sql?q=';
          requestPath += encodeURIComponent(cleanedSql);
          requestPath += '&api_key=' + config.cartodb.apiKey;
          request(requestPath).then(function(r) {
            console.log('CartoDB Command Complete', cleanedSql);
            queryResolve(r);
          }).catch(function(e) {
            queryReject(new Error(e));
          });
        });
      };

      Bluebird.all(queries.map(runQuery)).then(function(r) {
        resolve(r);
      }).catch(function(e) {
        reject(new Error(e));
      });

    });
  }
};
