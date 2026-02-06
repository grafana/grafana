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

package zap

import (
	"bufio"
	"fmt"
	"io"
	"math"
	"os"

	index "github.com/blevesearch/bleve_index_api"
	"github.com/blevesearch/vellum"
)

const Version uint32 = 16
const IndexSectionsVersion uint32 = 16
const Type string = "zap"

const fieldNotUninverted = math.MaxUint64

func (sb *SegmentBase) Persist(path string) error {
	return PersistSegmentBase(sb, path)
}

// WriteTo is an implementation of io.WriterTo interface.
func (sb *SegmentBase) WriteTo(w io.Writer) (int64, error) {
	if w == nil {
		return 0, fmt.Errorf("invalid writer found")
	}

	n, err := persistSegmentBaseToWriter(sb, w)
	return int64(n), err
}

// PersistSegmentBase persists SegmentBase in the zap file format.
func PersistSegmentBase(sb *SegmentBase, path string) error {
	flag := os.O_RDWR | os.O_CREATE

	f, err := os.OpenFile(path, flag, 0600)
	if err != nil {
		return err
	}

	cleanup := func() {
		_ = f.Close()
		_ = os.Remove(path)
	}

	_, err = persistSegmentBaseToWriter(sb, f)
	if err != nil {
		cleanup()
		return err
	}

	err = f.Sync()
	if err != nil {
		cleanup()
		return err
	}

	err = f.Close()
	if err != nil {
		cleanup()
		return err
	}

	return err
}

type bufWriter struct {
	w *bufio.Writer
	n int
}

func (br *bufWriter) Write(in []byte) (int, error) {
	n, err := br.w.Write(in)
	br.n += n
	return n, err
}

func persistSegmentBaseToWriter(sb *SegmentBase, w io.Writer) (int, error) {
	br := &bufWriter{w: bufio.NewWriter(w)}

	_, err := br.Write(sb.mem)
	if err != nil {
		return 0, err
	}

	err = persistFooter(sb.numDocs, sb.storedIndexOffset, sb.fieldsIndexOffset, sb.sectionsIndexOffset,
		sb.docValueOffset, sb.chunkMode, sb.memCRC, br)
	if err != nil {
		return 0, err
	}

	err = br.w.Flush()
	if err != nil {
		return 0, err
	}

	return br.n, nil
}

func persistStoredFieldValues(fieldID int,
	storedFieldValues [][]byte, stf []byte, spf [][]uint64,
	curr int, metaEncode varintEncoder, data []byte) (
	int, []byte, error) {
	for i := 0; i < len(storedFieldValues); i++ {
		// encode field
		_, err := metaEncode(uint64(fieldID))
		if err != nil {
			return 0, nil, err
		}
		// encode type
		_, err = metaEncode(uint64(stf[i]))
		if err != nil {
			return 0, nil, err
		}
		// encode start offset
		_, err = metaEncode(uint64(curr))
		if err != nil {
			return 0, nil, err
		}
		// end len
		_, err = metaEncode(uint64(len(storedFieldValues[i])))
		if err != nil {
			return 0, nil, err
		}
		// encode number of array pos
		_, err = metaEncode(uint64(len(spf[i])))
		if err != nil {
			return 0, nil, err
		}
		// encode all array positions
		for _, pos := range spf[i] {
			_, err = metaEncode(pos)
			if err != nil {
				return 0, nil, err
			}
		}

		data = append(data, storedFieldValues[i]...)
		curr += len(storedFieldValues[i])
	}

	return curr, data, nil
}

func InitSegmentBase(mem []byte, memCRC uint32, chunkMode uint32, numDocs uint64,
	storedIndexOffset uint64, sectionsIndexOffset uint64) (*SegmentBase, error) {
	sb := &SegmentBase{
		mem:                 mem,
		memCRC:              memCRC,
		chunkMode:           chunkMode,
		numDocs:             numDocs,
		storedIndexOffset:   storedIndexOffset,
		fieldsIndexOffset:   sectionsIndexOffset,
		sectionsIndexOffset: sectionsIndexOffset,
		fieldDvReaders:      make([]map[uint16]*docValueReader, len(segmentSections)),
		docValueOffset:      0, // docValueOffsets identified automatically by the section
		updatedFields:       make(map[string]*index.UpdateFieldInfo),
		fieldFSTs:           make(map[uint16]*vellum.FST),
		vecIndexCache:       newVectorIndexCache(),
		synIndexCache:       newSynonymIndexCache(),
		// following fields gets populated by loadFieldsNew
		fieldsMap: make(map[string]uint16),
		dictLocs:  make([]uint64, 0),
		fieldsInv: make([]string, 0),
	}
	sb.updateSize()

	// load the data/section starting offsets for each field
	// by via the sectionsIndexOffset as starting point.
	err := sb.loadFieldsNew()
	if err != nil {
		return nil, err
	}

	err = sb.loadDvReaders()
	if err != nil {
		return nil, err
	}

	return sb, nil
}
