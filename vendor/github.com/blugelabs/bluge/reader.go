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
	"context"
	"fmt"

	"github.com/blugelabs/bluge/index"

	segment "github.com/blugelabs/bluge_segment_api"

	"github.com/blugelabs/bluge/search"
)

type Reader struct {
	config Config
	reader *index.Snapshot
}

func OpenReader(config Config) (*Reader, error) {
	rv := &Reader{
		config: config,
	}
	var err error
	rv.reader, err = index.OpenReader(config.indexConfig)
	if err != nil {
		return nil, fmt.Errorf("error opening index: %w", err)
	}

	return rv, nil
}

func (r *Reader) Count() (count uint64, err error) {
	return r.reader.Count()
}

func (r *Reader) Fields() (fields []string, err error) {
	return r.reader.Fields()
}

type StoredFieldVisitor func(field string, value []byte) bool

func (r *Reader) VisitStoredFields(number uint64, visitor StoredFieldVisitor) error {
	return r.reader.VisitStoredFields(number, segment.StoredFieldVisitor(visitor))
}

func (r *Reader) Search(ctx context.Context, req SearchRequest) (search.DocumentMatchIterator, error) {
	collector := req.Collector()
	searcher, err := req.Searcher(r.reader, r.config)
	if err != nil {
		return nil, err
	}

	memNeeded := memNeededForSearch(searcher, collector)
	if r.config.SearchStartFunc != nil {
		err = r.config.SearchStartFunc(memNeeded)
	}
	if err != nil {
		return nil, err
	}
	if r.config.SearchEndFunc != nil {
		defer r.config.SearchEndFunc(memNeeded)
	}

	var dmItr search.DocumentMatchIterator
	dmItr, err = collector.Collect(ctx, req.Aggregations(), searcher)
	if err != nil {
		return nil, err
	}

	// FIXME search stats on reader?

	return dmItr, nil
}

func (r *Reader) DictionaryIterator(field string, automaton segment.Automaton, start, end []byte) (segment.DictionaryIterator, error) {
	return r.reader.DictionaryIterator(field, automaton, start, end)
}

func (r *Reader) Backup(path string, cancel chan struct{}) error {
	dir := index.NewFileSystemDirectory(path)
	return r.reader.Backup(dir, cancel)
}

func (r *Reader) Close() error {
	return r.reader.Close()
}
