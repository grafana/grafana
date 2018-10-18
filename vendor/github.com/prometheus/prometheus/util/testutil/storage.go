// Copyright 2017 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package testutil

import (
	"io/ioutil"
	"os"
	"time"

	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/storage"
	"github.com/prometheus/prometheus/storage/tsdb"
)

// NewStorage returns a new storage for testing purposes
// that removes all associated files on closing.
func NewStorage(t T) storage.Storage {
	dir, err := ioutil.TempDir("", "test_storage")
	if err != nil {
		t.Fatalf("Opening test dir failed: %s", err)
	}

	// Tests just load data for a series sequentially. Thus we
	// need a long appendable window.
	db, err := tsdb.Open(dir, nil, nil, &tsdb.Options{
		MinBlockDuration: model.Duration(24 * time.Hour),
		MaxBlockDuration: model.Duration(24 * time.Hour),
	})
	if err != nil {
		t.Fatalf("Opening test storage failed: %s", err)
	}
	return testStorage{Storage: tsdb.Adapter(db, int64(0)), dir: dir}
}

type testStorage struct {
	storage.Storage
	dir string
}

func (s testStorage) Close() error {
	if err := s.Storage.Close(); err != nil {
		return err
	}
	return os.RemoveAll(s.dir)
}
