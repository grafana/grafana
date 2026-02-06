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

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	trace2 "runtime/trace"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
	"unsafe"

	"github.com/shopspring/decimal"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql/values"
)

// Expression is a combination of one or more SQL expressions.
type Expression interface {
	Resolvable
	fmt.Stringer
	// Type returns the expression type.
	Type() Type
	// IsNullable returns whether the expression can be null.
	IsNullable() bool
	// Eval evaluates the given row and returns a result.
	Eval(ctx *Context, row Row) (interface{}, error)
	// Children returns the children expressions of this expression.
	Children() []Expression
	// WithChildren returns a copy of the expression with children replaced.
	// It will return an error if the number of children is different than
	// the current number of children. They must be given in the same order
	// as they are returned by Children.
	WithChildren(children ...Expression) (Expression, error)
}

// RowIterExpression is an Expression that returns a RowIter rather than a scalar, used to implement functions that
// return sets.
type RowIterExpression interface {
	Expression
	// EvalRowIter evaluates the expression, which must be a RowIter
	EvalRowIter(ctx *Context, r Row) (RowIter, error)
	// ReturnsRowIter returns whether this expression returns a RowIter
	ReturnsRowIter() bool
}

// ExpressionWithNodes is an expression that contains nodes as children.
type ExpressionWithNodes interface {
	Expression
	// NodeChildren returns all node children.
	NodeChildren() []Node
	// WithNodeChildren returns a copy of the expression with its node children replaced. It will return an error if the
	// number of children is different than the current number of children. They must be given in the same order as they
	// are returned by NodeChildren.
	WithNodeChildren(children ...Node) (ExpressionWithNodes, error)
}

// NonDeterministicExpression allows a way for expressions to declare that they are non-deterministic, which will
// signal the engine to not cache their results when this would otherwise appear to be safe.
type NonDeterministicExpression interface {
	Expression
	// IsNonDeterministic returns whether this expression returns a non-deterministic result. An expression is
	// non-deterministic if it can return different results on subsequent evaluations.
	IsNonDeterministic() bool
}

// IsNullExpression indicates that this expression tests for IS NULL.
type IsNullExpression interface {
	Expression
	IsNullExpression() bool
}

// IsNotNullExpression indicates that this expression tests for IS NOT NULL. Note that in some cases in some
// database engines, such as records in Postgres, IS NOT NULL is not identical to NOT(IS NULL).
type IsNotNullExpression interface {
	Expression
	IsNotNullExpression() bool
}

// Node is a node in the execution plan tree.
type Node interface {
	Resolvable
	fmt.Stringer
	// Schema of the node.
	Schema() Schema
	// Children nodes.
	Children() []Node
	// WithChildren returns a copy of the node with children replaced.
	// It will return an error if the number of children is different than
	// the current number of children. They must be given in the same order
	// as they are returned by Children.
	WithChildren(children ...Node) (Node, error)
	// IsReadOnly returns whether the node is read-only.
	IsReadOnly() bool
}

// NodeExecBuilder converts a sql.Node tree into a RowIter.
type NodeExecBuilder interface {
	Build(ctx *Context, n Node, r Row) (RowIter, error)
}

// ExecSourceRel is a node that has no children and is directly
// row generating.
type ExecSourceRel interface {
	Node
	RowIter(ctx *Context, r Row) (RowIter, error)
}

// Nameable is something that has a name.
type Nameable interface {
	// Name returns the name.
	Name() string
}

// RenameableNode is a Node that can be renamed.
type RenameableNode interface {
	Nameable
	Node
	// WithName returns a copy of the node with the name changed.
	WithName(string) Node
}

// Tableable is something that has a table.
type Tableable interface {
	// Table returns the table name.
	Table() string
}

// Resolvable is something that can be resolved or not.
type Resolvable interface {
	// Resolved returns whether the node is resolved.
	Resolved() bool
}

// BinaryNode is a Node with two children
type BinaryNode interface {
	Left() Node
	Right() Node
}

// UnaryNode is a Node with one child.
type UnaryNode interface {
	Child() Node
}

