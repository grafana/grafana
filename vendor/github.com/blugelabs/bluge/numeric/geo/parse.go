//  Copyright (c) 2020 Couchbase, Inc.
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
	"reflect"
	"strconv"
	"strings"
)

const lonLatSliceLen = 2

// ExtractGeoPoint takes an arbitrary interface{} and tries it's best to
// interpret it is as geo point.  Supported formats:
// Container:
// slice length 2 (GeoJSON)
//  first element lon, second element lat
// string (coordinates separated by comma, or a geohash)
//  first element lat, second element lon
// map[string]interface{}
//  exact keys lat and lon or lng
// struct
//  w/exported fields case-insensitive match on lat and lon or lng
// struct
//  satisfying Later and Loner or Lnger interfaces
//
// in all cases values must be some sort of numeric-like thing: int/uint/float
func ExtractGeoPoint(thing interface{}) (lon, lat float64, success bool) {
	var foundLon, foundLat bool

	thingVal := reflect.ValueOf(thing)
	if !thingVal.IsValid() {
		return lon, lat, false
	}

	thingTyp := thingVal.Type()

	if thingVal.Kind() == reflect.Slice {
		// is it a slice
		lon, foundLon, lat, foundLat = extractSlice(thingVal)
	} else if thingVal.Kind() == reflect.String {
		// is it a string
		lon, foundLon, lat, foundLat = extractString(thingVal)
	} else if l, ok := thing.(map[string]interface{}); ok {
		// is it a map
		lon, foundLon, lat, foundLat = extractMap(l)
	} else if thingVal.Kind() == reflect.Struct {
		// now try reflection on struct fields
		lon, foundLon, lat, foundLat = extractStruct(thingVal, thingTyp)
	}

	// last hope, some interfaces
	// lon
	switch l := thing.(type) {
	case loner:
		lon = l.Lon()
		foundLon = true
	case lnger:
		lon = l.Lng()
		foundLon = true
	}

	// lat
	if l, ok := thing.(later); ok {
		lat = l.Lat()
		foundLat = true
	}

	return lon, lat, foundLon && foundLat
}

func extractStruct(thingVal reflect.Value, thingTyp reflect.Type) (lon float64, foundLon bool, lat float64, foundLat bool) {
	for i := 0; i < thingVal.NumField(); i++ {
		fieldName := thingTyp.Field(i).Name
		if strings.HasPrefix(strings.ToLower(fieldName), "lon") {
			if thingVal.Field(i).CanInterface() {
				fieldVal := thingVal.Field(i).Interface()
				lon, foundLon = extractNumericVal(fieldVal)
			}
		}
		if strings.HasPrefix(strings.ToLower(fieldName), "lng") {
			if thingVal.Field(i).CanInterface() {
				fieldVal := thingVal.Field(i).Interface()
				lon, foundLon = extractNumericVal(fieldVal)
			}
		}
		if strings.HasPrefix(strings.ToLower(fieldName), "lat") {
			if thingVal.Field(i).CanInterface() {
				fieldVal := thingVal.Field(i).Interface()
				lat, foundLat = extractNumericVal(fieldVal)
			}
		}
	}
	return lon, foundLon, lat, foundLat
}

func extractMap(l map[string]interface{}) (lon float64, foundLon bool, lat float64, foundLat bool) {
	if lval, ok := l["lon"]; ok {
		lon, foundLon = extractNumericVal(lval)
	} else if lval, ok := l["lng"]; ok {
		lon, foundLon = extractNumericVal(lval)
	}
	if lval, ok := l["lat"]; ok {
		lat, foundLat = extractNumericVal(lval)
	}
	return lon, foundLon, lat, foundLat
}

func extractString(thingVal reflect.Value) (lon float64, foundLon bool, lat float64, foundLat bool) {
	geoStr := thingVal.Interface().(string)
	if strings.Contains(geoStr, ",") {
		// geo point with coordinates split by comma
		points := strings.Split(geoStr, ",")
		for i, point := range points {
			// trim any leading or trailing white spaces
			points[i] = strings.TrimSpace(point)
		}
		if len(points) == lonLatSliceLen {
			var err error
			lat, err = strconv.ParseFloat(points[0], 64)
			if err == nil {
				foundLat = true
			}
			lon, err = strconv.ParseFloat(points[1], 64)
			if err == nil {
				foundLon = true
			}
		}
	} else if len(geoStr) <= geoHashMaxLength {
		lat, lon = DecodeGeoHash(geoStr)
		foundLat = true
		foundLon = true
	}
	return lon, foundLon, lat, foundLat
}

func extractSlice(thingVal reflect.Value) (lon float64, foundLon bool, lat float64, foundLat bool) {
	// must be length 2
	if thingVal.Len() == lonLatSliceLen {
		first := thingVal.Index(0)
		if first.CanInterface() {
			firstVal := first.Interface()
			lon, foundLon = extractNumericVal(firstVal)
		}
		second := thingVal.Index(1)
		if second.CanInterface() {
			secondVal := second.Interface()
			lat, foundLat = extractNumericVal(secondVal)
		}
	}
	return lon, foundLon, lat, foundLat
}

// extract numeric value (if possible) and returns a float64
func extractNumericVal(v interface{}) (float64, bool) {
	val := reflect.ValueOf(v)
	if !val.IsValid() {
		return 0, false
	}
	typ := val.Type()
	switch typ.Kind() {
	case reflect.Float32, reflect.Float64:
		return val.Float(), true
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return float64(val.Int()), true
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return float64(val.Uint()), true
	}

	return 0, false
}

// various support interfaces which can be used to find lat/lon
type loner interface {
	Lon() float64
}

type later interface {
	Lat() float64
}

type lnger interface {
	Lng() float64
}
