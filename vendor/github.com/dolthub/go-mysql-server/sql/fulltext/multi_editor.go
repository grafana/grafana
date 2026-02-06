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

package fulltext

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
)

// MultiTableEditor wraps multiple table editors, allowing for a single function to handle writes across multiple tables.
type MultiTableEditor struct {
	primary     sql.TableEditor
	secondaries []sql.TableEditor
}

var _ sql.TableEditor = MultiTableEditor{}
var _ sql.ForeignKeyEditor = MultiTableEditor{}
var _ sql.AutoIncrementSetter = MultiTableEditor{}

// CreateMultiTableEditor creates a TableEditor that writes to both the primary and secondary editors. The primary
// editor must implement ForeignKeyEditor and AutoIncrementSetter in addition to TableEditor.
func CreateMultiTableEditor(ctx *sql.Context, primary sql.TableEditor, secondaries ...sql.TableEditor) (sql.TableEditor, error) {
	if _, ok := primary.(sql.ForeignKeyEditor); !ok {
		return nil, fmt.Errorf("cannot create a MultiTableEditor with a primary editor that does not implement ForeignKeyEditor")
	}
	if _, ok := primary.(sql.AutoIncrementSetter); !ok {
		return nil, fmt.Errorf("cannot create a MultiTableEditor with a primary editor that does not implement AutoIncrementSetter")
	}
	return MultiTableEditor{
		primary:     primary,
		secondaries: secondaries,
	}, nil
}

// PrimaryEditor returns the primary editor.
func (editor MultiTableEditor) PrimaryEditor() sql.TableEditor {
	return editor.primary
}

// SecondaryEditors returns the secondary editors.
func (editor MultiTableEditor) SecondaryEditors() []sql.TableEditor {
	return editor.secondaries
}

// StatementBegin implements the interface sql.TableEditor.
func (editor MultiTableEditor) StatementBegin(ctx *sql.Context) {
	for _, secondary := range editor.secondaries {
		secondary.StatementBegin(ctx)
	}
	editor.primary.StatementBegin(ctx)
}

// DiscardChanges implements the interface sql.TableEditor.
func (editor MultiTableEditor) DiscardChanges(ctx *sql.Context, errorEncountered error) error {
	var err error
	for _, secondary := range editor.secondaries {
		if nErr := secondary.DiscardChanges(ctx, errorEncountered); err == nil {
			err = nErr
		}
	}
	if nErr := editor.primary.DiscardChanges(ctx, errorEncountered); err == nil {
		err = nErr
	}
	return err
}

// StatementComplete implements the interface sql.TableEditor.
func (editor MultiTableEditor) StatementComplete(ctx *sql.Context) error {
	var err error
	for _, secondary := range editor.secondaries {
		if nErr := secondary.StatementComplete(ctx); err == nil {
			err = nErr
		}
	}
	if nErr := editor.primary.StatementComplete(ctx); err == nil {
		err = nErr
	}
	return err
}

// Insert implements the interface sql.TableEditor.
func (editor MultiTableEditor) Insert(ctx *sql.Context, row sql.Row) error {
	for _, secondary := range editor.secondaries {
		if err := secondary.Insert(ctx, row); err != nil {
			return err
		}
	}
	return editor.primary.Insert(ctx, row)
}

// Update implements the interface sql.TableEditor.
func (editor MultiTableEditor) Update(ctx *sql.Context, old sql.Row, new sql.Row) error {
	for _, secondary := range editor.secondaries {
		if err := secondary.Update(ctx, old, new); err != nil {
			return err
		}
	}
	return editor.primary.Update(ctx, old, new)
}

// Delete implements the interface sql.TableEditor.
func (editor MultiTableEditor) Delete(ctx *sql.Context, row sql.Row) error {
	for _, secondary := range editor.secondaries {
		if err := secondary.Delete(ctx, row); err != nil {
			return err
		}
	}
	return editor.primary.Delete(ctx, row)
}

// IndexedAccess implements the interface ForeignKeyEditor.
func (editor MultiTableEditor) IndexedAccess(ctx *sql.Context, lookup sql.IndexLookup) sql.IndexedTable {
	return editor.primary.(sql.ForeignKeyEditor).IndexedAccess(ctx, lookup)
}

func (editor MultiTableEditor) PreciseMatch() bool {
	return true
}

// GetIndexes implements the interface ForeignKeyEditor.
func (editor MultiTableEditor) GetIndexes(ctx *sql.Context) ([]sql.Index, error) {
	return editor.primary.(sql.ForeignKeyEditor).GetIndexes(ctx)
}

// SetAutoIncrementValue implements the interface AutoIncrementSetter.
func (editor MultiTableEditor) SetAutoIncrementValue(ctx *sql.Context, u uint64) error {
	return editor.primary.(sql.AutoIncrementSetter).SetAutoIncrementValue(ctx, u)
}

func (editor MultiTableEditor) AcquireAutoIncrementLock(ctx *sql.Context) (func(), error) {
	// TODO: Add concurrency tests for AutoIncrement locking modes.
	return func() {}, nil
}

// Close implements the interface sql.TableEditor.
func (editor MultiTableEditor) Close(ctx *sql.Context) error {
	var err error
	for _, secondary := range editor.secondaries {
		if nErr := secondary.Close(ctx); err == nil {
			err = nErr
		}
	}
	if nErr := editor.primary.Close(ctx); err == nil {
		err = nErr
	}
	return err
}