// CommentedNode allows comments to be set and retrieved on it. Used primarily for join hint comments.
type CommentedNode interface {
	Node
	WithComment(string) Node
	Comment() string
}

// OpaqueNode is a node that doesn't allow transformations to its children and
// acts as a black box.
type OpaqueNode interface {
	Node
	// Opaque reports whether the node is opaque or not.
	Opaque() bool
}

// Projector is a node that projects expressions for parent nodes to consume (i.e. GroupBy, Window, Project).
type Projector interface {
	// ProjectedExprs returns the list of expressions projected by this node.
	ProjectedExprs() []Expression
}

// Expressioner is a node that contains expressions.
type Expressioner interface {
	// Expressions returns the list of expressions contained by the node.
	Expressions() []Expression
	// WithExpressions returns a copy of the node with expressions replaced.
	// It will return an error if the number of expressions is different than
	// the current number of expressions. They must be given in the same order
	// as they are returned by Expressions.
	WithExpressions(...Expression) (Node, error)
}

// SchemaTarget is a node that has a target schema that can be set during analysis. This is necessary because some
// schema objects (things that involve expressions, column references, etc.) can only be reified during analysis. The
// target schema is the schema of a table under a DDL operation, not the schema of rows returned by this node.
type SchemaTarget interface {
	// WithTargetSchema returns a copy of this node with the target schema set
	WithTargetSchema(Schema) (Node, error)
	// TargetSchema returns the target schema for this node
	TargetSchema() Schema
}

// PrimaryKeySchemaTarget is a node that has a primary key target schema that can be set
type PrimaryKeySchemaTarget interface {
	SchemaTarget
	WithPrimaryKeySchema(schema PrimaryKeySchema) (Node, error)
}

// DynamicColumnsTable is a table with a schema that is variable depending
// on the tables in the database (information_schema.columns).
type DynamicColumnsTable interface {
	// AllColumns returns all columns that need to be resolved
	// for this particular table.
	AllColumns(*Context) (Schema, error)
	// WithDefaultsSchema returns a table with a fully resolved
	// schema for every column in AllColumns.
	WithDefaultsSchema(Schema) (Table, error)
	// HasDynamicColumns indicates that a type implements the
	// DynamicColumnsTable interface.
	HasDynamicColumns() bool
}

// PartitionCounter can return the number of partitions.
type PartitionCounter interface {
	// PartitionCount returns the number of partitions.
	PartitionCount(*Context) (int64, error)
}

// Closer is a node that can be closed.
type Closer interface {
	Close(*Context) error
}

// ExternalStoredProcedureProvider provides access to built-in stored procedures. These procedures are implemented
// as functions, instead of as SQL statements. The returned stored procedures cannot be modified or deleted.
type ExternalStoredProcedureProvider interface {
	// ExternalStoredProcedure returns the external stored procedure details for the procedure with the specified name
	// that is able to accept the specified number of parameters. If no matching external stored procedure is found,
	// nil, nil is returned. If an unexpected error is encountered, it is returned as the error parameter.
	ExternalStoredProcedure(ctx *Context, name string, numOfParams int) (*ExternalStoredProcedureDetails, error)
	// ExternalStoredProcedures returns a slice of all external stored procedure details with the specified name. External
	// stored procedures can overload the same name with different arguments, so this method enables a caller to see all
	// available variants with the specified name. If no matching external stored procedures are found, an
	// empty slice is returned, with a nil error. If an unexpected error is encountered, it is returned as the
	// error parameter.
	ExternalStoredProcedures(ctx *Context, name string) ([]ExternalStoredProcedureDetails, error)
}

type TransactionCharacteristic int

const (
	ReadWrite TransactionCharacteristic = iota
	ReadOnly
)

// Transaction is an opaque type implemented by an integrator to record necessary information at the start of a
// transaction. Active transactions will be recorded in the session.
type Transaction interface {
	fmt.Stringer
	IsReadOnly() bool
}

