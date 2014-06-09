module.exports = function(options, tm2Path, callback) {
  var util = require('util'),
    Scheme = require('./scheme')(tm2Path),
    CopyTask = require(tm2Path + '/lib/copytask'),
    tilelive = require(tm2Path + '/');

  function report(stats) {
    var progress = stats.processed / stats.total;
    var remaining = timeRemaining(progress, task.started);
    util.print(util.format('\r\033[K[%s] %s%% %s/%s @ %s/s | ✓ %s ■ %s □ %s ✕ %s | %s left',
      pad(formatDuration(stats.date - task.started), 4, true),
      pad(((progress || 0) * 100).toFixed(4), 8, true),
      pad(formatNumber(stats.processed), 6, true),
      pad(formatNumber(stats.total), 6, true),
      pad(formatNumber(stats.speed), 4, true),
      formatNumber(stats.unique),
      formatNumber(stats.duplicate),
      formatNumber(stats.skipped),
      formatNumber(stats.failed),
      formatDuration(remaining)
    ));
  }

  if (options.bbox && !Array.isArray(options.bbox))
    options.bbox = options.bbox.split(',').map(parseFloat);
  var from = tilelive.auto(options._[0]);
  var to = tilelive.auto(options._[1]);
  var scheme = Scheme.create(options.scheme, options);
  var task = new CopyTask(from, to, scheme, options.job);

  task.on('progress', report);
  task.on('finished', function() {
    callback(null, 'Finished.');
  });
  task.start(function(err) {
    if (err) {
      err.level = 'start';
      callback(err);
    }
    task.source.getInfo(function(err, info) {
      if (err) {
        err.level = 'getInfo';
        callback(err);
      }
      task.sink.putInfo(info, function(err) {
        if (err) {
          err.level = 'putInfo';
          callback(err);
        }

      });
    });
  });

  function pad(str, len, r) {
    while (str.length < len) str = r ? ' ' + str : str + ' ';
    return str;
  }

  function formatDuration(duration) {
    duration = duration / 1000 | 0;
    var seconds = duration % 60;
    duration -= seconds;
    var minutes = (duration % 3600) / 60;
    duration -= minutes * 60;
    var hours = (duration % 86400) / 3600;
    duration -= hours * 3600;
    var days = duration / 86400;

    return (days > 0 ? days + 'd ' : '') +
      (hours > 0 || days > 0 ? hours + 'h ' : '') +
      (minutes > 0 || hours > 0 || days > 0 ? minutes + 'm ' : '') +
      seconds + 's';
  }

  function formatNumber(num) {
    num = num || 0;
    if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + 'm';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(1) + 'k';
    } else {
      return num.toFixed(0);
    }
    return num.join('.');
  }

  function timeRemaining(progress, started) {
    return Math.floor(
      (Date.now() - started) * (1 / progress) -
      (Date.now() - started)
    );
  }
};
