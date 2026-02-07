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
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"strings"

	"github.com/dolthub/jsonpath"
	"github.com/shopspring/decimal"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/expression/function/aggregation"
	"github.com/dolthub/go-mysql-server/sql/expression/function/json"
	"github.com/dolthub/go-mysql-server/sql/iters"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/types"
)

func (b *BaseBuilder) buildTopN(ctx *sql.Context, n *plan.TopN, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.TopN")
	i, err := b.buildNodeExec(ctx, n.Child, row)
	if err != nil {
		span.End()
		return nil, err
	}

	limit, err := iters.GetInt64Value(ctx, n.Limit)
	if err != nil {
		return nil, err
	}
	return sql.NewSpanIter(span, iters.NewTopRowsIter(n.Fields, limit, n.CalcFoundRows, i, len(n.Child.Schema()))), nil
}

func (b *BaseBuilder) buildValueDerivedTable(ctx *sql.Context, n *plan.ValueDerivedTable, row sql.Row) (sql.RowIter, error) {
	rows := make([]sql.Row, len(n.ExpressionTuples))
	for i, et := range n.ExpressionTuples {
		vals := make(sql.Row, len(et))
		for j, e := range et {
			var err error
			p, err := e.Eval(ctx, row)
			if err != nil {
				return nil, err
			}
			// cast all row values to the most permissive type
			vals[j], _, err = n.Schema()[j].Type.Convert(ctx, p)
			if err != nil {
				return nil, err
			}
			// decimalType.Convert() does not use the given type precision and scale information
			if t, ok := n.Schema()[j].Type.(sql.DecimalType); ok {
				vals[j] = vals[j].(decimal.Decimal).Round(int32(t.Scale()))
			}
		}
		rows[i] = vals
	}

	return sql.RowsToRowIter(rows...), nil
}

func (b *BaseBuilder) buildValues(ctx *sql.Context, n *plan.Values, row sql.Row) (sql.RowIter, error) {
	rows := make([]sql.Row, len(n.ExpressionTuples))
	for i, et := range n.ExpressionTuples {
		vals := make(sql.Row, len(et))

		// A non-zero row means that we're executing in a trigger context, so we evaluate against the row provided
		// TODO: this probably won't work with triggers that define explicit DEFAULT values
		if len(row) > 0 {
			for j, e := range et {
				var err error
				vals[j], err = e.Eval(ctx, row)
				if err != nil {
					return nil, err
				}
			}
		} else {
			// For the values node, the relevant values to evaluate are the tuple itself. We may need to project
			// DEFAULT values onto them, which ProjectRow handles correctly (could require multiple passes)
			var err error
			vals, err = ProjectRow(ctx, et, vals)
			if err != nil {
				return nil, err
			}
		}

		rows[i] = vals
	}

	return sql.RowsToRowIter(rows...), nil
}

func (b *BaseBuilder) buildWindow(ctx *sql.Context, n *plan.Window, row sql.Row) (sql.RowIter, error) {
	childIter, err := b.buildNodeExec(ctx, n.Child, row)
	if err != nil {
		return nil, err
	}
	blockIters, outputOrdinals, err := windowToIter(n)
	if err != nil {
		return nil, err
	}
	return aggregation.NewWindowIter(blockIters, outputOrdinals, childIter), nil
}

func (b *BaseBuilder) buildOffset(ctx *sql.Context, n *plan.Offset, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.Offset", trace.WithAttributes(attribute.Stringer("offset", n.Offset)))

	offset, err := iters.GetInt64Value(ctx, n.Offset)
	if err != nil {
		span.End()
		return nil, err
	}

	it, err := b.buildNodeExec(ctx, n.Child, row)
	if err != nil {
		span.End()
		return nil, err
	}
	return sql.NewSpanIter(span, &offsetIter{
		childIter: it,
		skip:      offset,
	}), nil
}