// Lockable should be implemented by tables that can be locked and unlocked.
type Lockable interface {
	Nameable
	// Lock locks the table either for reads or writes. Any session clients can
	// read while the table is locked for read, but not write.
	// When the table is locked for write, nobody can write except for the
	// session client that requested the lock.
	Lock(ctx *Context, write bool) error
	// Unlock releases the lock for the current session client. It blocks until
	// all reads or writes started during the lock are finished.
	// Context may be nil if the unlock it's because the connection was closed.
	// The id will always be provided, since in some cases context is not
	// available.
	Unlock(ctx *Context, id uint32) error
}

// ConvertToBool converts a value to a boolean. nil is considered false.
// TODO: the logic here should be merged with types.Boolean.Convert()
func ConvertToBool(ctx *Context, v interface{}) (bool, error) {
	switch b := v.(type) {
	case []uint8:
		return ConvertToBool(ctx, string(b))
	case bool:
		return b, nil
	case int:
		return b != 0, nil
	case int64:
		return b != 0, nil
	case int32:
		return b != 0, nil
	case int16:
		return b != 0, nil
	case int8:
		return b != 0, nil
	case uint:
		return b != 0, nil
	case uint64:
		return b != 0, nil
	case uint32:
		return b != 0, nil
	case uint16:
		return b != 0, nil
	case uint8:
		return b != 0, nil
	case time.Duration:
		return b != 0, nil
	case time.Time:
		return b.UnixNano() != 0, nil
	case float32:
		return b != 0, nil
	case float64:
		return b != 0, nil
	case string:
		bFloat, err := strconv.ParseFloat(TrimStringToNumberPrefix(ctx, b, false), 64)
		if err != nil {
			return false, nil
		}
		return bFloat != 0, nil
	case decimal.Decimal:
		return !b.IsZero(), nil
	case nil:
		return false, fmt.Errorf("unable to cast nil to bool")
	default:
		return false, fmt.Errorf("unable to cast %#v of type %T to bool", v, v)
	}
}

const (
	// IntCutSet is the set of characters that should be trimmed from the beginning and end of a string
	//   when converting to a signed or unsigned integer
	IntCutSet = " \t"

	// NumericCutSet is the set of characters to trim from a string before converting it to a number.
	NumericCutSet = " \t\n\r"
)

var ErrVectorInvalidBinaryLength = errors.NewKind("cannot convert BINARY(%d) to vector, byte length must be a multiple of 4 bytes")

// DecodeVector decodes a byte slice that represents a vector. This is needed for distance functions.
func DecodeVector(buf []byte) ([]float32, error) {
	if len(buf)%int(values.Float32Size) != 0 {
		return nil, ErrVectorInvalidBinaryLength.New(len(buf))
	}
	return unsafe.Slice((*float32)(unsafe.Pointer(&buf[0])), len(buf)/int(values.Float32Size)), nil
}

// EncodeVector encodes a byte slice that represents a vector.
func EncodeVector(floats []float32) []byte {
	return unsafe.Slice((*byte)(unsafe.Pointer(&floats[0])), len(floats)*int(values.Float32Size))
}

func ConvertToVector(ctx context.Context, v interface{}) ([]float32, error) {
	var err error
	v, err = UnwrapAny(ctx, v)
	if err != nil {
		return nil, err
	}
	switch b := v.(type) {
	case []float32:
		return b, nil
	case []byte:
		return DecodeVector(b)
	case string:
		var val interface{}
		err := json.Unmarshal([]byte(b), &val)
		if err != nil {
			return nil, fmt.Errorf("can't convert JSON to vector: %w", err)
		}
		return convertJsonInterfaceToVector(val)
	case JSONWrapper:
		val, err := b.ToInterface(ctx)
		if err != nil {
			return nil, err
		}
		return convertJsonInterfaceToVector(val)
	default:
		return nil, fmt.Errorf("unable to cast %#v of type %T to vector", v, v)
	}
}

