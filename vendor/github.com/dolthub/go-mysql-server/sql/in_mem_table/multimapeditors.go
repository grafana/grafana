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
	"errors"

	"github.com/dolthub/go-mysql-server/sql"
)

// Given operations for converting an IndexedSet entry into a sql.Row, these
// editors converted and IndexedSet into a table editor.
//
// These editors treat the first first Keyer in the IndexedSet as a primary
// key. It is an internal coding error if other operations on the IndexedSet
// result in multiple entries for a single key for entries keyed by the first
// keyer.

type ValueOps[V any] struct {
	ToRow         func(*sql.Context, V) (sql.Row, error)
	FromRow       func(*sql.Context, sql.Row) (V, error)
	UpdateWithRow func(*sql.Context, sql.Row, V) (V, error)
}

func Insert[V any](ctx *sql.Context, ops *ValueOps[V], is IndexedSet[V], row sql.Row) error {
	e, err := ops.FromRow(ctx, row)
	if err != nil {
		return err
	}
	ek := is.Keyers[0].GetKey(e)
	if es := is.GetMany(is.Keyers[0], ek); len(es) != 0 {
		return sql.ErrPrimaryKeyViolation.New()
	}
	is.Put(e)
	return nil
}

func Delete[V any](ctx *sql.Context, ops *ValueOps[V], is IndexedSet[V], row sql.Row) error {
	e, err := ops.FromRow(ctx, row)
	if err != nil {
		return err
	}
	ek := is.Keyers[0].GetKey(e)
	is.RemoveMany(is.Keyers[0], ek)
	return nil
}

func Update[V any](ctx *sql.Context, ops *ValueOps[V], is IndexedSet[V], old, new sql.Row) error {
	e, err := ops.FromRow(ctx, old)
	if err != nil {
		return err
	}
	ek := is.Keyers[0].GetKey(e)
	es := is.GetMany(is.Keyers[0], ek)
	if len(es) == 1 {
		old := e
		e := es[0]
		e, err = ops.UpdateWithRow(ctx, new, e)
		if err != nil {
			return err
		}
		is.Remove(old)
		is.Put(e)
	} else {
		e, err = ops.FromRow(ctx, new)
		if err != nil {
			return err
		}
		for _, old := range es {
			is.Remove(old)
		}
		is.Put(e)
	}
	return nil
}

var _ sql.TableEditor = (*IndexedSetTableEditor[string])(nil)

type IndexedSetTableEditor[V any] struct {
	Ops ValueOps[V]
	Set IndexedSet[V]
}

func (e *IndexedSetTableEditor[V]) StatementBegin(ctx *sql.Context) {
}

func (e *IndexedSetTableEditor[V]) DiscardChanges(ctx *sql.Context, cause error) error {
	return nil
}

func (e *IndexedSetTableEditor[V]) StatementComplete(ctx *sql.Context) error {
	return nil
}

func (e *IndexedSetTableEditor[V]) Close(ctx *sql.Context) error {
	return nil
}

func (e *IndexedSetTableEditor[V]) Insert(ctx *sql.Context, row sql.Row) error {
	return Insert[V](ctx, &e.Ops, e.Set, row)
}

func (e *IndexedSetTableEditor[V]) Delete(ctx *sql.Context, row sql.Row) error {
	return Delete[V](ctx, &e.Ops, e.Set, row)
}

func (e *IndexedSetTableEditor[V]) Update(ctx *sql.Context, old, new sql.Row) error {
	return Update[V](ctx, &e.Ops, e.Set, old, new)
}

type MultiValueOps[V any] struct {
	ToRows    func(*sql.Context, V) ([]sql.Row, error)
	FromRow   func(*sql.Context, sql.Row) (V, error)
	AddRow    func(*sql.Context, sql.Row, V) (V, error)
	DeleteRow func(*sql.Context, sql.Row, V) (V, error)
}

var ErrEntryNotFound = errors.New("cannot insert row; matching entry not found")

func MultiInsert[V any](ctx *sql.Context, ops *MultiValueOps[V], is IndexedSet[V], row sql.Row) error {
	e, err := ops.FromRow(ctx, row)
	if err != nil {
		return err
	}
	ek := is.Keyers[0].GetKey(e)
	es := is.GetMany(is.Keyers[0], ek)
	if len(es) != 1 {
		return ErrEntryNotFound
	}
	newE, err := ops.AddRow(ctx, row, es[0])
	if err != nil {
		return err
	}
	is.Remove(es[0])
	is.Put(newE)
	return nil
}

func MultiDelete[V any](ctx *sql.Context, ops *MultiValueOps[V], is IndexedSet[V], row sql.Row) error {
	e, err := ops.FromRow(ctx, row)
	if err != nil {
		return err
	}
	ek := is.Keyers[0].GetKey(e)
	es := is.GetMany(is.Keyers[0], ek)
	if len(es) != 1 {
		return ErrEntryNotFound
	}
	newE, err := ops.DeleteRow(ctx, row, es[0])
	if err != nil {
		return err
	}
	is.Remove(es[0])
	is.Put(newE)
	return nil
}

func MultiUpdate[V any](ctx *sql.Context, ops *MultiValueOps[V], is IndexedSet[V], old, new sql.Row) error {
	err := MultiDelete[V](ctx, ops, is, old)
	if err != nil {
		return err
	}
	return MultiInsert(ctx, ops, is, new)
}

var _ sql.TableEditor = (*MultiIndexedSetTableEditor[string])(nil)

type MultiIndexedSetTableEditor[V any] struct {
	Ops MultiValueOps[V]
	Set IndexedSet[V]
}

func (e *MultiIndexedSetTableEditor[V]) StatementBegin(ctx *sql.Context) {
}

func (e *MultiIndexedSetTableEditor[V]) DiscardChanges(ctx *sql.Context, cause error) error {
	return nil
}

func (e *MultiIndexedSetTableEditor[V]) StatementComplete(ctx *sql.Context) error {
	return nil
}

func (e *MultiIndexedSetTableEditor[V]) Close(ctx *sql.Context) error {
	return nil
}

func (e *MultiIndexedSetTableEditor[V]) Insert(ctx *sql.Context, row sql.Row) error {
	return MultiInsert[V](ctx, &e.Ops, e.Set, row)
}

func (e *MultiIndexedSetTableEditor[V]) Delete(ctx *sql.Context, row sql.Row) error {
	return MultiDelete[V](ctx, &e.Ops, e.Set, row)
}

func (e *MultiIndexedSetTableEditor[V]) Update(ctx *sql.Context, old, new sql.Row) error {
	return MultiUpdate[V](ctx, &e.Ops, e.Set, old, new)
}
