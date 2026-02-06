package query

import (
	"bytes"
	"context"
	"os"
	"strings"

	"github.com/mithrandie/csvq/lib/constant"
	"github.com/mithrandie/csvq/lib/excmd"
	"github.com/mithrandie/csvq/lib/json"
	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"

	"github.com/mithrandie/ternary"
)

func Evaluate(ctx context.Context, scope *ReferenceScope, expr parser.QueryExpression) (value.Primary, error) {
	if expr == nil {
		return value.NewTernary(ternary.TRUE), nil
	}

	var val value.Primary
	var err error

	switch expr.(type) {
	case parser.PrimitiveType:
		val = expr.(parser.PrimitiveType).Value
	case parser.FieldReference, parser.ColumnNumber:
		val, err = evalFieldReference(expr, scope)
	case parser.Parentheses:
		val, err = Evaluate(ctx, scope, expr.(parser.Parentheses).Expr)
	case parser.Arithmetic:
		val, err = evalArithmetic(ctx, scope, expr.(parser.Arithmetic))
	case parser.UnaryArithmetic:
		val, err = evalUnaryArithmetic(ctx, scope, expr.(parser.UnaryArithmetic))
	case parser.Concat:
		val, err = evalConcat(ctx, scope, expr.(parser.Concat))
	case parser.Comparison:
		val, err = evalComparison(ctx, scope, expr.(parser.Comparison))
	case parser.Is:
		val, err = evalIs(ctx, scope, expr.(parser.Is))
	case parser.Between:
		val, err = evalBetween(ctx, scope, expr.(parser.Between))
	case parser.Like:
		val, err = evalLike(ctx, scope, expr.(parser.Like))
	case parser.In:
		val, err = evalIn(ctx, scope, expr.(parser.In))
	case parser.Any:
		val, err = evalAny(ctx, scope, expr.(parser.Any))
	case parser.All:
		val, err = evalAll(ctx, scope, expr.(parser.All))
	case parser.Exists:
		val, err = evalExists(ctx, scope, expr.(parser.Exists))
	case parser.Subquery:
		val, err = evalSubqueryForValue(ctx, scope, expr.(parser.Subquery))
	case parser.Function:
		val, err = evalFunction(ctx, scope, expr.(parser.Function))
	case parser.AggregateFunction:
		val, err = evalAggregateFunction(ctx, scope, expr.(parser.AggregateFunction))
	case parser.ListFunction:
		val, err = evalListFunction(ctx, scope, expr.(parser.ListFunction))
	case parser.AnalyticFunction:
		val, err = evalAnalyticFunction(scope, expr.(parser.AnalyticFunction))
	case parser.CaseExpr:
		val, err = evalCaseExpr(ctx, scope, expr.(parser.CaseExpr))
	case parser.Logic:
		val, err = evalLogic(ctx, scope, expr.(parser.Logic))
	case parser.UnaryLogic:
		val, err = evalUnaryLogic(ctx, scope, expr.(parser.UnaryLogic))
	case parser.Variable:
		val, err = scope.GetVariable(expr.(parser.Variable))
	case parser.EnvironmentVariable:
		val = value.NewString(os.Getenv(expr.(parser.EnvironmentVariable).Name))
	case parser.RuntimeInformation:
		val, err = GetRuntimeInformation(scope.Tx, expr.(parser.RuntimeInformation))
	case parser.Constant:
		val, err = constant.Get(expr.(parser.Constant))
		if err != nil {
			err = NewUndefinedConstantError(expr.(parser.Constant))
		}
	case parser.Flag:
		if v, ok := scope.Tx.GetFlag(expr.(parser.Flag).Name); ok {
			val = v
		} else {
			err = NewInvalidFlagNameError(expr.(parser.Flag))
		}
	case parser.VariableSubstitution:
		val, err = scope.SubstituteVariable(ctx, expr.(parser.VariableSubstitution))
	case parser.CursorStatus:
		val, err = evalCursorStatus(expr.(parser.CursorStatus), scope)
	case parser.CursorAttrebute:
		val, err = evalCursorAttribute(expr.(parser.CursorAttrebute), scope)
	case parser.Placeholder:
		val, err = evalPlaceholder(ctx, scope, expr.(parser.Placeholder))
	default:
		err = NewInvalidValueExpressionError(expr)
	}

	return val, err
}

func evaluateSequentialRoutine(ctx context.Context, scope *ReferenceScope, view *View, fn func(*ReferenceScope, int) error, thIdx int, gm *GoroutineTaskManager) {
	defer func() {
		if !gm.HasError() {
			if panicReport := recover(); panicReport != nil {
				gm.SetError(NewFatalError(panicReport))
			}
		}

		if 1 < gm.Number {
			gm.Done()
		}
	}()

	start, end := gm.RecordRange(thIdx)
	seqScope := scope.CreateScopeForSequentialEvaluation(
		&View{
			Header:    view.Header,
			RecordSet: view.RecordSet[start:end],
			isGrouped: view.isGrouped,
		},
	)

	i := 0
	for seqScope.NextRecord() {
		if gm.HasError() {
			break
		}
		if i&15 == 0 && ctx.Err() != nil {
			break
		}

		if err := fn(seqScope, start+seqScope.Records[0].recordIndex); err != nil {
			gm.SetError(err)
			break
		}

		i++
	}
}