func convertJsonInterfaceToVector(val interface{}) ([]float32, error) {
	array, ok := val.([]interface{})
	if !ok {
		return nil, fmt.Errorf("can't convert JSON to vector; expected array, got %T", val)
	}
	res := make([]float32, len(array))
	for i, elem := range array {
		switch v := elem.(type) {
		case float32:
			res[i] = v
		case float64:
			if v > math.MaxFloat32 || v < -math.MaxFloat32 {
				return nil, fmt.Errorf("data cannot be converted to a valid vector: %v", v)
			}
			res[i] = float32(v)
		case int64:
			res[i] = float32(v)
		case int32:
			res[i] = float32(v)
		default:
			return nil, fmt.Errorf("can't convert JSON to vector; expected array of floats, but array contained %T", elem)
		}
	}
	return res, nil
}

// EvaluateCondition evaluates a condition, which is an expression whose value
// will be nil or coerced boolean.
func EvaluateCondition(ctx *Context, cond Expression, row Row) (interface{}, error) {
	defer trace2.StartRegion(ctx, "EvaluateCondition").End()

	v, err := cond.Eval(ctx, row)
	if err != nil {
		return false, err
	}
	if v == nil {
		return nil, nil
	}
	res, err := ConvertToBool(ctx, v)
	if err != nil {
		return nil, err
	}
	return res, nil
}

// IsFalse coerces EvaluateCondition interface{} response to boolean
func IsFalse(val interface{}) bool {
	res, ok := val.(bool)
	return ok && !res
}

// IsTrue coerces EvaluateCondition interface{} response to boolean
func IsTrue(val interface{}) bool {
	res, ok := val.(bool)
	return ok && res
}

// DebugStringer is shared by implementors of Node and Expression, and is used for debugging the analyzer. It allows
// a node or expression to be printed in greater detail than its default String() representation.
type DebugStringer interface {
	// DebugString prints a debug string of the node in question.
	DebugString() string
}

// DebugString returns a debug string for the Node or Expression given.
func DebugString(nodeOrExpression interface{}) string {
	if ds, ok := nodeOrExpression.(DebugStringer); ok {
		return ds.DebugString()
	}
	if s, ok := nodeOrExpression.(fmt.Stringer); ok {
		return s.String()
	}
	if nodeOrExpression == nil {
		return ""
	}
	panic(fmt.Sprintf("Expected sql.DebugString or fmt.Stringer for %T", nodeOrExpression))
}

// Expression2 is an experimental future interface alternative to Expression to provide faster access.
type Expression2 interface {
	Expression
	// Eval2 evaluates the given row frame and returns a result.
	Eval2(ctx *Context, row Row2) (Value, error)
	// Type2 returns the expression type.
	Type2() Type2
}

var SystemVariables SystemVariableRegistry

// SystemVariableRegistry is a registry of system variables. Each session gets its own copy of all values via the
// SessionMap() method.
type SystemVariableRegistry interface {
	// AddSystemVariables adds the given system variables to this registry
	AddSystemVariables(sysVars []SystemVariable)
	// AssignValues assigns the given values to the system variables in this registry
	AssignValues(vals map[string]interface{}) error
	// NewSessionMap returns a map of system variables values that can be used by a session
	NewSessionMap() map[string]SystemVarValue
	// GetGlobal returns the current global value of the system variable with the given name
	GetGlobal(name string) (SystemVariable, interface{}, bool)
	// SetGlobal sets the global value of the system variable with the given name
	SetGlobal(ctx *Context, name string, val interface{}) error
	// GetAllGlobalVariables returns a copy of all global variable values.
	GetAllGlobalVariables() map[string]interface{}
}

