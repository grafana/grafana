// Copyright 2024 Dolthub, Inc.
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

package planbuilder

import (
	"sort"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

func (b *Builder) validateInsert(ins *plan.InsertInto) {
	table := getResolvedTable(ins.Destination)
	if table == nil {
		return
	}

	insertable, err := plan.GetInsertable(table)
	if err != nil {
		b.handleErr(err)
	}

	if ins.IsReplace {
		var ok bool
		_, ok = insertable.(sql.ReplaceableTable)
		if !ok {
			err := plan.ErrReplaceIntoNotSupported.New()
			b.handleErr(err)
		}
	}

	if len(ins.OnDupExprs) > 0 {
		var ok bool
		_, ok = insertable.(sql.UpdatableTable)
		if !ok {
			err := plan.ErrOnDuplicateKeyUpdateNotSupported.New()
			b.handleErr(err)
		}
	}

	// normalize the column name
	dstSchema := insertable.Schema()
	columnNames := make([]string, len(ins.ColumnNames))
	for i, name := range ins.ColumnNames {
		columnNames[i] = strings.ToLower(name)
	}

	// If no columns are given and value tuples are not all empty, use the full schema
	if len(columnNames) == 0 && existsNonZeroValueCount(ins.Source) {
		columnNames = make([]string, len(dstSchema))
		for i, f := range dstSchema {
			columnNames[i] = f.Name
		}
	}

	if len(ins.ColumnNames) > 0 {
		err := validateInsertColumns(table.Name(), columnNames, dstSchema, ins.Source)
		if err != nil {
			b.handleErr(err)
		}
	}

	err = validateValueCount(columnNames, ins.Source)
	if err != nil {
		b.handleErr(err)
	}
}

// Ensures that the number of elements in each Value tuple is empty
func existsNonZeroValueCount(values sql.Node) bool {
	switch node := values.(type) {
	case *plan.Values:
		for _, exprTuple := range node.ExpressionTuples {
			if len(exprTuple) != 0 {
				return true
			}
		}
	default:
		return true
	}
	return false
}

// validateInsertColumns performs two checks. The first is insert and destination column
// names. The insert column name must be valid, and we reject duplicate/conflicting
// column names. The second check validates that we are not trying to modify a
// read-only column (generated), which depends on first pairing source/destination
// columns.
func validateInsertColumns(tableName string, columnNames []string, dstSchema sql.Schema, source sql.Node) error {
	type namePos struct {
		name string
		pos  int
		gen  bool
	}

	insCols := make([]namePos, len(columnNames))
	for i, c := range columnNames {
		insCols[i] = namePos{name: strings.ToLower(c), pos: i}
	}
	destCols := make([]namePos, len(dstSchema))
	for i, c := range dstSchema {
		destCols[i] = namePos{name: strings.ToLower(c.Name), pos: i, gen: c.Generated != nil}
	}

	sort.Slice(insCols, func(i, j int) bool {
		return insCols[i].name < insCols[j].name
	})
	sort.Slice(destCols, func(i, j int) bool {
		return destCols[i].name < destCols[j].name
	})

	// XXX: This is written a perf critical way, specifically
	// to avoid building hash maps.

	var i, j int
	for i < len(insCols) && j < len(destCols) {
		if insCols[i].name != destCols[j].name {
			// we could go do a > check here, but we need to check
			// after exiting the loop anyways
			j++
			continue
		}

		if destCols[j].gen && !validGeneratedColumnValue(insCols[i].pos, source) {
			return sql.ErrGeneratedColumnValue.New(destCols[j].name, tableName)
		}

		i++
		j++
		if i < len(insCols) && insCols[i-1].name == insCols[i].name {
			return sql.ErrColumnSpecifiedTwice.New(insCols[i].name)
		}
	}
	if i < len(columnNames) {
		return sql.ErrUnknownColumn.New(insCols[i].name, tableName)
	}

	return nil
}

// validGeneratedColumnValue returns true if the column is a generated column and the source node is not a values node.
// Explicit default values (`DEFAULT`) are the only valid values to specify for a generated column
func validGeneratedColumnValue(idx int, source sql.Node) bool {
	switch source := source.(type) {
	case *plan.Values:
		for _, tuple := range source.ExpressionTuples {
			switch val := tuple[idx].(type) {
			case *sql.ColumnDefaultValue: // should be wrapped, but just in case
				return true
			case *expression.Wrapper:
				if _, ok := val.Unwrap().(*sql.ColumnDefaultValue); ok {
					return true
				}
				if _, ok := val.Unwrap().(*expression.DefaultColumn); ok {
					return true
				}
				return false
			case *expression.DefaultColumn: // handle unwrapped DefaultColumn
				return true
			default:
				return false
			}
		}
		return false
	default:
		return false
	}
}

func validateValueCount(columnNames []string, values sql.Node) error {
	switch node := values.(type) {
	case *plan.Values:
		for _, exprTuple := range node.ExpressionTuples {
			if len(exprTuple) != len(columnNames) {
				return sql.ErrInsertIntoMismatchValueCount.New()
			}
		}
	case *plan.LoadData:
		dataColLen := len(node.ColNames)
		if dataColLen == 0 {
			dataColLen = len(node.Schema())
		}
		if len(columnNames) != dataColLen {
			return sql.ErrInsertIntoMismatchValueCount.New()
		}
	default:
		// Parser assures us that this will be some form of SelectStatement, so no need to type check it
		if len(columnNames) != len(values.Schema()) {
			return sql.ErrInsertIntoMismatchValueCount.New()
		}
	}
	return nil
}
