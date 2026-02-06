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

import "encoding/binary"

func (s *SegmentBase) getDocStoredMetaAndCompressed(docNum uint64) ([]byte, []byte) {
	_, storedOffset, n, metaLen, dataLen := s.getDocStoredOffsets(docNum)

	meta := s.mem[storedOffset+n : storedOffset+n+metaLen]
	data := s.mem[storedOffset+n+metaLen : storedOffset+n+metaLen+dataLen]

	return meta, data
}

func (s *SegmentBase) getDocStoredOffsets(docNum uint64) (
	uint64, uint64, uint64, uint64, uint64) {
	indexOffset := s.storedIndexOffset + (8 * docNum)

	storedOffset := binary.BigEndian.Uint64(s.mem[indexOffset : indexOffset+8])

	var n uint64

	metaLen, read := binary.Uvarint(s.mem[storedOffset : storedOffset+binary.MaxVarintLen64])
	n += uint64(read)

	dataLen, read := binary.Uvarint(s.mem[storedOffset+n : storedOffset+n+binary.MaxVarintLen64])
	n += uint64(read)

	return indexOffset, storedOffset, n, metaLen, dataLen
}
