var Bluebird = require('bluebird');
var cartoDbScripts = require('../cartoDbScripts');
var config = require('../config');
var runScript = require('./runScripts');
var sqlFiles = require('../sqlScripts');
var fs = require('fs');

module.exports = function(type) {
  var params = {
    'taskName': type + '_' + config.taskName
  };

  return new Bluebird(function(resolve, reject) {
    runScript.database(sqlFiles.writeStartTime, params).then(function() {
      runScript.database(sqlFiles[type].getChanges, params).then(function(result) {
        if (result && result[0] && result[0].result && result[0].result.rows && result[0].result.rows[0] && result[0].result.rows[0].ids) {
          console.log('Updating ' + type + '!');
          console.log('New ID', result[0].result.rows[0].ids);
          params.changes = '{' + result[0].result.rows[0].ids.join(',') + '}';
          params.cartoDbChanges = 'ARRAY[' + result[0].result.rows[0].ids.join(',') + ']';
          runScript.database(sqlFiles[type].getNewData, params).then(function(listOfUpdates) {
            params.newData = listOfUpdates[0].result.rows;

            // CartoDB doesn't like a long delete list, so we split up the list
            var numberOfDeletes = 25;
            var cartoDbDeletes = [];
            var paramParts = [];
            for (var i = 0; i < result[0].result.rows[0].ids.length; i += numberOfDeletes) {
              console.log('Change #', i, '-', i + numberOfDeletes);
              paramParts[i] = {
                'cartoDbChanges': 'ARRAY[' + result[0].result.rows[0].ids.slice(i, i + (numberOfDeletes - 1)) + ']'
              };
              cartoDbDeletes[i] = runScript.server(cartoDbScripts[type].remove, paramParts[i]);
            }
            Bluebird.all(cartoDbDeletes).then(function() {
              var insertList = [];
              params.newData.map(function(row) {
                insertList.push(
                  runScript.server(cartoDbScripts[type].insert, row)
                );
              });
              Bluebird.all(insertList).then(function() {
                // Post Sync Transactions
                // TODO: Clean this up!
                var viewParams = {
                  'singleTransation': true
                };
                var viewList = [];
                var postSyncTasks = fs.readdirSync(__dirname + '/../sql/views').indexOf(type) > -1;
                if (postSyncTasks) {
                  fs.readdirSync(__dirname + '/../sql/views/' + type).map(function(fileName) {
                    viewList.push(runScript.server('file:///views/' + type + '/' + fileName, viewParams));
                  });
                }
                if (viewList.length > 0) {
                  Bluebird.all(viewList).then(function() {
                    resolve('Done with ' + type + 's and its ' + viewList.length + ' materialized view' + (viewList.length > 1 ? 's!' : '!'));
                  }).catch(function(e) {
                    reject(new Error(e));
                  });
                } else {
                  resolve('Done with ' + type + 's!');
                }
              }).catch(function(e) {
                reject(new Error(e));
              });
            }).catch(function(e) {
              reject(new Error(e));
            });
          }).catch(function(e) {
            reject(new Error(e));
          });
        } else {
          resolve('No ' + type + ' updates!');
        }
      }).catch(function(e) {
        reject(new Error(e));
      });
    }).catch(function(e) {
      reject(new Error(e));
    });
  });
};
