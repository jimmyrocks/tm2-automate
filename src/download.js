var http = require('http'),
  fs = require('fs'),
  util = require('util');

module.exports = function download(url, dest, callback, encoding, silent) {
  var file = dest ? fs.createWriteStream(dest) : null,
    request = http.get(url, function(response) {
      if (encoding) {
        response.setEncoding(encoding);
      }
      var len = parseInt(response.headers['content-length'], 10),
        body = '',
        cur = 0,
        total = len / 1048576; //1048576 - bytes in  1Megabyte


      response.on('data', function(chunk) {
        if (!file) {
          body += chunk;
        }
        cur += chunk.length;
        if (!silent) {
          util.print('Downloading ' + (100.0 * cur / len).toFixed(2) + '% ' + (cur / 1048576).toFixed(2) + ' mb' + '. Total size: ' + total.toFixed(2) + ' mb\r');
        }
      });

      response.on('end', function() {
        if (!silent) {
          util.print('Download complete                                                 \n\r');
        }
        if (!file) {
          callback(null, body);
        }
      });

      request.on('error', function(e) {
        callback(e);
        console.log('Error: ' + e.message);
      });

      if (file) {
        response.pipe(file);
        file.on('finish', function() {
          file.close(callback);
        });
      }

    });
};
