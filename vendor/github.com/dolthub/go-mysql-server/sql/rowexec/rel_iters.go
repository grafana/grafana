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
	"errors"
	"io"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/expression/function/aggregation"
	"github.com/dolthub/go-mysql-server/sql/hash"
	"github.com/dolthub/go-mysql-server/sql/iters"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// windowToIter transforms a plan.Window into a series
// of aggregation.WindowPartitionIter and a list of output projection indexes
// for each window partition.
// TODO: make partition ordering deterministic
func windowToIter(w *plan.Window) ([]*aggregation.WindowPartitionIter, [][]int, error) {
	partIdToOutputIdxs := make(map[uint64][]int, 0)
	partIdToBlock := make(map[uint64]*aggregation.WindowPartition, 0)
	var window *sql.WindowDefinition
	var agg *aggregation.Aggregation
	var fn sql.WindowFunction
	var err error
	// collect functions in hash map keyed by partitioning scheme
	for i, expr := range w.SelectExprs {
		if alias, ok := expr.(*expression.Alias); ok {
			expr = alias.Child
		}
		switch e := expr.(type) {
		case sql.Aggregation:
			window = e.Window()
			fn, err = e.NewWindowFunction()
		case sql.WindowAggregation:
			window = e.Window()
			fn, err = e.NewWindowFunction()
		default:
			// non window aggregates resolve to LastAgg with empty over clause
			window = sql.NewWindowDefinition(nil, nil, nil, "", "")
			fn, err = aggregation.NewLast(e).NewWindowFunction()
		}
		if err != nil {
			return nil, nil, err
		}
		agg = aggregation.NewAggregation(fn, fn.DefaultFramer())

		id, err := window.PartitionId()
		if err != nil {
			return nil, nil, err
		}

		if block, ok := partIdToBlock[id]; !ok {
			if err != nil {
				return nil, nil, err
			}
			partIdToBlock[id] = aggregation.NewWindowPartition(
				window.PartitionBy,
				window.OrderBy,
				[]*aggregation.Aggregation{agg},
			)
			partIdToOutputIdxs[id] = []int{i}
		} else {
			block.AddAggregation(agg)
			partIdToOutputIdxs[id] = append(partIdToOutputIdxs[id], i)
		}
	}

	// convert partition hash map into list
	blockIters := make([]*aggregation.WindowPartitionIter, len(partIdToBlock))
	outputOrdinals := make([][]int, len(partIdToBlock))
	i := 0
	for id, block := range partIdToBlock {
		outputIdx := partIdToOutputIdxs[id]
		blockIters[i] = aggregation.NewWindowPartitionIter(block)
		outputOrdinals[i] = outputIdx
		i++
	}
	return blockIters, outputOrdinals, nil
}

type offsetIter struct {
	childIter sql.RowIter
	skip      int64
}

func (i *offsetIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.skip > 0 {
		for i.skip > 0 {
			_, err := i.childIter.Next(ctx)
			if err != nil {
				return nil, err
			}
			i.skip--
		}
	}

	row, err := i.childIter.Next(ctx)
	if err != nil {
		return nil, err
	}

	return row, nil
}

func (i *offsetIter) Close(ctx *sql.Context) error {
	return i.childIter.Close(ctx)
}

var _ sql.RowIter = &iters.JsonTableRowIter{}

type ProjectIter struct {
	childIter      sql.RowIter
	nestedState    *nestedIterState
	projs          []sql.Expression
	canDefer       bool
	hasNestedIters bool
}

type nestedIterState struct {
	projections    []sql.Expression
	sourceRow      sql.Row
	iterEvaluators []*RowIterEvaluator
}

func (i *ProjectIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.hasNestedIters {
		return i.ProjectRowWithNestedIters(ctx)
	}

	childRow, err := i.childIter.Next(ctx)
	if err != nil {
		return nil, err
	}

	return ProjectRow(ctx, i.projs, childRow)
}

func (i *ProjectIter) Close(ctx *sql.Context) error {
	return i.childIter.Close(ctx)
}

func (i *ProjectIter) GetProjections() []sql.Expression {
	return i.projs
}

func (i *ProjectIter) CanDefer() bool {
	return i.canDefer
}

func (i *ProjectIter) GetChildIter() sql.RowIter {
	return i.childIter
}

