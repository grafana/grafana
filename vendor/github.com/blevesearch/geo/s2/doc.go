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

/*
Package s2 is a library for working with geometry in S² (spherical geometry).

Its related packages, parallel to this one, are s1 (operates on S¹), r1 (operates on ℝ¹),
r2 (operates on ℝ²) and r3 (operates on ℝ³).

This package provides types and functions for the S2 cell hierarchy and coordinate systems.
The S2 cell hierarchy is a hierarchical decomposition of the surface of a unit sphere (S²)
into “cells”; it is highly efficient, scales from continental size to under 1 cm²
and preserves spatial locality (nearby cells have close IDs).

More information including an in-depth introduction to S2 can be found on the
S2 website https://s2geometry.io/
*/
package s2
