// Copyright 2021 Dolthub, Inc.
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

package plan

import (
	"io"
	"sync"

	"github.com/dolthub/go-mysql-server/sql"
)

// TableEditorIter wraps the given iterator and calls the Begin and Complete functions on the given table.
type TableEditorIter struct {
	inner            sql.RowIter
	errorEncountered error

	once          *sync.Once
	onceCtx       *sql.Context
	openerClosers []sql.EditOpenerCloser
}

var _ sql.RowIter = (*TableEditorIter)(nil)

// NewTableEditorIter returns a new *tableEditorIter by wrapping the given iterator. If the
// "statement_boundaries" session variable is set to false, then the original iterator is returned.
// Each of the |openerClosers| specified will be called to begin, complete, and discard statements as
// needed as the |wrappedIter| is processed.
func NewTableEditorIter(wrappedIter sql.RowIter, openerClosers ...sql.EditOpenerCloser) sql.RowIter {
	return &TableEditorIter{
		once:             &sync.Once{},
		openerClosers:    openerClosers,
		inner:            wrappedIter,
		errorEncountered: nil,
	}
}

// Next implements the interface sql.RowIter.
func (s *TableEditorIter) Next(ctx *sql.Context) (sql.Row, error) {
	s.once.Do(func() {
		for _, openerCloser := range s.openerClosers {
			openerCloser.StatementBegin(ctx)
		}
	})
	row, err := s.inner.Next(ctx)
	if err != nil && err != io.EOF {
		s.errorEncountered = err
		return row, err
	}
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	return row, err
}

// Close implements the interface sql.RowIter.
func (s *TableEditorIter) Close(ctx *sql.Context) error {
	err := s.errorEncountered
	_, ignoreError := err.(sql.IgnorableError)

	if err != nil && !ignoreError {
		for _, openerCloser := range s.openerClosers {
			tempErr := openerCloser.DiscardChanges(ctx, s.errorEncountered)
			if tempErr != nil {
				err = tempErr
			}
		}
	} else {
		for _, openerCloser := range s.openerClosers {
			tempErr := openerCloser.StatementComplete(ctx)
			if tempErr != nil {
				err = tempErr
			}
		}
	}
	if err != nil {
		_ = s.inner.Close(ctx)
	} else {
		err = s.inner.Close(ctx)
	}
	return err
}

func (s *TableEditorIter) InnerIter() sql.RowIter {
	return s.inner
}

type CheckpointingTableEditorIter struct {
	editIter sql.EditOpenerCloser
	inner    sql.RowIter
}

var _ sql.RowIter = (*TableEditorIter)(nil)

// NewCheckpointingTableEditorIter is similar to NewTableEditorIter except that
// it returns an iter that calls BeginStatement and CompleteStatement on |table|
// after every iter of |wrappedIter|. While SLOW, this functionality ensures
// correctness for statements that need to rollback individual statements that
// error such as INSERT IGNORE INTO.
func NewCheckpointingTableEditorIter(wrappedIter sql.RowIter, table sql.EditOpenerCloser) sql.RowIter {
	return &CheckpointingTableEditorIter{
		editIter: table,
		inner:    wrappedIter,
	}
}

func (c CheckpointingTableEditorIter) Next(ctx *sql.Context) (sql.Row, error) {
	c.editIter.StatementBegin(ctx)
	row, err := c.inner.Next(ctx)
	if err != nil && err != io.EOF {
		if dErr := c.editIter.DiscardChanges(ctx, err); dErr != nil {
			return nil, dErr
		}
		return row, err
	}
	if sErr := c.editIter.StatementComplete(ctx); sErr != nil {
		return row, sErr
	}
	return row, err
}

func (c CheckpointingTableEditorIter) InnerIter() sql.RowIter {
	return c.inner
}

func (c CheckpointingTableEditorIter) Close(context *sql.Context) error {
	return c.inner.Close(context)
}
