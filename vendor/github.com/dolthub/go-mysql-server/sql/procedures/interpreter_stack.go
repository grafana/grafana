// Copyright 2025 Dolthub, Inc.
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

package procedures

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"

	ast "github.com/dolthub/vitess/go/vt/sqlparser"
)

// Stack is a generic stack.
type Stack[T any] struct {
	values []T
}

// NewStack creates a new, empty stack.
func NewStack[T any]() *Stack[T] {
	return &Stack[T]{}
}

// Len returns the size of the stack.
func (s *Stack[T]) Len() int {
	return len(s.values)
}

// Peek returns the top value on the stack without removing it.
func (s *Stack[T]) Peek() (value T) {
	if len(s.values) == 0 {
		return
	}
	return s.values[len(s.values)-1]
}

// PeekDepth returns the n-th value from the top. PeekDepth(0) is equivalent to the standard Peek().
func (s *Stack[T]) PeekDepth(depth int) (value T) {
	if len(s.values) <= depth {
		return
	}
	return s.values[len(s.values)-(1+depth)]
}

// PeekReference returns a reference to the top value on the stack without removing it.
func (s *Stack[T]) PeekReference() *T {
	if len(s.values) == 0 {
		return nil
	}
	return &s.values[len(s.values)-1]
}

// Pop returns the top value on the stack while also removing it from the stack.
func (s *Stack[T]) Pop() (value T) {
	if len(s.values) == 0 {
		return
	}
	value = s.values[len(s.values)-1]
	s.values = s.values[:len(s.values)-1]
	return
}

// Push adds the given value to the stack.
func (s *Stack[T]) Push(value T) {
	s.values = append(s.values, value)
}

// Empty returns whether the stack is empty.
func (s *Stack[T]) Empty() bool {
	return len(s.values) == 0
}

// InterpreterCondition is a declare condition with custom SQLState and ErrorCode.
type InterpreterCondition struct {
	SQLState     string
	MySQLErrCode int64
}

// InterpreterCursor is a declare cursor.
type InterpreterCursor struct {
	SelectStmt ast.SelectStatement
	RowIter    sql.RowIter
	Schema     sql.Schema
}

// InterpreterHandler is a declare handler that specifies an Action during an error Condition.
type InterpreterHandler struct {
	Statement ast.Statement
	Condition ast.DeclareHandlerConditionValue
	Action    ast.DeclareHandlerAction
	Counter   int // This is used to track the current position in the stack for the handler
}

// InterpreterVariable is a variable that lives on the stack.
type InterpreterVariable struct {
	Type       sql.Type
	Value      any
	HasBeenSet bool
}

func (iv *InterpreterVariable) ToAST() ast.Expr {
	if sqlVal, isSQLVal := iv.Value.(*ast.SQLVal); isSQLVal {
		return sqlVal
	}
	if iv.Value == nil {
		return &ast.NullVal{}
	}
	if types.IsInteger(iv.Type) {
		switch val := iv.Value.(type) {
		case bool:
			if val {
				return ast.NewIntVal([]byte("1"))
			} else {
				return ast.NewIntVal([]byte("0"))
			}
		case ast.BoolVal:
			if val {
				return ast.NewIntVal([]byte("1"))
			} else {
				return ast.NewIntVal([]byte("0"))
			}
		default:
			return ast.NewIntVal([]byte(fmt.Sprintf("%d", val)))
		}
	}
	if types.IsFloat(iv.Type) {
		return ast.NewFloatVal([]byte(strconv.FormatFloat(iv.Value.(float64), 'f', -1, 64)))
	}
	return ast.NewStrVal([]byte(fmt.Sprintf("%s", iv.Value)))
}

// InterpreterScopeDetails contains all the details that are relevant to a particular scope.
type InterpreterScopeDetails struct {
	conditions map[string]*InterpreterCondition
	cursors    map[string]*InterpreterCursor
	variables  map[string]*InterpreterVariable

	// labels mark the counter of the start of a loop or block.
	labels map[string]int

	// database is the current database for this scope.
	database string

	handlers []*InterpreterHandler
}

// InterpreterStack represents the working information that an interpreter will use during execution. It is not exactly
// the same as a stack in the traditional programming sense, but rather is a loose abstraction that serves the same
// general purpose.
type InterpreterStack struct {
	stack *Stack[*InterpreterScopeDetails]
}

// NewInterpreterStack creates a new InterpreterStack.
func NewInterpreterStack() *InterpreterStack {
	stack := NewStack[*InterpreterScopeDetails]()
	// This first push represents the function base, including parameters
	stack.Push(&InterpreterScopeDetails{
		conditions: make(map[string]*InterpreterCondition),
		cursors:    make(map[string]*InterpreterCursor),
		handlers:   make([]*InterpreterHandler, 0),
		variables:  make(map[string]*InterpreterVariable),

		labels: make(map[string]int),
	})
	return &InterpreterStack{
		stack: stack,
	}
}

// Details returns the details for the current scope.
func (is *InterpreterStack) Details() *InterpreterScopeDetails {
	return is.stack.Peek()
}

// NewVariable creates a new variable in the current scope. If a variable with the same name exists in a previous scope,
// then that variable will be shadowed until the current scope exits.
func (is *InterpreterStack) NewVariable(name string, typ sql.Type) {
	is.NewVariableWithValue(name, typ, typ.Zero())
}

// NewVariableWithValue creates a new variable in the current scope, setting its initial value to the one given.
func (is *InterpreterStack) NewVariableWithValue(name string, typ sql.Type, val any) {
	is.stack.Peek().variables[name] = &InterpreterVariable{
		Type:  typ,
		Value: val,
	}
}