func EvaluateSequentially(ctx context.Context, scope *ReferenceScope, view *View, fn func(*ReferenceScope, int) error) error {
	gm := NewGoroutineTaskManager(view.Len(), -1, scope.Tx.Flags.CPU)
	if 1 < gm.Number {
		for i := 0; i < gm.Number; i++ {
			gm.Add()
			go evaluateSequentialRoutine(ctx, scope, view, fn, i, gm)
		}
		gm.Wait()
	} else {
		evaluateSequentialRoutine(ctx, scope, view, fn, 0, gm)
	}

	if gm.HasError() {
		return gm.Err()
	}
	if ctx.Err() != nil {
		return ConvertContextError(ctx.Err())
	}
	return nil
}

func evalFieldReference(expr parser.QueryExpression, scope *ReferenceScope) (value.Primary, error) {
	var p value.Primary
	for i := range scope.Records {
		if idx, ok := scope.Records[i].cache.Get(expr); ok {
			if scope.Records[i].IsInRange() {
				p = scope.Records[i].view.RecordSet[scope.Records[i].recordIndex][idx][0]
			} else {
				p = value.NewNull()
			}
			break
		}

		idx, err := scope.Records[i].view.Header.SearchIndex(expr)
		if err == nil {
			if scope.Records[i].view.isGrouped && scope.Records[i].view.Header[idx].IsFromTable && !scope.Records[i].view.Header[idx].IsGroupKey {
				return nil, NewFieldNotGroupKeyError(expr)
			}
			if scope.Records[i].IsInRange() {
				p = scope.Records[i].view.RecordSet[scope.Records[i].recordIndex][idx][0]
			} else {
				p = value.NewNull()
			}
			scope.Records[i].cache.Add(expr, idx)
			break
		} else if err == errFieldAmbiguous {
			return nil, NewFieldAmbiguousError(expr)
		}
	}
	if p == nil {
		return nil, NewFieldNotExistError(expr)
	}
	return p, nil
}

func evalArithmetic(ctx context.Context, scope *ReferenceScope, expr parser.Arithmetic) (value.Primary, error) {
	lhs, err := Evaluate(ctx, scope, expr.LHS)
	if err != nil {
		return nil, err
	}
	if value.IsNull(lhs) {
		return value.NewNull(), nil
	}

	rhs, err := Evaluate(ctx, scope, expr.RHS)
	if err != nil {
		return nil, err
	}

	ret, err := Calculate(lhs, rhs, expr.Operator.Token)
	if err != nil {
		return nil, NewIntegerDevidedByZeroError(expr)
	}

	return ret, nil
}

func evalUnaryArithmetic(ctx context.Context, scope *ReferenceScope, expr parser.UnaryArithmetic) (value.Primary, error) {
	ope, err := Evaluate(ctx, scope, expr.Operand)
	if err != nil {
		return nil, err
	}

	if pi := value.ToIntegerStrictly(ope); !value.IsNull(pi) {
		val := pi.(*value.Integer).Raw()
		value.Discard(pi)
		switch expr.Operator.Token {
		case '-':
			val = val * -1
		}
		return value.NewInteger(val), nil
	}

	pf := value.ToFloat(ope)
	if value.IsNull(pf) {
		return value.NewNull(), nil
	}

	val := pf.(*value.Float).Raw()
	value.Discard(pf)

	switch expr.Operator.Token {
	case '-':
		val = val * -1
	}

	return value.NewFloat(val), nil
}

func evalConcat(ctx context.Context, scope *ReferenceScope, expr parser.Concat) (value.Primary, error) {
	items := make([]string, len(expr.Items))
	for i, v := range expr.Items {
		p, err := Evaluate(ctx, scope, v)
		if err != nil {
			return nil, err
		}
		s := value.ToString(p)
		if value.IsNull(s) {
			return value.NewNull(), nil
		}
		items[i] = s.(*value.String).Raw()
		value.Discard(s)
	}
	return value.NewString(strings.Join(items, "")), nil
}

func evalRowOrSingleValue(ctx context.Context, scope *ReferenceScope, expr parser.QueryExpression) (value.RowValue, value.Primary, error) {
	var rv value.RowValue
	var sv value.Primary

	switch expr.(type) {
	case parser.Subquery, parser.JsonQuery, parser.ValueList, parser.RowValue:
		row, err := EvalRowValue(ctx, scope, expr)
		if err != nil {
			return nil, nil, err
		}
		if row == nil {
			sv = value.NewNull()
		} else {
			if 1 == len(row) {
				sv = row[0]
			} else {
				rv = row
			}
		}
	default:
		val, err := Evaluate(ctx, scope, expr)
		if err != nil {
			return nil, nil, err
		}
		sv = val
	}

	return rv, sv, nil
}

