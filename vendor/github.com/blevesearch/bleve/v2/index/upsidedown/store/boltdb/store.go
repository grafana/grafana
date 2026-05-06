//  Copyright (c) 2014 Couchbase, Inc.
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

// Package boltdb implements a store.KVStore on top of BoltDB. It supports the
// following options:
//
// "bucket" (string): the name of BoltDB bucket to use, defaults to "bleve".
//
// "nosync" (bool): if true, set boltdb.DB.NoSync to true. It speeds up index
// operations in exchange of losing integrity guarantees if indexation aborts
// without closing the index. Use it when rebuilding indexes from zero.
package boltdb

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"

	"github.com/blevesearch/bleve/v2/registry"
	store "github.com/blevesearch/upsidedown_store_api"
	bolt "go.etcd.io/bbolt"
)

const (
	Name                    = "boltdb"
	defaultCompactBatchSize = 100
)

type Store struct {
	path        string
	bucket      string
	db          *bolt.DB
	noSync      bool
	fillPercent float64
	mo          store.MergeOperator
}

func New(mo store.MergeOperator, config map[string]interface{}) (store.KVStore, error) {
	path, ok := config["path"].(string)
	if !ok {
		return nil, fmt.Errorf("must specify path")
	}
	if path == "" {
		return nil, os.ErrInvalid
	}

	bucket, ok := config["bucket"].(string)
	if !ok {
		bucket = "bleve"
	}

	noSync, _ := config["nosync"].(bool)

	fillPercent, ok := config["fillPercent"].(float64)
	if !ok {
		fillPercent = bolt.DefaultFillPercent
	}

	bo := &bolt.Options{}
	ro, ok := config["read_only"].(bool)
	if ok {
		bo.ReadOnly = ro
	}

	if initialMmapSize, ok := config["initialMmapSize"].(int); ok {
		bo.InitialMmapSize = initialMmapSize
	} else if initialMmapSize, ok := config["initialMmapSize"].(float64); ok {
		bo.InitialMmapSize = int(initialMmapSize)
	}

	db, err := bolt.Open(path, 0600, bo)
	if err != nil {
		return nil, err
	}
	db.NoSync = noSync

	if !bo.ReadOnly {
		err = db.Update(func(tx *bolt.Tx) error {
			_, err := tx.CreateBucketIfNotExists([]byte(bucket))

			return err
		})
		if err != nil {
			return nil, err
		}
	}

	rv := Store{
		path:        path,
		bucket:      bucket,
		db:          db,
		mo:          mo,
		noSync:      noSync,
		fillPercent: fillPercent,
	}
	return &rv, nil
}

func (bs *Store) Close() error {
	return bs.db.Close()
}

func (bs *Store) Reader() (store.KVReader, error) {
	tx, err := bs.db.Begin(false)
	if err != nil {
		return nil, err
	}
	return &Reader{
		store:  bs,
		tx:     tx,
		bucket: tx.Bucket([]byte(bs.bucket)),
	}, nil
}

func (bs *Store) Writer() (store.KVWriter, error) {
	return &Writer{
		store: bs,
	}, nil
}

func (bs *Store) Stats() json.Marshaler {
	return &stats{
		s: bs,
	}
}

// CompactWithBatchSize removes DictionaryTerm entries with a count of zero (in batchSize batches)
// Removing entries is a workaround for github issue #374.
func (bs *Store) CompactWithBatchSize(batchSize int) error {
	for {
		cnt := 0
		err := bs.db.Batch(func(tx *bolt.Tx) error {
			c := tx.Bucket([]byte(bs.bucket)).Cursor()
			prefix := []byte("d")

			for k, v := c.Seek(prefix); bytes.HasPrefix(k, prefix); k, v = c.Next() {
				if bytes.Equal(v, []byte{0}) {
					cnt++
					if err := c.Delete(); err != nil {
						return err
					}
					if cnt == batchSize {
						break
					}
				}

			}
			return nil
		})
		if err != nil {
			return err
		}

		if cnt == 0 {
			break
		}
	}
	return nil
}

// Compact calls CompactWithBatchSize with a default batch size of 100.  This is a workaround
// for github issue #374.
func (bs *Store) Compact() error {
	return bs.CompactWithBatchSize(defaultCompactBatchSize)
}

func init() {
	err := registry.RegisterKVStore(Name, New)
	if err != nil {
		panic(err)
	}
}
