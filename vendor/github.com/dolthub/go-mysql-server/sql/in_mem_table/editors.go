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

package in_mem_table

import (
	"sync"

	"github.com/dolthub/go-mysql-server/sql"
)

var _ sql.TableEditor = StatementLockingTableEditor{}

type StatementLockingTableEditor struct {
	L sync.Locker
	E sql.TableEditor
}

// StatementBegin implements the sql.TableEditor interface.
func (e StatementLockingTableEditor) StatementBegin(ctx *sql.Context) {
	e.L.Lock()
}

// DiscardChanges implements the sql.TableEditor interface.
func (e StatementLockingTableEditor) DiscardChanges(ctx *sql.Context, errorEncountered error) error {
	defer e.L.Unlock()
	return e.E.DiscardChanges(ctx, errorEncountered)
}

// StatementComplete implements the sql.TableEditor interface.
func (e StatementLockingTableEditor) StatementComplete(ctx *sql.Context) error {
	defer e.L.Unlock()
	return e.E.StatementComplete(ctx)
}

// Insert implements the sql.RowInserter interface.
func (e StatementLockingTableEditor) Insert(ctx *sql.Context, row sql.Row) error {
	return e.E.Insert(ctx, row)
}

// Update implements the sql.RowUpdater interface.
func (e StatementLockingTableEditor) Update(ctx *sql.Context, old sql.Row, new sql.Row) error {
	return e.E.Update(ctx, old, new)
}

// Delete implements the sql.RowDeleter interface.
func (e StatementLockingTableEditor) Delete(ctx *sql.Context, row sql.Row) error {
	return e.E.Delete(ctx, row)
}

// Close implements the sql.Closer interface.
func (e StatementLockingTableEditor) Close(ctx *sql.Context) error {
	return e.E.Close(ctx)
}

type OperationLockingTableEditor struct {
	L sync.Locker
	E sql.TableEditor
}

// StatementBegin implements the sql.TableEditor interface.
func (e OperationLockingTableEditor) StatementBegin(ctx *sql.Context) {
	e.E.StatementBegin(ctx)
}

// DiscardChanges implements the sql.TableEditor interface.
func (e OperationLockingTableEditor) DiscardChanges(ctx *sql.Context, errorEncountered error) error {
	return e.E.DiscardChanges(ctx, errorEncountered)
}

// OperationComplete implements the sql.TableEditor interface.
func (e OperationLockingTableEditor) StatementComplete(ctx *sql.Context) error {
	return e.E.StatementComplete(ctx)
}

// Insert implements the sql.RowInserter interface.
func (e OperationLockingTableEditor) Insert(ctx *sql.Context, row sql.Row) error {
	e.L.Lock()
	defer e.L.Unlock()
	return e.E.Insert(ctx, row)
}

// Update implements the sql.RowUpdater interface.
func (e OperationLockingTableEditor) Update(ctx *sql.Context, old sql.Row, new sql.Row) error {
	e.L.Lock()
	defer e.L.Unlock()
	return e.E.Update(ctx, old, new)
}

// Delete implements the sql.RowDeleter interface.
func (e OperationLockingTableEditor) Delete(ctx *sql.Context, row sql.Row) error {
	e.L.Lock()
	defer e.L.Unlock()
	return e.E.Delete(ctx, row)
}

// Close implements the sql.Closer interface.
func (e OperationLockingTableEditor) Close(ctx *sql.Context) error {
	return e.E.Close(ctx)
}
