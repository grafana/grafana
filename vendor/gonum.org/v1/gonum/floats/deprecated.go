// Copyright ©2020 The Gonum Authors. All rights reserved.
// Use of this code is governed by a BSD-style
// license that can be found in the LICENSE file.

// TODO(kortschak): Delete this file for v0.9.0.

package floats

import "gonum.org/v1/gonum/floats/scalar"

var (
	// Deprecated: Use scalar.EqualWithinAbs.
	EqualWithinAbs = scalar.EqualWithinAbs

	// Deprecated: Use scalar.EqualWithinAbsOrRel.
	EqualWithinAbsOrRel = scalar.EqualWithinAbsOrRel

	// Deprecated: Use scalar.EqualWithinRel.
	EqualWithinRel = scalar.EqualWithinRel

	// Deprecated: Use scalar.EqualWithinULP.
	EqualWithinULP = scalar.EqualWithinULP

	// Deprecated: Use scalar.NaNPayload.
	NaNPayload = scalar.NaNPayload

	// Deprecated: Use scalar.NaNWith.
	NaNWith = scalar.NaNWith

	// Deprecated: Use scalar.ParseWithNA.
	ParseWithNA = scalar.ParseWithNA

	// Deprecated: Use scalar.Round.
	Round = scalar.Round

	// Deprecated: Use scalar.RoundEven.
	RoundEven = scalar.RoundEven
)