// ProjectRowWithNestedIters evaluates a set of projections, allowing for nested iterators in the expressions.
func (i *ProjectIter) ProjectRowWithNestedIters(
	ctx *sql.Context,
) (sql.Row, error) {

	// For the set of iterators, we return one row each element in the longest of the iterators provided.
	// Other iterator values will be NULL after they are depleted. All non-iterator fields for the row are returned
	// identically for each row in the result set.
	if i.nestedState != nil {
		row, err := ProjectRow(ctx, i.nestedState.projections, i.nestedState.sourceRow)
		if err != nil {
			return nil, err
		}

		nestedIterationFinished := true
		for _, evaluator := range i.nestedState.iterEvaluators {
			if !evaluator.finished && evaluator.iter != nil {
				nestedIterationFinished = false
				break
			}
		}

		if nestedIterationFinished {
			i.nestedState = nil
			return i.ProjectRowWithNestedIters(ctx)
		}

		return row, nil
	}

	row, err := i.childIter.Next(ctx)
	if err != nil {
		return nil, err
	}

	i.nestedState = &nestedIterState{
		sourceRow: row,
	}

	// We need a new set of projections, with any iterator-returning expressions replaced by new expressions that will
	// return the result of the iteration on each call to Eval. We also need to keep a list of all such iterators, so
	// that we can tell when they have all finished their iterations.
	var rowIterEvaluators []*RowIterEvaluator
	newProjs := make([]sql.Expression, len(i.projs))
	for i, proj := range i.projs {
		p, _, err := transform.Expr(proj, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
			if rie, ok := e.(sql.RowIterExpression); ok && rie.ReturnsRowIter() {
				ri, err := rie.EvalRowIter(ctx, row)
				if err != nil {
					return nil, false, err
				}

				evaluator := &RowIterEvaluator{
					iter: ri,
					typ:  rie.Type(),
				}
				rowIterEvaluators = append(rowIterEvaluators, evaluator)
				return evaluator, transform.NewTree, nil
			}

			return e, transform.SameTree, nil
		})

		if err != nil {
			return nil, err
		}

		newProjs[i] = p
	}

	i.nestedState.projections = newProjs
	i.nestedState.iterEvaluators = rowIterEvaluators

	return i.ProjectRowWithNestedIters(ctx)
}

// RowIterEvaluator is an expression that returns the next value from a sql.RowIter each time Eval is called.
type RowIterEvaluator struct {
	iter     sql.RowIter
	typ      sql.Type
	finished bool
}

var _ sql.Expression = (*RowIterEvaluator)(nil)

func (r RowIterEvaluator) Resolved() bool {
	return true
}

func (r RowIterEvaluator) String() string {
	return "RowIterEvaluator"
}

func (r RowIterEvaluator) Type() sql.Type {
	return r.typ
}

func (r RowIterEvaluator) IsNullable() bool {
	return true
}

func (r *RowIterEvaluator) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if r.finished || r.iter == nil {
		return nil, nil
	}

	nextRow, err := r.iter.Next(ctx)
	if err != nil {
		if errors.Is(err, io.EOF) {
			r.finished = true
			return nil, nil
		}
		return nil, err
	}

	// All of the set-returning functions return a single value per column
	return nextRow[0], nil
}

func (r RowIterEvaluator) Children() []sql.Expression {
	return nil
}

func (r RowIterEvaluator) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(children), 0)
	}
	return &r, nil
}

// ProjectRow evaluates a set of projections.
func ProjectRow(
	ctx *sql.Context,
	projections []sql.Expression,
	row sql.Row,
) (sql.Row, error) {
	var fields = make(sql.Row, len(projections))
	var secondPass []int
	for i, expr := range projections {
		// Default values that are expressions may reference other fields, thus they must evaluate after all other exprs.
		// Also default expressions may not refer to other columns that come after them if they also have a default expr.
		// This ensures that all columns referenced by expressions will have already been evaluated.
		// Since literals do not reference other columns, they're evaluated on the first pass.
		defaultVal, isDefaultVal := defaultValFromProjectExpr(expr)
		if isDefaultVal && !defaultVal.IsLiteral() {
			secondPass = append(secondPass, i)
			continue
		}
		field, fErr := expr.Eval(ctx, row)
		if fErr != nil {
			return nil, fErr
		}
		field = normalizeNegativeZeros(field)
		fields[i] = field
	}
	for _, index := range secondPass {
		field, err := projections[index].Eval(ctx, fields)
		if err != nil {
			return nil, err
		}
		field = normalizeNegativeZeros(field)
		fields[index] = field
	}
	return fields, nil
}

func defaultValFromProjectExpr(e sql.Expression) (*sql.ColumnDefaultValue, bool) {
	if defaultVal, ok := e.(*expression.Wrapper); ok {
		e = defaultVal.Unwrap()
	}
	if defaultVal, ok := e.(*sql.ColumnDefaultValue); ok {
		return defaultVal, true
	}
	if defaultExpr, ok := e.(plan.ColDefaultExpression); ok {
		if defaultExpr.Column.Default != nil {
			return defaultExpr.Column.Default, true
		} else if defaultExpr.Column.Generated != nil {
			return defaultExpr.Column.Generated, true
		}
	}

	return nil, false
}

