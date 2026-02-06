package query

import (
	"strings"

	"github.com/mithrandie/csvq/lib/parser"
)

func HasAggregateFunction(expr parser.QueryExpression, scope *ReferenceScope) (bool, error) {
	switch expr.(type) {
	case parser.AggregateFunction, parser.ListFunction:
		return true, nil
	case parser.Function:
		e := expr.(parser.Function)
		if strings.ToUpper(e.Name) == "JSON_OBJECT" {
			return false, nil
		}

		if udfn, err := scope.GetFunction(expr, expr.(parser.Function).Name); err == nil && udfn.IsAggregate {
			return true, nil
		}

		return HasAggregateFunctionInList(e.Args, scope)
	case parser.PrimitiveType, parser.FieldReference, parser.ColumnNumber, parser.Subquery, parser.Exists,
		parser.Variable, parser.EnvironmentVariable, parser.RuntimeInformation, parser.Constant, parser.Flag,
		parser.CursorStatus, parser.CursorAttrebute, parser.Placeholder,
		parser.AllColumns:
		return false, nil
	case parser.Parentheses:
		return HasAggregateFunction(expr.(parser.Parentheses).Expr, scope)
	case parser.Arithmetic:
		e := expr.(parser.Arithmetic)
		return HasAggregateFunctionInList([]parser.QueryExpression{e.LHS, e.RHS}, scope)
	case parser.UnaryArithmetic:
		return HasAggregateFunction(expr.(parser.UnaryArithmetic).Operand, scope)
	case parser.Concat:
		return HasAggregateFunctionInList(expr.(parser.Concat).Items, scope)
	case parser.Comparison:
		e := expr.(parser.Comparison)
		return HasAggregateFunctionInList([]parser.QueryExpression{e.LHS, e.RHS}, scope)
	case parser.Is:
		e := expr.(parser.Is)
		return HasAggregateFunctionInList([]parser.QueryExpression{e.LHS, e.RHS}, scope)
	case parser.Between:
		e := expr.(parser.Between)
		return HasAggregateFunctionInList([]parser.QueryExpression{e.LHS, e.Low, e.High}, scope)
	case parser.Like:
		e := expr.(parser.Like)
		return HasAggregateFunctionInList([]parser.QueryExpression{e.LHS, e.Pattern}, scope)
	case parser.In:
		e := expr.(parser.In)
		return hasAggFuncInRowValueComparison(e.LHS, e.Values, scope)
	case parser.Any:
		e := expr.(parser.Any)
		return hasAggFuncInRowValueComparison(e.LHS, e.Values, scope)
	case parser.All:
		e := expr.(parser.All)
		return hasAggFuncInRowValueComparison(e.LHS, e.Values, scope)
	case parser.AnalyticFunction:
		e := expr.(parser.AnalyticFunction)
		values := make([]parser.QueryExpression, 0, len(e.Args)+2)
		values = append(values, e.Args...)

		if e.AnalyticClause.PartitionClause != nil {
			values = append(values, e.AnalyticClause.PartitionClause.(parser.PartitionClause).Values...)
		}
		if e.AnalyticClause.OrderByClause != nil {
			values = append(values, GetValuesInOrderByClause(e.AnalyticClause.OrderByClause.(parser.OrderByClause))...)
		}

		return HasAggregateFunctionInList(values, scope)
	case parser.CaseExpr:
		e := expr.(parser.CaseExpr)
		values := make([]parser.QueryExpression, 0, len(e.When)+2)
		if e.Value != nil {
			values = append(values, e.Value)
		}

		for _, v := range e.When {
			w := v.(parser.CaseExprWhen)
			values = append(values, w.Condition, w.Result)
		}

		if e.Else != nil {
			values = append(values, e.Else.(parser.CaseExprElse).Result)
		}

		return HasAggregateFunctionInList(values, scope)
	case parser.Logic:
		e := expr.(parser.Logic)
		return HasAggregateFunctionInList([]parser.QueryExpression{e.LHS, e.RHS}, scope)
	case parser.UnaryLogic:
		return HasAggregateFunction(expr.(parser.UnaryLogic).Operand, scope)
	case parser.VariableSubstitution:
		return HasAggregateFunction(expr.(parser.VariableSubstitution).Value, scope)
	default:
		return false, NewInvalidValueExpressionError(expr)
	}
}

