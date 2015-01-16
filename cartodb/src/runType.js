var Bluebird = require('bluebird');
var cartoDbScripts = require('../cartoDbScripts');
var config = require('../config');
var runScript = require('./runScripts');
var sqlFiles = require('../sqlScripts');

module.exports = function(type) {
  var params = {
    'taskName': type + '_' + config.taskName
  };

  return new Bluebird(function(resolve, reject) {
    runScript.database(sqlFiles.writeStartTime, params).then(function() {
      runScript.database(sqlFiles[type].getChanges, params).then(function(result) {
        if (result && result[0] && result[0].result && result[0].result.rows && result[0].result.rows[0] && result[0].result.rows[0].ids) {
          console.log('Updating point!');
          console.log('New ID', result[0].result.rows[0].ids);
          params.changes = '{' + result[0].result.rows[0].ids.join(',') + '}';
          params.cartoDbChanges = 'ARRAY[' + result[0].result.rows[0].ids.join(',') + ']';
          runScript.database(sqlFiles[type].getNewData, params).then(function(listOfUpdates) {
            params.newData = listOfUpdates[0].result.rows;
            runScript.server(cartoDbScripts[type].remove, params).then(function() {
              var insertList = [];
              params.newData.map(function(row) {
                insertList.push(
                  runScript.server(cartoDbScripts[type].insert, row)
                );
              });
              Bluebird.all(insertList).then(function() {
                resolve('Done with ' + type + 's!');
              }).catch(function(e) {
                reject(e);
              });
            }).catch(function(e) {
              reject(e);
            });
          }).catch(function(e) {
            reject(e);
          });
        } else {
          resolve('No ' + type + ' updates!');
        }
      }).catch(function(e) {
        reject(e);
      });
    }).catch(function(e) {
      reject(e);
    });
  });
};
