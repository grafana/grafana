// Copyright ©2020 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !safe
// +build !safe

package iterator

import (
	"unsafe"

	"gonum.org/v1/gonum/graph"
)

// A mapIter is an iterator for ranging over a map.
type mapIter struct {
	m     *emptyInterface
	hiter hiter
}

type emptyInterface struct {
	typ, word unsafe.Pointer
}

// newMapIterNodes returns a range iterator for a map of nodes.
// The returned mapIter must not have its line or weightedLine methods called.
func newMapIterNodes(m map[int64]graph.Node) *mapIter {
	return &mapIter{m: eface(m)}
}

// newMapIterEdges returns a range iterator for a map of edges.
// The returned mapIter must not have its node, line or weightedLine methods called.
func newMapIterEdges(m map[int64]graph.Edge) *mapIter {
	return &mapIter{m: eface(m)}
}

// newMapIterLines returns a range iterator for a map of line.
// The returned mapIter must not have its node or weightedLine method called.
func newMapIterLines(m map[int64]graph.Line) *mapIter {
	return &mapIter{m: eface(m)}
}

// newMapIterWeightedLines returns a range iterator for a map of line.
// The returned mapIter must not have its node, line or weightedLine methods called.
func newMapIterWeightedLines(m map[int64]graph.WeightedLine) *mapIter {
	return &mapIter{m: eface(m)}
}

// newMapIterByWeightedEdges returns a range iterator for a map of edges.
// The returned mapIter must not have its node, line or weightedLine methods called.
func newMapIterByWeightedEdges(m map[int64]graph.WeightedEdge) *mapIter {
	return &mapIter{m: eface(m)}
}

// newMapIterByLines returns a range iterator for a map of edges.
// The returned mapIter must not have its node, line or weightedLine methods called.
func newMapIterByLines(m map[int64]map[int64]graph.Line) *mapIter {
	return &mapIter{m: eface(m)}
}

// newMapIterByWeightedLines returns a range iterator for a map of edges.
// The returned mapIter must not have its node, line or weightedLine methods called.
func newMapIterByWeightedLines(m map[int64]map[int64]graph.WeightedLine) *mapIter {
	return &mapIter{m: eface(m)}
}

func eface(i interface{}) *emptyInterface {
	return (*emptyInterface)(unsafe.Pointer(&i))
}

// id returns the key of the iterator's current map entry.
func (it *mapIter) id() int64 {
	if !it.hiter.initialized() {
		panic("mapIter.id called before Next")
	}
	if mapiterkey(&it.hiter) == nil {
		panic("mapIter.id called on exhausted iterator")
	}
	return *(*int64)(mapiterkey(&it.hiter))
}

// node returns the value of the iterator's current map entry.
func (it *mapIter) node() graph.Node {
	if !it.hiter.initialized() {
		panic("mapIter.node called before next")
	}
	if mapiterkey(&it.hiter) == nil {
		panic("mapIter.node called on exhausted iterator")
	}
	return *(*graph.Node)(mapiterelem(&it.hiter))
}

// line returns the value of the iterator's current map entry.
func (it *mapIter) line() graph.Line {
	if !it.hiter.initialized() {
		panic("mapIter.line called before next")
	}
	if mapiterkey(&it.hiter) == nil {
		panic("mapIter.line called on exhausted iterator")
	}
	return *(*graph.Line)(mapiterelem(&it.hiter))
}

// weightedLine returns the value of the iterator's current map entry.
func (it *mapIter) weightedLine() graph.WeightedLine {
	if !it.hiter.initialized() {
		panic("mapIter.weightedLine called before next")
	}
	if mapiterkey(&it.hiter) == nil {
		panic("mapIter.weightedLine called on exhausted iterator")
	}
	return *(*graph.WeightedLine)(mapiterelem(&it.hiter))
}

// next advances the map iterator and reports whether there is another
// entry. It returns false when the iterator is exhausted; subsequent
// calls to Key, Value, or next will panic.
func (it *mapIter) next() bool {
	if !it.hiter.initialized() {
		mapiterinit(it.m.typ, it.m.word, &it.hiter)
	} else {
		if mapiterkey(&it.hiter) == nil {
			panic("mapIter.next called on exhausted iterator")
		}
		mapiternext(&it.hiter)
	}
	return mapiterkey(&it.hiter) != nil
}

//go:linkname mapiterinit runtime.mapiterinit
//go:noescape
func mapiterinit(t, m unsafe.Pointer, it *hiter)

//go:linkname mapiterkey reflect.mapiterkey
//go:noescape
func mapiterkey(it *hiter) (key unsafe.Pointer)

//go:linkname mapiterelem reflect.mapiterelem
//go:noescape
func mapiterelem(it *hiter) (elem unsafe.Pointer)

//go:linkname mapiternext reflect.mapiternext
//go:noescape
func mapiternext(it *hiter)
