// Copyright 2020-2021 Dolthub, Inc.
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

package analyzer

import (
	"fmt"
	"strings"

	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/expression/function"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

func resolveInsertRows(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if _, ok := n.(*plan.TriggerExecutor); ok {
		return n, transform.SameTree, nil
	}
	if _, ok := n.(*plan.CreateProcedure); ok {
		return n, transform.SameTree, nil
	}
	// We capture all INSERTs along the tree, such as those inside of block statements.
	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		insert, ok := n.(*plan.InsertInto)
		if !ok {
			return n, transform.SameTree, nil
		}

		table := getResolvedTable(insert.Destination)

		insertable, err := plan.GetInsertable(table)
		if err != nil {
			return nil, transform.SameTree, err
		}

		source := insert.Source
		// TriggerExecutor has already been analyzed
		if _, isTrigExec := insert.Source.(*plan.TriggerExecutor); !isTrigExec && !insert.LiteralValueSource {
			// Analyze the source of the insert independently
			if _, ok := insert.Source.(*plan.Values); ok {
				scope = scope.NewScope(plan.NewProject(
					expression.SchemaToGetFields(insert.Source.Schema()[:len(insert.ColumnNames)], sql.ColSet{}),
					plan.NewSubqueryAlias("dummy", "", insert.Source),
				))
			}
			scope.SetInInsertSource(true)
			source, _, err = a.analyzeWithSelector(ctx, insert.Source, scope, SelectAllBatches, newInsertSourceSelector(sel), qFlags)
			if err != nil {
				return nil, transform.SameTree, err
			}
		}

		dstSchema := insertable.Schema()

		// normalize the column name
		columnNames := make([]string, len(insert.ColumnNames))
		for i, name := range insert.ColumnNames {
			columnNames[i] = strings.ToLower(name)
		}

		// If no columns are given and value tuples are not all empty, use the full schema
		if len(columnNames) == 0 && existsNonZeroValueCount(source) {
			columnNames = make([]string, len(dstSchema))
			for i, f := range dstSchema {
				columnNames[i] = f.Name
			}
		}

		// The schema of the destination node and the underlying table differ subtly in terms of defaults
		var deferredDefaults sql.FastIntSet
		project, firstGeneratedAutoIncRowIdx, deferredDefaults, err := wrapRowSource(
			ctx,
			source,
			insertable,
			insert.Destination.Schema(),
			columnNames,
		)
		if err != nil {
			return nil, transform.SameTree, err
		}

		return insert.WithSource(project).
				WithAutoIncrementIdx(firstGeneratedAutoIncRowIdx).
				WithDeferredDefaults(deferredDefaults),
			transform.NewTree,
			nil
	})
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

func findColIdx(colName string, colNames []string) int {
	for i, name := range colNames {
		if strings.EqualFold(name, colName) {
			return i
		}
	}
	return -1
}

