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
	"strconv"
	"strings"
)

type distanceUnit struct {
	conv     float64
	suffixes []string
}

var inch = distanceUnit{0.0254, []string{"in", "inch"}}
var yard = distanceUnit{0.9144, []string{"yd", "yards"}}
var feet = distanceUnit{0.3048, []string{"ft", "feet"}}
var kilom = distanceUnit{1000, []string{"km", "kilometers"}}
var nauticalm = distanceUnit{1852.0, []string{"nm", "nauticalmiles"}}
var millim = distanceUnit{0.001, []string{"mm", "millimeters"}}
var centim = distanceUnit{0.01, []string{"cm", "centimeters"}}
var miles = distanceUnit{1609.344, []string{"mi", "miles"}}
var meters = distanceUnit{1, []string{"m", "meters"}}

var distanceUnits = []*distanceUnit{
	&inch, &yard, &feet, &kilom, &nauticalm, &millim, &centim, &miles, &meters,
}

// ParseDistance attempts to parse a distance string and return distance in
// meters.  Example formats supported:
// "5in" "5inch" "7yd" "7yards" "9ft" "9feet" "11km" "11kilometers"
// "3nm" "3nauticalmiles" "13mm" "13millimeters" "15cm" "15centimeters"
// "17mi" "17miles" "19m" "19meters"
// If the unit cannot be determined, the entire string is parsed and the
// unit of meters is assumed.
// If the number portion cannot be parsed, 0 and the parse error are returned.
func ParseDistance(d string) (float64, error) {
	for _, unit := range distanceUnits {
		for _, unitSuffix := range unit.suffixes {
			if strings.HasSuffix(d, unitSuffix) {
				parsedNum, err := strconv.ParseFloat(d[0:len(d)-len(unitSuffix)], 64)
				if err != nil {
					return 0, err
				}
				return parsedNum * unit.conv, nil
			}
		}
	}
	// no unit matched, try assuming meters?
	parsedNum, err := strconv.ParseFloat(d, 64)
	if err != nil {
		return 0, err
	}
	return parsedNum, nil
}

// ParseDistanceUnit attempts to parse a distance unit and return the
// multiplier for converting this to meters.  If the unit cannot be parsed
// then 0 and the error message is returned.
func ParseDistanceUnit(u string) (float64, error) {
	for _, unit := range distanceUnits {
		for _, unitSuffix := range unit.suffixes {
			if u == unitSuffix {
				return unit.conv, nil
			}
		}
	}
	return 0, fmt.Errorf("unknown distance unit: %s", u)
}

// Haversin computes the distance between two points.
// This implementation uses the sloppy math implementations which trade off
// accuracy for performance.  The distance returned is in kilometers.
func Haversin(lon1, lat1, lon2, lat2 float64) float64 {
	x1 := lat1 * degreesToRadian
	x2 := lat2 * degreesToRadian
	h1 := 1 - math.Cos(x1-x2)
	h2 := 1 - math.Cos((lon1-lon2)*degreesToRadian)
	h := (h1 + math.Cos(x1)*math.Cos(x2)*h2) / 2
	avgLat := (x1 + x2) / 2
	diameter := earthDiameter(avgLat)

	return diameter * math.Asin(math.Min(1, math.Sqrt(h)))
}