func (b *BaseBuilder) buildJSONTableCols(ctx *sql.Context, jtCols []plan.JSONTableCol, row sql.Row) ([]*iters.JsonTableCol, error) {
	var cols []*iters.JsonTableCol
	for _, col := range jtCols {
		if col.Opts == nil {
			innerCols, err := b.buildJSONTableCols(ctx, col.NestedCols, row)
			if err != nil {
				return nil, err
			}
			cols = append(cols, &iters.JsonTableCol{
				Path: col.Path,
				Cols: innerCols,
			})
			continue
		}

		defErrVal, err := col.Opts.DefErrorVal.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		defEmpVal, err := col.Opts.DefEmptyVal.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		cols = append(cols, &iters.JsonTableCol{
			Path: col.Path,
			Opts: &iters.JsonTableColOpts{
				Name:      col.Opts.Name,
				Typ:       col.Opts.Type,
				ForOrd:    col.Opts.ForOrd,
				Exists:    col.Opts.Exists,
				DefErrVal: defErrVal,
				DefEmpVal: defEmpVal,
				ErrOnErr:  col.Opts.ErrorOnError,
				ErrOnEmp:  col.Opts.ErrorOnEmpty,
			},
		})
	}
	return cols, nil
}

func (b *BaseBuilder) buildJSONTable(ctx *sql.Context, n *plan.JSONTable, row sql.Row) (sql.RowIter, error) {
	// data must evaluate to JSON string
	data, err := n.DataExpr.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if data == nil {
		return &iters.JsonTableRowIter{}, nil
	}

	jsonData, err := json.GetJSONFromWrapperOrCoercibleString(ctx, data, "json_table", 1)
	if err != nil {
		return nil, err
	}

	jsonPathData, err := jsonpath.JsonPathLookup(jsonData, n.RootPath)
	if err != nil {
		jsonPathData = []interface{}{}
	}
	if _, ok := jsonPathData.([]interface{}); !ok {
		jsonPathData = []interface{}{jsonPathData}
	}

	cols, err := b.buildJSONTableCols(ctx, n.Cols, row)

	rowIter := &iters.JsonTableRowIter{
		Data: jsonPathData.([]interface{}),
		Cols: cols,
	}
	rowIter.NextSibling() // set to first sibling

	return rowIter, nil
}

func (b *BaseBuilder) buildHashLookup(ctx *sql.Context, n *plan.HashLookup, row sql.Row) (sql.RowIter, error) {
	n.Mutex.Lock()
	defer n.Mutex.Unlock()
	if n.Lookup == nil {
		childIter, err := b.buildNodeExec(ctx, n.Child, row)
		if err != nil {
			return nil, err
		}
		return newHashLookupGeneratingIter(n, childIter), nil
	}
	key, err := n.GetHashKey(ctx, n.LeftProbeKey, row)
	if err != nil {
		return nil, err
	}
	if n.JoinType.IsExcludeNulls() {
		// Some joins care if any of their filter comparisons have a NULL result.
		// For these joins, we need to distinguish between an empty and non-empty secondary table.
		// Thus, if there are any rows in the lookup, we must return at least one.
		if len((*n.Lookup)[key]) > 0 {
			return sql.RowsToRowIter((*n.Lookup)[key]...), nil
		}
		for k := range *n.Lookup {
			if len((*n.Lookup)[k]) > 0 {
				return sql.RowsToRowIter((*n.Lookup)[k]...), nil
			}
		}
	}
	return sql.RowsToRowIter((*n.Lookup)[key]...), nil
}

func (b *BaseBuilder) buildTableAlias(ctx *sql.Context, n *plan.TableAlias, row sql.Row) (sql.RowIter, error) {
	var table string
	if tbl, ok := n.Child.(sql.Nameable); ok {
		table = tbl.Name()
	} else {
		table = reflect.TypeOf(n.Child).String()
	}

	span, ctx := ctx.Span("sql.TableAlias", trace.WithAttributes(attribute.String("table", table)))

	iter, err := b.Build(ctx, n.Child, row)
	if err != nil {
		span.End()
		return nil, err
	}

	return sql.NewSpanIter(span, iter), nil
}

