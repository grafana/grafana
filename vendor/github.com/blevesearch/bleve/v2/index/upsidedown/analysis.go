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

package upsidedown

import (
	index "github.com/blevesearch/bleve_index_api"
)

type IndexRow interface {
	KeySize() int
	KeyTo([]byte) (int, error)
	Key() []byte

	ValueSize() int
	ValueTo([]byte) (int, error)
	Value() []byte
}

type AnalysisResult struct {
	DocID string
	Rows  []IndexRow
}

func (udc *UpsideDownCouch) Analyze(d index.Document) *AnalysisResult {
	return udc.analyze(d)
}

func (udc *UpsideDownCouch) analyze(d index.Document) *AnalysisResult {
	rv := &AnalysisResult{
		DocID: d.ID(),
		Rows:  make([]IndexRow, 0, 100),
	}

	docIDBytes := []byte(d.ID())

	// track our back index entries
	backIndexStoredEntries := make([]*BackIndexStoreEntry, 0)

	// information we collate as we merge fields with same name
	fieldTermFreqs := make(map[uint16]index.TokenFrequencies)
	fieldLengths := make(map[uint16]int)
	fieldIncludeTermVectors := make(map[uint16]bool)
	fieldNames := make(map[uint16]string)

	analyzeField := func(field index.Field, storable bool) {
		fieldIndex, newFieldRow := udc.fieldIndexOrNewRow(field.Name())
		if newFieldRow != nil {
			rv.Rows = append(rv.Rows, newFieldRow)
		}
		fieldNames[fieldIndex] = field.Name()

		if field.Options().IsIndexed() {
			field.Analyze()
			fieldLength := field.AnalyzedLength()
			tokenFreqs := field.AnalyzedTokenFrequencies()
			existingFreqs := fieldTermFreqs[fieldIndex]
			if existingFreqs == nil {
				fieldTermFreqs[fieldIndex] = tokenFreqs
			} else {
				existingFreqs.MergeAll(field.Name(), tokenFreqs)
				fieldTermFreqs[fieldIndex] = existingFreqs
			}
			fieldLengths[fieldIndex] += fieldLength
			fieldIncludeTermVectors[fieldIndex] = field.Options().IncludeTermVectors()
		}

		if storable && field.Options().IsStored() {
			rv.Rows, backIndexStoredEntries = udc.storeField(docIDBytes, field, fieldIndex, rv.Rows, backIndexStoredEntries)
		}
	}

	// walk all the fields, record stored fields now
	// place information about indexed fields into map
	// this collates information across fields with
	// same names (arrays)
	d.VisitFields(func(field index.Field) {
		analyzeField(field, true)
	})

	if d.HasComposite() {
		for fieldIndex, tokenFreqs := range fieldTermFreqs {
			// see if any of the composite fields need this
			d.VisitComposite(func(field index.CompositeField) {
				field.Compose(fieldNames[fieldIndex], fieldLengths[fieldIndex], tokenFreqs)
			})
		}

		d.VisitComposite(func(field index.CompositeField) {
			analyzeField(field, false)
		})
	}

	rowsCapNeeded := len(rv.Rows) + 1
	for _, tokenFreqs := range fieldTermFreqs {
		rowsCapNeeded += len(tokenFreqs)
	}

	rv.Rows = append(make([]IndexRow, 0, rowsCapNeeded), rv.Rows...)

	backIndexTermsEntries := make([]*BackIndexTermsEntry, 0, len(fieldTermFreqs))

	// walk through the collated information and process
	// once for each indexed field (unique name)
	for fieldIndex, tokenFreqs := range fieldTermFreqs {
		fieldLength := fieldLengths[fieldIndex]
		includeTermVectors := fieldIncludeTermVectors[fieldIndex]

		// encode this field
		rv.Rows, backIndexTermsEntries = udc.indexField(docIDBytes, includeTermVectors, fieldIndex, fieldLength, tokenFreqs, rv.Rows, backIndexTermsEntries)
	}

	// build the back index row
	backIndexRow := NewBackIndexRow(docIDBytes, backIndexTermsEntries, backIndexStoredEntries)
	rv.Rows = append(rv.Rows, backIndexRow)

	return rv
}
