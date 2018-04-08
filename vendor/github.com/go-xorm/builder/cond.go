// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import (
	"bytes"
	"io"
)

// Writer defines the interface
type Writer interface {
	io.Writer
	Append(...interface{})
}

var _ Writer = NewWriter()

// BytesWriter implments Writer and save SQL in bytes.Buffer
type BytesWriter struct {
	writer *bytes.Buffer
	buffer []byte
	args   []interface{}
}

// NewWriter creates a new string writer
func NewWriter() *BytesWriter {
	w := &BytesWriter{}
	w.writer = bytes.NewBuffer(w.buffer)
	return w
}

// Write writes data to Writer
func (s *BytesWriter) Write(buf []byte) (int, error) {
	return s.writer.Write(buf)
}

// Append appends args to Writer
func (s *BytesWriter) Append(args ...interface{}) {
	s.args = append(s.args, args...)
}

// Cond defines an interface
type Cond interface {
	WriteTo(Writer) error
	And(...Cond) Cond
	Or(...Cond) Cond
	IsValid() bool
}

type condEmpty struct{}

var _ Cond = condEmpty{}

// NewCond creates an empty condition
func NewCond() Cond {
	return condEmpty{}
}

func (condEmpty) WriteTo(w Writer) error {
	return nil
}

func (condEmpty) And(conds ...Cond) Cond {
	return And(conds...)
}

func (condEmpty) Or(conds ...Cond) Cond {
	return Or(conds...)
}

func (condEmpty) IsValid() bool {
	return false
}

func condToSQL(cond Cond) (string, []interface{}, error) {
	if cond == nil || !cond.IsValid() {
		return "", nil, nil
	}

	w := NewWriter()
	if err := cond.WriteTo(w); err != nil {
		return "", nil, err
	}
	return w.writer.String(), w.args, nil
}
