// Copyright 2024 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package iters

import (
	"container/heap"
	"fmt"
	"io"
	"sort"

	"github.com/dolthub/jsonpath"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/hash"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type topRowsIter struct {
	childIter     sql.RowIter
	sortFields    sql.SortFields
	topRows       []sql.Row
	idx           int
	limit         int64
	numFoundRows  int64
	calcFoundRows bool
}

func NewTopRowsIter(s sql.SortFields, limit int64, calcFoundRows bool, child sql.RowIter, childSchemaLen int) *topRowsIter {
	return &topRowsIter{
		sortFields:    append(s, sql.SortField{Column: expression.NewGetField(childSchemaLen, types.Int64, "order", false)}),
		limit:         limit,
		calcFoundRows: calcFoundRows,
		childIter:     child,
		idx:           -1,
	}
}

func (i *topRowsIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.idx == -1 {
		err := i.computeTopRows(ctx)
		if err != nil {
			return nil, err
		}
		i.idx = 0
	}

	if i.idx >= len(i.topRows) {
		return nil, io.EOF
	}
	row := i.topRows[i.idx]
	i.idx++
	return row[:len(row)-1], nil
}

func (i *topRowsIter) Close(ctx *sql.Context) error {
	i.topRows = nil

	if i.calcFoundRows {
		ctx.SetLastQueryInfoInt(sql.FoundRows, i.numFoundRows)
	}

	return i.childIter.Close(ctx)
}

func (i *topRowsIter) computeTopRows(ctx *sql.Context) error {
	topRowsHeap := &expression.TopRowsHeap{
		Sorter: expression.Sorter{
			SortFields: i.sortFields,
			Rows:       []sql.Row{},
			LastError:  nil,
			Ctx:        ctx,
		},
	}
	for {
		row, err := i.childIter.Next(ctx)
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		i.numFoundRows++

		row = append(row, i.numFoundRows)

		heap.Push(topRowsHeap, row)
		if int64(topRowsHeap.Len()) > i.limit {
			heap.Pop(topRowsHeap)
		}
		if topRowsHeap.LastError != nil {
			return topRowsHeap.LastError
		}
	}

	var err error
	i.topRows, err = topRowsHeap.Rows()
	return err
}

// GetInt64Value returns the int64 literal value in the expression given, or an error with the errStr given if it
// cannot.
func GetInt64Value(ctx *sql.Context, expr sql.Expression) (int64, error) {
	i, err := expr.Eval(ctx, nil)
	if err != nil {
		return 0, err
	}

	switch i := i.(type) {
	case int:
		return int64(i), nil
	case int8:
		return int64(i), nil
	case int16:
		return int64(i), nil
	case int32:
		return int64(i), nil
	case int64:
		return i, nil
	case uint:
		return int64(i), nil
	case uint8:
		return int64(i), nil
	case uint16:
		return int64(i), nil
	case uint32:
		return int64(i), nil
	case uint64:
		return int64(i), nil
	default:
		// analyzer should catch this already
		panic(fmt.Sprintf("Unsupported type for limit %T", i))
	}
}

type JsonTableColOpts struct {
	Typ       sql.Type
	DefErrVal interface{}
	DefEmpVal interface{}
	Name      string
	ForOrd    bool
	Exists    bool
	ErrOnErr  bool
	ErrOnEmp  bool
}

// JsonTableCol represents a column in a json table.
type JsonTableCol struct {
	err      error
	Opts     *JsonTableColOpts
	Path     string          // if there are nested columns, this is a schema Path, otherwise it is a col Path
	Cols     []*JsonTableCol // nested columns
	data     []interface{}
	pos      int
	currSib  int
	finished bool // exhausted all rows in data
}

// IsSibling returns if the jsonTableCol contains multiple columns
func (c *JsonTableCol) IsSibling() bool {
	return len(c.Cols) != 0
}

// NextSibling starts at the current sibling and moves to the next unfinished sibling
// if there are no more unfinished siblings, it sets c.currSib to the first sibling and returns true
// if the c.currSib is unfinished, nothing changes
func (c *JsonTableCol) NextSibling() bool {
	for i := c.currSib; i < len(c.Cols); i++ {
		if c.Cols[i].IsSibling() && !c.Cols[i].finished {
			c.currSib = i
			return false
		}
	}
	c.currSib = 0
	for i := 0; i < len(c.Cols); i++ {
		if c.Cols[i].IsSibling() {
			c.currSib = i
			break
		}
	}
	return true
}

