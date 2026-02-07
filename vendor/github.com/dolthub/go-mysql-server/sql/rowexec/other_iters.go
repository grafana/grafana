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
	"io"
	"sync"

	"github.com/dolthub/go-mysql-server/sql/hash"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

type analyzeTableIter struct {
	stats  sql.StatsProvider
	db     string
	tables []sql.Table
	idx    int
}

var _ sql.RowIter = &analyzeTableIter{}

func (itr *analyzeTableIter) Next(ctx *sql.Context) (sql.Row, error) {
	if itr.idx >= len(itr.tables) {
		return nil, io.EOF
	}

	t := itr.tables[itr.idx]

	msgType := "status"
	msgText := "OK"
	err := itr.stats.AnalyzeTable(ctx, t, itr.db)
	if err != nil {
		msgType = "Error"
		msgText = err.Error()
	}
	itr.idx++
	return sql.Row{t.Name(), "analyze", msgType, msgText}, nil
}

func (itr *analyzeTableIter) Close(ctx *sql.Context) error {
	return nil
}

type updateHistogramIter struct {
	stats   sql.Statistic
	prov    sql.StatsProvider
	db      string
	table   string
	columns []string
	done    bool
}

var _ sql.RowIter = &updateHistogramIter{}

func (itr *updateHistogramIter) Next(ctx *sql.Context) (sql.Row, error) {
	if itr.done {
		return nil, io.EOF
	}
	defer func() {
		itr.done = true
	}()
	err := itr.prov.SetStats(ctx, itr.stats)
	if err != nil {
		return sql.Row{itr.table, "histogram", "error", err.Error()}, nil
	}
	return sql.Row{itr.table, "histogram", "status", "OK"}, nil
}

func (itr *updateHistogramIter) Close(_ *sql.Context) error {
	return nil
}

type dropHistogramIter struct {
	prov    sql.StatsProvider
	db      string
	schema  string
	table   string
	columns []string
	done    bool
}

var _ sql.RowIter = &dropHistogramIter{}

func (itr *dropHistogramIter) Next(ctx *sql.Context) (sql.Row, error) {
	if itr.done {
		return nil, io.EOF
	}
	defer func() {
		itr.done = true
	}()
	qual := sql.NewStatQualifier(itr.db, itr.schema, itr.table, "")
	err := itr.prov.DropStats(ctx, qual, itr.columns)
	if err != nil {
		return sql.Row{itr.table, "histogram", "error", err.Error()}, nil
	}
	return sql.Row{itr.table, "histogram", "status", "OK"}, nil
}

func (itr *dropHistogramIter) Close(_ *sql.Context) error {
	return nil
}

// blockIter is a sql.RowIter that iterates over the given rows.
type blockIter struct {
	internalIter sql.RowIter
	repNode      sql.Node
	repIter      sql.RowIter
	repSch       sql.Schema
}

var _ plan.BlockRowIter = (*blockIter)(nil)

// Next implements the sql.RowIter interface.
func (i *blockIter) Next(ctx *sql.Context) (sql.Row, error) {
	return i.internalIter.Next(ctx)
}

// Close implements the sql.RowIter interface.
func (i *blockIter) Close(ctx *sql.Context) error {
	return i.internalIter.Close(ctx)
}

// RepresentingNode implements the sql.BlockRowIter interface.
func (i *blockIter) RepresentingNode() sql.Node {
	return i.repNode
}

// Schema implements the sql.BlockRowIter interface.
func (i *blockIter) Schema() sql.Schema {
	return i.repSch
}

type prependRowIter struct {
	childIter sql.RowIter
	row       sql.Row
}

func (p *prependRowIter) Next(ctx *sql.Context) (sql.Row, error) {
	next, err := p.childIter.Next(ctx)
	if err != nil {
		return next, err
	}
	return p.row.Append(next), nil
}

func (p *prependRowIter) Close(ctx *sql.Context) error {
	return p.childIter.Close(ctx)
}

type cachedResultsIter struct {
	parent  *plan.CachedResults
	iter    sql.RowIter
	cache   sql.RowsCache
	dispose sql.DisposeFunc
}

func (i *cachedResultsIter) Next(ctx *sql.Context) (sql.Row, error) {
	r, err := i.iter.Next(ctx)
	if i.cache != nil {
		if err != nil {
			if err == io.EOF {
				i.saveResultsInGlobalCache()
				i.parent.Finalized = true
			}
			i.cleanUp()
		} else {
			aerr := i.cache.Add(r)
			if aerr != nil {
				i.cleanUp()
				i.parent.Mutex.Lock()
				defer i.parent.Mutex.Unlock()
				i.parent.NoCache = true
			}
		}
	}
	return r, err
}

func (i *cachedResultsIter) saveResultsInGlobalCache() {
	if plan.CachedResultsGlobalCache.AddNewCache(i.parent.Id, i.cache, i.dispose) {
		i.cache = nil
		i.dispose = nil
	}
}

