var run = require('./src/runType');

run('point').then(function(pointMsg) {
  console.log(pointMsg);
  process.exit();
}).catch(function(e) {
  throw e;
});