func evalComparison(ctx context.Context, scope *ReferenceScope, expr parser.Comparison) (value.Primary, error) {
	var t ternary.Value

	rv, sv, err := evalRowOrSingleValue(ctx, scope, expr.LHS)
	if err != nil {
		return nil, err
	}

	if sv != nil {
		if value.IsNull(sv) {
			return value.NewTernary(ternary.UNKNOWN), nil
		}

		rhs, err := Evaluate(ctx, scope, expr.RHS)
		if err != nil {
			return nil, err
		}

		t = value.Compare(sv, rhs, expr.Operator.Literal, scope.Tx.Flags.DatetimeFormat, scope.Tx.Flags.GetTimeLocation())
	} else {
		rhs, err := EvalRowValue(ctx, scope, expr.RHS.(parser.RowValue))
		if err != nil {
			return nil, err
		}

		t, err = value.CompareRowValues(rv, rhs, expr.Operator.Literal, scope.Tx.Flags.DatetimeFormat, scope.Tx.Flags.GetTimeLocation())
		if err != nil {
			return nil, NewRowValueLengthInComparisonError(expr.RHS.(parser.RowValue), len(rv))
		}
	}

	return value.NewTernary(t), nil
}

func evalIs(ctx context.Context, scope *ReferenceScope, expr parser.Is) (value.Primary, error) {
	lhs, err := Evaluate(ctx, scope, expr.LHS)
	if err != nil {
		return nil, err
	}
	rhs, err := Evaluate(ctx, scope, expr.RHS)
	if err != nil {
		return nil, err
	}

	t := Is(lhs, rhs)
	if expr.IsNegated() {
		t = ternary.Not(t)
	}
	return value.NewTernary(t), nil
}

func evalBetween(ctx context.Context, scope *ReferenceScope, expr parser.Between) (value.Primary, error) {
	var t ternary.Value

	rv, sv, err := evalRowOrSingleValue(ctx, scope, expr.LHS)
	if err != nil {
		return nil, err
	}

	if sv != nil {
		if value.IsNull(sv) {
			return value.NewTernary(ternary.UNKNOWN), nil
		}

		low, err := Evaluate(ctx, scope, expr.Low)
		if err != nil {
			return nil, err
		}

		lowResult := value.GreaterOrEqual(sv, low, scope.Tx.Flags.DatetimeFormat, scope.Tx.Flags.GetTimeLocation())
		if lowResult == ternary.FALSE {
			t = ternary.FALSE
		} else {
			high, err := Evaluate(ctx, scope, expr.High)
			if err != nil {
				return nil, err
			}

			highResult := value.LessOrEqual(sv, high, scope.Tx.Flags.DatetimeFormat, scope.Tx.Flags.GetTimeLocation())
			t = ternary.And(lowResult, highResult)
		}
	} else {
		low, err := EvalRowValue(ctx, scope, expr.Low.(parser.RowValue))
		if err != nil {
			return nil, err
		}
		lowResult, err := value.CompareRowValues(rv, low, ">=", scope.Tx.Flags.DatetimeFormat, scope.Tx.Flags.GetTimeLocation())
		if err != nil {
			return nil, NewRowValueLengthInComparisonError(expr.Low.(parser.RowValue), len(rv))
		}

		if lowResult == ternary.FALSE {
			t = ternary.FALSE
		} else {
			high, err := EvalRowValue(ctx, scope, expr.High.(parser.RowValue))
			if err != nil {
				return nil, err
			}

			highResult, err := value.CompareRowValues(rv, high, "<=", scope.Tx.Flags.DatetimeFormat, scope.Tx.Flags.GetTimeLocation())
			if err != nil {
				return nil, NewRowValueLengthInComparisonError(expr.High.(parser.RowValue), len(rv))
			}

			t = ternary.And(lowResult, highResult)
		}
	}

	if expr.IsNegated() {
		t = ternary.Not(t)
	}
	return value.NewTernary(t), nil
}

func valuesForRowValueListComparison(ctx context.Context, scope *ReferenceScope, lhs parser.QueryExpression, values parser.QueryExpression) (value.RowValue, []value.RowValue, error) {
	var rowValue value.RowValue
	var list []value.RowValue
	var err error

	rowValue, err = EvalRowValue(ctx, scope, lhs)
	if err != nil {
		return rowValue, list, err
	}

	if rowValue != nil && 1 < len(rowValue) {
		list, err = evalRowValueList(ctx, scope, values)
	} else {
		list, err = evalArray(ctx, scope, values)
	}

	return rowValue, list, err
}

func evalIn(ctx context.Context, scope *ReferenceScope, expr parser.In) (value.Primary, error) {
	val, list, err := valuesForRowValueListComparison(ctx, scope, expr.LHS, expr.Values)
	if err != nil {
		return nil, err
	}

	var t ternary.Value
	if expr.IsNegated() {
		t, err = All(val, list, "<>", scope.Tx.Flags.DatetimeFormat, scope.Tx.Flags.GetTimeLocation())
	} else {
		t, err = Any(val, list, "=", scope.Tx.Flags.DatetimeFormat, scope.Tx.Flags.GetTimeLocation())
	}
	if err != nil {
		if subquery, ok := expr.Values.(parser.Subquery); ok {
			return nil, NewSelectFieldLengthInComparisonError(subquery, len(val))
		} else if jsonQuery, ok := expr.Values.(parser.JsonQuery); ok {
			return nil, NewRowValueLengthInComparisonError(jsonQuery, len(val))
		}

		rvlist, _ := expr.Values.(parser.RowValueList)
		rverr, _ := err.(*RowValueLengthInListError)
		return nil, NewRowValueLengthInComparisonError(rvlist.RowValues[rverr.Index], len(val))
	}
	return value.NewTernary(t), nil
}

