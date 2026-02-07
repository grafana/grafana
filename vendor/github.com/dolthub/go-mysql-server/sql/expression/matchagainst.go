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

package expression

import (
	"fmt"
	"math"
	"strings"
	"sync"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/fulltext"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// MatchAgainst reads from the tables that create a Full-Text index, and returns a relevancy for each row that is passed
// into it. Within the context of a filter, these relevancy values will be used to filter out rows, as a relevancy > 0
// is a match. Within the context of a SELECT expression, the relevancy value is returned as-is. An index may use the
// tables provided by the expression to reduce the searchable set of tables, however this is performed as a separate step
// that is not directly tied to this expression. This expression's purpose is solely to calculate relevancy values.
type MatchAgainst struct {
	ftIndex          fulltext.Index
	rowCountIndex    sql.Index
	globalCountIndex sql.Index
	docCountIndex    sql.Index

	ConfigTable      sql.IndexAddressableTable
	ParentTable      sql.IndexAddressableTable
	PositionTable    sql.IndexAddressableTable
	DocCountTable    sql.IndexAddressableTable
	GlobalCountTable sql.IndexAddressableTable
	RowCountTable    sql.IndexAddressableTable

	Expr sql.Expression

	evaluatedString string
	Columns         []sql.Expression
	KeyCols         fulltext.KeyColumns
	parser          fulltext.DefaultParser
	expectedRowLen  int
	parentRowCount  uint64
	once            sync.Once
	SearchModifier  fulltext.SearchModifier
}

var _ sql.Expression = (*MatchAgainst)(nil)

// NewMatchAgainst creates a new *MatchAgainst expression.
func NewMatchAgainst(columns []sql.Expression, expr sql.Expression, searchModifier fulltext.SearchModifier) *MatchAgainst {
	return &MatchAgainst{
		Columns:          columns,
		Expr:             expr,
		SearchModifier:   searchModifier,
		ftIndex:          nil,
		KeyCols:          fulltext.KeyColumns{},
		ParentTable:      nil,
		ConfigTable:      nil,
		PositionTable:    nil,
		DocCountTable:    nil,
		GlobalCountTable: nil,
		RowCountTable:    nil,
		expectedRowLen:   0,
	}
}

// Children implements sql.Expression
func (expr *MatchAgainst) Children() []sql.Expression {
	exprs := make([]sql.Expression, len(expr.Columns)+1)
	copy(exprs, expr.Columns)
	exprs[len(exprs)-1] = expr.Expr
	return exprs
}

// Eval implements sql.Expression
func (expr *MatchAgainst) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	row = row[:expr.expectedRowLen]
	switch expr.SearchModifier {
	case fulltext.SearchModifier_NaturalLanguage:
		return expr.inNaturalLanguageMode(ctx, row)
	case fulltext.SearchModifier_NaturalLangaugeQueryExpansion:
		return expr.inNaturalLanguageModeWithQueryExpansion(ctx, row)
	case fulltext.SearchModifier_Boolean:
		return expr.inBooleanMode(ctx, row)
	case fulltext.SearchModifier_QueryExpansion:
		return expr.withQueryExpansion(ctx, row)
	default:
		panic("invalid MATCH...AGAINST search modifier")
	}
}

// IsNullable implements sql.Expression
func (expr *MatchAgainst) IsNullable() bool {
	return false
}

// Resolved implements sql.Expression
func (expr *MatchAgainst) Resolved() bool {
	for _, col := range expr.Columns {
		if !col.Resolved() {
			return false
		}
	}
	return expr.Expr.Resolved()
}

// String implements sql.Expression
func (expr *MatchAgainst) String() string {
	var searchModifierStr string
	switch expr.SearchModifier {
	case fulltext.SearchModifier_NaturalLanguage:
		searchModifierStr = "IN NATURAL LANGUAGE MODE"
	case fulltext.SearchModifier_NaturalLangaugeQueryExpansion:
		searchModifierStr = "IN NATURAL LANGUAGE MODE WITH QUERY EXPANSION"
	case fulltext.SearchModifier_Boolean:
		searchModifierStr = "IN BOOLEAN MODE"
	case fulltext.SearchModifier_QueryExpansion:
		searchModifierStr = "WITH QUERY EXPANSION"
	default:
		panic("invalid MATCH...AGAINST search modifier")
	}
	columns := make([]string, len(expr.Columns))
	for i := range expr.Columns {
		columns[i] = expr.Columns[i].String()
	}
	return fmt.Sprintf("MATCH (%s) AGAINST (%s %s)", strings.Join(columns, ","), expr.Expr.String(), searchModifierStr)
}