// SystemVariable is used to system variables.
type SystemVariable interface {
	// GetName returns the name of the sv. Case-sensitive.
	GetName() string
	// GetType returns the type of the sv.
	GetType() Type
	// GetSessionScope returns SESSION scope of the sv.
	GetSessionScope() SystemVariableScope
	// SetDefault sets the default value of the sv.
	SetDefault(any)
	// GetDefault returns the defined default value of the sv.
	// This is used for resetting some variables to initial default/reset value.
	GetDefault() any
	// InitValue sets value without validation.
	// This is used for setting the initial values internally
	// using pre-defined variables or for test-purposes.
	InitValue(ctx *Context, val any, global bool) (SystemVarValue, error)
	// SetValue sets the value of the sv of given scope, global or session
	// It validates setting value of correct scope,
	// converts the given value to appropriate value depending on the sv
	// and it returns the SystemVarValue with the updated value.
	SetValue(ctx *Context, val any, global bool) (SystemVarValue, error)
	// IsReadOnly checks whether the variable is read only.
	// It returns false if variable can be set to a value.
	IsReadOnly() bool
	// IsGlobalOnly checks whether the scope of the variable is global only.
	IsGlobalOnly() bool
	// DisplayString gets 'specified scope' prefix and
	// returns the name with the prefix, if applicable.
	DisplayString(string) string
}

var _ SystemVariable = (*MysqlSystemVariable)(nil)

// MysqlSystemVariable represents a mysql system variable.
type MysqlSystemVariable struct {
	// Type defines the type of the system variable. This may be a special type not accessible to standard MySQL operations.
	Type Type
	// Default defines the default value of the system variable.
	Default interface{}
	// Scope defines the scope of the system variable, which is either Global, Session, or Both.
	Scope *MysqlScope
	// NotifyChanged is called by the engine if the value of this variable
	// changes during runtime.  It is typically |nil|, but can be used for
	// system variables which control the behavior of the running server.
	// For example, replication threads might need to be started or stopped
	// when replication is enabled or disabled. This provides a scalable
	// alternative to polling.
	//
	// Calls to NotifyChanged are serialized for a given system variable in
	// the global context and in a particular session. They should never
	// block.  NotifyChanged is not called when a new system variable is
	// registered.
	NotifyChanged func(*Context, SystemVariableScope, SystemVarValue) error
	// ValueFunction defines an optional function that is executed to provide
	// the value of this system variable whenever it is requested. System variables
	// that provide a ValueFunction should also set Dynamic to false, since they
	// cannot be assigned a value and will return a read-only error if tried.
	ValueFunction func() (interface{}, error)
	// Name is the name of the system variable.
	Name string
	// Dynamic defines whether the variable may be written to during runtime. Variables with this set to `false` will
	// return an error if a user attempts to set a value.
	Dynamic bool
	// SetVarHintApplies defines if the variable may be set for a single query using SET_VAR().
	// https://dev.mysql.com/doc/refman/8.0/en/optimizer-hints.html#optimizer-hints-set-var
	SetVarHintApplies bool
}

// GetName implements SystemVariable.
func (m *MysqlSystemVariable) GetName() string {
	return m.Name
}

// GetType implements SystemVariable.
func (m *MysqlSystemVariable) GetType() Type {
	return m.Type
}

// GetSessionScope implements SystemVariable.
func (m *MysqlSystemVariable) GetSessionScope() SystemVariableScope {
	return GetMysqlScope(SystemVariableScope_Session)
}

// SetDefault implements SystemVariable.
func (m *MysqlSystemVariable) SetDefault(a any) {
	m.Default = a
}

// GetDefault implements SystemVariable.
func (m *MysqlSystemVariable) GetDefault() any {
	return m.Default
}

// InitValue implements SystemVariable.
func (m *MysqlSystemVariable) InitValue(ctx *Context, val any, global bool) (SystemVarValue, error) {
	convertedVal, _, err := m.Type.Convert(ctx, val)
	if err != nil {
		return SystemVarValue{}, err
	}
	svv := SystemVarValue{
		Var: m,
		Val: convertedVal,
	}
	scope := GetMysqlScope(SystemVariableScope_Session)
	if global {
		scope = GetMysqlScope(SystemVariableScope_Global)
	}
	if m.NotifyChanged != nil {
		err = m.NotifyChanged(ctx, scope, svv)
		if err != nil {
			return SystemVarValue{}, err
		}
	}
	return svv, nil
}

