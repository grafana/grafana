//  Copyright (c) 2020 Couchbase, Inc.
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

package ice

import (
	"encoding/binary"
)

func (s *Segment) getDocStoredMetaAndUnCompressed(docNum uint64) (meta, data []byte, err error) {
	_, storedOffset, n, metaLen, dataLen, err := s.getDocStoredOffsets(docNum)
	if err != nil {
		return nil, nil, err
	}

	meta = s.storedFieldChunkUncompressed[int(storedOffset+n):int(storedOffset+n+metaLen)]
	data = s.storedFieldChunkUncompressed[int(storedOffset+n+metaLen):int(storedOffset+n+metaLen+dataLen)]
	return meta, data, nil
}

func (s *Segment) getDocStoredOffsets(docNum uint64) (indexOffset, storedOffset, n, metaLen, dataLen uint64, err error) {
	indexOffset, storedOffset, err = s.getDocStoredOffsetsOnly(docNum)
	if err != nil {
		return 0, 0, 0, 0, 0, err
	}

	// document chunk coder
	chunkI := docNum / uint64(defaultDocumentChunkSize)
	chunkOffsetStart := s.storedFieldChunkOffsets[int(chunkI)]
	chunkOffsetEnd := s.storedFieldChunkOffsets[int(chunkI)+1]
	compressed, err := s.data.Read(int(chunkOffsetStart), int(chunkOffsetEnd))
	if err != nil {
		return 0, 0, 0, 0, 0, err
	}
	s.storedFieldChunkUncompressed = s.storedFieldChunkUncompressed[:0]
	s.storedFieldChunkUncompressed, err = ZSTDDecompress(s.storedFieldChunkUncompressed[:cap(s.storedFieldChunkUncompressed)], compressed)
	if err != nil {
		return 0, 0, 0, 0, 0, err
	}

	metaLenData := s.storedFieldChunkUncompressed[int(storedOffset):int(storedOffset+binary.MaxVarintLen64)]
	var read int
	metaLen, read = binary.Uvarint(metaLenData)
	n += uint64(read)

	dataLenData := s.storedFieldChunkUncompressed[int(storedOffset+n):int(storedOffset+n+binary.MaxVarintLen64)]
	dataLen, read = binary.Uvarint(dataLenData)
	n += uint64(read)

	return indexOffset, storedOffset, n, metaLen, dataLen, nil
}

func (s *Segment) getDocStoredOffsetsOnly(docNum uint64) (indexOffset, storedOffset uint64, err error) {
	indexOffset = s.footer.storedIndexOffset + (fileAddrWidth * docNum)
	storedOffsetData, err := s.data.Read(int(indexOffset), int(indexOffset+fileAddrWidth))
	if err != nil {
		return 0, 0, err
	}
	storedOffset = binary.BigEndian.Uint64(storedOffsetData)
	return indexOffset, storedOffset, nil
}
