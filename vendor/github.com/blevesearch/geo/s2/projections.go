// Copyright 2018 Google Inc. All rights reserved.
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
	"math"

	"github.com/golang/geo/r2"
	"github.com/golang/geo/s1"
)

// Projection defines an interface for different ways of mapping between s2 and r2 Points.
// It can also define the coordinate wrapping behavior along each axis.
type Projection interface {
	// Project converts a point on the sphere to a projected 2D point.
	Project(p Point) r2.Point

	// Unproject converts a projected 2D point to a point on the sphere.
	//
	// If wrapping is defined for a given axis (see below), then this method
	// should accept any real number for the corresponding coordinate.
	Unproject(p r2.Point) Point

	// FromLatLng is a convenience function equivalent to Project(LatLngToPoint(ll)),
	// but the implementation is more efficient.
	FromLatLng(ll LatLng) r2.Point

	// ToLatLng is a convenience function equivalent to LatLngFromPoint(Unproject(p)),
	// but the implementation is more efficient.
	ToLatLng(p r2.Point) LatLng

	// Interpolate returns the point obtained by interpolating the given
	// fraction of the distance along the line from A to B.
	// Fractions < 0 or > 1 result in extrapolation instead.
	Interpolate(f float64, a, b r2.Point) r2.Point

	// WrapDistance reports the coordinate wrapping distance along each axis.
	// If this value is non-zero for a given axis, the coordinates are assumed
	// to "wrap" with the given period. For example, if WrapDistance.Y == 360
	// then (x, y) and (x, y + 360) should map to the same Point.
	//
	// This information is used to ensure that edges takes the shortest path
	// between two given points. For example, if coordinates represent
	// (latitude, longitude) pairs in degrees and WrapDistance().Y == 360,
	// then the edge (5:179, 5:-179) would be interpreted as spanning 2 degrees
	// of longitude rather than 358 degrees.
	//
	// If a given axis does not wrap, its WrapDistance should be set to zero.
	WrapDistance() r2.Point

	// WrapDestination that wraps the coordinates of B if necessary in order to
	// obtain the shortest edge AB. For example, suppose that A = [170, 20],
	// B = [-170, 20], and the projection wraps so that [x, y] == [x + 360, y].
	// Then this function would return [190, 20] for point B (reducing the edge
	// length in the "x" direction from 340 to 20).
	WrapDestination(a, b r2.Point) r2.Point

	// We do not support implementations of this interface outside this package.
	privateInterface()
}

// PlateCarreeProjection defines the "plate carree" (square plate) projection,
// which converts points on the sphere to (longitude, latitude) pairs.
// Coordinates can be scaled so that they represent radians, degrees, etc, but
// the projection is always centered around (latitude=0, longitude=0).
//
// Note that (x, y) coordinates are backwards compared to the usual (latitude,
// longitude) ordering, in order to match the usual convention for graphs in
// which "x" is horizontal and "y" is vertical.
type PlateCarreeProjection struct {
	xWrap       float64
	toRadians   float64 // Multiplier to convert coordinates to radians.
	fromRadians float64 // Multiplier to convert coordinates from radians.
}

// NewPlateCarreeProjection constructs a plate carree projection where the
// x-coordinates (lng) span [-xScale, xScale] and the y coordinates (lat)
// span [-xScale/2, xScale/2]. For example if xScale==180 then the x
// range is [-180, 180] and the y range is [-90, 90].
//
// By default coordinates are expressed in radians, i.e. the x range is
// [-Pi, Pi] and the y range is [-Pi/2, Pi/2].
func NewPlateCarreeProjection(xScale float64) Projection {
	return &PlateCarreeProjection{
		xWrap:       2 * xScale,
		toRadians:   math.Pi / xScale,
		fromRadians: xScale / math.Pi,
	}
}

// Project converts a point on the sphere to a projected 2D point.
func (p *PlateCarreeProjection) Project(pt Point) r2.Point {
	return p.FromLatLng(LatLngFromPoint(pt))
}

// Unproject converts a projected 2D point to a point on the sphere.
func (p *PlateCarreeProjection) Unproject(pt r2.Point) Point {
	return PointFromLatLng(p.ToLatLng(pt))
}

// FromLatLng returns the LatLng projected into an R2 Point.
func (p *PlateCarreeProjection) FromLatLng(ll LatLng) r2.Point {
	return r2.Point{
		X: p.fromRadians * ll.Lng.Radians(),
		Y: p.fromRadians * ll.Lat.Radians(),
	}
}

// ToLatLng returns the LatLng projected from the given R2 Point.
func (p *PlateCarreeProjection) ToLatLng(pt r2.Point) LatLng {
	return LatLng{
		Lat: s1.Angle(p.toRadians * pt.Y),
		Lng: s1.Angle(p.toRadians * math.Remainder(pt.X, p.xWrap)),
	}
}

