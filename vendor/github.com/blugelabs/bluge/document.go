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

package bluge

import (
	segment "github.com/blugelabs/bluge_segment_api"
)

type Document []Field

func NewDocument(id string) *Document {
	return &Document{
		NewKeywordField(_idField, id).StoreValue().Sortable(),
	}
}

func NewDocumentWithIdentifier(id Identifier) *Document {
	return &Document{
		NewKeywordFieldBytes(id.Field(), id.Term()).StoreValue().Sortable(),
	}
}

func (d Document) Size() int {
	sizeInBytes := sizeOfSlice

	for _, entry := range d {
		sizeInBytes += entry.Size()
	}

	return sizeInBytes
}

// ID is an experimental helper method
// to simplify common use cases
func (d Document) ID() segment.Term {
	return Identifier(d[0].Value())
}

func (d *Document) AddField(f Field) *Document {
	*d = append(*d, f)
	return d
}

// FieldConsumer is anything which can consume a field
// Fields can implement this interface to consume the
// content of another field.
type FieldConsumer interface {
	Consume(Field)
}

func (d Document) Analyze() {
	fieldOffsets := map[string]int{}
	for _, field := range d {
		if !field.Index() {
			continue
		}
		fieldOffset := fieldOffsets[field.Name()]
		if fieldOffset > 0 {
			fieldOffset += field.PositionIncrementGap()
		}
		lastPos := field.Analyze(fieldOffset)
		fieldOffsets[field.Name()] = lastPos

		// see if any of the composite fields need this
		for _, otherField := range d {
			if otherField == field {
				// never include yourself
				continue
			}
			if fieldConsumer, ok := otherField.(FieldConsumer); ok {
				fieldConsumer.Consume(field)
			}
		}
	}
}

func (d Document) EachField(vf segment.VisitField) {
	for _, field := range d {
		vf(field)
	}
}
