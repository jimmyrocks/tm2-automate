var fs = require('fs'),
  mkdirp = require('mkdirp'),
  request = require('request'),
  util = require('util');

module.exports = function download(url, dest, callback, silent) {
  if (dest) {
    // Make sure the dir exists
    mkdirp.sync(dest.split('/').slice(0,-1).join('/'));
  }
  var file = dest ? fs.createWriteStream(dest) : null,
    totalSize,
    cur = 0,
    req = request(url, function(error, resp, body) {
      if (error) throw error;
      if (file) {
        file.on('finish', function() {
          file.close(callback);
        });
      } else {
        callback(error, body);
      }
    });

  req.on('response', function(response) {
    totalSize = Number(response.headers['content-length']);
  });

  req.on('data', function(chunk) {
    cur += chunk.length;
    if (!silent) {
      if (totalSize) {
        util.print('Downloading ' + (100.0 * cur / totalSize).toFixed(2) + '% ' + (cur / 1048576).toFixed(2) + ' mb' + '. Total size: ' + (totalSize / 1048576).toFixed(2) + ' mb\r');
      } else {
        util.print('Downloading ' + (cur / 1048576).toFixed(2) + ' mb\r');
      }
    }
  });

  req.on('end', function() {
    if (!silent) {
      util.print('Download complete                                                 \n\r');
    }

  });

  req.on('error', function(e) {
    callback(e);
    console.log('Error: ' + e.message);
  });

  if (file) {
    req.pipe(file);
  }


};
