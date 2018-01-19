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
	"fmt"
	"reflect"

	"golang.org/x/net/context"
	bq "google.golang.org/api/bigquery/v2"
	"google.golang.org/api/iterator"
)

func newRowIterator(ctx context.Context, t *Table, pf pageFetcher) *RowIterator {
	it := &RowIterator{
		ctx:   ctx,
		table: t,
		pf:    pf,
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(
		it.fetch,
		func() int { return len(it.rows) },
		func() interface{} { r := it.rows; it.rows = nil; return r })
	return it
}

// A RowIterator provides access to the result of a BigQuery lookup.
type RowIterator struct {
	ctx      context.Context
	table    *Table
	pf       pageFetcher
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// StartIndex can be set before the first call to Next. If PageInfo().Token
	// is also set, StartIndex is ignored.
	StartIndex uint64

	rows [][]Value

	schema       Schema       // populated on first call to fetch
	structLoader structLoader // used to populate a pointer to a struct
}

// Next loads the next row into dst. Its return value is iterator.Done if there
// are no more results. Once Next returns iterator.Done, all subsequent calls
// will return iterator.Done.
//
// dst may implement ValueLoader, or may be a *[]Value, *map[string]Value, or struct pointer.
//
// If dst is a *[]Value, it will be set to to new []Value whose i'th element
// will be populated with the i'th column of the row.
//
// If dst is a *map[string]Value, a new map will be created if dst is nil. Then
// for each schema column name, the map key of that name will be set to the column's
// value. STRUCT types (RECORD types or nested schemas) become nested maps.
//
// If dst is pointer to a struct, each column in the schema will be matched
// with an exported field of the struct that has the same name, ignoring case.
// Unmatched schema columns and struct fields will be ignored.
//
// Each BigQuery column type corresponds to one or more Go types; a matching struct
// field must be of the correct type. The correspondences are:
//
//   STRING      string
//   BOOL        bool
//   INTEGER     int, int8, int16, int32, int64, uint8, uint16, uint32
//   FLOAT       float32, float64
//   BYTES       []byte
//   TIMESTAMP   time.Time
//   DATE        civil.Date
//   TIME        civil.Time
//   DATETIME    civil.DateTime
//
// A repeated field corresponds to a slice or array of the element type. A STRUCT
// type (RECORD or nested schema) corresponds to a nested struct or struct pointer.
// All calls to Next on the same iterator must use the same struct type.
//
// It is an error to attempt to read a BigQuery NULL value into a struct field.
// If your table contains NULLs, use a *[]Value or *map[string]Value.
func (it *RowIterator) Next(dst interface{}) error {
	var vl ValueLoader
	switch dst := dst.(type) {
	case ValueLoader:
		vl = dst
	case *[]Value:
		vl = (*valueList)(dst)
	case *map[string]Value:
		vl = (*valueMap)(dst)
	default:
		if !isStructPtr(dst) {
			return fmt.Errorf("bigquery: cannot convert %T to ValueLoader (need pointer to []Value, map[string]Value, or struct)", dst)
		}
	}
	if err := it.nextFunc(); err != nil {
		return err
	}
	row := it.rows[0]
	it.rows = it.rows[1:]

	if vl == nil {
		// This can only happen if dst is a pointer to a struct. We couldn't
		// set vl above because we need the schema.
		if err := it.structLoader.set(dst, it.schema); err != nil {
			return err
		}
		vl = &it.structLoader
	}
	return vl.Load(row, it.schema)
}

func isStructPtr(x interface{}) bool {
	t := reflect.TypeOf(x)
	return t.Kind() == reflect.Ptr && t.Elem().Kind() == reflect.Struct
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *RowIterator) PageInfo() *iterator.PageInfo { return it.pageInfo }

func (it *RowIterator) fetch(pageSize int, pageToken string) (string, error) {
	res, err := it.pf(it.ctx, it.table, it.schema, it.StartIndex, int64(pageSize), pageToken)
	if err != nil {
		return "", err
	}
	it.rows = append(it.rows, res.rows...)
	it.schema = res.schema
	return res.pageToken, nil
}

// A pageFetcher returns a page of rows from a destination table.
type pageFetcher func(ctx context.Context, _ *Table, _ Schema, startIndex uint64, pageSize int64, pageToken string) (*fetchPageResult, error)

type fetchPageResult struct {
	pageToken string
	rows      [][]Value
	totalRows uint64
	schema    Schema
}

// fetchPage gets a page of rows from t.
func fetchPage(ctx context.Context, t *Table, schema Schema, startIndex uint64, pageSize int64, pageToken string) (*fetchPageResult, error) {
	// Fetch the table schema in the background, if necessary.
	errc := make(chan error, 1)
	if schema != nil {
		errc <- nil
	} else {
		go func() {
			var bqt *bq.Table
			err := runWithRetry(ctx, func() (err error) {
				bqt, err = t.c.bqs.Tables.Get(t.ProjectID, t.DatasetID, t.TableID).
					Fields("schema").
					Context(ctx).
					Do()
				return err
			})
			if err == nil && bqt.Schema != nil {
				schema = bqToSchema(bqt.Schema)
			}
			errc <- err
		}()
	}
	call := t.c.bqs.Tabledata.List(t.ProjectID, t.DatasetID, t.TableID)
	setClientHeader(call.Header())
	if pageToken != "" {
		call.PageToken(pageToken)
	} else {
		call.StartIndex(startIndex)
	}
	if pageSize > 0 {
		call.MaxResults(pageSize)
	}
	var res *bq.TableDataList
	err := runWithRetry(ctx, func() (err error) {
		res, err = call.Context(ctx).Do()
		return err
	})
	if err != nil {
		return nil, err
	}
	err = <-errc
	if err != nil {
		return nil, err
	}
	rows, err := convertRows(res.Rows, schema)
	if err != nil {
		return nil, err
	}
	return &fetchPageResult{
		pageToken: res.PageToken,
		rows:      rows,
		totalRows: uint64(res.TotalRows),
		schema:    schema,
	}, nil
}
