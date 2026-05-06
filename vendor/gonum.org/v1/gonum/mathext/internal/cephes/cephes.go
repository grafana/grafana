// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package cephes

import "math"

/*
Additional copyright information:

Code in this package is adapted from the Cephes library (http://www.netlib.org/cephes/).
There is no explicit licence on Netlib, but the author has agreed to a BSD release.
See https://github.com/deepmind/torch-cephes/blob/master/LICENSE.txt and
https://lists.debian.org/debian-legal/2004/12/msg00295.html
*/

const (
	paramOutOfBounds            = "cephes: parameter out of bounds"
	errParamFunctionSingularity = "cephes: function singularity"
)

const (
	machEp  = 1.0 / (1 << 53)
	maxLog  = 1024 * math.Ln2
	minLog  = -1075 * math.Ln2
	maxIter = 2000
)