func evalAny(ctx context.Context, scope *ReferenceScope, expr parser.Any) (value.Primary, error) {
	val, list, err := valuesForRowValueListComparison(ctx, scope, expr.LHS, expr.Values)
	if err != nil {
		return nil, err
	}

	t, err := Any(val, list, expr.Operator.Literal, scope.Tx.Flags.DatetimeFormat, scope.Tx.Flags.GetTimeLocation())
	if err != nil {
		if subquery, ok := expr.Values.(parser.Subquery); ok {
			return nil, NewSelectFieldLengthInComparisonError(subquery, len(val))
		} else if jsonQuery, ok := expr.Values.(parser.JsonQuery); ok {
			return nil, NewRowValueLengthInComparisonError(jsonQuery, len(val))
		}

		rvlist, _ := expr.Values.(parser.RowValueList)
		rverr, _ := err.(*RowValueLengthInListError)
		return nil, NewRowValueLengthInComparisonError(rvlist.RowValues[rverr.Index], len(val))
	}
	return value.NewTernary(t), nil
}

func evalAll(ctx context.Context, scope *ReferenceScope, expr parser.All) (value.Primary, error) {
	val, list, err := valuesForRowValueListComparison(ctx, scope, expr.LHS, expr.Values)
	if err != nil {
		return nil, err
	}

	t, err := All(val, list, expr.Operator.Literal, scope.Tx.Flags.DatetimeFormat, scope.Tx.Flags.GetTimeLocation())
	if err != nil {
		if subquery, ok := expr.Values.(parser.Subquery); ok {
			return nil, NewSelectFieldLengthInComparisonError(subquery, len(val))
		} else if jsonQuery, ok := expr.Values.(parser.JsonQuery); ok {
			return nil, NewRowValueLengthInComparisonError(jsonQuery, len(val))
		}

		rvlist, _ := expr.Values.(parser.RowValueList)
		rverr, _ := err.(*RowValueLengthInListError)
		return nil, NewRowValueLengthInComparisonError(rvlist.RowValues[rverr.Index], len(val))
	}
	return value.NewTernary(t), nil
}

func evalLike(ctx context.Context, scope *ReferenceScope, expr parser.Like) (value.Primary, error) {
	lhs, err := Evaluate(ctx, scope, expr.LHS)
	if err != nil {
		return nil, err
	}
	pattern, err := Evaluate(ctx, scope, expr.Pattern)
	if err != nil {
		return nil, err
	}

	t := Like(lhs, pattern)
	if expr.IsNegated() {
		t = ternary.Not(t)
	}
	return value.NewTernary(t), nil
}

func evalExists(ctx context.Context, scope *ReferenceScope, expr parser.Exists) (value.Primary, error) {
	view, err := Select(ctx, scope, expr.Query.Query)
	if err != nil {
		return nil, err
	}
	if view.RecordLen() < 1 {
		return value.NewTernary(ternary.FALSE), nil
	}
	return value.NewTernary(ternary.TRUE), nil
}

func evalSubqueryForValue(ctx context.Context, scope *ReferenceScope, expr parser.Subquery) (value.Primary, error) {
	view, err := Select(ctx, scope, expr.Query)
	if err != nil {
		return nil, err
	}

	if 1 < view.FieldLen() {
		return nil, NewSubqueryTooManyFieldsError(expr)
	}

	if 1 < view.RecordLen() {
		return nil, NewSubqueryTooManyRecordsError(expr)
	}

	if view.RecordLen() < 1 {
		return value.NewNull(), nil
	}

	return view.RecordSet[0][0][0], nil
}

func evalFunction(ctx context.Context, scope *ReferenceScope, expr parser.Function) (value.Primary, error) {
	name := strings.ToUpper(expr.Name)

	var fn BuiltInFunction
	var udfn *UserDefinedFunction
	var ok bool
	var err error

	if fn, ok = Functions[name]; !ok && name != "CALL" && name != "NOW" && name != "JSON_OBJECT" {
		udfn, err = scope.GetFunction(expr, name)
		if err != nil {
			return nil, NewFunctionNotExistError(expr, expr.Name)
		}
		if udfn.IsAggregate {
			aggrdcl := parser.AggregateFunction{
				BaseExpr: expr.BaseExpr,
				Name:     expr.Name,
				Args:     expr.Args,
			}
			return evalAggregateFunction(ctx, scope, aggrdcl)
		}

		if err = udfn.CheckArgsLen(expr, expr.Name, len(expr.Args)); err != nil {
			return nil, err
		}
	}

	if name == "JSON_OBJECT" {
		return JsonObject(ctx, scope, expr)
	}

	args := make([]value.Primary, len(expr.Args))
	for i, v := range expr.Args {
		arg, err := Evaluate(ctx, scope, v)
		if err != nil {
			return nil, err
		}
		args[i] = arg
	}

	if name == "CALL" {
		return Call(ctx, expr, args)
	} else if name == "NOW" {
		return Now(scope, expr, args)
	}

	if fn != nil {
		return fn(expr, args, scope.Tx.Flags)
	}
	return udfn.Execute(ctx, scope, args)
}