// NewVariableAlias creates a new variable alias, named |alias|, in the current frame of this stack,
// pointing to the specified |variable|.
func (is *InterpreterStack) NewVariableAlias(alias string, variable *InterpreterVariable) {
	is.stack.Peek().variables[alias] = variable
}

// GetVariable traverses the stack (starting from the top) to find a variable with a matching name. Returns nil if no
// variable was found.
func (is *InterpreterStack) GetVariable(name string) *InterpreterVariable {
	name = strings.ToLower(name)
	for i := 0; i < is.stack.Len(); i++ {
		if iv, ok := is.stack.PeekDepth(i).variables[name]; ok {
			return iv
		}
	}
	return nil
}

// ListVariables returns a map with the names of all variables.
func (is *InterpreterStack) ListVariables() map[string]struct{} {
	seen := make(map[string]struct{})
	for i := 0; i < is.stack.Len(); i++ {
		for varName := range is.stack.PeekDepth(i).variables {
			seen[varName] = struct{}{}
		}
	}
	return seen
}

// SetVariable sets the first variable found, with a matching name, to the value given. This does not ensure that the
// value matches the expectations of the type, so it should be validated before this is called. Returns an error if the
// variable cannot be found.
func (is *InterpreterStack) SetVariable(name string, val any) error {
	iv := is.GetVariable(name)
	if iv == nil {
		return fmt.Errorf("variable `%s` could not be found", name)
	}
	iv.Value = val
	iv.HasBeenSet = true
	return nil
}

// NewCondition creates a new condition in the current scope.
func (is *InterpreterStack) NewCondition(name string, sqlState string, mysqlErrCode int64) {
	is.stack.Peek().conditions[name] = &InterpreterCondition{
		SQLState:     sqlState,
		MySQLErrCode: mysqlErrCode,
	}
}

// GetCondition traverses the stack (starting from the top) to find a condition with a matching name. Returns nil if no
// variable was found.
func (is *InterpreterStack) GetCondition(name string) *InterpreterCondition {
	name = strings.ToLower(name)
	for i := 0; i < is.stack.Len(); i++ {
		if ic, ok := is.stack.PeekDepth(i).conditions[name]; ok {
			return ic
		}
	}
	return nil
}

// NewCursor creates a new cursor in the current scope.
func (is *InterpreterStack) NewCursor(name string, selStmt ast.SelectStatement) {
	is.stack.Peek().cursors[name] = &InterpreterCursor{
		SelectStmt: selStmt,
	}
}

// GetCursor traverses the stack (starting from the top) to find a condition with a matching name. Returns nil if no
// variable was found.
func (is *InterpreterStack) GetCursor(name string) *InterpreterCursor {
	name = strings.ToLower(name)
	for i := 0; i < is.stack.Len(); i++ {
		if ic, ok := is.stack.PeekDepth(i).cursors[name]; ok {
			return ic
		}
	}
	return nil
}

// NewHandler creates a new handler in the current scope.
func (is *InterpreterStack) NewHandler(cond ast.DeclareHandlerConditionValue, action ast.DeclareHandlerAction, stmt ast.Statement, counter int) {
	is.stack.Peek().handlers = append(is.stack.Peek().handlers, &InterpreterHandler{
		Condition: cond,
		Action:    action,
		Statement: stmt,
		Counter:   counter,
	})
}

// ListHandlers returns a map with the names of all handlers.
func (is *InterpreterStack) ListHandlers() []*InterpreterHandler {
	handlers := make([]*InterpreterHandler, 0)
	for i := 0; i < is.stack.Len(); i++ {
		for _, handler := range is.stack.PeekDepth(i).handlers {
			handlers = append(handlers, handler)
		}
	}
	return handlers
}

// NewLabel creates a new label in the current scope.
func (is *InterpreterStack) NewLabel(name string, index int) {
	is.stack.Peek().labels[name] = index
}

// GetDatabase returns the current database for this scope.
func (is *InterpreterStack) GetDatabase() string {
	for i := 0; i < is.stack.Len(); i++ {
		if db := is.stack.PeekDepth(i).database; db != "" {
			return db
		}
	}
	return ""
}

// SetDatabase sets the current database for this scope.
func (is *InterpreterStack) SetDatabase(db string) {
	is.stack.Peek().database = db
}

// GetLabel traverses the stack (starting from the top) to find a label with a matching name. Returns -1 if no
// variable was found.
func (is *InterpreterStack) GetLabel(name string) int {
	for i := 0; i < is.stack.Len(); i++ {
		if index, ok := is.stack.PeekDepth(i).labels[name]; ok {
			return index
		}
	}
	return -1
}

// PushScope creates a new scope.
func (is *InterpreterStack) PushScope() {
	is.stack.Push(&InterpreterScopeDetails{
		conditions: make(map[string]*InterpreterCondition),
		cursors:    make(map[string]*InterpreterCursor),
		handlers:   make([]*InterpreterHandler, 0),
		variables:  make(map[string]*InterpreterVariable),

		labels: make(map[string]int),
	})
}

// PopScope removes the current scope.
func (is *InterpreterStack) PopScope(ctx *sql.Context) {
	scope := is.stack.Pop()
	for _, cursor := range scope.cursors {
		if cursor == nil {
			continue
		}
		if cursor.RowIter == nil {
			continue
		}
		cursor.RowIter.Close(ctx)
	}
}
