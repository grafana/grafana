/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package sqlparser

import (
	"fmt"

	"github.com/dolthub/vitess/go/sqltypes"

	querypb "github.com/dolthub/vitess/go/vt/proto/query"
)

// Normalize changes the statement to use bind values, and
// updates the bind vars to those values. The supplied prefix
// is used to generate the bind var names. The function ensures
// that there are no collisions with existing bind vars.
// Within Select constructs, bind vars are deduped. This allows
// us to identify vindex equality. Otherwise, every value is
// treated as distinct.
func Normalize(stmt Statement, bindVars map[string]*querypb.BindVariable, prefix string) {
	nz := newNormalizer(stmt, bindVars, prefix)
	_ = Walk(nz.WalkStatement, stmt)
}

type normalizer struct {
	stmt     Statement
	bindVars map[string]*querypb.BindVariable
	reserved map[string]struct{}
	vals     map[string]string
	prefix   string
	counter  int
}

func newNormalizer(stmt Statement, bindVars map[string]*querypb.BindVariable, prefix string) *normalizer {
	return &normalizer{
		stmt:     stmt,
		bindVars: bindVars,
		prefix:   prefix,
		reserved: GetBindvars(stmt),
		counter:  1,
		vals:     make(map[string]string),
	}
}

// WalkStatement is the top level walk function.
// If it encounters a Select, it switches to a mode
// where variables are deduped.
func (nz *normalizer) WalkStatement(node SQLNode) (bool, error) {
	switch node := node.(type) {
	case *Select:
		_ = Walk(nz.WalkSelect, node)
		// Don't continue
		return false, nil
	case *SQLVal:
		nz.convertSQLVal(node)
	case *ComparisonExpr:
		nz.convertComparison(node)
	case *ColName, TableName:
		// Common node types that never contain SQLVals or ListArgs but create a lot of object
		// allocations.
		return false, nil
	}
	return true, nil
}

// WalkSelect normalizes the AST in Select mode.
func (nz *normalizer) WalkSelect(node SQLNode) (bool, error) {
	switch node := node.(type) {
	case *SQLVal:
		nz.convertSQLValDedup(node)
	case *ComparisonExpr:
		nz.convertComparison(node)
	case *ColName, TableName:
		// Common node types that never contain SQLVals or ListArgs but create a lot of object
		// allocations.
		return false, nil
	case OrderBy, GroupBy:
		// do not make a bind var for order by column_position
		return false, nil
	}
	return true, nil
}

func (nz *normalizer) convertSQLValDedup(node *SQLVal) {
	// If value is too long, don't dedup.
	// Such values are most likely not for vindexes.
	// We save a lot of CPU because we avoid building
	// the key for them.
	if len(node.Val) > 256 {
		nz.convertSQLVal(node)
		return
	}

	// Make the bindvar
	bval := nz.sqlToBindvar(node)
	if bval == nil {
		return
	}

	// Check if there's a bindvar for that value already.
	var key string
	if bval.Type == sqltypes.VarBinary {
		// Prefixing strings with "'" ensures that a string
		// and number that have the same representation don't
		// collide.
		key = "'" + string(node.Val)
	} else {
		key = string(node.Val)
	}
	bvname, ok := nz.vals[key]
	if !ok {
		// If there's no such bindvar, make a new one.
		bvname = nz.newName()
		nz.vals[key] = bvname
		nz.bindVars[bvname] = bval
	}

	// Modify the AST node to a bindvar.
	node.Type = ValArg
	node.Val = append([]byte(":"), bvname...)
}

// convertSQLVal converts an SQLVal without the dedup.
func (nz *normalizer) convertSQLVal(node *SQLVal) {
	bval := nz.sqlToBindvar(node)
	if bval == nil {
		return
	}

	bvname := nz.newName()
	nz.bindVars[bvname] = bval

	node.Type = ValArg
	node.Val = append([]byte(":"), bvname...)
}

// convertComparison attempts to convert IN clauses to
// use the list bind var construct. If it fails, it returns
// with no change made. The walk function will then continue
// and iterate on converting each individual value into separate
// bind vars.
func (nz *normalizer) convertComparison(node *ComparisonExpr) {
	if node.Operator != InStr && node.Operator != NotInStr {
		return
	}
	tupleVals, ok := node.Right.(ValTuple)
	if !ok {
		return
	}
	// The RHS is a tuple of values.
	// Make a list bindvar.
	bvals := &querypb.BindVariable{
		Type: querypb.Type_TUPLE,
	}
	for _, val := range tupleVals {
		bval := nz.sqlToBindvar(val)
		if bval == nil {
			return
		}
		bvals.Values = append(bvals.Values, &querypb.Value{
			Type:  bval.Type,
			Value: bval.Value,
		})
	}
	bvname := nz.newName()
	nz.bindVars[bvname] = bvals
	// Modify RHS to be a list bindvar.
	node.Right = ListArg(append([]byte("::"), bvname...))
}

func (nz *normalizer) sqlToBindvar(node SQLNode) *querypb.BindVariable {
	if node, ok := node.(*SQLVal); ok {
		var v sqltypes.Value
		var err error
		switch node.Type {
		case StrVal:
			v, err = sqltypes.NewValue(sqltypes.VarBinary, node.Val)
		case IntVal:
			v, err = sqltypes.NewValue(sqltypes.Int64, node.Val)
		case FloatVal:
			v, err = sqltypes.NewValue(sqltypes.Float64, node.Val)
		default:
			return nil
		}
		if err != nil {
			return nil
		}
		return sqltypes.ValueBindVariable(v)
	}
	return nil
}

func (nz *normalizer) newName() string {
	for {
		newName := fmt.Sprintf("%s%d", nz.prefix, nz.counter)
		if _, ok := nz.reserved[newName]; !ok {
			nz.reserved[newName] = struct{}{}
			return newName
		}
		nz.counter++
	}
}

// GetBindvars returns a map of the bind vars referenced in the statement.
// TODO(sougou); This function gets called again from vtgate/planbuilder.
// Ideally, this should be done only once.
func GetBindvars(stmt Statement) map[string]struct{} {
	bindvars := make(map[string]struct{})
	_ = Walk(func(node SQLNode) (kontinue bool, err error) {
		switch node := node.(type) {
		case *ColName, TableName:
			// Common node types that never contain SQLVals or ListArgs but create a lot of object
			// allocations.
			return false, nil
		case *SQLVal:
			if node.Type == ValArg {
				bindvars[string(node.Val[1:])] = struct{}{}
			}
		case ListArg:
			bindvars[string(node[2:])] = struct{}{}
		}
		return true, nil
	}, stmt)
	return bindvars
}
