/* USAGE: node upload_new.js FILEPATH MAPBOX_ID */

var configFile = require('./config'),
  fs = require('fs'),
  mapboxId = process.argv[3],
  upload = require('mapbox-upload'),
  uploadFile = process.argv[2];

// creates a progress-stream object to track status of
// upload while upload continues in background
var startDownload = function() {
  upload({
    file: uploadFile, // Path to mbtiles file on disk.
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
};

if (uploadFile && mapboxId && fs.existsSync(uploadFile)) {
  startDownload();
} else {
  console.log('Usage: node ./upload_new.js "MBTILES_FILE_TO_UPLOAD" "MAP_ID"');
}
