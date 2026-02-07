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

//go:generate protoc --gofast_out=. upsidedown.proto

package upsidedown

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"sync/atomic"
	"time"

	"github.com/blevesearch/bleve/v2/document"
	"github.com/blevesearch/bleve/v2/registry"
	index "github.com/blevesearch/bleve_index_api"
	store "github.com/blevesearch/upsidedown_store_api"

	"google.golang.org/protobuf/proto"
)

const Name = "upside_down"

// RowBufferSize should ideally this is sized to be the smallest
// size that can contain an index row key and its corresponding
// value.  It is not a limit, if need be a larger buffer is
// allocated, but performance will be more optimal if *most*
// rows fit this size.
const RowBufferSize = 4 * 1024

var VersionKey = []byte{'v'}

const Version uint8 = 7

var IncompatibleVersion = fmt.Errorf("incompatible version, %d is supported", Version)

var ErrorUnknownStorageType = fmt.Errorf("unknown storage type")

type UpsideDownCouch struct {
	version       uint8
	path          string
	storeName     string
	storeConfig   map[string]interface{}
	store         store.KVStore
	fieldCache    *FieldCache
	analysisQueue *index.AnalysisQueue
	stats         *indexStat

	m sync.RWMutex
	// fields protected by m
	docCount uint64

	writeMutex sync.Mutex
}

type docBackIndexRow struct {
	docID        string
	doc          index.Document // If deletion, doc will be nil.
	backIndexRow *BackIndexRow
}

func NewUpsideDownCouch(storeName string, storeConfig map[string]interface{}, analysisQueue *index.AnalysisQueue) (index.Index, error) {
	rv := &UpsideDownCouch{
		version:       Version,
		fieldCache:    NewFieldCache(),
		storeName:     storeName,
		storeConfig:   storeConfig,
		analysisQueue: analysisQueue,
	}
	rv.stats = &indexStat{i: rv}
	return rv, nil
}

func (udc *UpsideDownCouch) init(kvwriter store.KVWriter) (err error) {
	// version marker
	rowsAll := [][]UpsideDownCouchRow{
		{NewVersionRow(udc.version)},
	}

	err = udc.batchRows(kvwriter, nil, rowsAll, nil)
	return
}