// wrapRowSource returns a projection that wraps the original row source so that its schema matches the full schema of
// the underlying table in the same order. Also, returns an integer value that indicates when this row source will
// result in an automatically generated value for an auto_increment column.
func wrapRowSource(ctx *sql.Context, insertSource sql.Node, destTbl sql.Table, schema sql.Schema, columnNames []string) (sql.Node, int, sql.FastIntSet, error) {
	projExprs := make([]sql.Expression, len(schema))
	deferredDefaults := sql.NewFastIntSet()
	firstGeneratedAutoIncRowIdx := -1

	for i, col := range schema {
		colIdx := findColIdx(col.Name, columnNames)
		// if column was not explicitly specified, try to substitute with default or generated value
		if colIdx == -1 {
			defaultExpr := col.Default
			if defaultExpr == nil {
				defaultExpr = col.Generated
			}
			if !col.Nullable && defaultExpr == nil && !col.AutoIncrement {
				deferredDefaults.Add(i)
			}

			var err error
			colNameToIdx := make(map[string]int)
			for i, c := range schema {
				colNameToIdx[fmt.Sprintf("%s.%s", strings.ToLower(c.Source), strings.ToLower(c.Name))] = i
			}
			def, _, err := transform.Expr(defaultExpr, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
				switch e := e.(type) {
				case *expression.GetField:
					idx, ok := colNameToIdx[strings.ToLower(e.WithTable(destTbl.Name()).String())]
					if !ok {
						return nil, transform.SameTree, fmt.Errorf("field not found: %s", e.String())
					}
					return e.WithIndex(idx), transform.NewTree, nil
				default:
					return e, transform.SameTree, nil
				}
			})
			if err != nil {
				return nil, -1, sql.FastIntSet{}, err
			}
			projExprs[i] = def
		} else {
			projExprs[i] = expression.NewGetField(colIdx, col.Type, col.Name, col.Nullable)
		}

		if col.AutoIncrement {
			// Regardless of whether the column was explicitly specified, if it is an auto increment column, we need to
			// wrap it in an AutoIncrement expression.
			ai, err := expression.NewAutoIncrement(ctx, destTbl, projExprs[i])
			if err != nil {
				return nil, -1, sql.FastIntSet{}, err
			}
			projExprs[i] = ai

			if colIdx == -1 {
				// Auto increment column was not specified explicitly, so we should increment last_insert_id immediately
				firstGeneratedAutoIncRowIdx = 0
			} else {
				// Additionally, the first NULL, DEFAULT, or empty value is what the last_insert_id should be set to.
				switch src := insertSource.(type) {
				case *plan.Values:
					for ii, tup := range src.ExpressionTuples {
						expr := tup[colIdx]
						if unwrap, ok := expr.(*expression.Wrapper); ok {
							expr = unwrap.Unwrap()
						}
						if _, isDef := expr.(*sql.ColumnDefaultValue); isDef {
							firstGeneratedAutoIncRowIdx = ii
							break
						}
						if lit, isLit := expr.(*expression.Literal); isLit {
							// If a literal NULL or if 0 is specified and the NO_AUTO_VALUE_ON_ZERO SQL mode is
							// not active, then MySQL will fill in an auto_increment value.
							if types.Null.Equals(lit.Type()) ||
								(!sql.LoadSqlMode(ctx).ModeEnabled(sql.NoAutoValueOnZero) && isZero(ctx, lit)) {
								firstGeneratedAutoIncRowIdx = ii
								break
							}
						}
					}
				}
			}
		}
	}

	// Handle auto UUID columns
	autoUuidCol, autoUuidColIdx := findAutoUuidColumn(ctx, schema)
	if autoUuidCol != nil {
		if columnDefaultValue, ok := projExprs[autoUuidColIdx].(*sql.ColumnDefaultValue); ok {
			// If the auto UUID column is being populated through the projection (i.e. it's projecting a
			// ColumnDefaultValue to create the UUID), then update the project to include the AutoUuid expression.
			newExpr, identity, err := insertAutoUuidExpression(ctx, columnDefaultValue, autoUuidCol)
			if err != nil {
				return nil, -1, sql.FastIntSet{}, err
			}
			if identity == transform.NewTree {
				projExprs[autoUuidColIdx] = newExpr
			}
		} else {
			// Otherwise, if the auto UUID column is not getting populated through the projection, then we
			// need to look through the tuples to look for the first DEFAULT or UUID() expression and apply
			// the AutoUuid expression to it.
			err := wrapAutoUuidInValuesTuples(ctx, autoUuidCol, insertSource, columnNames)
			if err != nil {
				return nil, -1, sql.FastIntSet{}, err
			}
		}
	}

	return plan.NewProject(projExprs, insertSource), firstGeneratedAutoIncRowIdx, deferredDefaults, nil
}

// isZero returns true if the specified literal value |lit| has a value equal to 0.
func isZero(ctx *sql.Context, lit *expression.Literal) bool {
	if !types.IsNumber(lit.Type()) {
		return false
	}

	convert, inRange, err := types.Int8.Convert(ctx, lit.Value())
	if err != nil {
		// Ignore any conversion errors, since that means the value isn't 0
		// and the values are validated in other parts of the analyzer anyway.
		return false
	}
	return bool(inRange) && convert == int8(0)
}

