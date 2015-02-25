var tileMath = require('./tilemath');

module.exports = function(bboxArray, minZoom, maxZoom, bufferPx) {
  // The accepts an array of bboxes that is structured like:
  // [{maxLat: 1, minLat -1, maxLon: 1, minLon -1}] in WGS84 projection
  // It also requires the following parameters
  //   minZoom: number (the minimum zoom level to generate tiles for)
  //   maxZoom: number (the maximum zoom level to generate tiles for)
  //   bufferPx: number (the size in pixels that the mapnik buffer is set to)
  //
  var tiles = bboxArray.map(function(bbox) {
    var tileBounds = {}, bboxTiles = [];
    for (var zoom = minZoom; zoom <= maxZoom; zoom++) {
      tileBounds[zoom] = {
        minX: tileMath.long2tile(parseFloat(bbox.minLon, 10), zoom, bufferPx * -1),
        minY: tileMath.lat2tile(parseFloat(bbox.minLat, 10), zoom, bufferPx * -1),
        maxX: tileMath.long2tile(parseFloat(bbox.maxLon, 10), zoom, bufferPx),
        maxY: tileMath.lat2tile(parseFloat(bbox.maxLat, 10), zoom, bufferPx)
      };
      console.log('zoom', zoom, tileBounds[zoom]);
      for (var xRow = tileBounds[zoom].minX; xRow <= tileBounds[zoom].maxX; xRow++) {
        for (var yRow = tileBounds[zoom].minY; yRow <= tileBounds[zoom].maxY; yRow++) {
          bboxTiles.push([zoom, xRow, yRow]);
        }
      }
    }
    console.log(bboxTiles, bbox);
    return bboxTiles;
  });

  return tiles.reduce(function(previous, current) {
    return previous.concat(current);
  });
};