// SetValue implements SystemVariable.
func (m *MysqlSystemVariable) SetValue(ctx *Context, val any, global bool) (SystemVarValue, error) {
	if global && m.Scope.Type == SystemVariableScope_Session {
		return SystemVarValue{}, ErrSystemVariableSessionOnly.New(m.Name)
	}
	if !global && m.Scope.Type == SystemVariableScope_Global {
		return SystemVarValue{}, ErrSystemVariableGlobalOnly.New(m.Name)
	}
	if !m.Dynamic || m.ValueFunction != nil {
		return SystemVarValue{}, ErrSystemVariableReadOnly.New(m.Name)
	}
	return m.InitValue(ctx, val, global)
}

// IsReadOnly implements SystemVariable.
func (m *MysqlSystemVariable) IsReadOnly() bool {
	return !m.Dynamic || m.ValueFunction != nil
}

// IsGlobalOnly implements SystemVariable.
func (m *MysqlSystemVariable) IsGlobalOnly() bool {
	return m.Scope.IsGlobalOnly()
}

// DisplayString implements SystemVariable.
func (m *MysqlSystemVariable) DisplayString(specifiedScope string) string {
	// If the scope wasn't explicitly provided, then don't include it in the string representation
	if specifiedScope == "" {
		return fmt.Sprintf("@@%s", m.Name)
	} else {
		return fmt.Sprintf("@@%s.%s", specifiedScope, m.Name)
	}
}

// SystemVariableScope represents the scope of a system variable
// and handles SV values depending on its scope.
type SystemVariableScope interface {
	// SetValue sets an appropriate value to the given SV name depending on the scope.
	SetValue(*Context, string, any) error
	// GetValue returns appropriate value of the given SV name depending on the scope.
	GetValue(*Context, string, CollationID) (any, error)
	// IsGlobalOnly returns true if SV is of SystemVariableScope_Global scope.
	IsGlobalOnly() bool
	// IsSessionOnly returns true if SV is of SystemVariableScope_Session scope.
	IsSessionOnly() bool
}

// MysqlScope represents the scope of a MySQL system variable.
type MysqlScope struct {
	Type MysqlSVScopeType
}

func GetMysqlScope(t MysqlSVScopeType) *MysqlScope {
	return &MysqlScope{Type: t}
}

func (m *MysqlScope) SetValue(ctx *Context, name string, val any) error {
	switch m.Type {
	case SystemVariableScope_Global:
		err := SystemVariables.SetGlobal(ctx, name, val)
		if err != nil {
			return err
		}
	case SystemVariableScope_Session:
		err := ctx.SetSessionVariable(ctx, name, val)
		if err != nil {
			return err
		}
	case SystemVariableScope_Persist:
		persistSess, ok := ctx.Session.(PersistableSession)
		if !ok {
			return ErrSessionDoesNotSupportPersistence.New()
		}
		err := persistSess.PersistGlobal(ctx, name, val)
		if err != nil {
			return err
		}
		err = SystemVariables.SetGlobal(ctx, name, val)
		if err != nil {
			return err
		}
	case SystemVariableScope_PersistOnly:
		persistSess, ok := ctx.Session.(PersistableSession)
		if !ok {
			return ErrSessionDoesNotSupportPersistence.New()
		}
		err := persistSess.PersistGlobal(ctx, name, val)
		if err != nil {
			return err
		}
	case SystemVariableScope_ResetPersist:
		// TODO: add parser support for RESET PERSIST
		persistSess, ok := ctx.Session.(PersistableSession)
		if !ok {
			return ErrSessionDoesNotSupportPersistence.New()
		}
		if name == "" {
			err := persistSess.RemoveAllPersistedGlobals()
			if err != nil {
				return err
			}
		}
		err := persistSess.RemovePersistedGlobal(name)
		if err != nil {
			return err
		}
	default: // should never be hit
		return fmt.Errorf("unable to set `%s` due to unknown scope `%v`", name, m.Type)
	}
	return nil
}

