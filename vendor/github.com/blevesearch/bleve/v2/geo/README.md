# Geo spatial search support in bleve

Latest bleve spatial capabilities are powered by spatial hierarchical tokens generated from s2geometry.
You can find more details about the [s2geometry basics here](http://s2geometry.io/), and explore the extended functionality of our forked golang port of [s2geometry lib here](https://github.com/blevesearch/geo).

Users can continue to index and query `geopoint` field type and the existing queries like,

- Point Distance
- Bounded Rectangle
- Bounded Polygon

as before.

## New Spatial Field Type - geoshape

We have introduced a field type (`geoshape`) for representing the new spatial types.

Using the new `geoshape` field type, users can unblock the spatial capabilities  
for the [geojson](https://datatracker.ietf.org/doc/html/rfc7946) shapes like,

- Point
- LineString
- Polygon
- MultiPoint
- MultiLineString
- MultiPolygon
- GeometryCollection

In addition to these shapes, bleve will also support additional shapes like,

- Circle
- Envelope (Bounded box)

To specify GeoJSON data, use a nested field with:

- a field named type that specifies the GeoJSON object type and the type value will be case-insensitive.
- a field named coordinates that specifies the object's coordinates.

```text
         "fieldName": { 
              "type": "GeoJSON Type", 
              "coordinates": <coordinates> 
           }
```

- If specifying latitude and longitude coordinates, list the longitude first and then latitude.
- Valid longitude values are between -180 and 180, both inclusive.
- Valid latitude values are between -90 and 90, both inclusive.
- Shapes would be internally represented as geodesics.
- The GeoJSON specification strongly suggests splitting geometries so that neither of their parts crosses the antimeridian.

Examples for the various geojson shapes representations are as below.

## Point

The following specifies a [Point](https://tools.ietf.org/html/rfc7946#section-3.1.2) field in a document:

```json
{
  "type": "point",
  "coordinates": [75.05687713623047, 22.53539059204079]
}
```

## Linestring

The following specifies a [Linestring](https://tools.ietf.org/html/rfc7946#section-3.1.4) field in a document:

```json
{
  "type": "linestring",
  "coordinates": [
    [77.01416015625, 23.0797317624497],
    [78.134765625, 20.385825381874263]
  ]
}
```

## Polygon

The following specifies a [Polygon](https://tools.ietf.org/html/rfc7946#section-3.1.6) field in a document:

```json
{
  "type": "polygon",
  "coordinates": [
    [
      [85.605, 57.207],
      [86.396, 55.998],
      [87.033, 56.716],
      [85.605, 57.207]
    ]
  ]
}
```

The first and last coordinates must match in order to close the polygon.
And the exterior coordinates have to be in Counter Clockwise Order in a polygon. (CCW)

## MultiPoint

The following specifies a [Multipoint](https://tools.ietf.org/html/rfc7946#section-3.1.3) field in a document:

```json
{
  "type": "multipoint",
  "coordinates": [
    [-115.8343505859375, 38.45789034424927],
    [-115.81237792968749, 38.19502155795575],
    [-120.80017089843749, 36.54053616262899],
    [-120.67932128906249, 36.33725319397006]
  ]
}
```

## MultiLineString

The following specifies a [MultiLineString](https://tools.ietf.org/html/rfc7946#section-3.1.5) field in a document:

```json
{
  "type": "multilinestring",
  "coordinates": [
    [
      [-118.31726074, 35.250105158],
      [-117.509765624, 35.3756141]
    ],
    [
      [-118.696289, 34.624167789],
      [-118.317260742, 35.03899204]
    ],
    [
      [-117.9492187, 35.146862906],
      [-117.6745605, 34.41144164]
    ]
  ]
}
```

## MultiPolygon

The following specifies a [MultiPolygon](https://tools.ietf.org/html/rfc7946#section-3.1.7) field in a document:

```json
{
  "type": "multipolygon",
  "coordinates": [
    [
      [
        [-73.958, 40.8003],
        [-73.9498, 40.7968],
        [-73.9737, 40.7648],
        [-73.9814, 40.7681],
        [-73.958, 40.8003]
      ]
    ],
    [
      [
        [-73.958, 40.8003],
        [-73.9498, 40.7968],
        [-73.9737, 40.7648],
        [-73.958, 40.8003]
      ]
    ]
  ]
}
```

## GeometryCollection

The following specifies a [GeometryCollection](https://tools.ietf.org/html/rfc7946#section-3.1.8) field in a document:

```json
{
  "type": "geometrycollection",
  "geometries": [
    {
      "type": "multipoint",
      "coordinates": [
        [-73.958, 40.8003],
        [-73.9498, 40.7968],
        [-73.9737, 40.7648],
        [-73.9814, 40.7681]
      ]
    },
    {
      "type": "multilinestring",
      "coordinates": [
        [
          [-73.96943, 40.78519],
          [-73.96082, 40.78095]
        ],
        [
          [-73.96415, 40.79229],
          [-73.95544, 40.78854]
        ],
        [
          [-73.97162, 40.78205],
          [-73.96374, 40.77715]
        ],
        [
          [-73.9788, 40.77247],
          [-73.97036, 40.76811]
        ]
      ]
    },
    {
      "type": "polygon",
      "coordinates": [
        [
          [0, 0],
          [3, 6],
          [6, 1],
          [0, 0]
        ],
        [
          [2, 2],
          [3, 3],
          [4, 2],
          [2, 2]
        ]
      ]
    }
  ]
}
```

## Circle

If the user wishes to cover a circular region over the earth's surface, then they could use this shape.
A  sample circular shape is as below.

```json
{
  "type": "circle",
  "coordinates": [75.05687713623047, 22.53539059204079],
  "radius": "1000m"
}
```

Circle is specified over the center point coordinates along with the radius.
Example formats supported for radius are:
"5in" , "5inch" , "7yd" , "7yards",  "9ft" , "9feet", "11km", "11kilometers", "3nm", "3nauticalmiles", "13mm" , "13millimeters",  "15cm", "15centimeters", "17mi", "17miles", "19m" or "19meters".

If the unit cannot be determined, the entire string is parsed and the unit of meters is assumed.

## Envelope

Envelope type, which consists of coordinates for upper left and lower right points of the shape to represent a bounding rectangle in the format  [[minLon, maxLat], [maxLon, minLat]].

```json
{
  "type": "envelope",
  "coordinates": [
    [72.83, 18.979],
    [78.508, 17.4555]
  ]
}
```

## GeoShape Query

Geoshape query support three types/filters of spatial querying capability across those heterogeneous types of documents indexed.

### Query Structure

```json
{
  "query": {
    "geometry": {
      "shape": {
        "type": "<shapeType>",
        "coordinates": [
          [[]]
        ]
      },
      "relation": "<<filterName>>"
    }
  }
}
```

*shapeType* => can be any of the aforementioned types like Point, LineString, Polygon, MultiPoint,
Geometrycollection, MultiLineString, MultiPolygon, Circle and Envelope.

*filterName* => can be any of the 3 types like *intersects*, *contains* and *within*.

### Relation

|   FilterName   |  Description                                                             |
|   :-----------:|  :-----------------------------------------------------------------:     |
|   `intersects` |  Return all documents whose shape field intersects the query  geometry.  |
|   `contains`   |  Return all documents whose shape field contains the query geometry      |
|   `within`     |  Return all documents whose shape field is within the query geometry.    |

------------------------------------------------------------------------------------------------------------------------

### Older Implementation

First, all of this geo code is a Go adaptation of the [Lucene 5.3.2 sandbox geo support](https://lucene.apache.org/core/5_3_2/sandbox/org/apache/lucene/util/package-summary.html).

## Notes

- All of the APIs will use float64 for lon/lat values.
- When describing a point in function arguments or return values, we always use the order lon, lat.
- High level APIs will use TopLeft and BottomRight to describe bounding boxes. This may not map cleanly to min/max lon/lat when crossing the dateline. The lower level APIs will use min/max lon/lat and require the higher-level code to split boxes accordingly.
- Points and MultiPoints may only contain Points and MultiPoints.
- LineStrings and MultiLineStrings may only contain Points and MultiPoints.
- Polygons or MultiPolygons intersecting Polygons and MultiPolygons may return arbitrary results when the overlap is only an edge or a vertex.
- Circles containing polygon will return a false positive result if all of the vertices of the polygon are within the circle, but the orientation of those points are clock-wise.
- The edges of an Envelope follows the latitude and longitude lines instead of the shortest path on a globe.
- Envelope intersecting queries with LineStrings, MultiLineStrings, Polygons and MultiPolygons implicitly converts the Envelope into a Polygon which changes the curvature of the edges causing inaccurate results for few edge cases.