func defaultValFromSetExpression(e sql.Expression) (*sql.ColumnDefaultValue, bool) {
	if sf, ok := e.(*expression.SetField); ok {
		return defaultValFromProjectExpr(sf.RightChild)
	}
	return nil, false
}

// normalizeNegativeZeros converts negative zero into positive zero.
// We do this so that floats and decimals have the same representation when displayed to the user.
func normalizeNegativeZeros(val interface{}) interface{} {
	// Golang doesn't have a negative zero literal, but negative zero compares equal to zero.
	if val == float32(0) {
		return float32(0)
	}
	if val == float64(0) {
		return float64(0)
	}
	return val
}

func setUserVar(ctx *sql.Context, userVar *expression.UserVar, right sql.Expression, row sql.Row) error {
	val, err := right.Eval(ctx, row)
	if err != nil {
		return err
	}
	typ := types.ApproximateTypeFromValue(val)

	err = ctx.SetUserVariable(ctx, userVar.Name, val, typ)
	if err != nil {
		return err
	}
	return nil
}

func setSystemVar(ctx *sql.Context, sysVar *expression.SystemVar, right sql.Expression, row sql.Row) error {
	val, err := right.Eval(ctx, row)
	if err != nil {
		return err
	}
	err = validateSystemVariableValue(sysVar.Name, val)
	if err != nil {
		return err
	}
	err = sysVar.Scope.SetValue(ctx, sysVar.Name, val)
	if err != nil {
		return err
	}

	// Setting `character_set_connection` and `collation_connection` will set the corresponding variable
	// Setting `character_set_server` and `collation_server` will set the corresponding variable
	switch strings.ToLower(sysVar.Name) {
	case "character_set_connection":
		if val == nil {
			return sysVar.Scope.SetValue(ctx, "collation_connection", val)
		}
		valStr, ok := val.(string)
		if !ok {
			return sql.ErrInvalidSystemVariableValue.New("collation_connection", val)
		}
		var charset sql.CharacterSetID
		charset, err = sql.ParseCharacterSet(valStr)
		if err != nil {
			return err
		}
		collationName := charset.DefaultCollation().Name()
		return sysVar.Scope.SetValue(ctx, "collation_connection", collationName)
	case "collation_connection":
		if val == nil {
			return sysVar.Scope.SetValue(ctx, "character_set_connection", val)
		}
		valStr, ok := val.(string)
		if !ok {
			return sql.ErrInvalidSystemVariableValue.New("character_set_connection", val)
		}
		var collation sql.CollationID
		collation, err = sql.ParseCollation("", valStr, false)
		if err != nil {
			return err
		}
		charsetName := collation.CharacterSet().Name()
		return sysVar.Scope.SetValue(ctx, "character_set_connection", charsetName)
	case "character_set_server":
		if val == nil {
			return sysVar.Scope.SetValue(ctx, "collation_server", val)
		}
		valStr, ok := val.(string)
		if !ok {
			return sql.ErrInvalidSystemVariableValue.New("collation_server", val)
		}
		var charset sql.CharacterSetID
		charset, err = sql.ParseCharacterSet(valStr)
		if err != nil {
			return err
		}
		collationName := charset.DefaultCollation().Name()
		return sysVar.Scope.SetValue(ctx, "collation_server", collationName)
	case "collation_server":
		if val == nil {
			return sysVar.Scope.SetValue(ctx, "character_set_server", val)
		}
		valStr, ok := val.(string)
		if !ok {
			return sql.ErrInvalidSystemVariableValue.New("character_set_server", val)
		}
		var collation sql.CollationID
		collation, err = sql.ParseCollation("", valStr, false)
		if err != nil {
			return err
		}
		charsetName := collation.CharacterSet().Name()
		return sysVar.Scope.SetValue(ctx, "character_set_server", charsetName)
	}
	return nil
}

func validateSystemVariableValue(sysVarName string, val interface{}) error {
	switch strings.ToLower(sysVarName) {
	case "time_zone":
		valStr, ok := val.(string)
		if !ok {
			return sql.ErrInvalidTimeZone.New(val)
		}
		if !sql.ValidTimeZone(valStr) {
			return sql.ErrInvalidTimeZone.New(valStr)
		}
	}
	return nil
}

// Applies the update expressions given to the row given, returning the new resultant row.
func applyUpdateExpressions(ctx *sql.Context, updateExprs []sql.Expression, row sql.Row) (sql.Row, error) {
	var ok bool
	prev := row
	for _, updateExpr := range updateExprs {
		val, err := updateExpr.Eval(ctx, prev)
		if err != nil {
			return nil, err
		}
		prev, ok = val.(sql.Row)
		if !ok {
			return nil, plan.ErrUpdateUnexpectedSetResult.New(val)
		}
	}
	return prev, nil
}

