-- This is temporary for testing
-- The array at the end should be (SELECT * FROM join_points_alphacode('tm2-automater'))

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
  places_points
WHERE
  osm_id = ANY (ARRAY[9287, 5049, 3145, 9273]);