func (b *BaseBuilder) buildJoinNode(ctx *sql.Context, n *plan.JoinNode, row sql.Row) (sql.RowIter, error) {
	switch {
	case n.Op.IsFullOuter():
		return newFullJoinIter(ctx, b, n, row)
	case n.Op.IsPartial():
		return newExistsIter(ctx, b, n, row)
	case n.Op.IsCross():
		return newCrossJoinIter(ctx, b, n, row)
	case n.Op.IsPlaceholder():
		panic(fmt.Sprintf("%s is a placeholder, RowIter called", n.Op))
	case n.Op.IsMerge():
		return newMergeJoinIter(ctx, b, n, row)
	case n.Op.IsLateral():
		return newLateralJoinIter(ctx, b, n, row)
	case n.Op.IsRange():
		return newRangeHeapJoinIter(ctx, b, n, row)
	default:
		return newJoinIter(ctx, b, n, row)
	}
}

func (b *BaseBuilder) buildOrderedDistinct(ctx *sql.Context, n *plan.OrderedDistinct, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.OrderedDistinct")

	it, err := b.buildNodeExec(ctx, n.Child, row)
	if err != nil {
		span.End()
		return nil, err
	}

	return sql.NewSpanIter(span, iters.NewOrderedDistinctIter(it, n.Child.Schema())), nil
}

func (b *BaseBuilder) buildWith(ctx *sql.Context, n *plan.With, row sql.Row) (sql.RowIter, error) {
	return nil, fmt.Errorf("*plan.With has no execution iterator")
}

func (b *BaseBuilder) buildProject(ctx *sql.Context, n *plan.Project, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.Project", trace.WithAttributes(
		attribute.Int("projections", len(n.Projections)),
	))

	i, err := b.buildNodeExec(ctx, n.Child, row)
	if err != nil {
		span.End()
		return nil, err
	}

	return sql.NewSpanIter(span, &ProjectIter{
		projs:          n.Projections,
		canDefer:       n.CanDefer,
		hasNestedIters: n.IncludesNestedIters,
		childIter:      i,
	}), nil
}

func (b *BaseBuilder) buildVirtualColumnTable(ctx *sql.Context, n *plan.VirtualColumnTable, tableIter sql.RowIter, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.VirtualColumnTable", trace.WithAttributes(
		attribute.Int("projections", len(n.Projections)),
	))

	return sql.NewSpanIter(span, &ProjectIter{
		projs:     n.Projections,
		childIter: tableIter,
	}), nil
}

func (b *BaseBuilder) buildProcedure(ctx *sql.Context, n *plan.Procedure, row sql.Row) (sql.RowIter, error) {
	if n.ExternalProc == nil {
		return nil, nil
	}
	return b.buildNodeExec(ctx, n.ExternalProc, row)
}

func (b *BaseBuilder) buildRecursiveTable(ctx *sql.Context, n *plan.RecursiveTable, row sql.Row) (sql.RowIter, error) {
	return &iters.RecursiveTableIter{Buf: n.Buf}, nil
}