// LoadData loads the data for this column from the given object and c.path
// LoadData will always wrap the data in a slice to ensure it is iterable
// Additionally, this function will set the c.currSib to the first sibling
func (c *JsonTableCol) LoadData(obj interface{}) {
	var data interface{}
	data, c.err = jsonpath.JsonPathLookup(obj, c.Path)
	if d, ok := data.([]interface{}); ok {
		c.data = d
	} else {
		c.data = []interface{}{data}
	}
	c.pos = 0

	c.NextSibling()
}

// Reset clears the column's data and error, and recursively resets all nested columns
func (c *JsonTableCol) Reset() {
	c.data, c.err = nil, nil
	c.finished = false
	for _, col := range c.Cols {
		col.Reset()
	}
}

// Next returns the next row for this column.
func (c *JsonTableCol) Next(ctx *sql.Context, obj interface{}, pass bool, ord int) (sql.Row, error) {
	// nested column should recurse
	if len(c.Cols) != 0 {
		if c.data == nil {
			c.LoadData(obj)
		}

		var innerObj interface{}
		if !c.finished {
			innerObj = c.data[c.pos]
		}

		var row sql.Row
		for i, col := range c.Cols {
			innerPass := len(col.Cols) != 0 && i != c.currSib
			rowPart, err := col.Next(ctx, innerObj, pass || innerPass, c.pos+1)
			if err != nil {
				return nil, err
			}
			row = append(row, rowPart...)
		}

		if pass {
			return row, nil
		}

		if c.NextSibling() {
			for _, col := range c.Cols {
				col.Reset()
			}
			c.pos++
		}

		if c.pos >= len(c.data) {
			c.finished = true
		}

		return row, nil
	}

	// this should only apply to nested columns, maybe...
	if pass {
		return sql.Row{nil}, nil
	}

	// FOR ORDINAL is a special case
	if c.Opts != nil && c.Opts.ForOrd {
		return sql.Row{ord}, nil
	}

	// TODO: cache this?
	val, err := jsonpath.JsonPathLookup(obj, c.Path)
	if c.Opts.Exists {
		if err != nil {
			return sql.Row{0}, nil
		} else {
			return sql.Row{1}, nil
		}
	}

	// key error means empty
	if err != nil {
		if c.Opts.ErrOnEmp {
			return nil, fmt.Errorf("missing value for JSON_TABLE column '%s'", c.Opts.Name)
		}
		val = c.Opts.DefEmpVal
	}

	val, _, err = c.Opts.Typ.Convert(ctx, val)
	if err != nil {
		if c.Opts.ErrOnErr {
			if sql.ErrTruncatedIncorrect.Is(err) {
				return nil, sql.ErrInvalidJSONText.New(c.pos+1, "JSON_TABLE", "Invalid value.")
			}
			return nil, sql.ErrInvalidJSONText.New(c.pos+1, "JSON_TABLE", err.Error())
		}
		val, _, err = c.Opts.Typ.Convert(ctx, c.Opts.DefErrVal)
		if err != nil {
			if sql.ErrTruncatedIncorrect.Is(err) {
				return nil, sql.ErrInvalidJSONText.New(c.pos+1, "JSON_TABLE", "Invalid value.")
			}
			return nil, sql.ErrInvalidJSONText.New(c.pos+1, "JSON_TABLE", err.Error())
		}
	}

	// Base columns are always finished
	c.finished = true
	return sql.Row{val}, nil
}

type JsonTableRowIter struct {
	Data    []interface{}
	Cols    []*JsonTableCol
	pos     int
	currSib int
}

// NextSibling starts at the current sibling and moves to the next unfinished sibling
// if there are no more unfinished siblings, it resets to the first sibling
func (j *JsonTableRowIter) NextSibling() bool {
	for i := j.currSib; i < len(j.Cols); i++ {
		if !j.Cols[i].finished && len(j.Cols[i].Cols) != 0 {
			j.currSib = i
			return false
		}
	}
	j.currSib = 0
	for i := 0; i < len(j.Cols); i++ {
		if len(j.Cols[i].Cols) != 0 {
			j.currSib = i
			break
		}
	}
	return true
}

func (j *JsonTableRowIter) ResetAll() {
	for _, col := range j.Cols {
		col.Reset()
	}
}

func (j *JsonTableRowIter) Next(ctx *sql.Context) (sql.Row, error) {
	if j.pos >= len(j.Data) {
		return nil, io.EOF
	}
	obj := j.Data[j.pos]

	var row sql.Row
	for i, col := range j.Cols {
		pass := len(col.Cols) != 0 && i != j.currSib
		rowPart, err := col.Next(ctx, obj, pass, j.pos+1)
		if err != nil {
			return nil, err
		}
		row = append(row, rowPart...)
	}

	if j.NextSibling() {
		j.ResetAll()
		j.pos++
	}

	return row, nil
}

