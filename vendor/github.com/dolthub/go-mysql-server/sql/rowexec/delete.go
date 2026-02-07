// Copyright 2023 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package rowexec

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

// schemaPositionDeleter contains a sql.RowDeleter and the start (inclusive) and end (exclusive) position
// within a schema that indicate the portion of the schema that is associated with this specific deleter.
type schemaPositionDeleter struct {
	deleter     sql.RowDeleter
	schemaStart int
	schemaEnd   int
}

// findSourcePosition searches the specified |schema| for the first group of columns whose source is |name|,
// and returns the start position of that source in the schema (inclusive) and the end position (exclusive).
// If any problems were an encountered, such as not finding any columns from the specified source name,
// an error is returned.
func findSourcePosition(schema sql.Schema, name string) (uint, uint, error) {
	foundStart := false
	name = strings.ToLower(name)
	var start uint
	for i, col := range schema {
		if strings.ToLower(col.Source) == name {
			if !foundStart {
				start = uint(i)
				foundStart = true
			}
		} else {
			if foundStart {
				return start, uint(i), nil
			}
		}
	}
	if foundStart {
		return start, uint(len(schema)), nil
	}

	return 0, 0, fmt.Errorf("unable to find any columns in schema from source %q", name)
}

// deleteIter executes the DELETE FROM logic to delete rows from tables as they flow through the iterator. For every
// table the deleteIter needs to delete rows from, it needs a schemaPositionDeleter that provides the RowDeleter
// interface as well as start and end position for that table's full row in the row this iterator consumes from its
// child. For simple DELETE FROM statements deleting from a single table, this will likely be the full row contents,
// but in more complex scenarios when there are columns contributed by outer scopes and for DELETE FROM JOIN statements
// the child iterator will return a row that is composed of rows from multiple table sources.
type deleteIter struct {
	childIter    sql.RowIter
	deleters     []schemaPositionDeleter
	returnExprs  []sql.Expression
	schema       sql.Schema
	returnSchema sql.Schema
	closed       bool
}

func (d *deleteIter) Next(ctx *sql.Context) (sql.Row, error) {
	row, err := d.childIter.Next(ctx)
	if err != nil {
		return nil, err
	}
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	// For each target table from which we are deleting rows, reduce the row from our child iterator to just
	// the columns that are part of that target table. This means looking at the position in the schema for
	// the target table and also removing any prepended columns contributed by outer scopes.
	fullSchemaLength := len(d.schema)
	rowLength := len(row)
	for _, deleter := range d.deleters {
		schemaLength := deleter.schemaEnd - deleter.schemaStart
		subSlice := row
		if schemaLength < rowLength {
			subSlice = row[(rowLength - fullSchemaLength + deleter.schemaStart):(rowLength - fullSchemaLength + deleter.schemaEnd)]
		}
		err = deleter.deleter.Delete(ctx, subSlice)
		if err != nil {
			return nil, err
		}
	}

	if len(d.returnExprs) > 0 {
		var retExprRow sql.Row
		for _, returnExpr := range d.returnExprs {
			result, err := returnExpr.Eval(ctx, row)
			if err != nil {
				return nil, err
			}
			retExprRow = append(retExprRow, result)
		}
		return retExprRow, nil
	}

	return row, nil
}

func (d *deleteIter) Close(ctx *sql.Context) error {
	if !d.closed {
		d.closed = true
		var firstErr error
		// Make sure we close all the deleters and the childIter, and track the first
		// error seen so we can return it after safely closing all resources.
		for _, deleter := range d.deleters {
			err := deleter.deleter.Close(ctx)
			if err != nil && firstErr == nil {
				firstErr = err
			}
		}
		err := d.childIter.Close(ctx)

		if firstErr != nil {
			return firstErr
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func newDeleteIter(childIter sql.RowIter, schema sql.Schema, deleters []schemaPositionDeleter, returnExprs []sql.Expression, returnSchema sql.Schema) sql.RowIter {
	openerClosers := make([]sql.EditOpenerCloser, len(deleters))
	for i, ds := range deleters {
		openerClosers[i] = ds.deleter
	}
	return plan.NewTableEditorIter(&deleteIter{
		deleters:     deleters,
		childIter:    childIter,
		schema:       schema,
		returnExprs:  returnExprs,
		returnSchema: returnSchema,
	}, openerClosers...)
}
