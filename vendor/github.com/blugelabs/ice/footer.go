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

package ice

import (
	"encoding/binary"
	"fmt"

	segment "github.com/blugelabs/bluge_segment_api"
)

// Ice footer
//
// |========|========|========|========|====|====|====|
// |     D# |     SF |      F |    FDV | CM |  V | CC |
// |========|====|===|====|===|====|===|====|====|====|
//
// D#  - number of docs
// SF  - stored fields index offset
//  F  - field index offset
// FDV - field doc values offset
// CM  - chunk Mode
//  V  - version
// CC  - crc32

type footer struct {
	storedIndexOffset uint64
	docValueOffset    uint64
	fieldsIndexOffset uint64
	numDocs           uint64
	crc               uint32
	version           uint32
	chunkMode         uint32
}

const (
	crcWidth          = 4
	verWidth          = 4
	chunkWidth        = 4
	fdvOffsetWidth    = 8
	fieldsOffsetWidth = 8
	storedOffsetWidth = 8
	numDocsWidth      = 8
	footerLen         = crcWidth + verWidth + chunkWidth + fdvOffsetWidth +
		fieldsOffsetWidth + storedOffsetWidth + numDocsWidth
)

func parseFooter(data *segment.Data) (*footer, error) {
	if data.Len() < footerLen {
		return nil, fmt.Errorf("data len %d less than footer len %d", data.Len(),
			footerLen)
	}

	rv := &footer{}
	crcOffset := data.Len() - crcWidth
	crcData, err := data.Read(crcOffset, crcOffset+crcWidth)
	if err != nil {
		return nil, err
	}
	rv.crc = binary.BigEndian.Uint32(crcData)

	verOffset := crcOffset - verWidth
	verData, err := data.Read(verOffset, verOffset+verWidth)
	if err != nil {
		return nil, err
	}
	rv.version = binary.BigEndian.Uint32(verData)
	if rv.version != Version {
		return nil, fmt.Errorf("unsupported version %d", rv.version)
	}

	chunkOffset := verOffset - chunkWidth
	chunkData, err := data.Read(chunkOffset, chunkOffset+chunkWidth)
	if err != nil {
		return nil, err
	}
	rv.chunkMode = binary.BigEndian.Uint32(chunkData)

	docValueOffset := chunkOffset - fdvOffsetWidth
	docValueData, err := data.Read(docValueOffset, docValueOffset+fdvOffsetWidth)
	if err != nil {
		return nil, err
	}
	rv.docValueOffset = binary.BigEndian.Uint64(docValueData)

	fieldsIndexOffset := docValueOffset - fieldsOffsetWidth
	fieldsData, err := data.Read(fieldsIndexOffset, fieldsIndexOffset+fieldsOffsetWidth)
	if err != nil {
		return nil, err
	}
	rv.fieldsIndexOffset = binary.BigEndian.Uint64(fieldsData)

	storedIndexOffset := fieldsIndexOffset - storedOffsetWidth
	storedData, err := data.Read(storedIndexOffset, storedIndexOffset+storedOffsetWidth)
	if err != nil {
		return nil, err
	}
	rv.storedIndexOffset = binary.BigEndian.Uint64(storedData)

	numDocsOffset := storedIndexOffset - numDocsWidth
	numDocsData, err := data.Read(numDocsOffset, numDocsOffset+numDocsWidth)
	if err != nil {
		return nil, err
	}
	rv.numDocs = binary.BigEndian.Uint64(numDocsData)
	return rv, nil
}
