var Bluebird = require('bluebird');
var coordsToTiles = require('./coordsToTiles');
var datawrap = require('datawrap');
var download = require('./download');
var fs = require('fs');
var mapboxUpload = require('mapbox-upload');
var shelljs = require('shelljs');
var sqliteDb = require('./sqliteDb');
var yaml = require('js-yaml');

module.exports = {
  'getTiles': function(res) {
    return new Bluebird(function(fulfill, reject) {
      var db = datawrap(res.config.database, res.config.database.defaults);
      var params = {
        'taskName': res.config.interfaces[res.settings.type].taskName
      };
      db.runQuery(res.config.interfaces[res.settings.type].startTask, params, function(startError) {
        if (startError) {
          reject(startError);
        } else {
          db.runQuery(res.config.interfaces[res.settings.type].getChanges, params, function(e, r) {
            if (e) {
              reject(e);
            } else {
              if (r[0].result.rowCount) {
                fulfill({
                  'result': r[0].result,
                  'bboxList': r[0].result.rows
                });
              } else {
                fulfill({
                  'stop': true,
                  'error': 'No new tiles',
                  'result': r[0].result,
                  'bboxList': r[0].result.rows
                });
              }
            }
          });
        }
      });
    });
  },
  'downloadMbtiles': function(res) {
    return new Bluebird(function(fulfill, reject) {
      var path = res.config.interfaces[res.settings.type].tempDirectory + '/' + res.config.interfaces[res.settings.type].mbtiles.mapboxId + '.mbtiles';
      if (res.config.interfaces[res.settings.type].mbtiles.downloadFromServer) {
        download(
          'http://a.tiles.mapbox.com/v3/' + res.config.interfaces[res.settings.type].mbtiles.mapboxId + '.mbtiles',
          path,
          function(e) {
            if (e) {
              reject(e);
            } else {
              fulfill({
                'downloaded': true,
                'path': path
              });
            }
          });
      } else {
        //TODO: Check if file exists, if not, throw error
        fulfill({
          'downloaded': false,
          'path': path
        });
      }
    });
  },
  'readStudioFile': function(res) {
    return new Bluebird(function(fulfill, reject) {
      fs.readFile(res.config.interfaces[res.settings.type].mapboxStudio.projectPath + '/data.yml', function(e, r) {
        if (e) {
          reject(e);
        } else {
          fulfill(yaml.load(r));
        }
      });
    });
  },
  'removeTiles': function(res) {
    return new Bluebird(function(fulfill, reject) {
      var params = {
          path: res.downloadMbtiles.path
        },
        removeImages = sqliteDb(params.path),
        removeMaps = sqliteDb(params.path),
        tileList = coordsToTiles(res.getTiles.bboxList, res.readStudioFile.minzoom, res.readStudioFile.maxzoom, res.readStudioFile.Layer[0].properties['buffer-size']);

      tileList.map(function(tilePaths) {
        removeImages.add([
          'DELETE FROM images WHERE tile_id IN (SELECT tile_id FROM map WHERE ',
          'zoom_level = ' + tilePaths[0] + ' AND tile_column = ' + tilePaths[1] + ' AND tile_row = ' + ((1 << tilePaths[0]) - tilePaths[2] - 1),
          ');'
        ].join(''));
        removeMaps.add([
          'DELETE FROM map WHERE ',
          'zoom_level = ' + tilePaths[0] + ' AND tile_column = ' + tilePaths[1] + ' AND tile_row = ' + ((1 << tilePaths[0]) - tilePaths[2] - 1),
          ';'
        ].join(''));
      });

      removeImages.run(function(iE) {
        if (iE) {
          reject(iE);
        } else {
          removeMaps.run(function(mE) {
            if (mE) {
              reject(mE);
            } else {
              fulfill(true);
            }
          });
        }
      });
    });
  },
  'generateTiles': function(res) {
    return new Bluebird(function(fulfill, reject) {
      var tileliveCopyPath = res.config.interfaces[res.settings.type].tileliveCopyPath;
      var tileFile = coordsToTiles(res.getTiles.bboxList, res.readStudioFile.minzoom, res.readStudioFile.maxzoom, res.readStudioFile.Layer[0].properties['buffer-size']).map(function(row) {
        return row[0] + '/' + row[1] + '/' + row[2];
      }).join('\n');
      fs.writeFile(res.config.interfaces[res.settings.type].tileFile, tileFile, function(writeError) {
        if (writeError) {
          reject(writeError);
        } else {
          var params = [
            ' --scheme=', 'list',
            ' --list=', res.config.interfaces[res.settings.type].tileFile,
            ' --concurrency=', '16', ' ',
            'bridge://' + res.config.interfaces[res.settings.type].mapboxStudio.projectPath, '/data.xml', ' ',
            'mbtiles://' + res.downloadMbtiles.path
          ].join('');
          // For long-lived processes, it's best to run exec() asynchronously as the current synchronous implementation uses a lot of CPU
          shelljs.exec(tileliveCopyPath + ' ' + params, function(tileliveError, tileliveOutput) {
            // Delete the temp tilefile
            shelljs.rm(res.config.interfaces[res.settings.type].tileFile);

            if (tileliveError) {
              reject({
                'description': 'tileliveError',
                'error': tileliveError
              });
            } else {
              fulfill(tileliveOutput);
            }
          });
        }
      });
    });
  },
  'uploadMBtiles': function(res) {
    return new Bluebird(function(fulfill, reject) {
      mapboxUpload({
        account: res.config.mapbox.account,
        accesstoken: res.config.mapbox.accesstoken,
        file: res.downloadMbtiles.path,
        mapid: res.config.interfaces[res.settings.type].mbtiles.mapboxId
      }, function(e, r) {
        console.log(e, r);
        if (e) {
          reject(e);
        } else {
          fulfill(true);
        }
      });
    });
  },
  'completeTask': function(res) {
    return new Bluebird(function(fulfill) {
      if (res.downloadMbtiles.downloaded) {
        shelljs.rm(res.downloadMbtiles.path);
      }
      fulfill(true);
    });
  }
};