func (b *BaseBuilder) buildSet(ctx *sql.Context, n *plan.Set, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.Set")
	defer span.End()

	var updateExprs []sql.Expression
	for _, v := range n.Exprs {
		setField, ok := v.(*expression.SetField)
		if !ok {
			return nil, fmt.Errorf("unsupported type for set: %T", v)
		}

		switch left := setField.LeftChild.(type) {
		case *expression.SystemVar:
			err := setSystemVar(ctx, left, setField.RightChild, row)
			if err != nil {
				return nil, err
			}
		case *expression.UserVar:
			err := setUserVar(ctx, left, setField.RightChild, row)
			if err != nil {
				return nil, err
			}
		case *expression.ProcedureParam:
			value, err := setField.RightChild.Eval(ctx, row)
			if err != nil {
				return nil, err
			}
			err = left.Set(ctx, value, setField.RightChild.Type())
			if err != nil {
				return nil, err
			}
		case *expression.GetField:
			updateExprs = append(updateExprs, setField)
		default:
			return nil, fmt.Errorf("unsupported type for set: %T", left)
		}
	}

	var resultRow sql.Row
	if len(updateExprs) > 0 {
		newRow, err := applyUpdateExpressions(ctx, updateExprs, row)
		if err != nil {
			return nil, err
		}
		copy(resultRow, row)
		resultRow = row.Append(newRow)
		return sql.RowsToRowIter(resultRow), nil
	}

	// For system and user variable SET statements, return OkResult like MySQL does
	return sql.RowsToRowIter(sql.NewRow(types.NewOkResult(0))), nil
}

func (b *BaseBuilder) buildGroupBy(ctx *sql.Context, n *plan.GroupBy, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.GroupBy", trace.WithAttributes(
		attribute.Int("groupings", len(n.GroupByExprs)),
		attribute.Int("aggregates", len(n.SelectDeps)),
	))

	i, err := b.buildNodeExec(ctx, n.Child, row)
	if err != nil {
		span.End()
		return nil, err
	}

	var iter sql.RowIter
	if len(n.GroupByExprs) == 0 {
		iter = newGroupByIter(n.SelectDeps, i)
	} else {
		iter = newGroupByGroupingIter(ctx, n.SelectDeps, n.GroupByExprs, i)
	}

	return sql.NewSpanIter(span, iter), nil
}

func (b *BaseBuilder) buildFilter(ctx *sql.Context, n *plan.Filter, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.Filter")

	i, err := b.buildNodeExec(ctx, n.Child, row)
	if err != nil {
		span.End()
		return nil, err
	}

	return sql.NewSpanIter(span, plan.NewFilterIter(n.Expression, i)), nil
}

func (b *BaseBuilder) buildDeclareVariables(ctx *sql.Context, n *plan.DeclareVariables, row sql.Row) (sql.RowIter, error) {
	return &declareVariablesIter{n, row}, nil
}

func (b *BaseBuilder) buildDeclareHandler(ctx *sql.Context, n *plan.DeclareHandler, row sql.Row) (sql.RowIter, error) {
	return &declareHandlerIter{n}, nil
}

func (b *BaseBuilder) buildRecursiveCte(ctx *sql.Context, n *plan.RecursiveCte, row sql.Row) (sql.RowIter, error) {
	var iter sql.RowIter = &recursiveCteIter{
		init:        n.Left(),
		rec:         n.Right(),
		row:         row,
		working:     n.Working,
		temp:        make([]sql.Row, 0),
		deduplicate: n.Union().Distinct,
		b:           b,
	}
	if n.Union().Limit != nil && len(n.Union().SortFields) > 0 {
		limit, err := iters.GetInt64Value(ctx, n.Union().Limit)
		if err != nil {
			return nil, err
		}
		iter = iters.NewTopRowsIter(n.Union().SortFields, limit, false, iter, len(n.Union().Schema()))
	} else if n.Union().Limit != nil {
		limit, err := iters.GetInt64Value(ctx, n.Union().Limit)
		if err != nil {
			return nil, err
		}
		iter = &iters.LimitIter{Limit: limit, ChildIter: iter}
	} else if len(n.Union().SortFields) > 0 {
		iter = iters.NewSortIter(n.Union().SortFields, iter)
	}
	return iter, nil
}

func (b *BaseBuilder) buildLimit(ctx *sql.Context, n *plan.Limit, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.Limit", trace.WithAttributes(attribute.Stringer("limit", n.Limit)))

	limit, err := iters.GetInt64Value(ctx, n.Limit)
	if err != nil {
		span.End()
		return nil, err
	}

	childIter, err := b.buildNodeExec(ctx, n.Child, row)
	if err != nil {
		span.End()
		return nil, err
	}
	return sql.NewSpanIter(span, &iters.LimitIter{
		CalcFoundRows: n.CalcFoundRows,
		Limit:         limit,
		ChildIter:     childIter,
	}), nil
}

