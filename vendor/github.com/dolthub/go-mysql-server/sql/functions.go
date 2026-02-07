// Copyright 2020-2021 Dolthub, Inc.
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

package sql

// Function is a function defined by the user that can be applied in a SQL query.
type Function interface {
	// NewInstance returns a new instance of the function to evaluate against rows
	NewInstance([]Expression) (Expression, error)
	// FunctionName returns the name of this function
	FunctionName() string
	// isFunction is a private method to restrict implementations of Function
	isFunction()
}

// FunctionProvider is an interface that allows custom functions to be provided. It's usually (but not always)
// implemented by a DatabaseProvider.
type FunctionProvider interface {
	// Function returns the function with the name provided, case-insensitive
	Function(ctx *Context, name string) (Function, bool)
}

type CreateFunc0Args func() Expression
type CreateFunc1Args func(e1 Expression) Expression
type CreateFunc2Args func(e1, e2 Expression) Expression
type CreateFunc3Args func(e1, e2, e3 Expression) Expression
type CreateFunc4Args func(e1, e2, e3, e4 Expression) Expression
type CreateFunc5Args func(e1, e2, e3, e4, e5 Expression) Expression
type CreateFunc6Args func(e1, e2, e3, e4, e5, e6 Expression) Expression
type CreateFunc7Args func(e1, e2, e3, e4, e5, e6, e7 Expression) Expression
type CreateFuncNArgs func(args ...Expression) (Expression, error)

type (
	// Function0 is a function with 0 arguments.
	Function0 struct {
		Fn   CreateFunc0Args
		Name string
	}
	// Function1 is a function with 1 argument.
	Function1 struct {
		Fn   CreateFunc1Args
		Name string
	}
	// Function2 is a function with 2 arguments.
	Function2 struct {
		Fn   CreateFunc2Args
		Name string
	}
	// Function3 is a function with 3 arguments.
	Function3 struct {
		Fn   CreateFunc3Args
		Name string
	}
	// Function4 is a function with 4 arguments.
	Function4 struct {
		Fn   CreateFunc4Args
		Name string
	}
	// Function5 is a function with 5 arguments.
	Function5 struct {
		Fn   CreateFunc5Args
		Name string
	}
	// Function6 is a function with 6 arguments.
	Function6 struct {
		Fn   CreateFunc6Args
		Name string
	}
	// Function7 is a function with 7 arguments.
	Function7 struct {
		Fn   CreateFunc7Args
		Name string
	}
	// FunctionN is a function with variable number of arguments. This function
	// is expected to return ErrInvalidArgumentNumber if the arity does not
	// match, since the check has to be done in the implementation.
	FunctionN struct {
		Fn   CreateFuncNArgs
		Name string
	}
)

var _ Function = Function0{}
var _ Function = Function1{}
var _ Function = Function2{}
var _ Function = Function3{}
var _ Function = Function4{}
var _ Function = Function5{}
var _ Function = Function6{}
var _ Function = Function7{}
var _ Function = FunctionN{}

func NewFunction0(name string, fn func() Expression) Function0 {
	return Function0{
		Name: name,
		Fn:   fn,
	}
}

func (fn Function0) NewInstance(args []Expression) (Expression, error) {
	if len(args) != 0 {
		return nil, ErrInvalidArgumentNumber.New(fn.Name, 0, len(args))
	}

	return fn.Fn(), nil
}

func (fn Function1) NewInstance(args []Expression) (Expression, error) {
	if len(args) != 1 {
		return nil, ErrInvalidArgumentNumber.New(fn.Name, 1, len(args))
	}

	return fn.Fn(args[0]), nil
}

func (fn Function2) NewInstance(args []Expression) (Expression, error) {
	if len(args) != 2 {
		return nil, ErrInvalidArgumentNumber.New(fn.Name, 2, len(args))
	}

	return fn.Fn(args[0], args[1]), nil
}

func (fn Function3) NewInstance(args []Expression) (Expression, error) {
	if len(args) != 3 {
		return nil, ErrInvalidArgumentNumber.New(fn.Name, 3, len(args))
	}

	return fn.Fn(args[0], args[1], args[2]), nil
}

func (fn Function4) NewInstance(args []Expression) (Expression, error) {
	if len(args) != 4 {
		return nil, ErrInvalidArgumentNumber.New(fn.Name, 4, len(args))
	}

	return fn.Fn(args[0], args[1], args[2], args[3]), nil
}

func (fn Function5) NewInstance(args []Expression) (Expression, error) {
	if len(args) != 5 {
		return nil, ErrInvalidArgumentNumber.New(fn.Name, 5, len(args))
	}

	return fn.Fn(args[0], args[1], args[2], args[3], args[4]), nil
}

func (fn Function6) NewInstance(args []Expression) (Expression, error) {
	if len(args) != 6 {
		return nil, ErrInvalidArgumentNumber.New(fn.Name, 6, len(args))
	}

	return fn.Fn(args[0], args[1], args[2], args[3], args[4], args[5]), nil
}

func (fn Function7) NewInstance(args []Expression) (Expression, error) {
	if len(args) != 7 {
		return nil, ErrInvalidArgumentNumber.New(fn.Name, 7, len(args))
	}

	return fn.Fn(args[0], args[1], args[2], args[3], args[4], args[5], args[6]), nil
}

func (fn FunctionN) NewInstance(args []Expression) (Expression, error) {
	return fn.Fn(args...)
}

func (fn Function0) FunctionName() string { return fn.Name }
func (fn Function1) FunctionName() string { return fn.Name }
func (fn Function2) FunctionName() string { return fn.Name }
func (fn Function3) FunctionName() string { return fn.Name }
func (fn Function4) FunctionName() string { return fn.Name }
func (fn Function5) FunctionName() string { return fn.Name }
func (fn Function6) FunctionName() string { return fn.Name }
func (fn Function7) FunctionName() string { return fn.Name }
func (fn FunctionN) FunctionName() string { return fn.Name }

func (Function0) isFunction() {}
func (Function1) isFunction() {}
func (Function2) isFunction() {}
func (Function3) isFunction() {}
func (Function4) isFunction() {}
func (Function5) isFunction() {}
func (Function6) isFunction() {}
func (Function7) isFunction() {}
func (FunctionN) isFunction() {}

// UnsupportedFunctionStub is a marker interface for function stubs that are unsupported
type UnsupportedFunctionStub interface {
	IsUnsupported() bool
}

// FunctionExpression is an Expression that represents a function.
type FunctionExpression interface {
	Expression
	FunctionName() string
	Description() string
}
