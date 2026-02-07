// Copyright 2022 Dolthub, Inc.
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

package aggregation

import (
	"errors"
	"io"

	"github.com/dolthub/go-mysql-server/sql"
)

// WindowIter is a wrapper that evaluates a set of WindowPartitionIter.
//
// The current implementation has 3 steps:
// 1. Materialize [iter] and duplicate a sql.WindowBuffer for each partition.
// 2. Collect rows from child partitions.
// 3. Rearrange partition results into the projected ordering given by [outputOrdinals].
//
// We assume [outputOrdinals] is appropriately sized for [partitionIters].
type WindowIter struct {
	iter           sql.RowIter
	partitionIters []*WindowPartitionIter
	outputOrdinals [][]int
	initialized    bool
}

func NewWindowIter(partitionIters []*WindowPartitionIter, outputOrdinals [][]int, iter sql.RowIter) *WindowIter {
	return &WindowIter{
		partitionIters: partitionIters,
		outputOrdinals: outputOrdinals,
		iter:           iter,
	}
}

var _ sql.RowIter = (*WindowIter)(nil)
var _ sql.Disposable = (*WindowIter)(nil)

// Close implements sql.RowIter
func (i *WindowIter) Close(ctx *sql.Context) error {
	i.Dispose()
	var err error
	for _, p := range i.partitionIters {
		e := p.Close(ctx)
		if err == nil && e != nil {
			err = e
		}
	}
	return err
}

// Dispose implements sql.Disposable
func (i *WindowIter) Dispose() {
	for _, p := range i.partitionIters {
		p.Dispose()
	}
	return
}

// Next implements sql.RowIter
func (i *WindowIter) Next(ctx *sql.Context) (sql.Row, error) {
	if !i.initialized {
		err := i.initializeIters(ctx)
		if err != nil {
			return nil, err
		}
	}

	row := make(sql.Row, i.size())
	for j, pIter := range i.partitionIters {
		res, err := pIter.Next(ctx)
		if err != nil {
			return nil, err
		}
		for k, idx := range i.outputOrdinals[j] {
			row[idx] = res[k]
		}
	}
	return row, nil
}

func (i *WindowIter) size() int {
	size := -1
	for _, i := range i.outputOrdinals {
		for _, j := range i {
			if j > size {
				size = j
			}
		}
	}
	return size + 1
}

// initializeIters materializes and copies the input buffer into each
// WindowPartitionIter.
// TODO: share the child buffer and sort/partition inbetween WindowPartitionIters
func (i *WindowIter) initializeIters(ctx *sql.Context) error {
	buf := make(sql.WindowBuffer, 0)
	var row sql.Row
	var err error
	for {
		// drain child iter into reusable buffer
		row, err = i.iter.Next(ctx)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return err
		}
		buf = append(buf, row)
	}

	for _, i := range i.partitionIters {
		// each iter has its own copy of input buffer
		i.child = &windowBufferIter{buf: buf}
	}
	i.initialized = true
	return nil
}

// windowBufferIter bridges an in-memory buffer to the sql.RowIter interface
type windowBufferIter struct {
	buf sql.WindowBuffer
	pos int
}

func (i *windowBufferIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.pos >= len(i.buf) {
		return nil, io.EOF
	}
	row := i.buf[i.pos]
	i.pos++
	return row, nil
}

func (i *windowBufferIter) Close(ctx *sql.Context) error {
	i.buf = nil
	return nil
}
