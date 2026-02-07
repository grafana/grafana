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
	"io"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/fulltext"
)

// FulltextFilterTable handles row iteration for filters involving Full-Text indexes, as they behave differently than
// other indexes. This acts as a sort of wrapper, so that integrators do not need to implement special logic on their
// side.
//
// This takes a MatchAgainst expression, as it will have already resolved the index and necessary tables, therefore we
// do not need to replicate the work here. Although they may seem similar in functionality, they are performing two
// different functions. This filter table determines if we need to calculate the relevancy of a word, by only returning
// rows that exist within our index tables. If a word does not exist within the tables, then we can assume that it has a
// relevancy of zero (for the default search mode). Therefore, we can skip processing that row altogether. The existence
// of a row does not imply that the relevancy value will be non-zero though, as the relevancy calculation can return a
// zero due to rounding (as is the case with the MyISAM backend, which we currently do not support).
type FulltextFilterTable struct {
	MatchAgainst *expression.MatchAgainst
	Table        sql.TableNode
}

var _ sql.IndexedTable = (*FulltextFilterTable)(nil)

// Name implements the interface sql.IndexedTable.
func (f *FulltextFilterTable) Name() string {
	return f.Table.Name()
}

// String implements the interface sql.IndexedTable.
func (f *FulltextFilterTable) String() string {
	return f.Table.String()
}

// Schema implements the interface sql.IndexedTable.
func (f *FulltextFilterTable) Schema() sql.Schema {
	return f.Table.Schema()
}

// Collation implements the interface sql.IndexedTable.
func (f *FulltextFilterTable) Collation() sql.CollationID {
	return f.Table.Collation()
}

// Partitions implements the interface sql.IndexedTable.
func (f *FulltextFilterTable) Partitions(ctx *sql.Context) (sql.PartitionIter, error) {
	if f.MatchAgainst.KeyCols.Type == fulltext.KeyType_None {
		return f.Table.Partitions(ctx)
	}
	return &fulltextFilterTablePartitionIter{false}, nil
}

// PartitionRows implements the interface sql.IndexedTable.
func (f *FulltextFilterTable) PartitionRows(ctx *sql.Context, partition sql.Partition) (sql.RowIter, error) {
	// Keyless just iterates over the entire table. Not the most performant, but it works.
	if f.MatchAgainst.KeyCols.Type == fulltext.KeyType_None {
		return f.Table.PartitionRows(ctx, partition)
	}

	// Get the word parser for our string literal
	words, err := f.MatchAgainst.Expr.Eval(ctx, nil)
	if err != nil {
		return nil, err
	}
	wordsStr, ok := words.(string)
	if !ok {
		if words != nil {
			return nil, fmt.Errorf("expected WORD to be a string, but had type `%T`", words)
		}
	}
	collation := fulltext.GetCollationFromSchema(ctx, f.MatchAgainst.DocCountTable.Schema())
	parser, err := fulltext.NewDefaultParser(ctx, collation, wordsStr)
	if err != nil {
		return nil, err
	}

	// Get the primary key index for the document count table
	docCountIndexes, err := f.MatchAgainst.DocCountTable.GetIndexes(ctx)
	if err != nil {
		return nil, err
	}
	// There should only be a single index on this table
	if len(docCountIndexes) == 0 {
		return nil, fmt.Errorf("expected to find a primary key on the table `%s`", f.MatchAgainst.DocCountTable.Name())
	} else if len(docCountIndexes) > 1 {
		return nil, fmt.Errorf("found too many indexes on the table `%s`", f.MatchAgainst.DocCountTable.Name())
	}

	// Get the primary or unique key index for the parent table
	parentIndexes, err := f.MatchAgainst.ParentTable.GetIndexes(ctx)
	if err != nil {
		return nil, err
	}
	var parentIndex sql.Index
	for _, index := range parentIndexes {
		switch f.MatchAgainst.KeyCols.Type {
		case fulltext.KeyType_Primary:
			if index.ID() == "PRIMARY" {
				parentIndex = index
				break
			}
		case fulltext.KeyType_Unique:
			if index.ID() == f.MatchAgainst.KeyCols.Name {
				parentIndex = index
				break
			}
		}
	}
	if parentIndex == nil {
		return nil, fmt.Errorf("Full-Text filter cannot find the index on the table `%s`", f.MatchAgainst.ParentTable.Name())
	}

	return &fulltextFilterTableRowIter{
		matchAgainst:  f.MatchAgainst,
		parser:        parser,
		parentIndex:   parentIndex,
		docCountIndex: docCountIndexes[0],
		parentIter:    nil,
		docCountIter:  nil,
	}, nil
}