func (i *cachedResultsIter) cleanUp() {
	if i.dispose != nil {
		i.dispose()
		i.cache = nil
		i.dispose = nil
	}
}

func (i *cachedResultsIter) Close(ctx *sql.Context) error {
	i.cleanUp()
	return i.iter.Close(ctx)
}

type hashLookupGeneratingIter struct {
	n         *plan.HashLookup
	childIter sql.RowIter
	lookup    *map[interface{}][]sql.Row
}

func newHashLookupGeneratingIter(n *plan.HashLookup, chlidIter sql.RowIter) *hashLookupGeneratingIter {
	h := &hashLookupGeneratingIter{
		n:         n,
		childIter: chlidIter,
	}
	lookup := make(map[interface{}][]sql.Row)
	h.lookup = &lookup
	return h
}

func (h *hashLookupGeneratingIter) Next(ctx *sql.Context) (sql.Row, error) {
	childRow, err := h.childIter.Next(ctx)
	if err == io.EOF {
		// We wait until we finish the child iter before caching the Lookup map.
		// This is because some plans may not fully exhaust the iterator.
		h.n.Lookup = h.lookup
		return nil, io.EOF
	}
	if err != nil {
		return nil, err
	}
	// TODO: Maybe do not put nil stuff in here.
	key, err := h.n.GetHashKey(ctx, h.n.RightEntryKey, childRow)
	if err != nil {
		return nil, err
	}
	(*(h.lookup))[key] = append((*(h.lookup))[key], childRow)
	return childRow, nil
}

func (h *hashLookupGeneratingIter) Close(c *sql.Context) error {
	return nil
}

var _ sql.RowIter = (*hashLookupGeneratingIter)(nil)

// declareCursorIter is the sql.RowIter of *DeclareCursor.
type declareCursorIter struct {
	*plan.DeclareCursor
}

var _ sql.RowIter = (*declareCursorIter)(nil)

// Next implements the interface sql.RowIter.
func (d *declareCursorIter) Next(ctx *sql.Context) (sql.Row, error) {
	if err := d.Pref.InitializeCursor(d.Name, d.Select); err != nil {
		return nil, err
	}
	return nil, io.EOF
}

// Close implements the interface sql.RowIter.
func (d *declareCursorIter) Close(ctx *sql.Context) error {
	return nil
}

type releaseIter struct {
	child   sql.RowIter
	release func()
	once    sync.Once
}

func (i *releaseIter) Next(ctx *sql.Context) (sql.Row, error) {
	row, err := i.child.Next(ctx)
	if err != nil {
		_ = i.Close(ctx)
		return nil, err
	}
	return row, nil
}

func (i *releaseIter) Close(ctx *sql.Context) (err error) {
	i.once.Do(i.release)
	if i.child != nil {
		err = i.child.Close(ctx)
	}
	return err
}

type concatIter struct {
	cur      sql.RowIter
	inLeft   sql.KeyValueCache
	dispose  sql.DisposeFunc
	nextIter func() (sql.RowIter, error)
}

func newConcatIter(ctx *sql.Context, cur sql.RowIter, nextIter func() (sql.RowIter, error)) *concatIter {
	seen, dispose := ctx.Memory.NewHistoryCache()
	return &concatIter{
		cur,
		seen,
		dispose,
		nextIter,
	}
}

var _ sql.Disposable = (*concatIter)(nil)
var _ sql.RowIter = (*concatIter)(nil)

func (ci *concatIter) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		res, err := ci.cur.Next(ctx)
		if err == io.EOF {
			if ci.nextIter == nil {
				return nil, io.EOF
			}
			err = ci.cur.Close(ctx)
			if err != nil {
				return nil, err
			}
			ci.cur, err = ci.nextIter()
			ci.nextIter = nil
			if err != nil {
				return nil, err
			}
			res, err = ci.cur.Next(ctx)
		}
		if err != nil {
			return nil, err
		}
		hash, err := hash.HashOf(ctx, nil, res)
		if err != nil {
			return nil, err
		}
		if ci.nextIter != nil {
			// On Left
			if err := ci.inLeft.Put(hash, struct{}{}); err != nil {
				return nil, err
			}
		} else {
			// On Right
			if _, err := ci.inLeft.Get(hash); err == nil {
				continue
			}
		}
		return res, err
	}
}

func (ci *concatIter) Dispose() {
	ci.dispose()
}

func (ci *concatIter) Close(ctx *sql.Context) error {
	ci.Dispose()
	if ci.cur != nil {
		return ci.cur.Close(ctx)
	} else {
		return nil
	}
}

type stripRowIter struct {
	sql.RowIter
	numCols int
}

func (sri *stripRowIter) Next(ctx *sql.Context) (sql.Row, error) {
	r, err := sri.RowIter.Next(ctx)
	if err != nil {
		return nil, err
	}
	return r[sri.numCols:], nil
}

func (sri *stripRowIter) Close(ctx *sql.Context) error {
	return sri.RowIter.Close(ctx)
}
