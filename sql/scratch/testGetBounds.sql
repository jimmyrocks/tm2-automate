SELECT
  ST_AsGeoJson(
    ST_Transform(
      ST_Envelope(
        ST_Buffer(
          geom, 1, 2 --Buffering the point by 1 meter makes a point a polygon
      )
    ), 4326)
  )
FROM
 nodes
WHERE
  RANDOM() < 0.01
LIMIT
  1;