// insertAutoUuidExpression transforms the specified |expr| for |autoUuidCol| and inserts an AutoUuid
// expression above the UUID() function call, so that the auto generated UUID value can be captured and
// saved to the session's query info.
func insertAutoUuidExpression(ctx *sql.Context, expr sql.Expression, autoUuidCol *sql.Column) (sql.Expression, transform.TreeIdentity, error) {
	return transform.Expr(expr, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		switch e := e.(type) {
		case *function.UUIDFunc:
			return expression.NewAutoUuid(ctx, autoUuidCol, e), transform.NewTree, nil
		default:
			return e, transform.SameTree, nil
		}
	})
}

// findAutoUuidColumn searches the specified |schema| for a column that meets the requirements of an auto UUID
// column, and if found, returns the column, as well as its index in the schema. See isAutoUuidColumn() for the
// requirements on what is considered an auto UUID column.
func findAutoUuidColumn(_ *sql.Context, schema sql.Schema) (autoUuidCol *sql.Column, autoUuidColIdx int) {
	for i, col := range schema {
		if isAutoUuidColumn(col) {
			return col, i
		}
	}

	return nil, -1
}

// wrapAutoUuidInValuesTuples searches the tuples in the |insertSource| (if it is a *plan.Values) for the first
// tuple using a DEFAULT() or a UUID() function expression for the |autoUuidCol|, and wraps the UUID() function
// in an AutoUuid expression so that the generated UUID value can be captured and saved to the session's query info.
// After finding a first occurrence, this function returns, since only the first generated UUID needs to be saved.
// The caller must provide the |columnNames| for the insertSource so that this function can identify the index
// in the value tuples for the auto UUID column.
func wrapAutoUuidInValuesTuples(ctx *sql.Context, autoUuidCol *sql.Column, insertSource sql.Node, columnNames []string) error {
	values, ok := insertSource.(*plan.Values)
	if !ok {
		// If the insert source isn't value tuples, then we don't need to do anything
		return nil
	}

	// Search the column names in the Values tuples to find the right tuple index
	autoUuidColTupleIdx := -1
	for i, columnName := range columnNames {
		if strings.ToLower(autoUuidCol.Name) == strings.ToLower(columnName) {
			autoUuidColTupleIdx = i
		}
	}
	if autoUuidColTupleIdx == -1 {
		return nil
	}

	for _, tuple := range values.ExpressionTuples {
		expr := tuple[autoUuidColTupleIdx]
		if wrapper, ok := expr.(*expression.Wrapper); ok {
			expr = wrapper.Unwrap()
		}

		switch expr.(type) {
		case *sql.ColumnDefaultValue, *function.UUIDFunc, *function.UUIDToBin:
			// Only ColumnDefaultValue, UUIDFunc, and UUIDToBin are valid to use in an auto UUID column
			newExpr, identity, err := insertAutoUuidExpression(ctx, expr, autoUuidCol)
			if err != nil {
				return err
			}
			if identity == transform.NewTree {
				tuple[autoUuidColTupleIdx] = newExpr
				return nil
			}
		}
	}

	return nil
}

// isAutoUuidColumn returns true if the specified |col| meets the requirements of an auto generated UUID column. To
// be an auto UUID column, the column must be part of the primary key (it may be a composite primary key), and the
// type must be either varchar(36), char(36), varbinary(16), or binary(16). It must have a default value set to
// populate a UUID, either through the UUID() function (for char and varchar columns) or the UUID_TO_BIN(UUID())
// function (for binary and varbinary columns).
func isAutoUuidColumn(col *sql.Column) bool {
	if col.PrimaryKey == false {
		return false
	}

	switch col.Type.Type() {
	case sqltypes.Char, sqltypes.VarChar:
		stringType := col.Type.(sql.StringType)
		if stringType.MaxCharacterLength() != 36 || col.Default == nil {
			return false
		}
		if _, ok := col.Default.Expr.(*function.UUIDFunc); ok {
			return true
		}
	case sqltypes.Binary, sqltypes.VarBinary:
		stringType := col.Type.(sql.StringType)
		if stringType.MaxByteLength() != 16 || col.Default == nil {
			return false
		}
		if uuidToBinFunc, ok := col.Default.Expr.(*function.UUIDToBin); ok {
			if _, ok := uuidToBinFunc.Children()[0].(*function.UUIDFunc); ok {
				return true
			}
		}
	}

	return false
}