// Type implements sql.Expression
func (expr *MatchAgainst) Type() sql.Type {
	return types.Float32
}

// WithChildren implements sql.Expression
func (expr *MatchAgainst) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != len(expr.Columns)+1 {
		return nil, sql.ErrInvalidChildrenNumber.New(expr, len(children), len(expr.Columns)+1)
	}
	columns := make([]sql.Expression, len(children)-1)
	copy(columns, children)
	return &MatchAgainst{
		Columns:          columns,
		Expr:             children[len(children)-1],
		SearchModifier:   expr.SearchModifier,
		ftIndex:          expr.ftIndex,
		KeyCols:          expr.KeyCols,
		ParentTable:      expr.ParentTable,
		ConfigTable:      expr.ConfigTable,
		PositionTable:    expr.PositionTable,
		DocCountTable:    expr.DocCountTable,
		GlobalCountTable: expr.GlobalCountTable,
		RowCountTable:    expr.RowCountTable,
		expectedRowLen:   expr.expectedRowLen,
	}, nil
}

// WithInfo returns a new *MatchAgainst with the given tables and other needed information to perform matching.
func (expr *MatchAgainst) WithInfo(parent, config, position, docCount, globalCount, rowCount sql.IndexAddressableTable, keyCols fulltext.KeyColumns) *MatchAgainst {
	return &MatchAgainst{
		Columns:          expr.Columns,
		Expr:             expr.Expr,
		SearchModifier:   expr.SearchModifier,
		ftIndex:          expr.ftIndex,
		KeyCols:          keyCols,
		ParentTable:      parent,
		ConfigTable:      config,
		PositionTable:    position,
		DocCountTable:    docCount,
		GlobalCountTable: globalCount,
		RowCountTable:    rowCount,
		expectedRowLen:   len(parent.Schema()),
	}
}

// GetIndex returns the relevant Full-Text index for this expression, or nil if it has not yet been set.
func (expr *MatchAgainst) GetIndex() fulltext.Index {
	return expr.ftIndex
}

// SetIndex sets the index for this expression. This does not create and return a new expression, which differs from the
// "With" functions.
func (expr *MatchAgainst) SetIndex(fulltextIndex fulltext.Index) {
	if fulltextIndex == nil {
		return
	}
	expr.ftIndex = fulltextIndex
}

// ColumnsAsGetFields returns the columns as *GetField expressions. If the columns have not yet been resolved, then this
// returns a nil (empty) slice.
func (expr *MatchAgainst) ColumnsAsGetFields() []*GetField {
	var ok bool
	fields := make([]*GetField, len(expr.Columns))
	for i, col := range expr.Columns {
		fields[i], ok = col.(*GetField)
		if !ok {
			return nil
		}
	}
	return fields
}

