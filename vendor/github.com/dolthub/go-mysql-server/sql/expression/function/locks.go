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

package function

import (
	"fmt"
	"strings"
	"time"

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// ErrIllegalLockNameArgType is a kind of error that is thrown when the parameter passed as a lock name is not a string.
var ErrIllegalLockNameArgType = errors.NewKind("Illegal parameter data type %s for operation '%s'")

// lockFuncLogic is the logic executed when one of the single argument named lock functions is executed
type lockFuncLogic func(ctx *sql.Context, ls *sql.LockSubsystem, lockName string) (interface{}, error)

func (nl *NamedLockFunction) evalLockLogic(ctx *sql.Context, fn lockFuncLogic, row sql.Row) (interface{}, error) {
	lock, err := nl.GetLockName(ctx, row)
	if err != nil {
		return nil, err
	}
	if lock == nil {
		return nil, nil
	}

	return fn(ctx, nl.ls, *lock)
}

// NamedLockFunction is a sql function that takes just the name of a lock as an argument
type NamedLockFunction struct {
	expression.UnaryExpression
	retType  sql.Type
	ls       *sql.LockSubsystem
	funcName string
}

// FunctionName implements sql.FunctionExpression
func (nl *NamedLockFunction) FunctionName() string {
	return nl.funcName
}

// Eval implements the Expression interface.
func (nl *NamedLockFunction) GetLockName(ctx *sql.Context, row sql.Row) (*string, error) {
	if nl.Child == nil {
		return nil, nil
	}

	val, err := nl.Child.Eval(ctx, row)

	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	s, ok := nl.Child.Type().(sql.StringType)
	if !ok {
		return nil, ErrIllegalLockNameArgType.New(nl.Child.Type().String(), nl.funcName)
	}
	lockName, err := types.ConvertToString(ctx, val, s, nil)
	if err != nil {
		return nil, fmt.Errorf("%w; %s", ErrIllegalLockNameArgType.New(nl.Child.Type().String(), nl.funcName), err)
	}

	return &lockName, nil
}

// String implements the fmt.Stringer interface.
func (nl *NamedLockFunction) String() string {
	return fmt.Sprintf("%s(%s)", strings.ToLower(nl.funcName), nl.Child.String())
}

// IsNullable implements the Expression interface.
func (nl *NamedLockFunction) IsNullable() bool {
	return nl.Child.IsNullable()
}

// Type implements the Expression interface.
func (nl *NamedLockFunction) Type() sql.Type {
	return nl.retType
}

// ReleaseLockFunc is the function logic that is executed when the release_lock function is called.
func ReleaseLockFunc(ctx *sql.Context, ls *sql.LockSubsystem, lockName string) (interface{}, error) {
	err := ls.Unlock(ctx, lockName)

	if err != nil {
		if sql.ErrLockDoesNotExist.Is(err) {
			return nil, nil
		} else if sql.ErrLockNotOwned.Is(err) {
			return int8(0), nil
		}

		return nil, err
	}

	return int8(1), nil
}

type IsFreeLock struct {
	NamedLockFunction
}

var _ sql.FunctionExpression = &IsFreeLock{}
var _ sql.CollationCoercible = &IsFreeLock{}

func NewIsFreeLock(ls *sql.LockSubsystem) sql.CreateFunc1Args {
	return func(e sql.Expression) sql.Expression {
		return &IsFreeLock{
			NamedLockFunction: NamedLockFunction{
				UnaryExpression: expression.UnaryExpression{e},
				ls:              ls,
				funcName:        "is_free_lock",
				retType:         types.Int8,
			},
		}
	}
}

// Description implements sql.FunctionExpression
func (i *IsFreeLock) Description() string {
	return "returns whether the named lock is free."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*IsFreeLock) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (i *IsFreeLock) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return i.evalLockLogic(ctx, IsFreeLockFunc, row)
}

func (i *IsFreeLock) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 1)
	}

	return NewIsFreeLock(i.ls)(children[0]), nil
}

type IsUsedLock struct {
	NamedLockFunction
}

var _ sql.FunctionExpression = &IsUsedLock{}
var _ sql.CollationCoercible = &IsUsedLock{}

func NewIsUsedLock(ls *sql.LockSubsystem) sql.CreateFunc1Args {
	return func(e sql.Expression) sql.Expression {
		return &IsUsedLock{
			NamedLockFunction: NamedLockFunction{
				UnaryExpression: expression.UnaryExpression{e},
				ls:              ls,
				funcName:        "is_used_lock",
				retType:         types.Uint32,
			},
		}
	}
}

// Description implements sql.FunctionExpression
func (i *IsUsedLock) Description() string {
	return "returns whether the named lock is in use; return connection identifier if true."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*IsUsedLock) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (i *IsUsedLock) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return i.evalLockLogic(ctx, IsUsedLockFunc, row)
}

func (i *IsUsedLock) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 1)
	}

	return NewIsUsedLock(i.ls)(children[0]), nil
}

type ReleaseLock struct {
	NamedLockFunction
}

var _ sql.FunctionExpression = &ReleaseLock{}
var _ sql.CollationCoercible = &ReleaseLock{}