func evalAggregateFunction(ctx context.Context, scope *ReferenceScope, expr parser.AggregateFunction) (value.Primary, error) {
	var aggfn func([]value.Primary, *option.Flags) value.Primary
	var udfn *UserDefinedFunction
	var err error

	uname := strings.ToUpper(expr.Name)
	if fn, ok := AggregateFunctions[uname]; ok {
		aggfn = fn
	} else {
		if udfn, err = scope.GetFunction(expr, uname); err != nil || !udfn.IsAggregate {
			return nil, NewFunctionNotExistError(expr, expr.Name)
		}
	}

	if aggfn == nil {
		if err = udfn.CheckArgsLen(expr, expr.Name, len(expr.Args)-1); err != nil {
			return nil, err
		}
	} else {
		if len(expr.Args) != 1 {
			return nil, NewFunctionArgumentLengthError(expr, expr.Name, []int{1})
		}
	}

	var list []value.Primary
	if 0 < len(scope.Records) {
		if !scope.Records[0].view.isGrouped {
			return nil, NewNotGroupingRecordsError(expr, expr.Name)
		}

		listExpr := expr.Args[0]
		if _, ok := listExpr.(parser.AllColumns); ok {
			listExpr = parser.NewIntegerValue(1)
		}

		if uname == "COUNT" {
			if pt, ok := listExpr.(parser.PrimitiveType); ok {
				v := pt.Value
				if !value.IsNull(v) && !value.IsUnknown(v) && scope.Records[0].IsInRange() {
					return value.NewInteger(int64(scope.Records[0].view.RecordSet[scope.Records[0].recordIndex].GroupLen())), nil
				} else {
					return value.NewInteger(0), nil
				}
			}
		}

		if scope.Records[0].IsInRange() {
			view, err := NewViewFromGroupedRecord(ctx, scope.Tx.Flags, scope.Records[0])
			if err != nil {
				return nil, err
			}
			list, err = view.ListValuesForAggregateFunctions(ctx, scope, expr, listExpr, expr.IsDistinct())
			if err != nil {
				return nil, err
			}
		}
	}

	if aggfn == nil {
		argsExprs := expr.Args[1:]
		args := make([]value.Primary, len(argsExprs))
		for i, v := range argsExprs {
			arg, err := Evaluate(ctx, scope, v)
			if err != nil {
				return nil, err
			}
			args[i] = arg
		}
		return udfn.ExecuteAggregate(ctx, scope, list, args)
	}

	return aggfn(list, scope.Tx.Flags), nil
}

func evalListFunction(ctx context.Context, scope *ReferenceScope, expr parser.ListFunction) (value.Primary, error) {
	var separator string
	var err error

	switch strings.ToUpper(expr.Name) {
	case "JSON_AGG":
		err = checkArgsForJsonAgg(expr)
	default: // LISTAGG
		separator, err = checkArgsForListFunction(ctx, scope, expr)
	}

	if err != nil {
		return nil, err
	}

	var list []value.Primary
	if 0 < len(scope.Records) {
		if !scope.Records[0].view.isGrouped {
			return nil, NewNotGroupingRecordsError(expr, expr.Name)
		}

		view, err := NewViewFromGroupedRecord(ctx, scope.Tx.Flags, scope.Records[0])
		if err != nil {
			return nil, err
		}
		if expr.OrderBy != nil {
			err := view.OrderBy(ctx, scope, expr.OrderBy.(parser.OrderByClause))
			if err != nil {
				return nil, err
			}
		}

		list, err = view.ListValuesForAggregateFunctions(ctx, scope, expr, expr.Args[0], expr.IsDistinct())
		if err != nil {
			return nil, err
		}
	}

	switch strings.ToUpper(expr.Name) {
	case "JSON_AGG":
		return JsonAgg(list), nil
	}
	return ListAgg(list, separator), nil
}

func evalAnalyticFunction(scope *ReferenceScope, expr parser.AnalyticFunction) (value.Primary, error) {
	if 0 < len(scope.Records) {
		fieldIndex, ok := scope.Records[0].view.Header.ContainsObject(expr)
		if ok {
			if !scope.Records[0].IsInRange() {
				return value.NewNull(), nil
			}
			return scope.Records[0].view.RecordSet[scope.Records[0].recordIndex][fieldIndex][0], nil
		}
	}
	return nil, NewNotAllowedAnalyticFunctionError(expr)
}

func checkArgsForListFunction(ctx context.Context, scope *ReferenceScope, expr parser.ListFunction) (string, error) {
	var separator string

	if expr.Args == nil || 2 < len(expr.Args) {
		return "", NewFunctionArgumentLengthError(expr, expr.Name, []int{1, 2})
	}

	if len(expr.Args) == 2 {
		p, err := Evaluate(ctx, scope, expr.Args[1])
		if err != nil {
			return separator, NewFunctionInvalidArgumentError(expr, expr.Name, "the second argument must be a string")
		}
		s := value.ToString(p)
		if value.IsNull(s) {
			return separator, NewFunctionInvalidArgumentError(expr, expr.Name, "the second argument must be a string")
		}
		separator = s.(*value.String).Raw()
		value.Discard(s)
	}
	return separator, nil
}

