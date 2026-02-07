// Copyright ©2021 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build safe
// +build safe

package iterator

import (
	"reflect"

	"gonum.org/v1/gonum/graph"
)

// Lines implements the graph.Lines interfaces.
// The iteration order of Lines is randomized.
type Lines struct {
	iter     reflect.MapIter
	pos, len int
	curr     graph.Line
	value    reflect.Value
	lines    reflect.Value
}

// NewLines returns a Lines initialized with the provided lines, a
// map of line IDs to graph.Lines. No check is made that the keys
// match the graph.Line IDs, and the map keys are not used.
//
// Behavior of the Lines is unspecified if lines is mutated after
// the call to NewLines.
func NewLines(lines map[int64]graph.Line) *Lines {
	rv := reflect.ValueOf(lines)
	l := &Lines{lines: rv, len: len(lines)}
	l.iter.Reset(rv)
	l.value = reflect.ValueOf(&l.curr).Elem()
	return l
}

// Len returns the remaining number of lines to be iterated over.
func (l *Lines) Len() int {
	return l.len - l.pos
}

// Next returns whether the next call of Line will return a valid line.
func (l *Lines) Next() bool {
	if l.pos >= l.len {
		return false
	}
	ok := l.iter.Next()
	if ok {
		l.pos++
		l.value.SetIterValue(&l.iter)
	}
	return ok
}

// Line returns the current line of the iterator. Next must have been
// called prior to a call to Line.
func (l *Lines) Line() graph.Line {
	return l.curr
}

// Reset returns the iterator to its initial state.
func (l *Lines) Reset() {
	l.curr = nil
	l.pos = 0
	l.iter.Reset(l.lines)
}

// LineSlice returns all the remaining lines in the iterator and advances
// the iterator. The order of lines within the returned slice is not
// specified.
func (l *Lines) LineSlice() []graph.Line {
	if l.Len() == 0 {
		return nil
	}
	lines := make([]graph.Line, 0, l.Len())
	for l.iter.Next() {
		l.value.SetIterValue(&l.iter)
		lines = append(lines, l.curr)
	}
	l.pos = l.len
	return lines
}

// WeightedLines implements the graph.WeightedLines interfaces.
// The iteration order of WeightedLines is randomized.
type WeightedLines struct {
	iter     reflect.MapIter
	pos, len int
	curr     graph.WeightedLine
	value    reflect.Value
	lines    reflect.Value
}

// NewWeightedLines returns a WeightedLines initialized with the provided lines, a
// map of line IDs to graph.WeightedLines. No check is made that the keys
// match the graph.WeightedLine IDs, and the map keys are not used.
//
// Behavior of the WeightedLines is unspecified if lines is mutated after
// the call to NewWeightedLines.
func NewWeightedLines(lines map[int64]graph.WeightedLine) *WeightedLines {
	rv := reflect.ValueOf(lines)
	l := &WeightedLines{lines: rv, len: len(lines)}
	l.iter.Reset(rv)
	l.value = reflect.ValueOf(&l.curr).Elem()
	return l
}

// Len returns the remaining number of lines to be iterated over.
func (l *WeightedLines) Len() int {
	return l.len - l.pos
}

// Next returns whether the next call of WeightedLine will return a valid line.
func (l *WeightedLines) Next() bool {
	if l.pos >= l.len {
		return false
	}
	ok := l.iter.Next()
	if ok {
		l.pos++
		l.value.SetIterValue(&l.iter)
	}
	return ok
}

// WeightedLine returns the current line of the iterator. Next must have been
// called prior to a call to WeightedLine.
func (l *WeightedLines) WeightedLine() graph.WeightedLine {
	return l.curr
}

// Reset returns the iterator to its initial state.
func (l *WeightedLines) Reset() {
	l.curr = nil
	l.pos = 0
	l.iter.Reset(l.lines)
}

// WeightedLineSlice returns all the remaining lines in the iterator and advances
// the iterator. The order of lines within the returned slice is not
// specified.
func (l *WeightedLines) WeightedLineSlice() []graph.WeightedLine {
	if l.Len() == 0 {
		return nil
	}
	lines := make([]graph.WeightedLine, 0, l.Len())
	for l.iter.Next() {
		l.value.SetIterValue(&l.iter)
		lines = append(lines, l.curr)
	}
	l.pos = l.len
	return lines
}