func HasAggregateFunctionInList(list []parser.QueryExpression, scope *ReferenceScope) (bool, error) {
	for _, op := range list {
		ok, err := HasAggregateFunction(op, scope)
		if err != nil {
			return false, err
		}
		if ok {
			return true, nil
		}
	}
	return false, nil
}

func GetValuesInOrderByClause(e parser.OrderByClause) []parser.QueryExpression {
	values := make([]parser.QueryExpression, 0, len(e.Items))
	for _, v := range e.Items {
		values = append(values, v.(parser.OrderItem).Value)
	}
	return values
}

func hasAggFuncInRowValueComparison(lhs parser.QueryExpression, values parser.QueryExpression, scope *ReferenceScope) (bool, error) {
	val, err := hasAggFuncInRowValue(lhs, scope)
	if err != nil {
		return false, err
	}
	if val {
		return true, nil
	}

	return hasAggFuncInRowValue(values, scope)
}

func hasAggFuncInRowValue(expr parser.QueryExpression, scope *ReferenceScope) (bool, error) {
	switch expr.(type) {
	case parser.Subquery, parser.JsonQuery:
		return false, nil
	case parser.ValueList:
		return HasAggregateFunctionInList(expr.(parser.ValueList).Values, scope)
	case parser.RowValue:
		return hasAggFuncInRowValue(expr.(parser.RowValue).Value, scope)
	case parser.RowValueList:
		e := expr.(parser.RowValueList)
		for _, v := range e.RowValues {
			ok, err := hasAggFuncInRowValue(v, scope)
			if err != nil {
				return false, err
			}
			if ok {
				return true, nil
			}
		}
		return false, nil
	default:
		return HasAggregateFunction(expr, scope)
	}
}

func SearchAnalyticFunctions(expr parser.QueryExpression) ([]parser.AnalyticFunction, error) {
	switch expr.(type) {
	case parser.AnalyticFunction:
		e := expr.(parser.AnalyticFunction)
		values := make([]parser.QueryExpression, 0, len(e.Args)+2)
		values = append(values, e.Args...)

		if e.AnalyticClause.PartitionClause != nil {
			values = append(values, e.AnalyticClause.PartitionClause.(parser.PartitionClause).Values...)
		}
		if e.AnalyticClause.OrderByClause != nil {
			values = append(values, GetValuesInOrderByClause(e.AnalyticClause.OrderByClause.(parser.OrderByClause))...)
		}

		childFuncs, err := SearchAnalyticFunctionsInList(values)
		if err != nil {
			return nil, err
		}

		return appendAnalyticFunctionToListIfNotExist(childFuncs, []parser.AnalyticFunction{e}), nil
	case parser.PrimitiveType, parser.FieldReference, parser.ColumnNumber, parser.Subquery, parser.Exists,
		parser.Variable, parser.EnvironmentVariable, parser.RuntimeInformation, parser.Constant, parser.Flag,
		parser.CursorStatus, parser.CursorAttrebute, parser.Placeholder,
		parser.AllColumns:
		return nil, nil
	case parser.Parentheses:
		return SearchAnalyticFunctions(expr.(parser.Parentheses).Expr)
	case parser.Arithmetic:
		e := expr.(parser.Arithmetic)
		return SearchAnalyticFunctionsInList([]parser.QueryExpression{e.LHS, e.RHS})
	case parser.UnaryArithmetic:
		return SearchAnalyticFunctions(expr.(parser.UnaryArithmetic).Operand)
	case parser.Concat:
		return SearchAnalyticFunctionsInList(expr.(parser.Concat).Items)
	case parser.Comparison:
		e := expr.(parser.Comparison)
		return SearchAnalyticFunctionsInList([]parser.QueryExpression{e.LHS, e.RHS})
	case parser.Is:
		e := expr.(parser.Is)
		return SearchAnalyticFunctionsInList([]parser.QueryExpression{e.LHS, e.RHS})
	case parser.Between:
		e := expr.(parser.Between)
		return SearchAnalyticFunctionsInList([]parser.QueryExpression{e.LHS, e.Low, e.High})
	case parser.Like:
		e := expr.(parser.Like)
		return SearchAnalyticFunctionsInList([]parser.QueryExpression{e.LHS, e.Pattern})
	case parser.In:
		e := expr.(parser.In)
		return searchAnalyticFunctionsInRowValueComparison(e.LHS, e.Values)
	case parser.Any:
		e := expr.(parser.Any)
		return searchAnalyticFunctionsInRowValueComparison(e.LHS, e.Values)
	case parser.All:
		e := expr.(parser.All)
		return searchAnalyticFunctionsInRowValueComparison(e.LHS, e.Values)
	case parser.Function:
		if strings.ToUpper(expr.(parser.Function).Name) == "JSON_OBJECT" {
			return nil, nil
		}
		return SearchAnalyticFunctionsInList(expr.(parser.Function).Args)
	case parser.AggregateFunction:
		return SearchAnalyticFunctionsInList(expr.(parser.AggregateFunction).Args)
	case parser.ListFunction:
		return SearchAnalyticFunctionsInList(expr.(parser.ListFunction).Args)
	case parser.CaseExpr:
		e := expr.(parser.CaseExpr)
		values := make([]parser.QueryExpression, 0, len(e.When)+2)
		if e.Value != nil {
			values = append(values, e.Value)
		}

		for _, v := range e.When {
			w := v.(parser.CaseExprWhen)
			values = append(values, w.Condition, w.Result)
		}

		if e.Else != nil {
			values = append(values, e.Else.(parser.CaseExprElse).Result)
		}

		return SearchAnalyticFunctionsInList(values)
	case parser.Logic:
		e := expr.(parser.Logic)
		return SearchAnalyticFunctionsInList([]parser.QueryExpression{e.LHS, e.RHS})
	case parser.UnaryLogic:
		return SearchAnalyticFunctions(expr.(parser.UnaryLogic).Operand)
	case parser.VariableSubstitution:
		return SearchAnalyticFunctions(expr.(parser.VariableSubstitution).Value)
	default:
		return nil, NewInvalidValueExpressionError(expr)
	}
}

