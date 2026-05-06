package query

import (
	"context"
	"fmt"
	"strings"

	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"
)

type UserDefinedFunctionMap struct {
	*SyncMap
}

func NewUserDefinedFunctionMap() UserDefinedFunctionMap {
	return UserDefinedFunctionMap{
		NewSyncMap(),
	}
}

func (m UserDefinedFunctionMap) IsEmpty() bool {
	return m.SyncMap == nil
}

func (m UserDefinedFunctionMap) Store(name string, val *UserDefinedFunction) {
	m.store(strings.ToUpper(name), val)
}

func (m UserDefinedFunctionMap) LoadDirect(name string) (interface{}, bool) {
	return m.load(strings.ToUpper(name))
}

func (m UserDefinedFunctionMap) Load(name string) (*UserDefinedFunction, bool) {
	if v, ok := m.load(strings.ToUpper(name)); ok {
		return v.(*UserDefinedFunction), true
	}
	return nil, false
}

func (m UserDefinedFunctionMap) Delete(name string) {
	m.delete(strings.ToUpper(name))
}

func (m UserDefinedFunctionMap) Exists(name string) bool {
	return m.exists(strings.ToUpper(name))
}

func (m UserDefinedFunctionMap) Declare(expr parser.FunctionDeclaration) error {
	if err := m.CheckDuplicate(expr.Name); err != nil {
		return err
	}

	parameters, defaults, required, err := m.parseParameters(expr.Parameters)
	if err != nil {
		return err
	}

	m.Store(expr.Name.Literal, &UserDefinedFunction{
		Name:         expr.Name,
		Statements:   expr.Statements,
		Parameters:   parameters,
		Defaults:     defaults,
		RequiredArgs: required,
	})
	return nil
}

func (m UserDefinedFunctionMap) DeclareAggregate(expr parser.AggregateDeclaration) error {
	if err := m.CheckDuplicate(expr.Name); err != nil {
		return err
	}

	parameters, defaults, required, err := m.parseParameters(expr.Parameters)
	if err != nil {
		return err
	}

	m.Store(expr.Name.Literal, &UserDefinedFunction{
		Name:         expr.Name,
		Statements:   expr.Statements,
		Parameters:   parameters,
		Defaults:     defaults,
		RequiredArgs: required,
		IsAggregate:  true,
		Cursor:       expr.Cursor,
	})
	return nil
}

func (m UserDefinedFunctionMap) parseParameters(parameters []parser.VariableAssignment) ([]parser.Variable, map[string]parser.QueryExpression, int, error) {
	var isDuplicate = func(variable parser.Variable, variables []parser.Variable) bool {
		for _, v := range variables {
			if variable.Name == v.Name {
				return true
			}
		}
		return false
	}

	variables := make([]parser.Variable, len(parameters))
	defaults := make(map[string]parser.QueryExpression)

	required := 0
	for i, assignment := range parameters {
		if isDuplicate(assignment.Variable, variables) {
			return nil, nil, 0, NewDuplicateParameterError(assignment.Variable)
		}

		variables[i] = assignment.Variable
		if assignment.Value == nil {
			required = i + 1
		} else {
			defaults[assignment.Variable.Name] = assignment.Value
		}
	}
	return variables, defaults, required, nil
}

func (m UserDefinedFunctionMap) CheckDuplicate(name parser.Identifier) error {
	uname := strings.ToUpper(name.Literal)

	if _, ok := Functions[uname]; ok || uname == "CALL" || uname == "NOW" || uname == "JSON_OBJECT" {
		return NewBuiltInFunctionDeclaredError(name)
	}
	if _, ok := AggregateFunctions[uname]; ok {
		return NewBuiltInFunctionDeclaredError(name)
	}
	if _, ok := AnalyticFunctions[uname]; ok {
		return NewBuiltInFunctionDeclaredError(name)
	}
	if m.Exists(uname) {
		return NewFunctionRedeclaredError(name)
	}
	return nil
}

func (m UserDefinedFunctionMap) Get(name string) (*UserDefinedFunction, bool) {
	if fn, ok := m.Load(name); ok {
		return fn, true
	}
	return nil, false
}

func (m UserDefinedFunctionMap) Dispose(name parser.Identifier) bool {
	if m.Exists(name.Literal) {
		m.Delete(name.Literal)
		return true
	}
	return false
}

type UserDefinedFunction struct {
	Name         parser.Identifier
	Statements   []parser.Statement
	Parameters   []parser.Variable
	Defaults     map[string]parser.QueryExpression
	RequiredArgs int

	IsAggregate bool
	Cursor      parser.Identifier // For Aggregate Functions
}

func (fn *UserDefinedFunction) Execute(ctx context.Context, scope *ReferenceScope, args []value.Primary) (value.Primary, error) {
	childScope := scope.CreateChild()
	defer childScope.CloseCurrentBlock()

	return fn.execute(ctx, childScope, args)
}

func (fn *UserDefinedFunction) ExecuteAggregate(ctx context.Context, scope *ReferenceScope, values []value.Primary, args []value.Primary) (value.Primary, error) {
	childScope := scope.CreateChild()
	defer childScope.CloseCurrentBlock()

	if err := childScope.AddPseudoCursor(fn.Cursor, values); err != nil {
		return nil, err
	}
	return fn.execute(ctx, childScope, args)
}

func (fn *UserDefinedFunction) CheckArgsLen(expr parser.QueryExpression, name string, argsLen int) error {
	parametersLen := len(fn.Parameters)
	requiredLen := fn.RequiredArgs
	if fn.IsAggregate {
		parametersLen++
		requiredLen++
	}

	if len(fn.Defaults) < 1 {
		if argsLen != len(fn.Parameters) {
			return NewFunctionArgumentLengthError(expr, name, []int{parametersLen})
		}
	} else if argsLen < fn.RequiredArgs {
		return NewFunctionArgumentLengthErrorWithCustomArgs(expr, name, fmt.Sprintf("at least %s", FormatCount(requiredLen, "argument")))
	} else if len(fn.Parameters) < argsLen {
		return NewFunctionArgumentLengthErrorWithCustomArgs(expr, name, fmt.Sprintf("at most %s", FormatCount(parametersLen, "argument")))
	}

	return nil
}

func (fn *UserDefinedFunction) execute(ctx context.Context, scope *ReferenceScope, args []value.Primary) (value.Primary, error) {
	if err := fn.CheckArgsLen(fn.Name, fn.Name.Literal, len(args)); err != nil {
		return nil, err
	}

	for i, v := range fn.Parameters {
		if i < len(args) {
			if err := scope.Blocks[0].Variables.Add(v, args[i]); err != nil {
				return nil, err
			}
		} else {
			defaultValue, _ := fn.Defaults[v.Name]
			val, err := Evaluate(ctx, scope, defaultValue)
			if err != nil {
				return nil, err
			}
			if err = scope.DeclareVariableDirectly(v, val); err != nil {
				return nil, err
			}
		}
	}

	proc := NewProcessorWithScope(scope.Tx, scope)
	if _, err := proc.execute(ctx, fn.Statements); err != nil {
		return nil, err
	}

	ret := proc.returnVal
	if ret == nil {
		ret = value.NewNull()
	}

	return ret, nil
}
