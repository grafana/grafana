// Copyright 2014 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package s2

import (
	"fmt"
	"math"

	"github.com/golang/geo/r3"
	"github.com/golang/geo/s1"
)

const (
	northPoleLat = s1.Angle(math.Pi/2) * s1.Radian
	southPoleLat = -northPoleLat
)

// LatLng represents a point on the unit sphere as a pair of angles.
type LatLng struct {
	Lat, Lng s1.Angle
}

// LatLngFromDegrees returns a LatLng for the coordinates given in degrees.
func LatLngFromDegrees(lat, lng float64) LatLng {
	return LatLng{s1.Angle(lat) * s1.Degree, s1.Angle(lng) * s1.Degree}
}

// IsValid returns true iff the LatLng is normalized, with Lat ∈ [-π/2,π/2] and Lng ∈ [-π,π].
func (ll LatLng) IsValid() bool {
	return math.Abs(ll.Lat.Radians()) <= math.Pi/2 && math.Abs(ll.Lng.Radians()) <= math.Pi
}

// Normalized returns the normalized version of the LatLng,
// with Lat clamped to [-π/2,π/2] and Lng wrapped in [-π,π].
func (ll LatLng) Normalized() LatLng {
	lat := ll.Lat
	if lat > northPoleLat {
		lat = northPoleLat
	} else if lat < southPoleLat {
		lat = southPoleLat
	}
	lng := s1.Angle(math.Remainder(ll.Lng.Radians(), 2*math.Pi)) * s1.Radian
	return LatLng{lat, lng}
}

func (ll LatLng) String() string { return fmt.Sprintf("[%v, %v]", ll.Lat, ll.Lng) }

// Distance returns the angle between two LatLngs.
func (ll LatLng) Distance(ll2 LatLng) s1.Angle {
	// Haversine formula, as used in C++ S2LatLng::GetDistance.
	lat1, lat2 := ll.Lat.Radians(), ll2.Lat.Radians()
	lng1, lng2 := ll.Lng.Radians(), ll2.Lng.Radians()
	dlat := math.Sin(0.5 * (lat2 - lat1))
	dlng := math.Sin(0.5 * (lng2 - lng1))
	x := dlat*dlat + dlng*dlng*math.Cos(lat1)*math.Cos(lat2)
	return s1.Angle(2*math.Atan2(math.Sqrt(x), math.Sqrt(math.Max(0, 1-x)))) * s1.Radian
}

// NOTE(mikeperrow): The C++ implementation publicly exposes latitude/longitude
// functions. Let's see if that's really necessary before exposing the same functionality.

func latitude(p Point) s1.Angle {
	return s1.Angle(math.Atan2(p.Z, math.Sqrt(p.X*p.X+p.Y*p.Y))) * s1.Radian
}

func longitude(p Point) s1.Angle {
	return s1.Angle(math.Atan2(p.Y, p.X)) * s1.Radian
}

// PointFromLatLng returns an Point for the given LatLng.
// The maximum error in the result is 1.5 * dblEpsilon. (This does not
// include the error of converting degrees, E5, E6, or E7 into radians.)
func PointFromLatLng(ll LatLng) Point {
	phi := ll.Lat.Radians()
	theta := ll.Lng.Radians()
	cosphi := math.Cos(phi)
	return Point{r3.Vector{math.Cos(theta) * cosphi, math.Sin(theta) * cosphi, math.Sin(phi)}}
}

// LatLngFromPoint returns an LatLng for a given Point.
func LatLngFromPoint(p Point) LatLng {
	return LatLng{latitude(p), longitude(p)}
}

// ApproxEqual reports whether the latitude and longitude of the two LatLngs
// are the same up to a small tolerance.
func (ll LatLng) ApproxEqual(other LatLng) bool {
	return ll.Lat.ApproxEqual(other.Lat) && ll.Lng.ApproxEqual(other.Lng)
}