func SearchAnalyticFunctionsInList(list []parser.QueryExpression) ([]parser.AnalyticFunction, error) {
	var funcs []parser.AnalyticFunction = nil
	for _, op := range list {
		children, err := SearchAnalyticFunctions(op)
		if err != nil {
			return funcs, err
		}
		if children != nil {
			funcs = appendAnalyticFunctionToListIfNotExist(children, funcs)
		}
	}
	return funcs, nil
}

func appendAnalyticFunctionToListIfNotExist(list1 []parser.AnalyticFunction, list2 []parser.AnalyticFunction) []parser.AnalyticFunction {
	var createMap = func(list []parser.AnalyticFunction) map[string]parser.AnalyticFunction {
		m := make(map[string]parser.AnalyticFunction, len(list))
		for _, v := range list {
			m[FormatFieldIdentifier(v)] = v
		}
		return m
	}

	m1 := createMap(list1)
	m2 := createMap(list2)
	for k, v := range m2 {
		if _, ok := m1[k]; !ok {
			list1 = append(list1, v)
		}
	}

	return list1
}

func searchAnalyticFunctionsInRowValueComparison(lhs parser.QueryExpression, values parser.QueryExpression) ([]parser.AnalyticFunction, error) {
	var funcs []parser.AnalyticFunction = nil

	children, err := searchAnalyticFunctionsInRowValue(lhs)
	if err != nil {
		return funcs, err
	}
	if children != nil {
		funcs = appendAnalyticFunctionToListIfNotExist(children, funcs)
	}

	childrenInValues, err := searchAnalyticFunctionsInRowValue(values)
	if err != nil {
		return funcs, err
	}
	if childrenInValues != nil {
		funcs = appendAnalyticFunctionToListIfNotExist(childrenInValues, funcs)
	}

	return funcs, nil
}

func searchAnalyticFunctionsInRowValue(expr parser.QueryExpression) ([]parser.AnalyticFunction, error) {
	switch expr.(type) {
	case parser.Subquery, parser.JsonQuery:
		return nil, nil
	case parser.ValueList:
		e := expr.(parser.ValueList)
		return SearchAnalyticFunctionsInList(e.Values)
	case parser.RowValue:
		return searchAnalyticFunctionsInRowValue(expr.(parser.RowValue).Value)
	case parser.RowValueList:
		var funcs []parser.AnalyticFunction = nil

		e := expr.(parser.RowValueList)
		for _, v := range e.RowValues {
			children, err := searchAnalyticFunctionsInRowValue(v)
			if err != nil {
				return funcs, err
			}
			if children != nil {
				funcs = appendAnalyticFunctionToListIfNotExist(children, funcs)
			}
		}

		return funcs, nil
	default:
		return SearchAnalyticFunctions(expr)
	}
}
