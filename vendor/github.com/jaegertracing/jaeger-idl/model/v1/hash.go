// Copyright (c) 2019 The Jaeger Authors.
// Copyright (c) 2017 Uber Technologies, Inc.
// SPDX-License-Identifier: Apache-2.0

package model

import (
	"hash/fnv"
	"io"
)

// Hashable interface is for type that can participate in a hash computation
// by writing their data into io.Writer, which is usually an instance of hash.Hash.
type Hashable interface {
	Hash(w io.Writer) error
}

// HashCode calculates a FNV-1a hash code for a Hashable object.
func HashCode(o Hashable) (uint64, error) {
	h := fnv.New64a()
	if err := o.Hash(h); err != nil {
		return 0, err
	}
	return h.Sum64(), nil
}
