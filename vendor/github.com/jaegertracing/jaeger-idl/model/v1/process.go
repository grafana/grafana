// Copyright (c) 2019 The Jaeger Authors.
// Copyright (c) 2017 Uber Technologies, Inc.
// SPDX-License-Identifier: Apache-2.0

package model

import (
	"io"
)

// NewProcess creates a new Process for given serviceName and tags.
// The tags are sorted in place and kept in the same array/slice,
// in order to store the Process in a canonical form that is relied
// upon by the Equal and Hash functions.
func NewProcess(serviceName string, tags []KeyValue) *Process {
	typedTags := KeyValues(tags)
	typedTags.Sort()
	return &Process{ServiceName: serviceName, Tags: typedTags}
}

// Equal compares Process object with another Process.
func (p *Process) Equal(other *Process) bool {
	if p.ServiceName != other.ServiceName {
		return false
	}
	return KeyValues(p.Tags).Equal(other.Tags)
}

// Hash implements Hash from Hashable.
func (p *Process) Hash(w io.Writer) (err error) {
	if _, err := w.Write([]byte(p.ServiceName)); err != nil {
		return err
	}
	return KeyValues(p.Tags).Hash(w)
}
