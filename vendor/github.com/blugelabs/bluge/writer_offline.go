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

type OfflineWriter struct {
	writer *index.WriterOffline

	batchSize          int
	maxSegmentsToMerge int
	batch              *index.Batch
	batchCount         int
}

func OpenOfflineWriter(config Config, batchSize, maxSegmentsToMerge int) (*OfflineWriter, error) {
	rv := &OfflineWriter{
		batchSize:          batchSize,
		maxSegmentsToMerge: maxSegmentsToMerge,
		batch:              index.NewBatch(),
	}

	var err error
	rv.writer, err = index.OpenOfflineWriter(config.indexConfig)
	if err != nil {
		return nil, fmt.Errorf("error opening index: %w", err)
	}

	return rv, nil
}

func (w *OfflineWriter) Insert(doc segment.Document) error {
	w.batch.Insert(doc)
	w.batchCount++
	if w.batchCount > w.batchSize {
		err := w.writer.Batch(w.batch)
		if err != nil {
			return err
		}
		w.batch.Reset()
		w.batchCount = 0
	}
	return nil
}

func (w *OfflineWriter) Close() error {
	if w.batchCount > 0 {
		err := w.writer.Batch(w.batch)
		if err != nil {
			return err
		}
	}
	return w.writer.Close()
}
