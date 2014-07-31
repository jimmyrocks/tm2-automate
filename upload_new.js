var upload = require('mapbox-upload');
var configFile = require('./config');
var uploadFile = process.argv[2];
var mapboxId = process.argv[3];

// creates a progress-stream object to track status of
// upload while upload continues in background
var progress = upload({
    file: __dirname + '/' + uploadFile, // Path to mbtiles file on disk.
    account: configFile.mapbox.account, // Mapbox user account.
    accesstoken: configFile.mapbox.accesstoken, // A valid Mapbox API secret token with the map:write scope enabled.
    mapid: mapboxId // The identifier of the map to create or update.
}, function(uploadErr, uploadResult) {
  console.log(uploadErr ? '**** Upload Error ****' : ' Upload Begin!');
  uploadResult.once('end', function() {
    console.log('Upload Success!');
    process.exit(uploadErr ? 1 : 0);
  });
});
