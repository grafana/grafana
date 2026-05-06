//  Copyright (c) 2020 The Bluge Authors.
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

package bluge

import (
	"fmt"

	segment "github.com/blugelabs/bluge_segment_api"

	"github.com/blugelabs/bluge/index"
)

type Writer struct {
	config Config
	chill  *index.Writer
}

func OpenWriter(config Config) (*Writer, error) {
	rv := &Writer{
		config: config,
	}

	var err error
	rv.chill, err = index.OpenWriter(config.indexConfig)
	if err != nil {
		return nil, fmt.Errorf("error opening index: %w", err)
	}

	return rv, nil
}

func (w *Writer) Insert(doc segment.Document) error {
	b := NewBatch()
	b.Insert(doc)
	return w.Batch(b)
}

func (w *Writer) Update(id segment.Term, doc segment.Document) error {
	b := NewBatch()
	b.Update(id, doc)
	return w.Batch(b)
}

func (w *Writer) Delete(id segment.Term) error {
	b := NewBatch()
	b.Delete(id)
	return w.Batch(b)
}

func (w *Writer) Batch(batch *index.Batch) error {
	return w.chill.Batch(batch)
}

func (w *Writer) Close() error {
	return w.chill.Close()
}

func (w *Writer) Reader() (*Reader, error) {
	r, err := w.chill.Reader()
	if err != nil {
		return nil, fmt.Errorf("error getting nreal time reader: %w", err)
	}
	return &Reader{
		config: w.config,
		reader: r,
	}, nil
}