func (b *BaseBuilder) buildMax1Row(ctx *sql.Context, n *plan.Max1Row, row sql.Row) (sql.RowIter, error) {
	n.Mu.Lock()
	defer n.Mu.Unlock()

	if !n.HasResults() {
		err := b.populateMax1Results(ctx, n, row)
		if err != nil {
			return nil, err
		}
	}

	switch {
	case n.EmptyResult:
		return plan.EmptyIter, nil
	case n.Result != nil:
		return sql.RowsToRowIter(n.Result), nil
	default:
		return nil, fmt.Errorf("Max1Row failed to load results")
	}
}

// PopulateResults loads and stores the state of its child iter:
// 1) no rows returned, 2) 1 row returned, or 3) more than 1 row
// returned
func (b *BaseBuilder) populateMax1Results(ctx *sql.Context, n *plan.Max1Row, row sql.Row) error {
	i, err := b.buildNodeExec(ctx, n.Child, row)
	if err != nil {
		return err
	}
	defer i.Close(ctx)
	r1, err := i.Next(ctx)
	if errors.Is(err, io.EOF) {
		n.EmptyResult = true
		return nil
	} else if err != nil {
		return err
	}

	_, err = i.Next(ctx)
	if err == nil {
		return sql.ErrExpectedSingleRow.New()
	} else if !errors.Is(err, io.EOF) {
		return err
	}
	n.Result = r1
	return nil
}

// isUnderSecureFileDir ensures that fileStr is under secureFileDir or a subdirectory of secureFileDir, errors otherwise
func isUnderSecureFileDir(secureFileDir interface{}, fileStr string) error {
	if secureFileDir == nil || secureFileDir == "" {
		return nil
	}
	sStat, err := os.Stat(secureFileDir.(string))
	if err != nil {
		return err
	}
	fStat, err := os.Stat(filepath.Dir(fileStr))
	if err != nil {
		return err
	}
	if os.SameFile(sStat, fStat) {
		return nil
	}

	fileAbsPath, filePathErr := filepath.Abs(fileStr)
	if filePathErr != nil {
		return filePathErr
	}
	secureFileDirAbsPath, _ := filepath.Abs(secureFileDir.(string))
	if strings.HasPrefix(fileAbsPath, secureFileDirAbsPath) {
		return nil
	}
	return sql.ErrSecureFilePriv.New()
}

// createIfNotExists creates a file if it does not exist, errors otherwise
func createIfNotExists(fileStr string) (*os.File, error) {
	if _, fErr := os.Stat(fileStr); fErr == nil {
		return nil, sql.ErrFileExists.New(fileStr)
	}
	file, fileErr := os.OpenFile(fileStr, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0640)
	if fileErr != nil {
		return nil, fileErr
	}
	return file, nil
}