func (udc *UpsideDownCouch) loadSchema(kvreader store.KVReader) (err error) {

	it := kvreader.PrefixIterator([]byte{'f'})
	defer func() {
		if cerr := it.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	key, val, valid := it.Current()
	for valid {
		var fieldRow *FieldRow
		fieldRow, err = NewFieldRowKV(key, val)
		if err != nil {
			return
		}
		udc.fieldCache.AddExisting(fieldRow.name, fieldRow.index)

		it.Next()
		key, val, valid = it.Current()
	}

	val, err = kvreader.Get([]byte{'v'})
	if err != nil {
		return
	}
	var vr *VersionRow
	vr, err = NewVersionRowKV([]byte{'v'}, val)
	if err != nil {
		return
	}
	if vr.version != Version {
		err = IncompatibleVersion
		return
	}

	return
}

type rowBuffer struct {
	buf []byte
}

var rowBufferPool sync.Pool

func GetRowBuffer() *rowBuffer {
	if rb, ok := rowBufferPool.Get().(*rowBuffer); ok {
		return rb
	} else {
		buf := make([]byte, RowBufferSize)
		return &rowBuffer{buf: buf}
	}
}

func PutRowBuffer(rb *rowBuffer) {
	rowBufferPool.Put(rb)
}

func (udc *UpsideDownCouch) batchRows(writer store.KVWriter, addRowsAll [][]UpsideDownCouchRow, updateRowsAll [][]UpsideDownCouchRow, deleteRowsAll [][]UpsideDownCouchRow) (err error) {
	dictionaryDeltas := make(map[string]int64)

	// count up bytes needed for buffering.
	addNum := 0
	addKeyBytes := 0
	addValBytes := 0

	updateNum := 0
	updateKeyBytes := 0
	updateValBytes := 0

	deleteNum := 0
	deleteKeyBytes := 0

	rowBuf := GetRowBuffer()

	for _, addRows := range addRowsAll {
		for _, row := range addRows {
			tfr, ok := row.(*TermFrequencyRow)
			if ok {
				if tfr.DictionaryRowKeySize() > len(rowBuf.buf) {
					rowBuf.buf = make([]byte, tfr.DictionaryRowKeySize())
				}
				dictKeySize, err := tfr.DictionaryRowKeyTo(rowBuf.buf)
				if err != nil {
					return err
				}
				dictionaryDeltas[string(rowBuf.buf[:dictKeySize])] += 1
			}
			addKeyBytes += row.KeySize()
			addValBytes += row.ValueSize()
		}
		addNum += len(addRows)
	}

	for _, updateRows := range updateRowsAll {
		for _, row := range updateRows {
			updateKeyBytes += row.KeySize()
			updateValBytes += row.ValueSize()
		}
		updateNum += len(updateRows)
	}

	for _, deleteRows := range deleteRowsAll {
		for _, row := range deleteRows {
			tfr, ok := row.(*TermFrequencyRow)
			if ok {
				// need to decrement counter
				if tfr.DictionaryRowKeySize() > len(rowBuf.buf) {
					rowBuf.buf = make([]byte, tfr.DictionaryRowKeySize())
				}
				dictKeySize, err := tfr.DictionaryRowKeyTo(rowBuf.buf)
				if err != nil {
					return err
				}
				dictionaryDeltas[string(rowBuf.buf[:dictKeySize])] -= 1
			}
			deleteKeyBytes += row.KeySize()
		}
		deleteNum += len(deleteRows)
	}

	PutRowBuffer(rowBuf)

	mergeNum := len(dictionaryDeltas)
	mergeKeyBytes := 0
	mergeValBytes := mergeNum * DictionaryRowMaxValueSize

	for dictRowKey := range dictionaryDeltas {
		mergeKeyBytes += len(dictRowKey)
	}

	// prepare batch
	totBytes := addKeyBytes + addValBytes +
		updateKeyBytes + updateValBytes +
		deleteKeyBytes +
		2*(mergeKeyBytes+mergeValBytes)

	buf, wb, err := writer.NewBatchEx(store.KVBatchOptions{
		TotalBytes: totBytes,
		NumSets:    addNum + updateNum,
		NumDeletes: deleteNum,
		NumMerges:  mergeNum,
	})
	if err != nil {
		return err
	}
	defer func() {
		_ = wb.Close()
	}()

	// fill the batch
	for _, addRows := range addRowsAll {
		for _, row := range addRows {
			keySize, err := row.KeyTo(buf)
			if err != nil {
				return err
			}
			valSize, err := row.ValueTo(buf[keySize:])
			if err != nil {
				return err
			}
			wb.Set(buf[:keySize], buf[keySize:keySize+valSize])
			buf = buf[keySize+valSize:]
		}
	}

	for _, updateRows := range updateRowsAll {
		for _, row := range updateRows {
			keySize, err := row.KeyTo(buf)
			if err != nil {
				return err
			}
			valSize, err := row.ValueTo(buf[keySize:])
			if err != nil {
				return err
			}
			wb.Set(buf[:keySize], buf[keySize:keySize+valSize])
			buf = buf[keySize+valSize:]
		}
	}

	for _, deleteRows := range deleteRowsAll {
		for _, row := range deleteRows {
			keySize, err := row.KeyTo(buf)
			if err != nil {
				return err
			}
			wb.Delete(buf[:keySize])
			buf = buf[keySize:]
		}
	}

	for dictRowKey, delta := range dictionaryDeltas {
		dictRowKeyLen := copy(buf, dictRowKey)
		binary.LittleEndian.PutUint64(buf[dictRowKeyLen:], uint64(delta))
		wb.Merge(buf[:dictRowKeyLen], buf[dictRowKeyLen:dictRowKeyLen+DictionaryRowMaxValueSize])
		buf = buf[dictRowKeyLen+DictionaryRowMaxValueSize:]
	}

	// write out the batch
	return writer.ExecuteBatch(wb)
}

func (udc *UpsideDownCouch) Open() (err error) {
	// acquire the write mutex for the duration of Open()
	udc.writeMutex.Lock()
	defer udc.writeMutex.Unlock()

	// open the kv store
	storeConstructor := registry.KVStoreConstructorByName(udc.storeName)
	if storeConstructor == nil {
		err = ErrorUnknownStorageType
		return
	}

	// now open the store
	udc.store, err = storeConstructor(&mergeOperator, udc.storeConfig)
	if err != nil {
		return
	}

	// start a reader to look at the index
	var kvreader store.KVReader
	kvreader, err = udc.store.Reader()
	if err != nil {
		return
	}

	var value []byte
	value, err = kvreader.Get(VersionKey)
	if err != nil {
		_ = kvreader.Close()
		return
	}

	if value != nil {
		err = udc.loadSchema(kvreader)
		if err != nil {
			_ = kvreader.Close()
			return
		}

		// set doc count
		udc.m.Lock()
		udc.docCount, err = udc.countDocs(kvreader)
		udc.m.Unlock()

		err = kvreader.Close()
	} else {
		// new index, close the reader and open writer to init
		err = kvreader.Close()
		if err != nil {
			return
		}

		var kvwriter store.KVWriter
		kvwriter, err = udc.store.Writer()
		if err != nil {
			return
		}
		defer func() {
			if cerr := kvwriter.Close(); err == nil && cerr != nil {
				err = cerr
			}
		}()

		// init the index
		err = udc.init(kvwriter)
	}

	return
}

func (udc *UpsideDownCouch) countDocs(kvreader store.KVReader) (count uint64, err error) {
	it := kvreader.PrefixIterator([]byte{'b'})
	defer func() {
		if cerr := it.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	_, _, valid := it.Current()
	for valid {
		count++
		it.Next()
		_, _, valid = it.Current()
	}

	return
}

func (udc *UpsideDownCouch) rowCount() (count uint64, err error) {
	// start an isolated reader for use during the rowcount
	kvreader, err := udc.store.Reader()
	if err != nil {
		return
	}
	defer func() {
		if cerr := kvreader.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()
	it := kvreader.RangeIterator(nil, nil)
	defer func() {
		if cerr := it.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	_, _, valid := it.Current()
	for valid {
		count++
		it.Next()
		_, _, valid = it.Current()
	}

	return
}

func (udc *UpsideDownCouch) Close() error {
	return udc.store.Close()
}

func (udc *UpsideDownCouch) Update(doc index.Document) (err error) {
	// do analysis before acquiring write lock
	analysisStart := time.Now()
	resultChan := make(chan *AnalysisResult)

	// put the work on the queue
	udc.analysisQueue.Queue(func() {
		ar := udc.analyze(doc)
		resultChan <- ar
	})

	// wait for the result
	result := <-resultChan
	close(resultChan)
	atomic.AddUint64(&udc.stats.analysisTime, uint64(time.Since(analysisStart)))

	udc.writeMutex.Lock()
	defer udc.writeMutex.Unlock()

	// open a reader for backindex lookup
	var kvreader store.KVReader
	kvreader, err = udc.store.Reader()
	if err != nil {
		return
	}

	// first we lookup the backindex row for the doc id if it exists
	// lookup the back index row
	var backIndexRow *BackIndexRow
	backIndexRow, err = backIndexRowForDoc(kvreader, index.IndexInternalID(doc.ID()))
	if err != nil {
		_ = kvreader.Close()
		atomic.AddUint64(&udc.stats.errors, 1)
		return
	}

	err = kvreader.Close()
	if err != nil {
		return
	}

	return udc.UpdateWithAnalysis(doc, result, backIndexRow)
}

func (udc *UpsideDownCouch) UpdateWithAnalysis(doc index.Document,
	result *AnalysisResult, backIndexRow *BackIndexRow) (err error) {
	// start a writer for this update
	indexStart := time.Now()
	var kvwriter store.KVWriter
	kvwriter, err = udc.store.Writer()
	if err != nil {
		return
	}
	defer func() {
		if cerr := kvwriter.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	// prepare a list of rows
	var addRowsAll [][]UpsideDownCouchRow
	var updateRowsAll [][]UpsideDownCouchRow
	var deleteRowsAll [][]UpsideDownCouchRow

	addRows, updateRows, deleteRows := udc.mergeOldAndNew(backIndexRow, result.Rows)
	if len(addRows) > 0 {
		addRowsAll = append(addRowsAll, addRows)
	}
	if len(updateRows) > 0 {
		updateRowsAll = append(updateRowsAll, updateRows)
	}
	if len(deleteRows) > 0 {
		deleteRowsAll = append(deleteRowsAll, deleteRows)
	}

	err = udc.batchRows(kvwriter, addRowsAll, updateRowsAll, deleteRowsAll)
	if err == nil && backIndexRow == nil {
		udc.m.Lock()
		udc.docCount++
		udc.m.Unlock()
	}
	atomic.AddUint64(&udc.stats.indexTime, uint64(time.Since(indexStart)))
	if err == nil {
		atomic.AddUint64(&udc.stats.updates, 1)
		atomic.AddUint64(&udc.stats.numPlainTextBytesIndexed, doc.NumPlainTextBytes())
	} else {
		atomic.AddUint64(&udc.stats.errors, 1)
	}
	return
}

func (udc *UpsideDownCouch) mergeOldAndNew(backIndexRow *BackIndexRow, rows []IndexRow) (addRows []UpsideDownCouchRow, updateRows []UpsideDownCouchRow, deleteRows []UpsideDownCouchRow) {
	addRows = make([]UpsideDownCouchRow, 0, len(rows))

	if backIndexRow == nil {
		addRows = addRows[0:len(rows)]
		for i, row := range rows {
			addRows[i] = row
		}
		return addRows, nil, nil
	}

	updateRows = make([]UpsideDownCouchRow, 0, len(rows))
	deleteRows = make([]UpsideDownCouchRow, 0, len(rows))

	var existingTermKeys map[string]struct{}
	backIndexTermKeys := backIndexRow.AllTermKeys()
	if len(backIndexTermKeys) > 0 {
		existingTermKeys = make(map[string]struct{}, len(backIndexTermKeys))
		for _, key := range backIndexTermKeys {
			existingTermKeys[string(key)] = struct{}{}
		}
	}

	var existingStoredKeys map[string]struct{}
	backIndexStoredKeys := backIndexRow.AllStoredKeys()
	if len(backIndexStoredKeys) > 0 {
		existingStoredKeys = make(map[string]struct{}, len(backIndexStoredKeys))
		for _, key := range backIndexStoredKeys {
			existingStoredKeys[string(key)] = struct{}{}
		}
	}

	keyBuf := GetRowBuffer()
	for _, row := range rows {
		switch row := row.(type) {
		case *TermFrequencyRow:
			if existingTermKeys != nil {
				if row.KeySize() > len(keyBuf.buf) {
					keyBuf.buf = make([]byte, row.KeySize())
				}
				keySize, _ := row.KeyTo(keyBuf.buf)
				if _, ok := existingTermKeys[string(keyBuf.buf[:keySize])]; ok {
					updateRows = append(updateRows, row)
					delete(existingTermKeys, string(keyBuf.buf[:keySize]))
					continue
				}
			}
			addRows = append(addRows, row)
		case *StoredRow:
			if existingStoredKeys != nil {
				if row.KeySize() > len(keyBuf.buf) {
					keyBuf.buf = make([]byte, row.KeySize())
				}
				keySize, _ := row.KeyTo(keyBuf.buf)
				if _, ok := existingStoredKeys[string(keyBuf.buf[:keySize])]; ok {
					updateRows = append(updateRows, row)
					delete(existingStoredKeys, string(keyBuf.buf[:keySize]))
					continue
				}
			}
			addRows = append(addRows, row)
		default:
			updateRows = append(updateRows, row)
		}
	}
	PutRowBuffer(keyBuf)

	// any of the existing rows that weren't updated need to be deleted
	for existingTermKey := range existingTermKeys {
		termFreqRow, err := NewTermFrequencyRowK([]byte(existingTermKey))
		if err == nil {
			deleteRows = append(deleteRows, termFreqRow)
		}
	}

	// any of the existing stored fields that weren't updated need to be deleted
	for existingStoredKey := range existingStoredKeys {
		storedRow, err := NewStoredRowK([]byte(existingStoredKey))
		if err == nil {
			deleteRows = append(deleteRows, storedRow)
		}
	}

	return addRows, updateRows, deleteRows
}

func (udc *UpsideDownCouch) storeField(docID []byte, field index.Field, fieldIndex uint16, rows []IndexRow, backIndexStoredEntries []*BackIndexStoreEntry) ([]IndexRow, []*BackIndexStoreEntry) {
	fieldType := field.EncodedFieldType()
	storedRow := NewStoredRow(docID, fieldIndex, field.ArrayPositions(), fieldType, field.Value())

	// record the back index entry
	backIndexStoredEntry := BackIndexStoreEntry{Field: proto.Uint32(uint32(fieldIndex)), ArrayPositions: field.ArrayPositions()}

	return append(rows, storedRow), append(backIndexStoredEntries, &backIndexStoredEntry)
}

func (udc *UpsideDownCouch) indexField(docID []byte, includeTermVectors bool, fieldIndex uint16, fieldLength int, tokenFreqs index.TokenFrequencies, rows []IndexRow, backIndexTermsEntries []*BackIndexTermsEntry) ([]IndexRow, []*BackIndexTermsEntry) {
	fieldNorm := float32(1.0 / math.Sqrt(float64(fieldLength)))

	termFreqRows := make([]TermFrequencyRow, len(tokenFreqs))
	termFreqRowsUsed := 0

	terms := make([]string, 0, len(tokenFreqs))
	for k, tf := range tokenFreqs {
		termFreqRow := &termFreqRows[termFreqRowsUsed]
		termFreqRowsUsed++

		InitTermFrequencyRow(termFreqRow, tf.Term, fieldIndex, docID,
			uint64(frequencyFromTokenFreq(tf)), fieldNorm)

		if includeTermVectors {
			termFreqRow.vectors, rows = udc.termVectorsFromTokenFreq(fieldIndex, tf, rows)
		}

		// record the back index entry
		terms = append(terms, k)

		rows = append(rows, termFreqRow)
	}
	backIndexTermsEntry := BackIndexTermsEntry{Field: proto.Uint32(uint32(fieldIndex)), Terms: terms}
	backIndexTermsEntries = append(backIndexTermsEntries, &backIndexTermsEntry)

	return rows, backIndexTermsEntries
}

func (udc *UpsideDownCouch) Delete(id string) (err error) {
	indexStart := time.Now()

	udc.writeMutex.Lock()
	defer udc.writeMutex.Unlock()

	// open a reader for backindex lookup
	var kvreader store.KVReader
	kvreader, err = udc.store.Reader()
	if err != nil {
		return
	}

	// first we lookup the backindex row for the doc id if it exists
	// lookup the back index row
	var backIndexRow *BackIndexRow
	backIndexRow, err = backIndexRowForDoc(kvreader, index.IndexInternalID(id))
	if err != nil {
		_ = kvreader.Close()
		atomic.AddUint64(&udc.stats.errors, 1)
		return
	}

	err = kvreader.Close()
	if err != nil {
		return
	}

	if backIndexRow == nil {
		atomic.AddUint64(&udc.stats.deletes, 1)
		return
	}

	// start a writer for this delete
	var kvwriter store.KVWriter
	kvwriter, err = udc.store.Writer()
	if err != nil {
		return
	}
	defer func() {
		if cerr := kvwriter.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	var deleteRowsAll [][]UpsideDownCouchRow

	deleteRows := udc.deleteSingle(id, backIndexRow, nil)
	if len(deleteRows) > 0 {
		deleteRowsAll = append(deleteRowsAll, deleteRows)
	}

	err = udc.batchRows(kvwriter, nil, nil, deleteRowsAll)
	if err == nil {
		udc.m.Lock()
		udc.docCount--
		udc.m.Unlock()
	}
	atomic.AddUint64(&udc.stats.indexTime, uint64(time.Since(indexStart)))
	if err == nil {
		atomic.AddUint64(&udc.stats.deletes, 1)
	} else {
		atomic.AddUint64(&udc.stats.errors, 1)
	}
	return
}

func (udc *UpsideDownCouch) deleteSingle(id string, backIndexRow *BackIndexRow, deleteRows []UpsideDownCouchRow) []UpsideDownCouchRow {
	idBytes := []byte(id)

	for _, backIndexEntry := range backIndexRow.termsEntries {
		for i := range backIndexEntry.Terms {
			tfr := NewTermFrequencyRow([]byte(backIndexEntry.Terms[i]), uint16(*backIndexEntry.Field), idBytes, 0, 0)
			deleteRows = append(deleteRows, tfr)
		}
	}
	for _, se := range backIndexRow.storedEntries {
		sf := NewStoredRow(idBytes, uint16(*se.Field), se.ArrayPositions, 'x', nil)
		deleteRows = append(deleteRows, sf)
	}

	// also delete the back entry itself
	deleteRows = append(deleteRows, backIndexRow)
	return deleteRows
}

func decodeFieldType(typ byte, name string, pos []uint64, value []byte) document.Field {
	switch typ {
	case 't':
		return document.NewTextField(name, pos, value)
	case 'n':
		return document.NewNumericFieldFromBytes(name, pos, value)
	case 'd':
		return document.NewDateTimeFieldFromBytes(name, pos, value)
	case 'b':
		return document.NewBooleanFieldFromBytes(name, pos, value)
	case 'g':
		return document.NewGeoPointFieldFromBytes(name, pos, value)
	case 'i':
		return document.NewIPFieldFromBytes(name, pos, value)
	}
	return nil
}

func frequencyFromTokenFreq(tf *index.TokenFreq) int {
	return tf.Frequency()
}

func (udc *UpsideDownCouch) termVectorsFromTokenFreq(field uint16, tf *index.TokenFreq, rows []IndexRow) ([]*TermVector, []IndexRow) {
	a := make([]TermVector, len(tf.Locations))
	rv := make([]*TermVector, len(tf.Locations))

	for i, l := range tf.Locations {
		var newFieldRow *FieldRow
		fieldIndex := field
		if l.Field != "" {
			// lookup correct field
			fieldIndex, newFieldRow = udc.fieldIndexOrNewRow(l.Field)
			if newFieldRow != nil {
				rows = append(rows, newFieldRow)
			}
		}
		a[i] = TermVector{
			field:          fieldIndex,
			arrayPositions: l.ArrayPositions,
			pos:            uint64(l.Position),
			start:          uint64(l.Start),
			end:            uint64(l.End),
		}
		rv[i] = &a[i]
	}

	return rv, rows
}

func (udc *UpsideDownCouch) termFieldVectorsFromTermVectors(in []*TermVector) []*index.TermFieldVector {
	if len(in) == 0 {
		return nil
	}

	a := make([]index.TermFieldVector, len(in))
	rv := make([]*index.TermFieldVector, len(in))

	for i, tv := range in {
		fieldName := udc.fieldCache.FieldIndexed(tv.field)
		a[i] = index.TermFieldVector{
			Field:          fieldName,
			ArrayPositions: tv.arrayPositions,
			Pos:            tv.pos,
			Start:          tv.start,
			End:            tv.end,
		}
		rv[i] = &a[i]
	}
	return rv
}

func (udc *UpsideDownCouch) Batch(batch *index.Batch) (err error) {
	persistedCallback := batch.PersistedCallback()
	if persistedCallback != nil {
		defer persistedCallback(err)
	}
	analysisStart := time.Now()

	resultChan := make(chan *AnalysisResult, len(batch.IndexOps))

	var numUpdates uint64
	var numPlainTextBytes uint64
	for _, doc := range batch.IndexOps {
		if doc != nil {
			numUpdates++
			numPlainTextBytes += doc.NumPlainTextBytes()
		}
	}

	if numUpdates > 0 {
		go func() {
			for k := range batch.IndexOps {
				doc := batch.IndexOps[k]
				if doc != nil {
					// put the work on the queue
					udc.analysisQueue.Queue(func() {
						ar := udc.analyze(doc)
						resultChan <- ar
					})
				}
			}
		}()
	}

	// retrieve back index rows concurrent with analysis
	docBackIndexRowErr := error(nil)
	docBackIndexRowCh := make(chan *docBackIndexRow, len(batch.IndexOps))

	udc.writeMutex.Lock()
	defer udc.writeMutex.Unlock()

	go func() {
		defer close(docBackIndexRowCh)

		// open a reader for backindex lookup
		var kvreader store.KVReader
		kvreader, err = udc.store.Reader()
		if err != nil {
			docBackIndexRowErr = err
			return
		}
		defer func() {
			if cerr := kvreader.Close(); err == nil && cerr != nil {
				docBackIndexRowErr = cerr
			}
		}()

		for docID, doc := range batch.IndexOps {
			backIndexRow, err := backIndexRowForDoc(kvreader, index.IndexInternalID(docID))
			if err != nil {
				docBackIndexRowErr = err
				return
			}

			docBackIndexRowCh <- &docBackIndexRow{docID, doc, backIndexRow}
		}
	}()

	// wait for analysis result
	newRowsMap := make(map[string][]IndexRow)
	var itemsDeQueued uint64
	for itemsDeQueued < numUpdates {
		result := <-resultChan
		newRowsMap[result.DocID] = result.Rows
		itemsDeQueued++
	}
	close(resultChan)

	atomic.AddUint64(&udc.stats.analysisTime, uint64(time.Since(analysisStart)))

	docsAdded := uint64(0)
	docsDeleted := uint64(0)

	indexStart := time.Now()

	// prepare a list of rows
	var addRowsAll [][]UpsideDownCouchRow
	var updateRowsAll [][]UpsideDownCouchRow
	var deleteRowsAll [][]UpsideDownCouchRow

	// add the internal ops
	var updateRows []UpsideDownCouchRow
	var deleteRows []UpsideDownCouchRow

	for internalKey, internalValue := range batch.InternalOps {
		if internalValue == nil {
			// delete
			deleteInternalRow := NewInternalRow([]byte(internalKey), nil)
			deleteRows = append(deleteRows, deleteInternalRow)
		} else {
			updateInternalRow := NewInternalRow([]byte(internalKey), internalValue)
			updateRows = append(updateRows, updateInternalRow)
		}
	}

	if len(updateRows) > 0 {
		updateRowsAll = append(updateRowsAll, updateRows)
	}
	if len(deleteRows) > 0 {
		deleteRowsAll = append(deleteRowsAll, deleteRows)
	}

	// process back index rows as they arrive
	for dbir := range docBackIndexRowCh {
		if dbir.doc == nil && dbir.backIndexRow != nil {
			// delete
			deleteRows := udc.deleteSingle(dbir.docID, dbir.backIndexRow, nil)
			if len(deleteRows) > 0 {
				deleteRowsAll = append(deleteRowsAll, deleteRows)
			}
			docsDeleted++
		} else if dbir.doc != nil {
			addRows, updateRows, deleteRows := udc.mergeOldAndNew(dbir.backIndexRow, newRowsMap[dbir.docID])
			if len(addRows) > 0 {
				addRowsAll = append(addRowsAll, addRows)
			}
			if len(updateRows) > 0 {
				updateRowsAll = append(updateRowsAll, updateRows)
			}
			if len(deleteRows) > 0 {
				deleteRowsAll = append(deleteRowsAll, deleteRows)
			}
			if dbir.backIndexRow == nil {
				docsAdded++
			}
		}
	}

	if docBackIndexRowErr != nil {
		return docBackIndexRowErr
	}

	// start a writer for this batch
	var kvwriter store.KVWriter
	kvwriter, err = udc.store.Writer()
	if err != nil {
		return
	}

	err = udc.batchRows(kvwriter, addRowsAll, updateRowsAll, deleteRowsAll)
	if err != nil {
		_ = kvwriter.Close()
		atomic.AddUint64(&udc.stats.errors, 1)
		return
	}

	err = kvwriter.Close()

	atomic.AddUint64(&udc.stats.indexTime, uint64(time.Since(indexStart)))

	if err == nil {
		udc.m.Lock()
		udc.docCount += docsAdded
		udc.docCount -= docsDeleted
		udc.m.Unlock()
		atomic.AddUint64(&udc.stats.updates, numUpdates)
		atomic.AddUint64(&udc.stats.deletes, docsDeleted)
		atomic.AddUint64(&udc.stats.batches, 1)
		atomic.AddUint64(&udc.stats.numPlainTextBytesIndexed, numPlainTextBytes)
	} else {
		atomic.AddUint64(&udc.stats.errors, 1)
	}

	return
}

func (udc *UpsideDownCouch) SetInternal(key, val []byte) (err error) {
	internalRow := NewInternalRow(key, val)
	udc.writeMutex.Lock()
	defer udc.writeMutex.Unlock()
	var writer store.KVWriter
	writer, err = udc.store.Writer()
	if err != nil {
		return
	}
	defer func() {
		if cerr := writer.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	batch := writer.NewBatch()
	batch.Set(internalRow.Key(), internalRow.Value())

	return writer.ExecuteBatch(batch)
}

func (udc *UpsideDownCouch) DeleteInternal(key []byte) (err error) {
	internalRow := NewInternalRow(key, nil)
	udc.writeMutex.Lock()
	defer udc.writeMutex.Unlock()
	var writer store.KVWriter
	writer, err = udc.store.Writer()
	if err != nil {
		return
	}
	defer func() {
		if cerr := writer.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	batch := writer.NewBatch()
	batch.Delete(internalRow.Key())
	return writer.ExecuteBatch(batch)
}

func (udc *UpsideDownCouch) Reader() (index.IndexReader, error) {
	kvr, err := udc.store.Reader()
	if err != nil {
		return nil, fmt.Errorf("error opening store reader: %v", err)
	}
	udc.m.RLock()
	defer udc.m.RUnlock()
	return &IndexReader{
		index:    udc,
		kvreader: kvr,
		docCount: udc.docCount,
	}, nil
}

func (udc *UpsideDownCouch) Stats() json.Marshaler {
	return udc.stats
}

func (udc *UpsideDownCouch) StatsMap() map[string]interface{} {
	return udc.stats.statsMap()
}

func (udc *UpsideDownCouch) Advanced() (store.KVStore, error) {
	return udc.store, nil
}

func (udc *UpsideDownCouch) fieldIndexOrNewRow(name string) (uint16, *FieldRow) {
	index, existed := udc.fieldCache.FieldNamed(name, true)
	if !existed {
		return index, NewFieldRow(index, name)
	}
	return index, nil
}

func init() {
	err := registry.RegisterIndexType(Name, NewUpsideDownCouch)
	if err != nil {
		panic(err)
	}
}

func backIndexRowForDoc(kvreader store.KVReader, docID index.IndexInternalID) (*BackIndexRow, error) {
	// use a temporary row structure to build key
	tempRow := BackIndexRow{
		doc: docID,
	}

	keyBuf := GetRowBuffer()
	if tempRow.KeySize() > len(keyBuf.buf) {
		keyBuf.buf = make([]byte, 2*tempRow.KeySize())
	}
	defer PutRowBuffer(keyBuf)
	keySize, err := tempRow.KeyTo(keyBuf.buf)
	if err != nil {
		return nil, err
	}

	value, err := kvreader.Get(keyBuf.buf[:keySize])
	if err != nil {
		return nil, err
	}
	if value == nil {
		return nil, nil
	}
	backIndexRow, err := NewBackIndexRowKV(keyBuf.buf[:keySize], value)
	if err != nil {
		return nil, err
	}
	return backIndexRow, nil
}