func (m *MysqlScope) GetValue(ctx *Context, name string, collation CollationID) (any, error) {
	switch m.Type {
	case SystemVariableScope_Global:
		_, val, ok := SystemVariables.GetGlobal(name)
		if !ok {
			return nil, ErrUnknownSystemVariable.New(name)
		}
		return val, nil
	case SystemVariableScope_Session:
		// "character_set_database" and "collation_database" are special system variables, in that they're set whenever
		// the current database is changed. Rather than attempting to synchronize the session variables of all
		// outstanding contexts whenever a database's collation is updated, we just pull the values from the database
		// directly. MySQL also plans to make these system variables immutable (from the user's perspective). This isn't
		// exactly the same as MySQL's behavior, but this is the intent of their behavior, which is also way easier to
		// implement.
		switch strings.ToLower(name) {
		case "character_set_database":
			return collation.CharacterSet().String(), nil
		case "collation_database":
			return collation.String(), nil
		default:
			val, err := ctx.GetSessionVariable(ctx, name)
			if err != nil {
				return nil, err
			}
			return val, nil
		}
	default:
		return nil, fmt.Errorf("unknown scope `%v` on system variable `%s`", m.Type, name)
	}
}

func (m *MysqlScope) IsGlobalOnly() bool {
	return m.Type == SystemVariableScope_Global
}

func (m *MysqlScope) IsSessionOnly() bool {
	return m.Type == SystemVariableScope_Session
}

var _ SystemVariableScope = (*MysqlScope)(nil)

// MysqlSVScopeType represents the scope of a system variable.
type MysqlSVScopeType byte

const (
	// SystemVariableScope_Global is set when the system variable exists only in the global context.
	SystemVariableScope_Global MysqlSVScopeType = iota
	// SystemVariableScope_Session is set when the system variable exists only in the session context.
	SystemVariableScope_Session
	// SystemVariableScope_Both is set when the system variable exists in both the global and session contexts.
	SystemVariableScope_Both
	// SystemVariableScope_Persist is set when the system variable is global and persisted.
	SystemVariableScope_Persist
	// SystemVariableScope_PersistOnly is set when the system variable is persisted outside of server context.
	SystemVariableScope_PersistOnly
	// SystemVariableScope_ResetPersist is used to remove a persisted variable
	SystemVariableScope_ResetPersist
)

// String returns the scope as an uppercase string.
func (s MysqlSVScopeType) String() string {
	switch s {
	case SystemVariableScope_Global:
		return "GLOBAL"
	case SystemVariableScope_Session:
		return "SESSION"
	case SystemVariableScope_Persist:
		return "GLOBAL, PERSIST"
	case SystemVariableScope_PersistOnly:
		return "PERSIST"
	case SystemVariableScope_ResetPersist:
		return "RESET PERSIST"
	case SystemVariableScope_Both:
		return "GLOBAL, SESSION"
	default:
		return "UNKNOWN_SYSTEM_SCOPE"
	}
}

type SystemVarValue struct {
	Var SystemVariable
	Val interface{}
}

type NameableNode interface {
	Nameable
	Node
}

var StatusVariables StatusVariableRegistry

// StatusVariableRegistry is a registry of status variables.
type StatusVariableRegistry interface {
	// NewSessionMap returns a deep copy of the status variables that are
	// not GlobalOnly scope (i.e. SessionOnly or Both)
	NewSessionMap() map[string]StatusVarValue
	// NewGlobalMap returns a deep copy of the status variables of every scope
	NewGlobalMap() map[string]StatusVarValue
	// GetGlobal returns the current global value of the status variable with the given name
	GetGlobal(name string) (StatusVariable, interface{}, bool)
	// SetGlobal sets the global value of the status variable with the given
	// name, returns an error if the variable is SessionOnly scope
	SetGlobal(name string, val interface{}) error
	// IncrementGlobal increments the value of the status variable by the
	// given integer value. Noop if the variable is session-only scoped.
	IncrementGlobal(name string, val int)
}

// StatusVariableScope represents the scope of a status variable.
type StatusVariableScope byte

const (
	StatusVariableScope_Global StatusVariableScope = iota
	StatusVariableScope_Session
	StatusVariableScope_Both
)

type StatusVariable interface {
	GetName() string
	GetScope() StatusVariableScope
	GetType() Type
	GetDefault() interface{}
}