// Interpolate returns the point obtained by interpolating the given
// fraction of the distance along the line from A to B.
func (p *PlateCarreeProjection) Interpolate(f float64, a, b r2.Point) r2.Point {
	return a.Mul(1 - f).Add(b.Mul(f))
}

// WrapDistance reports the coordinate wrapping distance along each axis.
func (p *PlateCarreeProjection) WrapDistance() r2.Point {
	return r2.Point{p.xWrap, 0}
}

// WrapDestination wraps the points if needed to get the shortest edge.
func (p *PlateCarreeProjection) WrapDestination(a, b r2.Point) r2.Point {
	return wrapDestination(a, b, p.WrapDistance)
}

func (p *PlateCarreeProjection) privateInterface() {}

// MercatorProjection defines the spherical Mercator projection. Google Maps
// uses this projection together with WGS84 coordinates, in which case it is
// known as the "Web Mercator" projection (see Wikipedia). This class makes
// no assumptions regarding the coordinate system of its input points, but
// simply applies the spherical Mercator projection to them.
//
// The Mercator projection is finite in width (x) but infinite in height (y).
// "x" corresponds to longitude, and spans a finite range such as [-180, 180]
// (with coordinate wrapping), while "y" is a function of latitude and spans
// an infinite range. (As "y" coordinates get larger, points get closer to
// the north pole but never quite reach it.) The north and south poles have
// infinite "y" values. (Note that this will cause problems if you tessellate
// a Mercator edge where one endpoint is a pole. If you need to do this, clip
// the edge first so that the "y" coordinate is no more than about 5 * maxX.)
type MercatorProjection struct {
	xWrap       float64
	toRadians   float64 // Multiplier to convert coordinates to radians.
	fromRadians float64 // Multiplier to convert coordinates from radians.
}

// NewMercatorProjection constructs a Mercator projection with the given maximum
// longitude axis value corresponding to a range of [-maxLng, maxLng].
// The horizontal and vertical axes are scaled equally.
func NewMercatorProjection(maxLng float64) Projection {
	return &MercatorProjection{
		xWrap:       2 * maxLng,
		toRadians:   math.Pi / maxLng,
		fromRadians: maxLng / math.Pi,
	}
}

// Project converts a point on the sphere to a projected 2D point.
func (p *MercatorProjection) Project(pt Point) r2.Point {
	return p.FromLatLng(LatLngFromPoint(pt))
}

// Unproject converts a projected 2D point to a point on the sphere.
func (p *MercatorProjection) Unproject(pt r2.Point) Point {
	return PointFromLatLng(p.ToLatLng(pt))
}

// FromLatLng returns the LatLng projected into an R2 Point.
func (p *MercatorProjection) FromLatLng(ll LatLng) r2.Point {
	// This formula is more accurate near zero than the log(tan()) version.
	// Note that latitudes of +/- 90 degrees yield "y" values of +/- infinity.
	sinPhi := math.Sin(float64(ll.Lat))
	y := 0.5 * math.Log((1+sinPhi)/(1-sinPhi))
	return r2.Point{p.fromRadians * float64(ll.Lng), p.fromRadians * y}
}

// ToLatLng returns the LatLng projected from the given R2 Point.
func (p *MercatorProjection) ToLatLng(pt r2.Point) LatLng {
	// This formula is more accurate near zero than the atan(exp()) version.
	x := p.toRadians * math.Remainder(pt.X, p.xWrap)
	k := math.Exp(2 * p.toRadians * pt.Y)
	var y float64
	if math.IsInf(k, 0) {
		y = math.Pi / 2
	} else {
		y = math.Asin((k - 1) / (k + 1))
	}
	return LatLng{s1.Angle(y), s1.Angle(x)}
}

// Interpolate returns the point obtained by interpolating the given
// fraction of the distance along the line from A to B.
func (p *MercatorProjection) Interpolate(f float64, a, b r2.Point) r2.Point {
	return a.Mul(1 - f).Add(b.Mul(f))
}

// WrapDistance reports the coordinate wrapping distance along each axis.
func (p *MercatorProjection) WrapDistance() r2.Point {
	return r2.Point{p.xWrap, 0}
}

// WrapDestination wraps the points if needed to get the shortest edge.
func (p *MercatorProjection) WrapDestination(a, b r2.Point) r2.Point {
	return wrapDestination(a, b, p.WrapDistance)
}

func (p *MercatorProjection) privateInterface() {}

func wrapDestination(a, b r2.Point, wrapDistance func() r2.Point) r2.Point {
	wrap := wrapDistance()
	x := b.X
	y := b.Y
	// The code below ensures that "b" is unmodified unless wrapping is required.
	if wrap.X > 0 && math.Abs(x-a.X) > 0.5*wrap.X {
		x = a.X + math.Remainder(x-a.X, wrap.X)
	}
	if wrap.Y > 0 && math.Abs(y-a.Y) > 0.5*wrap.Y {
		y = a.Y + math.Remainder(y-a.Y, wrap.Y)
	}
	return r2.Point{x, y}
}
