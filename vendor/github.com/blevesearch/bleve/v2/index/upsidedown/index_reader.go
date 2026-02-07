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

package upsidedown

import (
	"context"
	"reflect"

	"github.com/blevesearch/bleve/v2/document"
	index "github.com/blevesearch/bleve_index_api"
	store "github.com/blevesearch/upsidedown_store_api"
)

var reflectStaticSizeIndexReader int

func init() {
	var ir IndexReader
	reflectStaticSizeIndexReader = int(reflect.TypeOf(ir).Size())
}

type IndexReader struct {
	index    *UpsideDownCouch
	kvreader store.KVReader
	docCount uint64
}

func (i *IndexReader) TermFieldReader(ctx context.Context, term []byte, fieldName string, includeFreq, includeNorm, includeTermVectors bool) (index.TermFieldReader, error) {
	fieldIndex, fieldExists := i.index.fieldCache.FieldNamed(fieldName, false)
	if fieldExists {
		return newUpsideDownCouchTermFieldReader(i, term, uint16(fieldIndex), includeFreq, includeNorm, includeTermVectors)
	}
	return newUpsideDownCouchTermFieldReader(i, []byte{ByteSeparator}, ^uint16(0), includeFreq, includeNorm, includeTermVectors)
}

func (i *IndexReader) FieldDict(fieldName string) (index.FieldDict, error) {
	return i.FieldDictRange(fieldName, nil, nil)
}

func (i *IndexReader) FieldDictRange(fieldName string, startTerm []byte, endTerm []byte) (index.FieldDict, error) {
	fieldIndex, fieldExists := i.index.fieldCache.FieldNamed(fieldName, false)
	if fieldExists {
		return newUpsideDownCouchFieldDict(i, uint16(fieldIndex), startTerm, endTerm)
	}
	return newUpsideDownCouchFieldDict(i, ^uint16(0), []byte{ByteSeparator}, []byte{})
}

func (i *IndexReader) FieldDictPrefix(fieldName string, termPrefix []byte) (index.FieldDict, error) {
	return i.FieldDictRange(fieldName, termPrefix, termPrefix)
}

func (i *IndexReader) DocIDReaderAll() (index.DocIDReader, error) {
	return newUpsideDownCouchDocIDReader(i)
}

func (i *IndexReader) DocIDReaderOnly(ids []string) (index.DocIDReader, error) {
	return newUpsideDownCouchDocIDReaderOnly(i, ids)
}

func (i *IndexReader) Document(id string) (doc index.Document, err error) {
	// first hit the back index to confirm doc exists
	var backIndexRow *BackIndexRow
	backIndexRow, err = backIndexRowForDoc(i.kvreader, []byte(id))
	if err != nil {
		return
	}
	if backIndexRow == nil {
		return
	}
	rvd := document.NewDocument(id)
	storedRow := NewStoredRow([]byte(id), 0, []uint64{}, 'x', nil)
	storedRowScanPrefix := storedRow.ScanPrefixForDoc()
	it := i.kvreader.PrefixIterator(storedRowScanPrefix)
	defer func() {
		if cerr := it.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()
	key, val, valid := it.Current()
	for valid {
		safeVal := make([]byte, len(val))
		copy(safeVal, val)
		var row *StoredRow
		row, err = NewStoredRowKV(key, safeVal)
		if err != nil {
			return nil, err
		}
		if row != nil {
			fieldName := i.index.fieldCache.FieldIndexed(row.field)
			field := decodeFieldType(row.typ, fieldName, row.arrayPositions, row.value)
			if field != nil {
				rvd.AddField(field)
			}
		}

		it.Next()
		key, val, valid = it.Current()
	}
	return rvd, nil
}

func (i *IndexReader) documentVisitFieldTerms(id index.IndexInternalID, fields []string, visitor index.DocValueVisitor) error {
	fieldsMap := make(map[uint16]string, len(fields))
	for _, f := range fields {
		id, ok := i.index.fieldCache.FieldNamed(f, false)
		if ok {
			fieldsMap[id] = f
		}
	}

	tempRow := BackIndexRow{
		doc: id,
	}

	keyBuf := GetRowBuffer()
	if tempRow.KeySize() > len(keyBuf.buf) {
		keyBuf.buf = make([]byte, 2*tempRow.KeySize())
	}
	defer PutRowBuffer(keyBuf)
	keySize, err := tempRow.KeyTo(keyBuf.buf)
	if err != nil {
		return err
	}

	value, err := i.kvreader.Get(keyBuf.buf[:keySize])
	if err != nil {
		return err
	}
	if value == nil {
		return nil
	}

	return visitBackIndexRow(value, func(field uint32, term []byte) {
		if field, ok := fieldsMap[uint16(field)]; ok {
			visitor(field, term)
		}
	})
}

func (i *IndexReader) Fields() (fields []string, err error) {
	fields = make([]string, 0)
	it := i.kvreader.PrefixIterator([]byte{'f'})
	defer func() {
		if cerr := it.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()
	key, val, valid := it.Current()
	for valid {
		var row UpsideDownCouchRow
		row, err = ParseFromKeyValue(key, val)
		if err != nil {
			fields = nil
			return
		}
		if row != nil {
			fieldRow, ok := row.(*FieldRow)
			if ok {
				fields = append(fields, fieldRow.name)
			}
		}

		it.Next()
		key, val, valid = it.Current()
	}
	return
}

func (i *IndexReader) GetInternal(key []byte) ([]byte, error) {
	internalRow := NewInternalRow(key, nil)
	return i.kvreader.Get(internalRow.Key())
}

func (i *IndexReader) DocCount() (uint64, error) {
	return i.docCount, nil
}

func (i *IndexReader) Close() error {
	return i.kvreader.Close()
}

func (i *IndexReader) ExternalID(id index.IndexInternalID) (string, error) {
	return string(id), nil
}

func (i *IndexReader) InternalID(id string) (index.IndexInternalID, error) {
	return index.IndexInternalID(id), nil
}

func incrementBytes(in []byte) []byte {
	rv := make([]byte, len(in))
	copy(rv, in)
	for i := len(rv) - 1; i >= 0; i-- {
		rv[i] = rv[i] + 1
		if rv[i] != 0 {
			// didn't overflow, so stop
			break
		}
	}
	return rv
}

func (i *IndexReader) DocValueReader(fields []string) (index.DocValueReader, error) {
	return &DocValueReader{i: i, fields: fields}, nil
}

type DocValueReader struct {
	i      *IndexReader
	fields []string
}

func (dvr *DocValueReader) VisitDocValues(id index.IndexInternalID,
	visitor index.DocValueVisitor) error {
	return dvr.i.documentVisitFieldTerms(id, dvr.fields, visitor)
}

func (dvr *DocValueReader) BytesRead() uint64 { return 0 }
