// Copyright 2018 The CUE Authors
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

// Package pkg define CUE standard packages.
//
// Many of the standard packages are modeled after and generated from the Go
// core packages. The types, values, and functions are defined as their Go
// equivalence and mapped to CUE types.
//
// Beware that some packages are defined in lesser-precision types than are
// typically used in CUE and thus may lead to loss of precision.
//
// All packages except those defined in the tool subdirectory are hermetic,
// that is depending only on a known set of inputs, and therefore can guarantee
// reproducible results.  That is:
//
//   - no reading of files contents
//   - no querying of the file system of any kind
//   - no communication on the network
//   - no information about the type of environment
//   - only reproducible random generators
//
// Hermetic configurations allow for fast and advanced analysis that otherwise
// would not be possible or practical. The cue "cmd" command can be used to mix
// in non-hermetic influences into configurations by using packages defined
// in the tool subdirectory.
package pkg
