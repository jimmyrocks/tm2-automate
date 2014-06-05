var config = require('./config'),
  http = require('http'),
  runTm2 = {
    options: {
      headers: {
        'user-agent': 'Linux Mozilla/5.0',
        'Content-Type': 'application/json'
      },
      host: 'localhost',
      port: 3000
    },
    updateDatasource: function(options, callback) {
      runTm2.changeDatasource(options, function(e, r) {
        if (e) {
          callback(e, null);
        } else {
          runTm2.writeSource(r, callback);
        }
      });
    },
    writeSource: function(source, callback) {
      var options = runTm2.options;
      options.path = config.idSourcePath + config.tm2ProjectPath;
      options.method = 'PUT';
      var req = http.request(options, function(res) {
        var data = '';
        res.setEncoding('utf8');
        res.on('error', function(e) {
          callback(e, null);
        });
        res.on('data', function(chunk) {
          data += chunk;
        });
        res.on('end', function() {
          callback(null, data);
        });
      });
      //console.log(JSON.stringify(source, null,2));
      req.write(JSON.stringify(source));
      req.end();
    },
    changeDatasource: function(options, callback) {
      runTm2.getSource(function(e, r) {
        if (e) {
          callback(e, null);
        } else {
          //callback(e, JSON.parse(r).Layer[0].Datasource.extent, null, 2);
          var source = JSON.parse(r);
          source.Layer.map(function(layer) {
            for (var option in options) {
              if (layer && layer.Datasource) {
                layer.Datasource[option] = options[option];
              }
            }
          });
          callback(null, source);
        }
      });
    },
    getSource: function(callback) {
      var options = runTm2.options;
      options.path = config.idSourcePath;
      options.method = 'GET';
      var req = http.get(options, function(res) {
        var data = '';
        res.setEncoding('utf8');
        res.on('error', function(e) {
          callback(e, null);
        });
        res.on('data', function(chunk) {
          data += chunk;
        });
        res.on('end', function() {
          callback(null, data);
        });
      });
      req.end();
    },
    getExtent: function(callback) {
      runTm2.getSource(function(e, r) {
        callback(e, JSON.parse(r).Layer[0].Datasource.extent, null, 2);
      });
    },
    getTm2Extent: function(dbBounds) {
      var bounds = {
        'minLon': dbBounds[0][1],
        'maxLon': dbBounds[1][1],
        'minLat': dbBounds[0][0],
        'maxLat': dbBounds[2][0]
      };
      return [bounds.minLat, bounds.minLon, bounds.maxLat, bounds.maxLon].join(',');
    }
  };
