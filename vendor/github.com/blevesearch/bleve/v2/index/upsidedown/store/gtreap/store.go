//  Copyright (c) 2015 Couchbase, Inc.
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

// Package gtreap provides an in-memory implementation of the
// KVStore interfaces using the gtreap balanced-binary treap,
// copy-on-write data structure.

package gtreap

import (
	"bytes"
	"fmt"
	"os"
	"sync"

	"github.com/blevesearch/bleve/v2/registry"
	"github.com/blevesearch/gtreap"
	store "github.com/blevesearch/upsidedown_store_api"
)

const Name = "gtreap"

type Store struct {
	m  sync.Mutex
	t  *gtreap.Treap
	mo store.MergeOperator
}

type Item struct {
	k []byte
	v []byte
}

func itemCompare(a, b interface{}) int {
	return bytes.Compare(a.(*Item).k, b.(*Item).k)
}

func New(mo store.MergeOperator, config map[string]interface{}) (store.KVStore, error) {
	path, ok := config["path"].(string)
	if !ok {
		return nil, fmt.Errorf("must specify path")
	}
	if path != "" {
		return nil, os.ErrInvalid
	}

	rv := Store{
		t:  gtreap.NewTreap(itemCompare),
		mo: mo,
	}
	return &rv, nil
}

func (s *Store) Close() error {
	return nil
}

func (s *Store) Reader() (store.KVReader, error) {
	s.m.Lock()
	t := s.t
	s.m.Unlock()
	return &Reader{t: t}, nil
}

func (s *Store) Writer() (store.KVWriter, error) {
	return &Writer{s: s}, nil
}

func init() {
	err := registry.RegisterKVStore(Name, New)
	if err != nil {
		panic(err)
	}
}