func checkArgsForJsonAgg(expr parser.ListFunction) error {
	if 1 != len(expr.Args) {
		return NewFunctionArgumentLengthError(expr, expr.Name, []int{1})
	}
	return nil
}

func evalCaseExpr(ctx context.Context, scope *ReferenceScope, expr parser.CaseExpr) (value.Primary, error) {
	var val value.Primary
	var err error
	if expr.Value != nil {
		val, err = Evaluate(ctx, scope, expr.Value)
		if err != nil {
			return nil, err
		}
	}

	for _, v := range expr.When {
		when := v.(parser.CaseExprWhen)
		var t ternary.Value

		cond, err := Evaluate(ctx, scope, when.Condition)
		if err != nil {
			return nil, err
		}

		if val == nil {
			t = cond.Ternary()
		} else {
			t = value.Equal(val, cond, scope.Tx.Flags.DatetimeFormat, scope.Tx.Flags.GetTimeLocation())
		}

		if t == ternary.TRUE {
			result, err := Evaluate(ctx, scope, when.Result)
			if err != nil {
				return nil, err
			}
			return result, nil
		}
	}

	if expr.Else == nil {
		return value.NewNull(), nil
	}
	result, err := Evaluate(ctx, scope, expr.Else.(parser.CaseExprElse).Result)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func evalLogic(ctx context.Context, scope *ReferenceScope, expr parser.Logic) (value.Primary, error) {
	lhs, err := Evaluate(ctx, scope, expr.LHS)
	if err != nil {
		return nil, err
	}
	switch expr.Operator.Token {
	case parser.AND:
		if lhs.Ternary() == ternary.FALSE {
			return value.NewTernary(ternary.FALSE), nil
		}
	case parser.OR:
		if lhs.Ternary() == ternary.TRUE {
			return value.NewTernary(ternary.TRUE), nil
		}
	}

	rhs, err := Evaluate(ctx, scope, expr.RHS)
	if err != nil {
		return nil, err
	}

	var t ternary.Value
	switch expr.Operator.Token {
	case parser.AND:
		t = ternary.And(lhs.Ternary(), rhs.Ternary())
	case parser.OR:
		t = ternary.Or(lhs.Ternary(), rhs.Ternary())
	}
	return value.NewTernary(t), nil
}

func evalUnaryLogic(ctx context.Context, scope *ReferenceScope, expr parser.UnaryLogic) (value.Primary, error) {
	ope, err := Evaluate(ctx, scope, expr.Operand)
	if err != nil {
		return nil, err
	}

	var t ternary.Value
	switch expr.Operator.Token {
	case parser.NOT, '!':
		t = ternary.Not(ope.Ternary())
	}
	return value.NewTernary(t), nil
}

func evalCursorStatus(expr parser.CursorStatus, scope *ReferenceScope) (value.Primary, error) {
	var t ternary.Value
	var err error

	switch expr.Type.Token {
	case parser.OPEN:
		t, err = scope.CursorIsOpen(expr.Cursor)
		if err != nil {
			return nil, err
		}
	case parser.RANGE:
		t, err = scope.CursorIsInRange(expr.Cursor)
		if err != nil {
			return nil, err
		}
	}

	if !expr.Negation.IsEmpty() {
		t = ternary.Not(t)
	}
	return value.NewTernary(t), nil
}

func evalCursorAttribute(expr parser.CursorAttrebute, scope *ReferenceScope) (value.Primary, error) {
	var i int
	var err error

	switch expr.Attrebute.Token {
	case parser.COUNT:
		i, err = scope.CursorCount(expr.Cursor)
		if err != nil {
			return nil, err
		}
	}
	return value.NewInteger(int64(i)), nil
}

func evalPlaceholder(ctx context.Context, scope *ReferenceScope, expr parser.Placeholder) (value.Primary, error) {
	v := ctx.Value(StatementReplaceValuesContextKey)
	if v == nil {
		return nil, NewStatementReplaceValueNotSpecifiedError(expr)
	}
	replace := v.(*ReplaceValues)

	var idx int
	if 0 < len(expr.Name) {
		i, ok := replace.Names[expr.Name]
		if !ok {
			return nil, NewStatementReplaceValueNotSpecifiedError(expr)
		}
		idx = i
	} else {
		idx = expr.Ordinal - 1
		if len(replace.Values) <= idx {
			return nil, NewStatementReplaceValueNotSpecifiedError(expr)
		}
	}
	return Evaluate(ctx, scope, replace.Values[idx])
}

// EvalRowValue returns single or multiple fields, single record
func EvalRowValue(ctx context.Context, scope *ReferenceScope, expr parser.QueryExpression) (value.RowValue, error) {
	var rowValue value.RowValue
	var err error

	switch expr.(type) {
	case parser.Subquery:
		rowValue, err = evalSubqueryForRowValue(ctx, scope, expr.(parser.Subquery))
	case parser.JsonQuery:
		rowValue, err = evalJsonQueryForRowValue(ctx, scope, expr.(parser.JsonQuery))
	case parser.ValueList:
		rowValue, err = evalValueList(ctx, scope, expr.(parser.ValueList))
	case parser.RowValue:
		rowValue, err = EvalRowValue(ctx, scope, expr.(parser.RowValue).Value)
	default:
		var p value.Primary
		p, err = Evaluate(ctx, scope, expr)
		if err == nil {
			rowValue = value.RowValue{p}
		}
	}

	return rowValue, err
}

// evalRowValueList returns multiple fields, multiple records
func evalRowValueList(ctx context.Context, scope *ReferenceScope, expr parser.QueryExpression) ([]value.RowValue, error) {
	var list []value.RowValue
	var err error

	switch expr.(type) {
	case parser.Subquery:
		list, err = evalSubqueryForRowValueList(ctx, scope, expr.(parser.Subquery))
	case parser.JsonQuery:
		list, err = evalJsonQueryForRowValueList(ctx, scope, expr.(parser.JsonQuery))
	case parser.RowValueList:
		rowValueList := expr.(parser.RowValueList)
		list = make([]value.RowValue, len(rowValueList.RowValues))
		for i, v := range rowValueList.RowValues {
			rowValue, e := EvalRowValue(ctx, scope, v.(parser.RowValue))
			if e != nil {
				return list, e
			}
			list[i] = rowValue
		}
	}

	return list, err
}

/*
 * Returns single fields, multiple records
 */
func evalArray(ctx context.Context, scope *ReferenceScope, expr parser.QueryExpression) ([]value.RowValue, error) {
	var array []value.RowValue
	var err error

	switch expr.(type) {
	case parser.Subquery:
		array, err = evalSubqueryForArray(ctx, scope, expr.(parser.Subquery))
	case parser.JsonQuery:
		array, err = evalJsonQueryForArray(ctx, scope, expr.(parser.JsonQuery))
	case parser.ValueList:
		values, e := evalValueList(ctx, scope, expr.(parser.ValueList))
		if e != nil {
			return array, e
		}
		array = make([]value.RowValue, len(values))
		for i, v := range values {
			array[i] = value.RowValue{v}
		}
	case parser.RowValue:
		array, err = evalArray(ctx, scope, expr.(parser.RowValue).Value)
	}

	return array, err
}

func evalSubqueryForRowValue(ctx context.Context, scope *ReferenceScope, expr parser.Subquery) (value.RowValue, error) {
	view, err := Select(ctx, scope, expr.Query)
	if err != nil {
		return nil, err
	}

	if view.RecordLen() < 1 {
		return nil, nil
	}

	if 1 < view.RecordLen() {
		return nil, NewSubqueryTooManyRecordsError(expr)
	}

	rowValue := make(value.RowValue, view.FieldLen())
	for i := range view.RecordSet[0] {
		rowValue[i] = view.RecordSet[0][i][0]
	}

	return rowValue, nil
}

func evalJsonQueryForRowValue(ctx context.Context, scope *ReferenceScope, expr parser.JsonQuery) (value.RowValue, error) {
	query, jsonText, err := evalJsonQueryParameters(ctx, scope, expr)
	if err != nil {
		return nil, err
	}

	if value.IsNull(query) || value.IsNull(jsonText) {
		return nil, nil
	}

	_, values, _, err := json.LoadTable(query.(*value.String).Raw(), jsonText.(*value.String).Raw())
	if err != nil {
		return nil, NewLoadJsonError(expr, err.Error())
	}

	if len(values) < 1 {
		return nil, nil
	}

	if 1 < len(values) {
		return nil, NewJsonQueryTooManyRecordsError(expr)
	}

	rowValue := make(value.RowValue, len(values[0]))
	for i, cell := range values[0] {
		rowValue[i] = cell
	}

	return rowValue, nil
}

func evalValueList(ctx context.Context, scope *ReferenceScope, expr parser.ValueList) (value.RowValue, error) {
	values := make(value.RowValue, len(expr.Values))
	for i, v := range expr.Values {
		val, err := Evaluate(ctx, scope, v)
		if err != nil {
			return nil, err
		}
		values[i] = val
	}
	return values, nil
}

func evalSubqueryForRowValueList(ctx context.Context, scope *ReferenceScope, expr parser.Subquery) ([]value.RowValue, error) {
	view, err := Select(ctx, scope, expr.Query)
	if err != nil {
		return nil, err
	}

	if view.RecordLen() < 1 {
		return nil, nil
	}

	list := make([]value.RowValue, view.RecordLen())
	for i, r := range view.RecordSet {
		rowValue := make(value.RowValue, view.FieldLen())
		for j := range r {
			rowValue[j] = r[j][0]
		}
		list[i] = rowValue
	}

	return list, nil
}

func evalJsonQueryForRowValueList(ctx context.Context, scope *ReferenceScope, expr parser.JsonQuery) ([]value.RowValue, error) {
	query, jsonText, err := evalJsonQueryParameters(ctx, scope, expr)
	if err != nil {
		return nil, err
	}

	if value.IsNull(query) || value.IsNull(jsonText) {
		return nil, nil
	}

	_, values, _, err := json.LoadTable(query.(*value.String).Raw(), jsonText.(*value.String).Raw())
	if err != nil {
		return nil, NewLoadJsonError(expr, err.Error())
	}

	if len(values) < 1 {
		return nil, nil
	}

	list := make([]value.RowValue, len(values))
	for i, row := range values {
		list[i] = row
	}

	return list, nil
}

func evalSubqueryForArray(ctx context.Context, scope *ReferenceScope, expr parser.Subquery) ([]value.RowValue, error) {
	view, err := Select(ctx, scope, expr.Query)
	if err != nil {
		return nil, err
	}

	if 1 < view.FieldLen() {
		return nil, NewSubqueryTooManyFieldsError(expr)
	}

	if view.RecordLen() < 1 {
		return nil, nil
	}

	list := make([]value.RowValue, view.RecordLen())
	for i := range view.RecordSet {
		list[i] = value.RowValue{view.RecordSet[i][0][0]}
	}

	return list, nil
}

func evalJsonQueryForArray(ctx context.Context, scope *ReferenceScope, expr parser.JsonQuery) ([]value.RowValue, error) {
	query, jsonText, err := evalJsonQueryParameters(ctx, scope, expr)
	if err != nil {
		return nil, err
	}

	if value.IsNull(query) || value.IsNull(jsonText) {
		return nil, nil
	}

	values, err := json.LoadArray(query.(*value.String).Raw(), jsonText.(*value.String).Raw())
	if err != nil {
		return nil, NewLoadJsonError(expr, err.Error())
	}

	if len(values) < 1 {
		return nil, nil
	}

	list := make([]value.RowValue, len(values))
	for i, v := range values {
		list[i] = value.RowValue{v}
	}

	return list, nil
}

func evalJsonQueryParameters(ctx context.Context, scope *ReferenceScope, expr parser.JsonQuery) (value.Primary, value.Primary, error) {
	queryValue, err := Evaluate(ctx, scope, expr.Query)
	if err != nil {
		return nil, nil, err
	}
	query := value.ToString(queryValue)

	jsonTextValue, err := Evaluate(ctx, scope, expr.JsonText)
	if err != nil {
		return nil, nil, err
	}
	jsonText := value.ToString(jsonTextValue)

	return query, jsonText, nil
}

func EvaluateEmbeddedString(ctx context.Context, scope *ReferenceScope, embedded string) (string, error) {
	enclosure := rune(0)
	if 1 < len(embedded) {
		if embedded[0] == '\'' && embedded[len(embedded)-1] == '\'' {
			embedded = embedded[1 : len(embedded)-1]
			enclosure = '\''
		} else if embedded[0] == '"' && embedded[len(embedded)-1] == '"' {
			embedded = embedded[1 : len(embedded)-1]
			enclosure = '"'
		}
	}

	scanner := new(excmd.ArgumentScanner).Init(embedded)
	buf := &bytes.Buffer{}
	var err error

	for scanner.Scan() {
		switch scanner.ElementType() {
		case excmd.FixedString:
			buf.WriteString(option.UnescapeString(scanner.Text(), enclosure))
		case excmd.Variable:
			if err = writeEmbeddedExpression(ctx, scope, buf, parser.Variable{Name: scanner.Text()}); err != nil {
				return buf.String(), err
			}
		case excmd.EnvironmentVariable:
			buf.WriteString(os.Getenv(scanner.Text()))
		case excmd.RuntimeInformation:
			if err = writeEmbeddedExpression(ctx, scope, buf, parser.RuntimeInformation{Name: scanner.Text()}); err != nil {
				return buf.String(), err
			}
		case excmd.CsvqExpression:
			expr := scanner.Text()
			if 0 < len(expr) {
				statements, _, err := parser.Parse(expr, expr, false, scope.Tx.Flags.AnsiQuotes)
				if err != nil {
					if syntaxErr, ok := err.(*parser.SyntaxError); ok {
						err = NewSyntaxError(syntaxErr)
					}
					return buf.String(), err
				}

				switch len(statements) {
				case 1:
					qexpr, ok := statements[0].(parser.QueryExpression)
					if !ok {
						return buf.String(), NewInvalidValueExpressionError(parser.NewStringValue(expr))
					}
					if err = writeEmbeddedExpression(ctx, scope, buf, qexpr); err != nil {
						return buf.String(), err
					}
				default:
					return buf.String(), NewInvalidValueExpressionError(parser.NewStringValue(expr))
				}
			}
		}
	}
	if err = scanner.Err(); err != nil {
		return buf.String(), err
	}

	return buf.String(), nil
}

func writeEmbeddedExpression(ctx context.Context, scope *ReferenceScope, buf *bytes.Buffer, expr parser.QueryExpression) error {
	p, err := Evaluate(ctx, scope, expr)
	if err != nil {
		return err
	}
	s, _ := NewStringFormatter().Format("%s", []value.Primary{p})
	buf.WriteString(s)
	return nil
}