// MySQLStatusVariable represents a mysql status variable.
type MySQLStatusVariable struct {
	Type    Type
	Default interface{}
	Name    string
	Scope   StatusVariableScope
}

var _ StatusVariable = (*MySQLStatusVariable)(nil)

// GetName implements StatusVariable.
func (m *MySQLStatusVariable) GetName() string {
	return m.Name
}

// GetScope implements StatusVariable.
func (m *MySQLStatusVariable) GetScope() StatusVariableScope {
	return m.Scope
}

// GetType implements StatusVariable.
func (m *MySQLStatusVariable) GetType() Type {
	return m.Type
}

// GetDefault implements StatusVariable.
func (m *MySQLStatusVariable) GetDefault() interface{} {
	return m.Default
}

type StatusVarValue interface {
	Increment(uint64) error
	Set(interface{}) error
	Value() interface{}
	Variable() StatusVariable
	Copy() StatusVarValue
}

// MutableStatusVarValue is a StatusVariable with a value.
type MutableStatusVarValue struct {
	Var StatusVariable
	Val *atomic.Uint64
}

func (s *MutableStatusVarValue) Increment(v uint64) error {
	s.Val.Add(v)
	return nil
}

func (s *MutableStatusVarValue) Set(v interface{}) error {
	typedVal, ok := v.(uint64)
	if !ok {
		return fmt.Errorf("expected uint64")
	}
	s.Val.Store(typedVal)
	return nil
}

func (s *MutableStatusVarValue) Variable() StatusVariable {
	return s.Var
}

func (s *MutableStatusVarValue) Value() interface{} {
	return s.Val.Load()
}

func (s *MutableStatusVarValue) Copy() StatusVarValue {
	ret := *s
	ret.Val = &atomic.Uint64{}
	ret.Val.Add(s.Val.Load())
	return &ret
}

type ImmutableStatusVarValue struct {
	Var StatusVariable
	Val interface{}
}

func (s *ImmutableStatusVarValue) Increment(uint64) error {
	return fmt.Errorf("status variable %s is not a uint64", s.Variable().GetName())
}

func (s *ImmutableStatusVarValue) Set(v interface{}) error {
	s.Val = v
	return nil
}

func (s *ImmutableStatusVarValue) Variable() StatusVariable {
	return s.Var
}

func (s *ImmutableStatusVarValue) Value() interface{} {
	return s.Val
}

func (s *ImmutableStatusVarValue) Copy() StatusVarValue {
	ret := *s
	return &ret
}

// IncrementStatusVariable increments the value of the status variable by integer val.
// |name| is case-sensitive.
func IncrementStatusVariable(ctx *Context, name string, val int) {
	StatusVariables.IncrementGlobal(name, val)
	ctx.Session.IncrementStatusVariable(ctx, name, val)
}

// StoredProcParam is a Parameter for a Stored Procedure.
// Stored Procedures Parameters can be referenced from within other Stored Procedures, so we need to store them
// somewhere that is accessible between interpreter calls to the engine.
type StoredProcParam struct {
	Type       Type
	Value      any
	Reference  *StoredProcParam
	HasBeenSet bool
}

// SetValue saves val to the StoredProcParam, and set HasBeenSet to true.
func (s *StoredProcParam) SetValue(val any) {
	s.Value = val
	s.HasBeenSet = true
	if s.Reference != nil && s != s.Reference {
		s.Reference.SetValue(val)
	}
}

// OrderAndLimit stores the context of an ORDER BY ... LIMIT statement, and is used by index lookups and iterators.
type OrderAndLimit struct {
	OrderBy       Expression
	Limit         Expression
	Literal       Expression
	CalcFoundRows bool
}

func (v OrderAndLimit) DebugString() string {
	if v.Limit != nil {
		return fmt.Sprintf("%v LIMIT %v", DebugString(v.OrderBy), DebugString(v.Limit))
	}
	return DebugString(v.OrderBy)
}

func (v OrderAndLimit) String() string {
	if v.Limit != nil {
		return fmt.Sprintf("%v LIMIT %v", v.OrderBy, v.Limit)
	}
	return v.OrderBy.String()
}
