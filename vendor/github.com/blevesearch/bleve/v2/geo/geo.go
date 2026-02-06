//  Copyright (c) 2017 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package geo

import (
	"fmt"
	"math"

	"github.com/blevesearch/bleve/v2/numeric"
)

// GeoBits is the number of bits used for a single geo point
// Currently this is 32bits for lon and 32bits for lat
var GeoBits uint = 32

var minLon = -180.0
var minLat = -90.0
var maxLon = 180.0
var maxLat = 90.0
var minLonRad = minLon * degreesToRadian
var minLatRad = minLat * degreesToRadian
var maxLonRad = maxLon * degreesToRadian
var maxLatRad = maxLat * degreesToRadian
var geoTolerance = 1e-6
var lonScale = float64((uint64(0x1)<<GeoBits)-1) / 360.0
var latScale = float64((uint64(0x1)<<GeoBits)-1) / 180.0

var geoHashMaxLength = 12

// Point represents a geo point.
type Point struct {
	Lon float64 `json:"lon"`
	Lat float64 `json:"lat"`
}

// MortonHash computes the morton hash value for the provided geo point
// This point is ordered as lon, lat.
func MortonHash(lon, lat float64) uint64 {
	return numeric.Interleave(scaleLon(lon), scaleLat(lat))
}

func scaleLon(lon float64) uint64 {
	rv := uint64((lon - minLon) * lonScale)
	return rv
}

func scaleLat(lat float64) uint64 {
	rv := uint64((lat - minLat) * latScale)
	return rv
}

// MortonUnhashLon extracts the longitude value from the provided morton hash.
func MortonUnhashLon(hash uint64) float64 {
	return unscaleLon(numeric.Deinterleave(hash))
}

// MortonUnhashLat extracts the latitude value from the provided morton hash.
func MortonUnhashLat(hash uint64) float64 {
	return unscaleLat(numeric.Deinterleave(hash >> 1))
}

func unscaleLon(lon uint64) float64 {
	return (float64(lon) / lonScale) + minLon
}

func unscaleLat(lat uint64) float64 {
	return (float64(lat) / latScale) + minLat
}

// compareGeo will compare two float values and see if they are the same
// taking into consideration a known geo tolerance.
func compareGeo(a, b float64) float64 {
	compare := a - b
	if math.Abs(compare) <= geoTolerance {
		return 0
	}
	return compare
}

// RectIntersects checks whether rectangles a and b intersect
func RectIntersects(aMinX, aMinY, aMaxX, aMaxY, bMinX, bMinY, bMaxX, bMaxY float64) bool {
	return !(aMaxX < bMinX || aMinX > bMaxX || aMaxY < bMinY || aMinY > bMaxY)
}

// RectWithin checks whether box a is within box b
func RectWithin(aMinX, aMinY, aMaxX, aMaxY, bMinX, bMinY, bMaxX, bMaxY float64) bool {
	rv := !(aMinX < bMinX || aMinY < bMinY || aMaxX > bMaxX || aMaxY > bMaxY)
	return rv
}

// BoundingBoxContains checks whether the lon/lat point is within the box
func BoundingBoxContains(lon, lat, minLon, minLat, maxLon, maxLat float64) bool {
	return compareGeo(lon, minLon) >= 0 && compareGeo(lon, maxLon) <= 0 &&
		compareGeo(lat, minLat) >= 0 && compareGeo(lat, maxLat) <= 0
}

const degreesToRadian = math.Pi / 180
const radiansToDegrees = 180 / math.Pi

// DegreesToRadians converts an angle in degrees to radians
func DegreesToRadians(d float64) float64 {
	return d * degreesToRadian
}

// RadiansToDegrees converts an angle in radians to degrees
func RadiansToDegrees(r float64) float64 {
	return r * radiansToDegrees
}

var earthMeanRadiusMeters = 6371008.7714

func RectFromPointDistance(lon, lat, dist float64) (float64, float64, float64, float64, error) {
	err := checkLongitude(lon)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	err = checkLatitude(lat)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	radLon := DegreesToRadians(lon)
	radLat := DegreesToRadians(lat)
	radDistance := (dist + 7e-2) / earthMeanRadiusMeters

	minLatL := radLat - radDistance
	maxLatL := radLat + radDistance

	var minLonL, maxLonL float64
	if minLatL > minLatRad && maxLatL < maxLatRad {
		deltaLon := math.Asin(math.Sin(radDistance) / math.Cos(radLat))
		minLonL = radLon - deltaLon
		if minLonL < minLonRad {
			minLonL += 2 * math.Pi
		}
		maxLonL = radLon + deltaLon
		if maxLonL > maxLonRad {
			maxLonL -= 2 * math.Pi
		}
	} else {
		// pole is inside distance
		minLatL = math.Max(minLatL, minLatRad)
		maxLatL = math.Min(maxLatL, maxLatRad)
		minLonL = minLonRad
		maxLonL = maxLonRad
	}

	return RadiansToDegrees(minLonL),
		RadiansToDegrees(maxLatL),
		RadiansToDegrees(maxLonL),
		RadiansToDegrees(minLatL),
		nil
}

func checkLatitude(latitude float64) error {
	if math.IsNaN(latitude) || latitude < minLat || latitude > maxLat {
		return fmt.Errorf("invalid latitude %f; must be between %f and %f", latitude, minLat, maxLat)
	}
	return nil
}

func checkLongitude(longitude float64) error {
	if math.IsNaN(longitude) || longitude < minLon || longitude > maxLon {
		return fmt.Errorf("invalid longitude %f; must be between %f and %f", longitude, minLon, maxLon)
	}
	return nil
}

func BoundingRectangleForPolygon(polygon []Point) (
	float64, float64, float64, float64, error) {
	err := checkLongitude(polygon[0].Lon)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	err = checkLatitude(polygon[0].Lat)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	maxY, minY := polygon[0].Lat, polygon[0].Lat
	maxX, minX := polygon[0].Lon, polygon[0].Lon
	for i := 1; i < len(polygon); i++ {
		err := checkLongitude(polygon[i].Lon)
		if err != nil {
			return 0, 0, 0, 0, err
		}
		err = checkLatitude(polygon[i].Lat)
		if err != nil {
			return 0, 0, 0, 0, err
		}

		maxY = math.Max(maxY, polygon[i].Lat)
		minY = math.Min(minY, polygon[i].Lat)

		maxX = math.Max(maxX, polygon[i].Lon)
		minX = math.Min(minX, polygon[i].Lon)
	}

	return minX, maxY, maxX, minY, nil
}