// inNaturalLanguageMode calculates the relevancy using "IN NATURAL LANGUAGE MODE" (default mode). The returned float
// value is the relevancy. When used under a FILTER node, a non-zero result is interpreted as "true", while a zero result
// is interpreted as false. It is assumed that incoming rows will exactly match the schema of the parent table, meaning
// that we cannot take projected rows.
func (expr *MatchAgainst) inNaturalLanguageMode(ctx *sql.Context, row sql.Row) (float32, error) {
	// The general flow of this function is as follows:
	// 1) Perform the one-time setup by evaluating the match expression (string literal) and constructing a parser.
	//    a) Evaluate the match expression, which should be a string literal.
	//    b) Construct a parser over the evaluated literal, so that we may match against multiple words.
	//    c) Cache the indexes that will be used in our searches.
	// 2) Reset the parser, so that we may iterate over the evaluated literal for each input row.
	// 3) Iterate over each unique word from our evaluated literal.
	// 4) Construct a lookup on the document count and global count tables using the word and key (constructed from the input row).
	// 5) If entries were found in the tables, then calculate the relevancy. We'll loop back to #3 until we've exhausted our words.
	// 6) Return the sum of all relevancy calculations.
	var err error
	expr.once.Do(func() {
		// Evaluate the expression, which should always result in a string literal
		words, nErr := expr.Expr.Eval(ctx, nil)
		if nErr != nil {
			err = nErr
			return
		}
		wordsStr, ok := words.(string)
		if !ok {
			if words != nil {
				err = fmt.Errorf("expected WORD to be a string, but had type `%T`", words)
			}
		}
		expr.evaluatedString = wordsStr
		// Grab the index for the doc count table
		docCountIndexes, nErr := expr.DocCountTable.GetIndexes(ctx)
		if nErr != nil {
			err = nErr
			return
		}
		if len(docCountIndexes) != 1 || docCountIndexes[0].ID() != "PRIMARY" {
			err = fmt.Errorf("expected to find a primary key on the table `%s`", expr.DocCountTable.Name())
		}
		expr.docCountIndex = docCountIndexes[0]
		// Grab the index for the global count table
		globalCountIndexes, nErr := expr.GlobalCountTable.GetIndexes(ctx)
		if nErr != nil {
			err = nErr
			return
		}
		if len(globalCountIndexes) != 1 || globalCountIndexes[0].ID() != "PRIMARY" {
			err = fmt.Errorf("expected to find a primary key on the table `%s`", expr.GlobalCountTable.Name())
		}
		expr.globalCountIndex = globalCountIndexes[0]
		// Grab the index for the row count table
		rowCountIndexes, nErr := expr.RowCountTable.GetIndexes(ctx)
		if nErr != nil {
			err = nErr
			return
		}
		if len(rowCountIndexes) != 1 || rowCountIndexes[0].ID() != "PRIMARY" {
			err = fmt.Errorf("expected to find a primary key on the table `%s`", expr.RowCountTable.Name())
		}
		expr.rowCountIndex = rowCountIndexes[0]
		// Create the parser now since it does a lot of preprocessing. We'll reset the iterators every call.
		expr.parser, nErr = fulltext.NewDefaultParser(ctx, fulltext.GetCollationFromSchema(ctx, expr.DocCountTable.Schema()), wordsStr)
		if nErr != nil {
			err = nErr
			return
		}
		// Load the number of rows from the parent table, since it's used in the relevancy calculation
		expr.parentRowCount, _, nErr = expr.ParentTable.(sql.StatisticsTable).RowCount(ctx)
		if nErr != nil {
			err = nErr
			return
		}
	})
	if err != nil {
		return 0, err
	}

	accumulatedRelevancy := float32(0)
	hash, err := fulltext.HashRow(ctx, row)
	if err != nil {
		return 0, err
	}

	expr.parser.Reset()
	wordStr, reachedTheEnd, err := expr.parser.NextUnique(ctx)
	for ; err == nil && !reachedTheEnd; wordStr, reachedTheEnd, err = expr.parser.NextUnique(ctx) {
		// We'll look for this word within the doc count table, so that we can:
		// 1) Ensure that there's a match
		// 2) Grab the count to use in the relevancy calculation
		var lookup sql.IndexLookup
		if expr.KeyCols.Type != fulltext.KeyType_None {
			ranges := make(sql.MySQLRange, 1+len(expr.KeyCols.Positions))
			ranges[0] = sql.ClosedRangeColumnExpr(wordStr, wordStr, expr.DocCountTable.Schema()[0].Type)
			for i, keyColPos := range expr.KeyCols.Positions {
				ranges[i+1] = sql.ClosedRangeColumnExpr(row[keyColPos], row[keyColPos], expr.DocCountTable.Schema()[i+1].Type)
			}
			lookup = sql.IndexLookup{Ranges: sql.MySQLRangeCollection{ranges}, Index: expr.docCountIndex}
		} else {
			lookup = sql.IndexLookup{Ranges: sql.MySQLRangeCollection{
				{
					sql.ClosedRangeColumnExpr(wordStr, wordStr, expr.DocCountTable.Schema()[0].Type),
					sql.ClosedRangeColumnExpr(hash, hash, fulltext.SchemaRowCount[0].Type),
				},
			}, Index: expr.docCountIndex}
		}

		editorData := expr.DocCountTable.IndexedAccess(ctx, lookup)
		if err != nil {
			return 0, err
		}

		partIter, err := editorData.LookupPartitions(ctx, lookup)
		if err != nil {
			return 0, err
		}
		docCountRows, err := sql.RowIterToRows(ctx, sql.NewTableRowIter(ctx, editorData, partIter))
		if err != nil {
			return 0, err
		}
		if len(docCountRows) == 0 {
			// This did not match, so we continue
			continue
		} else if len(docCountRows) > 1 {
			return 0, fmt.Errorf("somehow there are duplicate entries within the Full-Text doc count table")
		}
		docCountRow := docCountRows[0]
		docCount := float64(docCountRow[len(docCountRow)-1].(uint64))
		if docCount == 0 {
			// We've got an empty document count, so the word does not match (so it should have been deleted)
			continue
		}

		// Otherwise, we've found a match, so we'll grab the global count as well
		lookup = sql.IndexLookup{Ranges: sql.MySQLRangeCollection{
			{
				sql.ClosedRangeColumnExpr(wordStr, wordStr, expr.GlobalCountTable.Schema()[0].Type),
			},
		}, Index: expr.globalCountIndex}
		editorData = expr.GlobalCountTable.IndexedAccess(ctx, lookup)
		if err != nil {
			return 0, err
		}

		partIter, err = editorData.LookupPartitions(ctx, lookup)
		if err != nil {
			return 0, err
		}
		globalCountRows, err := sql.RowIterToRows(ctx, sql.NewTableRowIter(ctx, editorData, partIter))
		if err != nil {
			return 0, err
		}
		if len(globalCountRows) == 0 {
			continue
		} else if len(globalCountRows) > 1 {
			return 0, fmt.Errorf("somehow there are duplicate entries within the Full-Text global count table")
		}
		globalCountRow := globalCountRows[0]

		// Lastly, grab the number of unique words within this row from the row count
		lookup = sql.IndexLookup{Ranges: sql.MySQLRangeCollection{
			{
				sql.ClosedRangeColumnExpr(hash, hash, expr.RowCountTable.Schema()[0].Type),
			},
		}, Index: expr.rowCountIndex}
		editorData = expr.RowCountTable.IndexedAccess(ctx, lookup)
		if err != nil {
			return 0, err
		}

		partIter, err = editorData.LookupPartitions(ctx, lookup)
		if err != nil {
			return 0, err
		}
		rowCountRows, err := sql.RowIterToRows(ctx, sql.NewTableRowIter(ctx, editorData, partIter))
		if err != nil {
			return 0, err
		}
		if len(rowCountRows) == 0 {
			continue
		} else if len(rowCountRows) > 1 {
			return 0, fmt.Errorf("somehow there are duplicate entries within the Full-Text row count table")
		}
		rowCountRow := rowCountRows[0]

		// Calculate the relevancy (partially based on an old MySQL implementation)
		// https://web.archive.org/web/20220122170304/http://dev.mysql.com/doc/internals/en/full-text-search.html
		globalCount := float64(globalCountRow[len(globalCountRow)-1].(uint64))
		uniqueWords := float64(rowCountRow[2].(uint64))
		base := math.Log(docCount) + 1
		normFactor := uniqueWords / (1 + 0.115*uniqueWords)
		globalMult := math.Log(float64(expr.parentRowCount)/globalCount) + 1
		accumulatedRelevancy += float32(base * normFactor * globalMult)
	}
	if err != nil {
		return 0, err
	}
	// Due to how we handle floating to bool conversion, we need to add 0.5 if the result is positive
	if accumulatedRelevancy > 0 {
		accumulatedRelevancy += 0.5
	}
	// Return the accumulated relevancy from all of the parsed words
	return accumulatedRelevancy, nil
}

// inNaturalLanguageModeWithQueryExpansion calculates the result using "IN NATURAL LANGUAGE MODE WITH QUERY EXPANSION".
func (expr *MatchAgainst) inNaturalLanguageModeWithQueryExpansion(ctx *sql.Context, row sql.Row) (float32, error) {
	return 0, fmt.Errorf("'IN NATURAL LANGUAGE MODE WITH QUERY EXPANSION' has not yet been implemented")
}

// inBooleanMode calculates the result using "IN BOOLEAN MODE".
func (expr *MatchAgainst) inBooleanMode(ctx *sql.Context, row sql.Row) (float32, error) {
	return 0, fmt.Errorf("'IN BOOLEAN MODE' has not yet been implemented")
}

// withQueryExpansion calculates the result using "WITH QUERY EXPANSION".
func (expr *MatchAgainst) withQueryExpansion(ctx *sql.Context, row sql.Row) (float32, error) {
	return 0, fmt.Errorf("'WITH QUERY EXPANSION' has not yet been implemented")
}
