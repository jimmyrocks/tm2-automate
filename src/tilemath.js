module.exports = {
  //http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
  long2tile: function(lon, zoom) {
    return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
  },
  lat2tile: function(lat, zoom) {
    return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
  },
  tile2long: function(x, z) {
    return (x / Math.pow(2, z) * 360 - 180);
  },
  tile2lat: function(y, z) {
    var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
    return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
  },
  //http://www.gal-systems.com/2011/07/convert-coordinates-between-web.html
  toWgs84: function(mercatorX_lon, mercatorY_lat) {
    if (Math.abs(mercatorX_lon) < 180 && Math.abs(mercatorY_lat) < 90)
      return;

    if ((Math.abs(mercatorX_lon) > 20037508.3427892) || (Math.abs(mercatorY_lat) > 20037508.3427892))
      return;

    var x = mercatorX_lon,
      y = mercatorY_lat,
      num3 = x / 6378137.0,
      num4 = num3 * 57.295779513082323,
      num5 = Math.floor((num4 + 180.0) / 360.0),
      num6 = num4 - (num5 * 360.0),
      num7 = 1.5707963267948966 - (2.0 * Math.atan(Math.exp((-1.0 * y) / 6378137.0))),
      mercatorX_lon_out = num6,
      mercatorY_lat_out = num7 * 57.295779513082323;
    return {
      'lat': num6,
      'lon': num7 * 57.295779513082323
    };
  },
  toWebMercator: function(mercatorX_lon, mercatorY_lat) {
    if ((Math.abs(mercatorX_lon) > 180 || Math.abs(mercatorY_lat) > 90))
      return;

    var num = mercatorX_lon * 0.017453292519943295,
      x = 6378137.0 * num,
      a = mercatorY_lat * 0.017453292519943295;
    return {
      'lat': x,
      'lon': 3189068.5 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a)))
    };
  }
}