func (j *JsonTableRowIter) Close(ctx *sql.Context) error {
	return nil
}

// orderedDistinctIter iterates the children iterator and skips all the
// repeated rows assuming the iterator has all rows sorted.
type orderedDistinctIter struct {
	childIter sql.RowIter
	schema    sql.Schema
	prevRow   sql.Row
}

func NewOrderedDistinctIter(child sql.RowIter, schema sql.Schema) *orderedDistinctIter {
	return &orderedDistinctIter{childIter: child, schema: schema}
}

func (di *orderedDistinctIter) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		row, err := di.childIter.Next(ctx)
		if err != nil {
			return nil, err
		}

		if di.prevRow != nil {
			ok, err := di.prevRow.Equals(ctx, row, di.schema)
			if err != nil {
				return nil, err
			}

			if ok {
				continue
			}
		}

		di.prevRow = row
		return row, nil
	}
}

func (di *orderedDistinctIter) Close(ctx *sql.Context) error {
	return di.childIter.Close(ctx)
}

// TODO a queue is probably more optimal
type RecursiveTableIter struct {
	Buf []sql.Row
	pos int
}

var _ sql.RowIter = (*RecursiveTableIter)(nil)

func (r *RecursiveTableIter) Next(ctx *sql.Context) (sql.Row, error) {
	if r.Buf == nil || r.pos >= len(r.Buf) {
		return nil, io.EOF
	}
	r.pos++
	return r.Buf[r.pos-1], nil
}

func (r *RecursiveTableIter) Close(ctx *sql.Context) error {
	r.Buf = nil
	return nil
}

type LimitIter struct {
	ChildIter     sql.RowIter
	currentPos    int64
	Limit         int64
	CalcFoundRows bool
}

func (li *LimitIter) Next(ctx *sql.Context) (sql.Row, error) {
	if li.currentPos >= li.Limit {
		// If we were asked to calc all found rows, then when we are past the limit we iterate over the rest of the
		// result set to count it
		if li.CalcFoundRows {
			for {
				_, err := li.ChildIter.Next(ctx)
				if err != nil {
					return nil, err
				}
				li.currentPos++
			}
		}

		return nil, io.EOF
	}

	childRow, err := li.ChildIter.Next(ctx)
	if err != nil {
		return nil, err
	}
	li.currentPos++

	return childRow, nil
}

func (li *LimitIter) Close(ctx *sql.Context) error {
	err := li.ChildIter.Close(ctx)
	if err != nil {
		return err
	}

	if li.CalcFoundRows {
		ctx.SetLastQueryInfoInt(sql.FoundRows, li.currentPos)
	}
	return nil
}

type sortIter struct {
	sortFields sql.SortFields
	childIter  sql.RowIter
	sortedRows []sql.Row
	idx        int
}

var _ sql.RowIter = (*sortIter)(nil)

func NewSortIter(s sql.SortFields, child sql.RowIter) *sortIter {
	return &sortIter{
		sortFields: s,
		childIter:  child,
		idx:        -1,
	}
}

func (i *sortIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.idx == -1 {
		err := i.computeSortedRows(ctx)
		if err != nil {
			return nil, err
		}
		i.idx = 0
	}

	if i.idx >= len(i.sortedRows) {
		return nil, io.EOF
	}
	row := i.sortedRows[i.idx]
	i.idx++
	return row, nil
}

func (i *sortIter) Close(ctx *sql.Context) error {
	i.sortedRows = nil
	return i.childIter.Close(ctx)
}

func (i *sortIter) computeSortedRows(ctx *sql.Context) error {
	cache, dispose := ctx.Memory.NewRowsCache()
	defer dispose()

	for {
		row, err := i.childIter.Next(ctx)

		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		if err := cache.Add(row); err != nil {
			return err
		}
	}

	rows := cache.Get()
	sorter := &expression.Sorter{
		SortFields: i.sortFields,
		Rows:       rows,
		LastError:  nil,
		Ctx:        ctx,
	}
	sort.Stable(sorter)
	if sorter.LastError != nil {
		return sorter.LastError
	}
	i.sortedRows = rows
	return nil
}

// distinctIter keeps track of the hashes of all rows that have been emitted.
// It does not emit any rows whose hashes have been seen already.
// TODO: come up with a way to use less memory than keeping all hashes in memory.
// Even though they are just 64-bit integers, this could be a problem in large
// result sets.
type distinctIter struct {
	childIter   sql.RowIter
	seen        sql.KeyValueCache
	DisposeFunc sql.DisposeFunc
}

func NewDistinctIter(ctx *sql.Context, child sql.RowIter) *distinctIter {
	cache, dispose := ctx.Memory.NewHistoryCache()
	return &distinctIter{
		childIter:   child,
		seen:        cache,
		DisposeFunc: dispose,
	}
}

