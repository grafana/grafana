// Copyright ©2025 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Copyright 2024 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !safe && go1.24
// +build !safe,go1.24

package iterator

import "unsafe"

// hiter's structure matches internal/runtime/maps.Iter's
// structure.
// Having a clone here allows us to embed a map iterator
// inside type mapIter so that mapIters can be re-used
// without doing any allocations.
//
//lint:ignore U1000 This is a verbatim copy of the runtime type.
type hiter struct {
	key         unsafe.Pointer // Must be in first position.  Write nil to indicate iteration end (see cmd/compile/internal/walk/range.go).
	elem        unsafe.Pointer // Must be in second position (see cmd/compile/internal/walk/range.go).
	typ         unsafe.Pointer
	m           unsafe.Pointer
	entryOffset uint64
	dirOffset   uint64
	clearSeq    uint64
	globalDepth uint8
	dirIdx      int
	tab         unsafe.Pointer
	group       groupReference
	entryIdx    uint64
}

//lint:ignore U1000 This is a verbatim copy of the runtime type.
type groupReference struct {
	data unsafe.Pointer // data *typ.Group
}

func (h *hiter) initialized() bool {
	return h.typ != nil
}
