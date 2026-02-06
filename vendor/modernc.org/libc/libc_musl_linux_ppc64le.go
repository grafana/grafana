// Copyright 2023 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package libc // import "modernc.org/libc"

type long = int64

type ulong = uint64

// RawMem represents the biggest byte array the runtime can handle
type RawMem [1<<50 - 1]byte
