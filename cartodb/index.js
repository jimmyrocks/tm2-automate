var cartoDbScripts = require('./cartoDbScripts');
var config = require('./config');
var Bluebird = require('bluebird');
var database = require('datawrap')(config.database.poi_pgs, config.database.defaults);
var fandlebars = require('fandlebars');
var request = Bluebird.promisify(require('request'));
var taskName = 'automated_task';
var files = {
  'writeStartTime': 'start_log.sql',
  'getChanges': 'get_changes.sql',
  'getNewData': 'get_new_data.sql'
};


var runDbScript = function(file, params) {
  return new Bluebird(function(resolve, reject) {
    database.runQuery('file:///' + file, params, function(e, r) {
      if (e) {
        reject(e);
      } else {
        resolve(r);
      }
    });
  });
};

var runServerScript = function(sql, params) {
  return new Bluebird(function(resolve, reject) {
    var cleanedSql = fandlebars(sql, params).replace(/\'null\'/g,'null');
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
};

var main = function() {
  var params = {
    'taskName': taskName
  };

  runDbScript(files.writeStartTime, params).then(function() {
    runDbScript(files.getChanges, params).then(function(result) {
      if (result && result[0] && result[0].result && result[0].result.rows && result[0].result.rows[0] && result[0].result.rows[0].ids) {
        console.log('Updating!');
        console.log('New ID', result[0].result.rows[0].ids);
        params.changes = '{' + result[0].result.rows[0].ids.join(',') + '}';
        params.cartoDbChanges = 'ARRAY[' + result[0].result.rows[0].ids.join(',') + ']';
        runDbScript(files.getNewData, params).then(function(listOfUpdates) {
          params.newData = listOfUpdates[0].result.rows;
          runServerScript(cartoDbScripts.remove, params).then(function() {
            var insertList = [];
            params.newData.map(function(row) {
              insertList.push(
                runServerScript(cartoDbScripts.insert, row)
              );
            });
            Bluebird.all(insertList).then(function() {
              console.log('Done, no errors!');
              process.exit();
            }).catch(function(e){throw e;});
          }).catch(function(e){throw e;});
        }).catch(function(e){throw e;});
      } else {
        console.log('No Updates');
        process.exit();
      }
    }).catch(function(e){throw e;});
  }).catch(function(e){throw e;});

};

main();