func NewReleaseLock(ls *sql.LockSubsystem) sql.CreateFunc1Args {
	return func(e sql.Expression) sql.Expression {
		return &ReleaseLock{
			NamedLockFunction: NamedLockFunction{
				UnaryExpression: expression.UnaryExpression{e},
				ls:              ls,
				funcName:        "release_lock",
				retType:         types.Int8,
			},
		}
	}
}

// Description implements sql.FunctionExpression
func (i *ReleaseLock) Description() string {
	return "release the named lock."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ReleaseLock) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (i *ReleaseLock) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return i.evalLockLogic(ctx, ReleaseLockFunc, row)
}

func (i *ReleaseLock) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 1)
	}

	return NewReleaseLock(i.ls)(children[0]), nil
}

// IsFreeLockFunc is the function logic that is executed when the is_free_lock function is called.
func IsFreeLockFunc(_ *sql.Context, ls *sql.LockSubsystem, lockName string) (interface{}, error) {
	state, _ := ls.GetLockState(lockName)

	switch state {
	case sql.LockInUse:
		return int8(0), nil
	default: // return 1 if the lock is free.  If the lock doesn't exist yet it is free
		return int8(1), nil
	}
}

// IsUsedLockFunc is the function logic that is executed when the is_used_lock function is called.
func IsUsedLockFunc(ctx *sql.Context, ls *sql.LockSubsystem, lockName string) (interface{}, error) {
	state, owner := ls.GetLockState(lockName)

	switch state {
	case sql.LockInUse:
		return owner, nil
	default:
		return nil, nil
	}
}

// GetLock is a SQL function implementing get_lock
type GetLock struct {
	expression.BinaryExpressionStub
	ls *sql.LockSubsystem
}

var _ sql.FunctionExpression = (*GetLock)(nil)
var _ sql.CollationCoercible = (*GetLock)(nil)

// CreateNewGetLock returns a new GetLock object
func CreateNewGetLock(ls *sql.LockSubsystem) func(e1, e2 sql.Expression) sql.Expression {
	return func(e1, e2 sql.Expression) sql.Expression {
		return &GetLock{expression.BinaryExpressionStub{e1, e2}, ls}
	}
}

// FunctionName implements sql.FunctionExpression
func (gl *GetLock) FunctionName() string {
	return "get_lock"
}

// Description implements sql.FunctionExpression
func (gl *GetLock) Description() string {
	return "gets a named lock."
}

// Eval implements the Expression interface.
func (gl *GetLock) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if gl.LeftChild == nil {
		return nil, nil
	}

	leftVal, err := gl.LeftChild.Eval(ctx, row)

	if err != nil {
		return nil, err
	}

	if leftVal == nil {
		return nil, nil
	}

	if gl.RightChild == nil {
		return nil, nil
	}

	rightVal, err := gl.RightChild.Eval(ctx, row)

	if err != nil {
		return nil, err
	}

	if rightVal == nil {
		return nil, nil
	}

	s, ok := gl.LeftChild.Type().(sql.StringType)
	if !ok {
		return nil, ErrIllegalLockNameArgType.New(gl.LeftChild.Type().String(), gl.FunctionName())
	}

	lockName, err := types.ConvertToString(ctx, leftVal, s, nil)
	if err != nil {
		return nil, fmt.Errorf("%w; %s", ErrIllegalLockNameArgType.New(gl.LeftChild.Type().String(), gl.FunctionName()), err)
	}

	timeout, _, err := types.Int64.Convert(ctx, rightVal)

	if err != nil {
		return nil, fmt.Errorf("illegal value for timeout %v", timeout)
	}

	err = gl.ls.Lock(ctx, lockName, time.Second*time.Duration(timeout.(int64)))

	if err != nil {
		if sql.ErrLockTimeout.Is(err) {
			return int8(0), nil
		}

		return nil, err
	}

	return int8(1), nil
}

// String implements the fmt.Stringer interface.
func (gl *GetLock) String() string {
	return fmt.Sprintf("get_lock(%s, %s)", gl.LeftChild.String(), gl.RightChild.String())
}

// IsNullable implements the Expression interface.
func (gl *GetLock) IsNullable() bool {
	return false
}

// WithChildren implements the Expression interface.
func (gl *GetLock) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(gl, len(children), 1)
	}

	return &GetLock{expression.BinaryExpressionStub{LeftChild: children[0], RightChild: children[1]}, gl.ls}, nil
}

// Type implements the Expression interface.
func (gl *GetLock) Type() sql.Type {
	return types.Int8
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*GetLock) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

type ReleaseAllLocks struct {
	ls *sql.LockSubsystem
	NoArgFunc
}

var _ sql.FunctionExpression = ReleaseAllLocks{}
var _ sql.CollationCoercible = ReleaseAllLocks{}

func NewReleaseAllLocks(ls *sql.LockSubsystem) func() sql.Expression {
	return func() sql.Expression {
		return ReleaseAllLocks{
			NoArgFunc: NoArgFunc{Name: "release_all_locks", SQLType: types.Int32},
			ls:        ls,
		}
	}
}

// Description implements sql.FunctionExpression
func (r ReleaseAllLocks) Description() string {
	return "release all current named locks."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (ReleaseAllLocks) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (r ReleaseAllLocks) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return r.ls.ReleaseAll(ctx)
}

func (r ReleaseAllLocks) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NoArgFuncWithChildren(r, children)
}
