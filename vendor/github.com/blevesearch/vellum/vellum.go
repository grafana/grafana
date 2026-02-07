//  Copyright (c) 2017 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/*
Package vellum is a library for building, serializing and executing an FST (finite
state transducer).

There are two distinct phases, building an FST and using it.

When building an FST, you insert keys ([]byte) and their associated value
(uint64). Insert operations MUST be done in lexicographic order.  While
building the FST, data is streamed to an underlying Writer. At the conclusion
of building, you MUST call Close() on the builder.

After completion of the build phase, you can either Open() the FST if you
serialized it to disk.  Alternatively, if you already have the bytes in
memory, you can use Load().  By default, Open() will use mmap to avoid loading
the entire file into memory.

Once the FST is ready, you can use the Contains() method to see if a keys is
in the FST.  You can use the Get() method to see if a key is in the FST and
retrieve it's associated value.  And, you can use the Iterator method to
enumerate key/value pairs within a specified range.

*/
package vellum

import (
	"errors"
	"io"
)

// ErrOutOfOrder is returned when values are not inserted in
// lexicographic order.
var ErrOutOfOrder = errors.New("values not inserted in lexicographic order")

// ErrIteratorDone is returned by Iterator/Next/Seek methods when the
// Current() value pointed to by the iterator is greater than the last
// key in this FST, or outside the configured startKeyInclusive/endKeyExclusive
// range of the Iterator.
var ErrIteratorDone = errors.New("iterator-done")

// BuilderOpts is a structure to let advanced users customize the behavior
// of the builder and some aspects of the generated FST.
type BuilderOpts struct {
	Encoder           int
	RegistryTableSize int
	RegistryMRUSize   int
}

// New returns a new Builder which will stream out the
// underlying representation to the provided Writer as the set is built.
func New(w io.Writer, opts *BuilderOpts) (*Builder, error) {
	return newBuilder(w, opts)
}

// Open loads the FST stored in the provided path
func Open(path string) (*FST, error) {
	return open(path)
}

// Load will return the FST represented by the provided byte slice.
func Load(data []byte) (*FST, error) {
	return new(data, nil)
}

// Merge will iterate through the provided Iterators, merge duplicate keys
// with the provided MergeFunc, and build a new FST to the provided Writer.
func Merge(w io.Writer, opts *BuilderOpts, itrs []Iterator, f MergeFunc) error {
	builder, err := New(w, opts)
	if err != nil {
		return err
	}

	itr, err := NewMergeIterator(itrs, f)
	for err == nil {
		k, v := itr.Current()
		err = builder.Insert(k, v)
		if err != nil {
			return err
		}
		err = itr.Next()
	}

	if err != nil && err != ErrIteratorDone {
		return err
	}

	err = itr.Close()
	if err != nil {
		return err
	}

	err = builder.Close()
	if err != nil {
		return err
	}

	return nil
}