// LookupPartitions implements the interface sql.IndexedTable.
func (f *FulltextFilterTable) LookupPartitions(ctx *sql.Context, lookup sql.IndexLookup) (sql.PartitionIter, error) {
	return f.Partitions(ctx)
}

// fulltextFilterTablePartition is a partition that is used exclusively by FulltextFilterTable.
type fulltextFilterTablePartition struct{}

var _ sql.Partition = fulltextFilterTablePartition{}

// Key implements the interface sql.Partition.
func (f fulltextFilterTablePartition) Key() []byte {
	return nil
}

// fulltextFilterTablePartitionIter is a partition iterator that is used exclusively by FulltextFilterTable.
type fulltextFilterTablePartitionIter struct {
	once bool
}

var _ sql.PartitionIter = (*fulltextFilterTablePartitionIter)(nil)

// Next implements the interface sql.PartitionIter.
func (f *fulltextFilterTablePartitionIter) Next(ctx *sql.Context) (sql.Partition, error) {
	if !f.once {
		f.once = true
		return fulltextFilterTablePartition{}, nil
	}
	return nil, io.EOF
}

// Close implements the interface sql.PartitionIter.
func (f *fulltextFilterTablePartitionIter) Close(*sql.Context) error {
	return nil
}

// fulltextFilterTableRowIter is a row iterator that is used exclusively by FulltextFilterTable. Handles the
// communication between multiple tables to function similarly to a regular indexed table row iterator.
type fulltextFilterTableRowIter struct {
	parentIndex   sql.Index
	docCountIndex sql.Index
	matchAgainst  *expression.MatchAgainst
	parentIter    *sql.TableRowIter
	docCountIter  *sql.TableRowIter
	parser        fulltext.DefaultParser
}

var _ sql.RowIter = (*fulltextFilterTableRowIter)(nil)

// Next implements the interface sql.RowIter.
func (f *fulltextFilterTableRowIter) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		// If we don't have an iterator for the parent table, then we need to get one
		if f.parentIter == nil {
			// If we don't have an iterator for the doc counts, then we need one first before we can iterate the parent
			if f.docCountIter == nil {
				word, reachedTheEnd, err := f.parser.NextUnique(ctx)
				if err != nil {
					return nil, err
				}
				if reachedTheEnd {
					return nil, io.EOF
				}
				lookup := sql.IndexLookup{Ranges: sql.MySQLRangeCollection{{
					sql.ClosedRangeColumnExpr(word, word, f.matchAgainst.DocCountTable.Schema()[0].Type),
				}}, Index: f.docCountIndex}

				docCountData := f.matchAgainst.DocCountTable.IndexedAccess(ctx, lookup)
				if err != nil {
					return nil, err
				}

				partIter, err := docCountData.LookupPartitions(ctx, lookup)
				if err != nil {
					return nil, err
				}

				f.docCountIter = sql.NewTableRowIter(ctx, docCountData, partIter)
			}

			// We have an iterator for the document table, so grab the next row
			docRow, err := f.docCountIter.Next(ctx)
			if err != nil {
				if err == io.EOF {
					if err = f.docCountIter.Close(ctx); err != nil {
						return nil, err
					}
					f.docCountIter = nil
					continue
				}
				return nil, err
			}

			// Get the key so that we may get rows from the parent table
			ranges := make(sql.MySQLRange, len(docRow)-2)
			for i, val := range docRow[1 : len(docRow)-1] {
				ranges[i] = sql.ClosedRangeColumnExpr(val, val, f.matchAgainst.DocCountTable.Schema()[i+1].Type)
			}
			lookup := sql.IndexLookup{Ranges: sql.MySQLRangeCollection{ranges}, Index: f.parentIndex}

			parentData := f.matchAgainst.ParentTable.IndexedAccess(ctx, lookup)
			if err != nil {
				return nil, err
			}

			partIter, err := parentData.LookupPartitions(ctx, lookup)
			if err != nil {
				return nil, err
			}

			f.parentIter = sql.NewTableRowIter(ctx, parentData, partIter)
		}

		// We have an iterator for the parent table, so grab the next row
		parentRow, err := f.parentIter.Next(ctx)
		if err != nil {
			if err == io.EOF {
				if err = f.parentIter.Close(ctx); err != nil {
					return nil, err
				}
				f.parentIter = nil
				continue
			}
			return nil, err
		}
		return parentRow, nil
	}
}

// Close implements the interface sql.RowIter.
func (f *fulltextFilterTableRowIter) Close(ctx *sql.Context) error {
	var err error
	if f.docCountIter != nil {
		if nErr := f.docCountIter.Close(ctx); err == nil {
			err = nErr
		}
		f.docCountIter = nil
	}
	if f.parentIter != nil {
		if nErr := f.parentIter.Close(ctx); err == nil {
			err = nErr
		}
		f.parentIter = nil
	}
	return err
}