func (di *distinctIter) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		row, err := di.childIter.Next(ctx)
		if err != nil {
			if err == io.EOF {
				di.Dispose()
			}
			return nil, err
		}

		hash, err := hash.HashOf(ctx, nil, row)
		if err != nil {
			return nil, err
		}

		if _, err := di.seen.Get(hash); err == nil {
			continue
		}

		if err := di.seen.Put(hash, struct{}{}); err != nil {
			return nil, err
		}

		return row, nil
	}
}

func (di *distinctIter) Close(ctx *sql.Context) error {
	di.Dispose()
	return di.childIter.Close(ctx)
}

func (di *distinctIter) Dispose() {
	if di.DisposeFunc != nil {
		di.DisposeFunc()
	}
}

type UnionIter struct {
	Cur      sql.RowIter
	NextIter func(ctx *sql.Context) (sql.RowIter, error)
}

func (ui *UnionIter) Next(ctx *sql.Context) (sql.Row, error) {
	res, err := ui.Cur.Next(ctx)
	if err == io.EOF {
		if ui.NextIter == nil {
			return nil, io.EOF
		}
		err = ui.Cur.Close(ctx)
		if err != nil {
			return nil, err
		}
		ui.Cur, err = ui.NextIter(ctx)
		ui.NextIter = nil
		if err != nil {
			return nil, err
		}
		return ui.Cur.Next(ctx)
	}
	return res, err
}

func (ui *UnionIter) Close(ctx *sql.Context) error {
	if ui.Cur != nil {
		return ui.Cur.Close(ctx)
	} else {
		return nil
	}
}

type IntersectIter struct {
	LIter  sql.RowIter
	RIter  sql.RowIter
	cache  map[uint64]int
	cached bool
}

func (ii *IntersectIter) Next(ctx *sql.Context) (sql.Row, error) {
	if !ii.cached {
		ii.cache = make(map[uint64]int)
		for {
			res, err := ii.RIter.Next(ctx)
			if err != nil {
				if err == io.EOF {
					break
				}
				return nil, err
			}

			hash, herr := hash.HashOf(ctx, nil, res)
			if herr != nil {
				return nil, herr
			}
			if _, ok := ii.cache[hash]; !ok {
				ii.cache[hash] = 0
			}
			ii.cache[hash]++
		}
		ii.cached = true
	}

	for {
		res, err := ii.LIter.Next(ctx)
		if err != nil {
			return nil, err
		}

		hash, herr := hash.HashOf(ctx, nil, res)
		if herr != nil {
			return nil, herr
		}
		if _, ok := ii.cache[hash]; !ok {
			continue
		}
		if ii.cache[hash] <= 0 {
			continue
		}
		ii.cache[hash]--

		return res, nil
	}
}

func (ii *IntersectIter) Close(ctx *sql.Context) error {
	if ii.LIter != nil {
		if err := ii.LIter.Close(ctx); err != nil {
			return err
		}
	}
	if ii.RIter != nil {
		if err := ii.RIter.Close(ctx); err != nil {
			return err
		}
	}
	return nil
}

type ExceptIter struct {
	LIter  sql.RowIter
	RIter  sql.RowIter
	cache  map[uint64]int
	cached bool
}

func (ei *ExceptIter) Next(ctx *sql.Context) (sql.Row, error) {
	if !ei.cached {
		ei.cache = make(map[uint64]int)
		for {
			res, err := ei.RIter.Next(ctx)
			if err != nil && err != io.EOF {
				return nil, err
			}

			hash, herr := hash.HashOf(ctx, nil, res)
			if herr != nil {
				return nil, herr
			}
			if _, ok := ei.cache[hash]; !ok {
				ei.cache[hash] = 0
			}
			ei.cache[hash]++

			if err == io.EOF {
				break
			}
		}
		ei.cached = true
	}

	for {
		res, err := ei.LIter.Next(ctx)
		if err != nil {
			return nil, err
		}

		hash, herr := hash.HashOf(ctx, nil, res)
		if herr != nil {
			return nil, herr
		}
		if _, ok := ei.cache[hash]; !ok {
			return res, nil
		}
		if ei.cache[hash] <= 0 {
			return res, nil
		}
		ei.cache[hash]--
	}
}

func (ei *ExceptIter) Close(ctx *sql.Context) error {
	if ei.LIter != nil {
		if err := ei.LIter.Close(ctx); err != nil {
			return err
		}
	}
	if ei.RIter != nil {
		if err := ei.RIter.Close(ctx); err != nil {
			return err
		}
	}
	return nil
}
