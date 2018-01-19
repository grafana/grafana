// Copyright 2015 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package bigquery

import (
	"errors"
	"fmt"
	"reflect"

	"golang.org/x/net/context"
	bq "google.golang.org/api/bigquery/v2"
)

// An Uploader does streaming inserts into a BigQuery table.
// It is safe for concurrent use.
type Uploader struct {
	t *Table

	// SkipInvalidRows causes rows containing invalid data to be silently
	// ignored. The default value is false, which causes the entire request to
	// fail if there is an attempt to insert an invalid row.
	SkipInvalidRows bool

	// IgnoreUnknownValues causes values not matching the schema to be ignored.
	// The default value is false, which causes records containing such values
	// to be treated as invalid records.
	IgnoreUnknownValues bool

	// A TableTemplateSuffix allows Uploaders to create tables automatically.
	//
	// Experimental: this option is experimental and may be modified or removed in future versions,
	// regardless of any other documented package stability guarantees.
	//
	// When you specify a suffix, the table you upload data to
	// will be used as a template for creating a new table, with the same schema,
	// called <table> + <suffix>.
	//
	// More information is available at
	// https://cloud.google.com/bigquery/streaming-data-into-bigquery#template-tables
	TableTemplateSuffix string
}

// Uploader returns an Uploader that can be used to append rows to t.
// The returned Uploader may optionally be further configured before its Put method is called.
func (t *Table) Uploader() *Uploader {
	return &Uploader{t: t}
}

// Put uploads one or more rows to the BigQuery service.
//
// If src is ValueSaver, then its Save method is called to produce a row for uploading.
//
// If src is a struct or pointer to a struct, then a schema is inferred from it
// and used to create a StructSaver. The InsertID of the StructSaver will be
// empty.
//
// If src is a slice of ValueSavers, structs, or struct pointers, then each
// element of the slice is treated as above, and multiple rows are uploaded.
//
// Put returns a PutMultiError if one or more rows failed to be uploaded.
// The PutMultiError contains a RowInsertionError for each failed row.
//
// Put will retry on temporary errors (see
// https://cloud.google.com/bigquery/troubleshooting-errors). This can result
// in duplicate rows if you do not use insert IDs. Also, if the error persists,
// the call will run indefinitely. Pass a context with a timeout to prevent
// hanging calls.
func (u *Uploader) Put(ctx context.Context, src interface{}) error {
	savers, err := valueSavers(src)
	if err != nil {
		return err
	}
	return u.putMulti(ctx, savers)
}

func valueSavers(src interface{}) ([]ValueSaver, error) {
	saver, ok, err := toValueSaver(src)
	if err != nil {
		return nil, err
	}
	if ok {
		return []ValueSaver{saver}, nil
	}
	srcVal := reflect.ValueOf(src)
	if srcVal.Kind() != reflect.Slice {
		return nil, fmt.Errorf("%T is not a ValueSaver, struct, struct pointer, or slice", src)

	}
	var savers []ValueSaver
	for i := 0; i < srcVal.Len(); i++ {
		s := srcVal.Index(i).Interface()
		saver, ok, err := toValueSaver(s)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, fmt.Errorf("src[%d] has type %T, which is not a ValueSaver, struct or struct pointer", i, s)
		}
		savers = append(savers, saver)
	}
	return savers, nil
}

// Make a ValueSaver from x, which must implement ValueSaver already
// or be a struct or pointer to struct.
func toValueSaver(x interface{}) (ValueSaver, bool, error) {
	if _, ok := x.(StructSaver); ok {
		return nil, false, errors.New("bigquery: use &StructSaver, not StructSaver")
	}
	var insertID string
	// Handle StructSavers specially so we can infer the schema if necessary.
	if ss, ok := x.(*StructSaver); ok && ss.Schema == nil {
		x = ss.Struct
		insertID = ss.InsertID
		// Fall through so we can infer the schema.
	}
	if saver, ok := x.(ValueSaver); ok {
		return saver, ok, nil
	}
	v := reflect.ValueOf(x)
	// Support Put with []interface{}
	if v.Kind() == reflect.Interface {
		v = v.Elem()
	}
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return nil, false, nil
	}
	schema, err := inferSchemaReflectCached(v.Type())
	if err != nil {
		return nil, false, err
	}
	return &StructSaver{
		Struct:   x,
		InsertID: insertID,
		Schema:   schema,
	}, true, nil
}

func (u *Uploader) putMulti(ctx context.Context, src []ValueSaver) error {
	req, err := u.newInsertRequest(src)
	if err != nil {
		return err
	}
	if req == nil {
		return nil
	}
	call := u.t.c.bqs.Tabledata.InsertAll(u.t.ProjectID, u.t.DatasetID, u.t.TableID, req)
	call = call.Context(ctx)
	setClientHeader(call.Header())
	var res *bq.TableDataInsertAllResponse
	err = runWithRetry(ctx, func() (err error) {
		res, err = call.Do()
		return err
	})
	if err != nil {
		return err
	}
	return handleInsertErrors(res.InsertErrors, req.Rows)
}

func (u *Uploader) newInsertRequest(savers []ValueSaver) (*bq.TableDataInsertAllRequest, error) {
	if savers == nil { // If there are no rows, do nothing.
		return nil, nil
	}
	req := &bq.TableDataInsertAllRequest{
		TemplateSuffix:      u.TableTemplateSuffix,
		IgnoreUnknownValues: u.IgnoreUnknownValues,
		SkipInvalidRows:     u.SkipInvalidRows,
	}
	for _, saver := range savers {
		row, insertID, err := saver.Save()
		if err != nil {
			return nil, err
		}
		if insertID == "" {
			insertID = randomIDFn()
		}
		m := make(map[string]bq.JsonValue)
		for k, v := range row {
			m[k] = bq.JsonValue(v)
		}
		req.Rows = append(req.Rows, &bq.TableDataInsertAllRequestRows{
			InsertId: insertID,
			Json:     m,
		})
	}
	return req, nil
}

func handleInsertErrors(ierrs []*bq.TableDataInsertAllResponseInsertErrors, rows []*bq.TableDataInsertAllRequestRows) error {
	if len(ierrs) == 0 {
		return nil
	}
	var errs PutMultiError
	for _, e := range ierrs {
		if int(e.Index) > len(rows) {
			return fmt.Errorf("internal error: unexpected row index: %v", e.Index)
		}
		rie := RowInsertionError{
			InsertID: rows[e.Index].InsertId,
			RowIndex: int(e.Index),
		}
		for _, errp := range e.Errors {
			rie.Errors = append(rie.Errors, bqToError(errp))
		}
		errs = append(errs, rie)
	}
	return errs
}