func (b *BaseBuilder) buildInto(ctx *sql.Context, n *plan.Into, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.Into")
	defer span.End()

	rowIter, err := b.buildNodeExec(ctx, n.Child, row)
	if err != nil {
		return nil, err
	}
	rows, err := sql.RowIterToRows(ctx, rowIter)
	if err != nil {
		return nil, err
	}

	var secureFileDir interface{}
	if n.Outfile != "" || n.Dumpfile != "" {
		var ok bool
		_, secureFileDir, ok = sql.SystemVariables.GetGlobal("secure_file_priv")
		if !ok {
			return nil, fmt.Errorf("error: secure_file_priv variable was not found")
		}
	}

	if n.Outfile != "" {
		// TODO: MySQL has relative paths from the "data dir"
		if err = isUnderSecureFileDir(secureFileDir, n.Outfile); err != nil {
			return nil, err
		}
		file, fileErr := createIfNotExists(n.Outfile)
		if fileErr != nil {
			return nil, fileErr
		}
		defer file.Close()

		sch := n.Child.Schema()
		for _, r := range rows {
			file.WriteString(n.LinesStartingBy)
			for i, val := range r {
				if i != 0 {
					file.WriteString(n.FieldsTerminatedBy)
				}
				if val == nil {
					if len(n.FieldsEscapedBy) == 0 {
						file.WriteString("NULL")
					} else {
						file.WriteString(fmt.Sprintf("%sN", n.FieldsEscapedBy))
					}
					continue
				}
				if !n.FieldsEnclosedByOpt || types.IsText(sch[i].Type) {
					if strVal, ok := val.(string); ok {
						if len(n.LinesTerminatedBy) != 0 {
							strVal = strings.Replace(strVal, n.LinesTerminatedBy, n.FieldsEscapedBy+n.LinesTerminatedBy, -1)
						}
						file.WriteString(fmt.Sprintf("%s%v%s", n.FieldsEnclosedBy, strVal, n.FieldsEnclosedBy))
					} else {
						file.WriteString(fmt.Sprintf("%s%v%s", n.FieldsEnclosedBy, val, n.FieldsEnclosedBy))
					}
				} else {
					file.WriteString(fmt.Sprintf("%v", val))
				}
			}
			file.WriteString(n.LinesTerminatedBy)
		}
		return sql.RowsToRowIter(sql.Row{types.NewOkResult(len(rows))}), nil
	}

	rowNum := len(rows)
	if rowNum > 1 {
		return nil, sql.ErrMoreThanOneRow.New()
	}

	if n.Dumpfile != "" {
		if err = isUnderSecureFileDir(secureFileDir, n.Dumpfile); err != nil {
			return nil, err
		}
		file, fileErr := createIfNotExists(n.Dumpfile)
		if fileErr != nil {
			return nil, fileErr
		}
		defer file.Close()
		if rowNum == 1 {
			for _, val := range rows[0] {
				file.WriteString(fmt.Sprintf("%v", val))
			}
		}
		return sql.RowsToRowIter(sql.Row{types.NewOkResult(rowNum)}), nil
	}

	if rowNum == 0 {
		// a warning with error code 1329 occurs (No data), and make no change to variables
		return sql.RowsToRowIter(sql.Row{types.NewOkResult(0)}), nil
	}
	if len(rows[0]) != len(n.IntoVars) {
		return nil, sql.ErrColumnNumberDoesNotMatch.New()
	}

	var rowValues = make([]interface{}, len(rows[0]))
	copy(rowValues, rows[0])

	for j, v := range n.IntoVars {
		switch variable := v.(type) {
		case *expression.UserVar:
			varType := types.ApproximateTypeFromValue(rowValues[j])
			err = ctx.SetUserVariable(ctx, variable.Name, rowValues[j], varType)
			if err != nil {
				return nil, err
			}
		case *expression.ProcedureParam:
			err = variable.Set(ctx, rowValues[j], types.ApproximateTypeFromValue(rowValues[j]))
			if err != nil {
				return nil, err
			}
		default:
			return nil, fmt.Errorf("unsupported type for into: %T", variable)
		}
	}

	return sql.RowsToRowIter(sql.Row{types.NewOkResult(1)}), nil
}

