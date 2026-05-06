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

import "encoding/binary"

func (s *Segment) getDocStoredMetaAndCompressed(docNum uint64) (meta, data []byte, err error) {
	_, storedOffset, n, metaLen, dataLen, err := s.getDocStoredOffsets(docNum)
	if err != nil {
		return nil, nil, err
	}

	meta, err = s.data.Read(int(storedOffset+n), int(storedOffset+n+metaLen))
	if err != nil {
		return nil, nil, err
	}
	data, err = s.data.Read(int(storedOffset+n+metaLen), int(storedOffset+n+metaLen+dataLen))
	if err != nil {
		return nil, nil, err
	}

	return meta, data, nil
}

func (s *Segment) getDocStoredOffsets(docNum uint64) (
	indexOffset, storedOffset, n, metaLen, dataLen uint64, err error) {
	indexOffset = s.footer.storedIndexOffset + (fileAddrWidth * docNum)

	storedOffsetData, err := s.data.Read(int(indexOffset), int(indexOffset+fileAddrWidth))
	if err != nil {
		return 0, 0, 0, 0, 0, err
	}
	storedOffset = binary.BigEndian.Uint64(storedOffsetData)

	metaLenData, err := s.data.Read(int(storedOffset), int(storedOffset+binary.MaxVarintLen64))
	if err != nil {
		return 0, 0, 0, 0, 0, err
	}
	var read int
	metaLen, read = binary.Uvarint(metaLenData)
	n += uint64(read)

	dataLenData, err := s.data.Read(int(storedOffset+n), int(storedOffset+n+binary.MaxVarintLen64))
	if err != nil {
		return 0, 0, 0, 0, 0, err
	}
	dataLen, read = binary.Uvarint(dataLenData)
	n += uint64(read)

	return indexOffset, storedOffset, n, metaLen, dataLen, nil
}

func (s *Segment) getDocStoredOffsetsOnly(docNum int) (indexOffset, storedOffset uint64, err error) {
	indexOffset = s.footer.storedIndexOffset + (fileAddrWidth * uint64(docNum))

	storedOffsetData, err := s.data.Read(int(indexOffset), int(indexOffset+fileAddrWidth))
	if err != nil {
		return 0, 0, err
	}
	storedOffset = binary.BigEndian.Uint64(storedOffsetData)
	return indexOffset, storedOffset, nil
}
