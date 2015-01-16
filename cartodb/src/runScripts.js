var Bluebird = require('bluebird');
var config = require('../config');
var database = require('datawrap')(config.database.poi_pgs, config.database.defaults);
var fandlebars = require('fandlebars');
var request = Bluebird.promisify(require('request'));

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
      var cleanedSql = fandlebars(sql, params).replace(/\'null\'/g, 'null');
      var requestPath = 'https://' + config.cartodb.account + '.cartodb.com/api/v2/sql?q=';
      requestPath += encodeURIComponent(cleanedSql);
      requestPath += '&api_key=' + config.cartodb.apiKey;
      request(requestPath).then(function(r) {
        console.log('CartoDB Command Complete', cleanedSql);
        resolve(r);
      }).catch(function(e) {
        reject(e);
      });
    });
  }
};