func (b *BaseBuilder) buildExternalProcedure(ctx *sql.Context, n *plan.ExternalProcedure, row sql.Row) (sql.RowIter, error) {
	// The function's structure has been verified by the analyzer, so no need to double-check any of it here
	funcVal := reflect.ValueOf(n.Function)
	funcType := funcVal.Type()
	// The first parameter is always the context, but it doesn't exist as far as the stored procedures are concerned, so
	// we prepend it here
	funcParams := make([]reflect.Value, len(n.Params)+1)
	funcParams[0] = reflect.ValueOf(ctx)

	for i := range n.Params {
		paramDefinition := n.ParamDefinitions[i]
		var funcParamType reflect.Type
		if paramDefinition.Variadic {
			funcParamType = funcType.In(funcType.NumIn() - 1).Elem()
		} else {
			funcParamType = funcType.In(i + 1)
		}
		// Grab the passed-in variable and convert it to the type we expect
		exprParamVal, err := n.Params[i].Eval(ctx, nil)
		if err != nil {
			return nil, err
		}
		exprParamVal, _, err = paramDefinition.Type.Convert(ctx, exprParamVal)
		if err != nil {
			return nil, err
		}

		funcParams[i+1], err = n.ProcessParam(ctx, funcParamType, exprParamVal)
		if err != nil {
			return nil, err
		}
	}
	out := funcVal.Call(funcParams)

	// Again, these types are enforced in the analyzer, so it's safe to assume their types here
	if err, ok := out[1].Interface().(error); ok { // Only evaluates to true when error is not nil
		return nil, err
	}
	for i, paramDefinition := range n.ParamDefinitions {
		if paramDefinition.Direction == plan.ProcedureParamDirection_Inout || paramDefinition.Direction == plan.ProcedureParamDirection_Out {
			exprParam := n.Params[i]
			funcParamVal := funcParams[i+1].Elem().Interface()
			err := exprParam.Set(ctx, funcParamVal, exprParam.Type())
			if err != nil {
				return nil, err
			}
			_ = ctx.Session.SetStoredProcParam(exprParam.Name(), funcParamVal)
		}
	}
	// It's not invalid to return a nil RowIter, as having no rows to return is expected of many stored procedures.
	if rowIter, ok := out[0].Interface().(sql.RowIter); ok {
		return rowIter, nil
	}
	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildHaving(ctx *sql.Context, n *plan.Having, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.Having")
	iter, err := b.buildNodeExec(ctx, n.Child, row)
	if err != nil {
		span.End()
		return nil, err
	}

	return sql.NewSpanIter(span, plan.NewFilterIter(n.Cond, iter)), nil
}

func (b *BaseBuilder) buildDistinct(ctx *sql.Context, n *plan.Distinct, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.Distinct")

	it, err := b.buildNodeExec(ctx, n.Child, row)
	if err != nil {
		span.End()
		return nil, err
	}

	return sql.NewSpanIter(span, iters.NewDistinctIter(ctx, it)), nil
}

func (b *BaseBuilder) buildIndexedTableAccess(ctx *sql.Context, n *plan.IndexedTableAccess, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.IndexedTableAccess")

	lookup, err := n.GetLookup(ctx, row)
	if err != nil {
		return nil, err
	}

	partIter, err := n.Table.LookupPartitions(ctx, lookup)
	if err != nil {
		return nil, err
	}

	var tableIter sql.RowIter
	tableIter = sql.NewTableRowIter(ctx, n.Table, partIter)

	if vct, ok := plan.FindVirtualColumnTable(n.Table); ok {
		tableIter, err = b.buildVirtualColumnTable(ctx, vct, tableIter, row)
		if err != nil {
			return nil, err
		}
	}

	return sql.NewSpanIter(span, tableIter), nil
}

func (b *BaseBuilder) buildSetOp(ctx *sql.Context, s *plan.SetOp, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.SetOp")
	var iter sql.RowIter
	var err error
	iter, err = b.buildNodeExec(ctx, s.Left(), row)
	if err != nil {
		span.End()
		return nil, err
	}
	switch s.SetOpType {
	case plan.UnionType:
		iter = &iters.UnionIter{
			Cur: iter,
			NextIter: func(ctx *sql.Context) (sql.RowIter, error) {
				return b.buildNodeExec(ctx, s.Right(), row)
			},
		}
	case plan.IntersectType:
		var iter2 sql.RowIter
		iter2, err = b.buildNodeExec(ctx, s.Right(), row)
		if err != nil {
			span.End()
			return nil, err
		}
		iter = &iters.IntersectIter{
			LIter: iter,
			RIter: iter2,
		}
	case plan.ExceptType:
		var iter2 sql.RowIter
		iter2, err = b.buildNodeExec(ctx, s.Right(), row)
		if err != nil {
			span.End()
			return nil, err
		}
		if s.Distinct {
			dIter := iters.NewDistinctIter(ctx, iter)
			s.AddDispose(dIter.DisposeFunc)
			iter = dIter

			dIter2 := iters.NewDistinctIter(ctx, iter2)
			s.AddDispose(dIter2.DisposeFunc)
			iter2 = dIter2
		}
		iter = &iters.ExceptIter{
			LIter: iter,
			RIter: iter2,
		}
	}

	if s.Distinct && s.SetOpType != plan.ExceptType {
		dIter := iters.NewDistinctIter(ctx, iter)
		s.AddDispose(dIter.DisposeFunc)
		iter = dIter
	}
	// Limit must wrap offset, and not vice-versa, so that
	// skipped rows don't count toward the returned row count.
	if s.Offset != nil {
		offset, err := iters.GetInt64Value(ctx, s.Offset)
		if err != nil {
			return nil, err
		}
		iter = &offsetIter{skip: offset, childIter: iter}
	}
	if s.Limit != nil && len(s.SortFields) > 0 {
		limit, err := iters.GetInt64Value(ctx, s.Limit)
		if err != nil {
			return nil, err
		}
		iter = iters.NewTopRowsIter(s.SortFields, limit, false, iter, len(s.Schema()))
	} else if s.Limit != nil {
		limit, err := iters.GetInt64Value(ctx, s.Limit)
		if err != nil {
			return nil, err
		}
		iter = &iters.LimitIter{Limit: limit, ChildIter: iter}
	} else if len(s.SortFields) > 0 {
		iter = iters.NewSortIter(s.SortFields, iter)
	}
	return sql.NewSpanIter(span, iter), nil
}

func (b *BaseBuilder) buildSubqueryAlias(ctx *sql.Context, n *plan.SubqueryAlias, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.SubqueryAlias")

	if !n.OuterScopeVisibility && !n.IsLateral {
		row = nil
	}
	iter, err := b.buildNodeExec(ctx, n.Child, row)
	if err != nil {
		span.End()
		return nil, err
	}

	return sql.NewSpanIter(span, iter), nil
}

func (b *BaseBuilder) buildSort(ctx *sql.Context, n *plan.Sort, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.Sort")
	i, err := b.buildNodeExec(ctx, n.Child, row)
	if err != nil {
		span.End()
		return nil, err
	}
	return sql.NewSpanIter(span, iters.NewSortIter(n.SortFields, i)), nil
}

func (b *BaseBuilder) buildPrepareQuery(ctx *sql.Context, n *plan.PrepareQuery, row sql.Row) (sql.RowIter, error) {
	return sql.RowsToRowIter(sql.NewRow(types.OkResult{RowsAffected: 0, Info: plan.PrepareInfo{}})), nil
}

func (b *BaseBuilder) buildResolvedTable(ctx *sql.Context, n *plan.ResolvedTable, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.TableNode")

	partitions, err := n.Table.Partitions(ctx)
	if err != nil {
		span.End()
		return nil, err
	}

	var iter sql.RowIter
	iter = sql.NewTableRowIter(ctx, n.Table, partitions)

	if vct, ok := plan.FindVirtualColumnTable(n.Table); ok {
		iter, err = b.buildVirtualColumnTable(ctx, vct, iter, row)
		if err != nil {
			return nil, err
		}
	}

	return sql.NewSpanIter(span, iter), nil
}

func (b *BaseBuilder) buildTableCount(_ *sql.Context, n *plan.TableCountLookup, _ sql.Row) (sql.RowIter, error) {
	return sql.RowsToRowIter(sql.Row{int64(n.Count())}), nil
}
