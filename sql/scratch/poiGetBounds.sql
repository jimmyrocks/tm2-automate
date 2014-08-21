SELECT
  ST_AsGeoJson(
    ST_Transform(
      ST_Envelope(
        ST_Buffer(
          way, 1, 2 --Buffering the point by 1 meter makes a point a polygon
      )
    ), 4326)
  )
FROM
  places_points, (select join_points_alphacode from join_points_alphacode('poi_update')) updated
WHERE
  osm_id = ANY (updated.join_points_alphacode);