// declareVariablesIter is the sql.RowIter of *DeclareVariables.
type declareVariablesIter struct {
	*plan.DeclareVariables
	row sql.Row
}

var _ sql.RowIter = (*declareVariablesIter)(nil)

// Next implements the interface sql.RowIter.
func (d *declareVariablesIter) Next(ctx *sql.Context) (sql.Row, error) {
	defaultVal, err := d.DefaultVal.Eval(ctx, d.row)
	if err != nil {
		return nil, err
	}
	for _, varName := range d.Names {
		if err := d.Pref.InitializeVariable(ctx, varName, d.Type, defaultVal); err != nil {
			return nil, err
		}
	}
	return nil, io.EOF
}

// Close implements the interface sql.RowIter.
func (d *declareVariablesIter) Close(ctx *sql.Context) error {
	return nil
}

// declareHandlerIter is the sql.RowIter of *DeclareHandler.
type declareHandlerIter struct {
	*plan.DeclareHandler
}

var _ sql.RowIter = (*declareHandlerIter)(nil)

// Next implements the interface sql.RowIter.
func (d *declareHandlerIter) Next(ctx *sql.Context) (sql.Row, error) {
	if err := d.Pref.InitializeHandler(d.Statement, d.Action, d.Condition); err != nil {
		return nil, err
	}
	return nil, io.EOF
}

// Close implements the interface sql.RowIter.
func (d *declareHandlerIter) Close(ctx *sql.Context) error {
	return nil
}

const cteRecursionLimit = 10001

// recursiveCteIter exhaustively executes a recursive
// relation [rec] populated by an [init] base case.
// Refer to RecursiveCte for more details.
type recursiveCteIter struct {
	// base sql.Project
	init sql.Node
	// recursive sql.Project
	rec sql.Node
	// active iterator, either [init].RowIter or [rec].RowIter
	iter sql.RowIter
	// duplicate lookup if [deduplicated] set
	cache sql.KeyValueCache
	// anchor to recursive table to repopulate with [temp]
	working *plan.RecursiveTable

	b *BaseBuilder
	// parent iter initialization state
	row sql.Row
	// buffer to collect intermediate results for next recursion
	temp []sql.Row
	// number of recursive iterations finishe
	cycle int
	// true if UNION, false if UNION ALL
	deduplicate bool
}

var _ sql.RowIter = (*recursiveCteIter)(nil)

// Next implements sql.RowIter
func (r *recursiveCteIter) Next(ctx *sql.Context) (sql.Row, error) {
	if r.iter == nil {
		// start with [Init].RowIter
		var err error
		if r.deduplicate {
			r.cache = sql.NewMapCache()

		}
		r.iter, err = r.b.buildNodeExec(ctx, r.init, r.row)

		if err != nil {
			return nil, err
		}
	}

	var row sql.Row
	for {
		var err error
		row, err = r.iter.Next(ctx)
		if errors.Is(err, io.EOF) && len(r.temp) > 0 {
			// reset [Rec].RowIter
			err = r.resetIter(ctx)
			if err != nil {
				return nil, err
			}
			continue
		} else if err != nil {
			return nil, err
		}

		var key uint64
		if r.deduplicate {
			key, _ = hash.HashOf(ctx, nil, row)
			if k, _ := r.cache.Get(key); k != nil {
				// skip duplicate
				continue
			}
		}
		r.store(row, key)
		if err != nil {
			return nil, err
		}
		break
	}
	return row, nil
}

// store saves a row to the [temp] buffer, and hashes if [deduplicated] = true
func (r *recursiveCteIter) store(row sql.Row, key uint64) {
	if r.deduplicate {
		r.cache.Put(key, struct{}{})
	}
	r.temp = append(r.temp, row)
	return
}

// resetIter creates a new [Rec].RowIter after refreshing the [working] RecursiveTable
func (r *recursiveCteIter) resetIter(ctx *sql.Context) error {
	if len(r.temp) == 0 {
		return io.EOF
	}
	r.cycle++
	if r.cycle > cteRecursionLimit {
		return sql.ErrCteRecursionLimitExceeded.New()
	}

	if r.working != nil {
		r.working.Buf = r.temp
		r.temp = make([]sql.Row, 0)
	}

	err := r.iter.Close(ctx)
	if err != nil {
		return err
	}
	r.iter, err = r.b.buildNodeExec(ctx, r.rec, r.row)
	if err != nil {
		return err
	}
	return nil
}

// Close implements sql.RowIter
func (r *recursiveCteIter) Close(ctx *sql.Context) error {
	r.working.Buf = nil
	r.temp = nil
	if r.iter != nil {
		return r.iter.Close(ctx)
	}
	return nil
}
