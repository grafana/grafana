// Copyright 2019 Gregory Petrosyan <gregory.petrosyan@gmail.com>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/*
Package rapid implements utilities for property-based testing.

[Check] verifies that properties you define hold for a large number
of automatically generated test cases. If a failure is found, rapid
fails the current test and presents an automatically minimized
version of the failing test case.

[T.Repeat] is used to construct state machine (sometimes called "stateful"
or "model-based") tests.

# Generators

Primitives:
  - [Bool]
  - [Rune], [RuneFrom]
  - [Byte], [ByteMin], [ByteMax], [ByteRange]
  - [Int], [IntMin], [IntMax], [IntRange]
  - [Int8], [Int8Min], [Int8Max], [Int8Range]
  - [Int16], [Int16Min], [Int16Max], [Int16Range]
  - [Int32], [Int32Min], [Int32Max], [Int32Range]
  - [Int64], [Int64Min], [Int64Max], [Int64Range]
  - [Uint], [UintMin], [UintMax], [UintRange]
  - [Uint8], [Uint8Min], [Uint8Max], [Uint8Range]
  - [Uint16], [Uint16Min], [Uint16Max], [Uint16Range]
  - [Uint32], [Uint32Min], [Uint32Max], [Uint32Range]
  - [Uint64], [Uint64Min], [Uint64Max], [Uint64Range]
  - [Uintptr], [UintptrMin], [UintptrMax], [UintptrRange]
  - [Float32], [Float32Min], [Float32Max], [Float32Range]
  - [Float64], [Float64Min], [Float64Max], [Float64Range]

Collections:
  - [String], [StringMatching], [StringOf], [StringOfN], [StringN]
  - [SliceOfBytesMatching]
  - [SliceOf], [SliceOfN], [SliceOfDistinct], [SliceOfNDistinct]
  - [Permutation]
  - [MapOf], [MapOfN], [MapOfValues], [MapOfNValues]

User-defined types:
  - [Custom]
  - [Make]

Other:
  - [Map],
  - [Generator.Filter]
  - [SampledFrom], [Just]
  - [OneOf]
  - [Deferred]
  - [Ptr]
*/
package rapid
