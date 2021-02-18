// Copyright 2015 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package parser

import (
	"context"
	"time"

	"github.com/pkg/errors"

	"github.com/prometheus/prometheus/pkg/labels"
	"github.com/prometheus/prometheus/storage"
)

// Node is a generic interface for all nodes in an AST.
//
// Whenever numerous nodes are listed such as in a switch-case statement
// or a chain of function definitions (e.g. String(), PromQLExpr(), etc.) convention is
// to list them as follows:
//
// 	- Statements
// 	- statement types (alphabetical)
// 	- ...
// 	- Expressions
// 	- expression types (alphabetical)
// 	- ...
//
type Node interface {
	// String representation of the node that returns the given node when parsed
	// as part of a valid query.
	String() string

	// PositionRange returns the position of the AST Node in the query string.
	PositionRange() PositionRange
}

// Statement is a generic interface for all statements.
type Statement interface {
	Node

	// PromQLStmt ensures that no other type accidentally implements the interface
	// nolint:unused
	PromQLStmt()
}

// EvalStmt holds an expression and information on the range it should
// be evaluated on.
type EvalStmt struct {
	Expr Expr // Expression to be evaluated.

	// The time boundaries for the evaluation. If Start equals End an instant
	// is evaluated.
	Start, End time.Time
	// Time between two evaluated instants for the range [Start:End].
	Interval time.Duration
}

func (*EvalStmt) PromQLStmt() {}

// Expr is a generic interface for all expression types.
type Expr interface {
	Node

	// Type returns the type the expression evaluates to. It does not perform
	// in-depth checks as this is done at parsing-time.
	Type() ValueType
	// PromQLExpr ensures that no other types accidentally implement the interface.
	PromQLExpr()
}

// Expressions is a list of expression nodes that implements Node.
type Expressions []Expr

// AggregateExpr represents an aggregation operation on a Vector.
type AggregateExpr struct {
	Op       ItemType // The used aggregation operation.
	Expr     Expr     // The Vector expression over which is aggregated.
	Param    Expr     // Parameter used by some aggregators.
	Grouping []string // The labels by which to group the Vector.
	Without  bool     // Whether to drop the given labels rather than keep them.
	PosRange PositionRange
}

// BinaryExpr represents a binary expression between two child expressions.
type BinaryExpr struct {
	Op       ItemType // The operation of the expression.
	LHS, RHS Expr     // The operands on the respective sides of the operator.

	// The matching behavior for the operation if both operands are Vectors.
	// If they are not this field is nil.
	VectorMatching *VectorMatching

	// If a comparison operator, return 0/1 rather than filtering.
	ReturnBool bool
}

// Call represents a function call.
type Call struct {
	Func *Function   // The function that was called.
	Args Expressions // Arguments used in the call.

	PosRange PositionRange
}

// MatrixSelector represents a Matrix selection.
type MatrixSelector struct {
	// It is safe to assume that this is an VectorSelector
	// if the parser hasn't returned an error.
	VectorSelector Expr
	Range          time.Duration

	EndPos Pos
}

// SubqueryExpr represents a subquery.
type SubqueryExpr struct {
	Expr   Expr
	Range  time.Duration
	Offset time.Duration
	Step   time.Duration

	EndPos Pos
}

// NumberLiteral represents a number.
type NumberLiteral struct {
	Val float64

	PosRange PositionRange
}

// ParenExpr wraps an expression so it cannot be disassembled as a consequence
// of operator precedence.
type ParenExpr struct {
	Expr     Expr
	PosRange PositionRange
}

// StringLiteral represents a string.
type StringLiteral struct {
	Val      string
	PosRange PositionRange
}

// UnaryExpr represents a unary operation on another expression.
// Currently unary operations are only supported for Scalars.
type UnaryExpr struct {
	Op   ItemType
	Expr Expr

	StartPos Pos
}

// VectorSelector represents a Vector selection.
type VectorSelector struct {
	Name          string
	Offset        time.Duration
	LabelMatchers []*labels.Matcher

	// The unexpanded seriesSet populated at query preparation time.
	UnexpandedSeriesSet storage.SeriesSet
	Series              []storage.Series

	PosRange PositionRange
}

// TestStmt is an internal helper statement that allows execution
// of an arbitrary function during handling. It is used to test the Engine.
type TestStmt func(context.Context) error

func (TestStmt) String() string { return "test statement" }
func (TestStmt) PromQLStmt()    {}

func (TestStmt) PositionRange() PositionRange {
	return PositionRange{
		Start: -1,
		End:   -1,
	}
}
func (e *AggregateExpr) Type() ValueType  { return ValueTypeVector }
func (e *Call) Type() ValueType           { return e.Func.ReturnType }
func (e *MatrixSelector) Type() ValueType { return ValueTypeMatrix }
func (e *SubqueryExpr) Type() ValueType   { return ValueTypeMatrix }
func (e *NumberLiteral) Type() ValueType  { return ValueTypeScalar }
func (e *ParenExpr) Type() ValueType      { return e.Expr.Type() }
func (e *StringLiteral) Type() ValueType  { return ValueTypeString }
func (e *UnaryExpr) Type() ValueType      { return e.Expr.Type() }
func (e *VectorSelector) Type() ValueType { return ValueTypeVector }
func (e *BinaryExpr) Type() ValueType {
	if e.LHS.Type() == ValueTypeScalar && e.RHS.Type() == ValueTypeScalar {
		return ValueTypeScalar
	}
	return ValueTypeVector
}

func (*AggregateExpr) PromQLExpr()  {}
func (*BinaryExpr) PromQLExpr()     {}
func (*Call) PromQLExpr()           {}
func (*MatrixSelector) PromQLExpr() {}
func (*SubqueryExpr) PromQLExpr()   {}
func (*NumberLiteral) PromQLExpr()  {}
func (*ParenExpr) PromQLExpr()      {}
func (*StringLiteral) PromQLExpr()  {}
func (*UnaryExpr) PromQLExpr()      {}
func (*VectorSelector) PromQLExpr() {}

// VectorMatchCardinality describes the cardinality relationship
// of two Vectors in a binary operation.
type VectorMatchCardinality int

const (
	CardOneToOne VectorMatchCardinality = iota
	CardManyToOne
	CardOneToMany
	CardManyToMany
)

func (vmc VectorMatchCardinality) String() string {
	switch vmc {
	case CardOneToOne:
		return "one-to-one"
	case CardManyToOne:
		return "many-to-one"
	case CardOneToMany:
		return "one-to-many"
	case CardManyToMany:
		return "many-to-many"
	}
	panic("promql.VectorMatchCardinality.String: unknown match cardinality")
}

// VectorMatching describes how elements from two Vectors in a binary
// operation are supposed to be matched.
type VectorMatching struct {
	// The cardinality of the two Vectors.
	Card VectorMatchCardinality
	// MatchingLabels contains the labels which define equality of a pair of
	// elements from the Vectors.
	MatchingLabels []string
	// On includes the given label names from matching,
	// rather than excluding them.
	On bool
	// Include contains additional labels that should be included in
	// the result from the side with the lower cardinality.
	Include []string
}

// Visitor allows visiting a Node and its child nodes. The Visit method is
// invoked for each node with the path leading to the node provided additionally.
// If the result visitor w is not nil and no error, Walk visits each of the children
// of node with the visitor w, followed by a call of w.Visit(nil, nil).
type Visitor interface {
	Visit(node Node, path []Node) (w Visitor, err error)
}

// Walk traverses an AST in depth-first order: It starts by calling
// v.Visit(node, path); node must not be nil. If the visitor w returned by
// v.Visit(node, path) is not nil and the visitor returns no error, Walk is
// invoked recursively with visitor w for each of the non-nil children of node,
// followed by a call of w.Visit(nil), returning an error
// As the tree is descended the path of previous nodes is provided.
func Walk(v Visitor, node Node, path []Node) error {
	var err error
	if v, err = v.Visit(node, path); v == nil || err != nil {
		return err
	}
	path = append(path, node)

	for _, e := range Children(node) {
		if err := Walk(v, e, path); err != nil {
			return err
		}
	}

	_, err = v.Visit(nil, nil)
	return err
}

type inspector func(Node, []Node) error

func (f inspector) Visit(node Node, path []Node) (Visitor, error) {
	if err := f(node, path); err != nil {
		return nil, err
	}

	return f, nil
}

// Inspect traverses an AST in depth-first order: It starts by calling
// f(node, path); node must not be nil. If f returns a nil error, Inspect invokes f
// for all the non-nil children of node, recursively.
func Inspect(node Node, f inspector) {
	//nolint: errcheck
	Walk(inspector(f), node, nil)
}

// Children returns a list of all child nodes of a syntax tree node.
func Children(node Node) []Node {
	// For some reasons these switches have significantly better performance than interfaces
	switch n := node.(type) {
	case *EvalStmt:
		return []Node{n.Expr}
	case Expressions:
		// golang cannot convert slices of interfaces
		ret := make([]Node, len(n))
		for i, e := range n {
			ret[i] = e
		}
		return ret
	case *AggregateExpr:
		// While this does not look nice, it should avoid unnecessary allocations
		// caused by slice resizing
		if n.Expr == nil && n.Param == nil {
			return nil
		} else if n.Expr == nil {
			return []Node{n.Param}
		} else if n.Param == nil {
			return []Node{n.Expr}
		} else {
			return []Node{n.Expr, n.Param}
		}
	case *BinaryExpr:
		return []Node{n.LHS, n.RHS}
	case *Call:
		// golang cannot convert slices of interfaces
		ret := make([]Node, len(n.Args))
		for i, e := range n.Args {
			ret[i] = e
		}
		return ret
	case *SubqueryExpr:
		return []Node{n.Expr}
	case *ParenExpr:
		return []Node{n.Expr}
	case *UnaryExpr:
		return []Node{n.Expr}
	case *MatrixSelector:
		return []Node{n.VectorSelector}
	case *NumberLiteral, *StringLiteral, *VectorSelector:
		// nothing to do
		return []Node{}
	default:
		panic(errors.Errorf("promql.Children: unhandled node type %T", node))
	}
}

// PositionRange describes a position in the input string of the parser.
type PositionRange struct {
	Start Pos
	End   Pos
}

// mergeRanges is a helper function to merge the PositionRanges of two Nodes.
// Note that the arguments must be in the same order as they
// occur in the input string.
func mergeRanges(first Node, last Node) PositionRange {
	return PositionRange{
		Start: first.PositionRange().Start,
		End:   last.PositionRange().End,
	}
}

// Item implements the Node interface.
// This makes it possible to call mergeRanges on them.
func (i *Item) PositionRange() PositionRange {
	return PositionRange{
		Start: i.Pos,
		End:   i.Pos + Pos(len(i.Val)),
	}
}

func (e *AggregateExpr) PositionRange() PositionRange {
	return e.PosRange
}
func (e *BinaryExpr) PositionRange() PositionRange {
	return mergeRanges(e.LHS, e.RHS)
}
func (e *Call) PositionRange() PositionRange {
	return e.PosRange
}
func (e *EvalStmt) PositionRange() PositionRange {
	return e.Expr.PositionRange()
}
func (e Expressions) PositionRange() PositionRange {
	if len(e) == 0 {
		// Position undefined.
		return PositionRange{
			Start: -1,
			End:   -1,
		}
	}
	return mergeRanges(e[0], e[len(e)-1])
}
func (e *MatrixSelector) PositionRange() PositionRange {
	return PositionRange{
		Start: e.VectorSelector.PositionRange().Start,
		End:   e.EndPos,
	}
}
func (e *SubqueryExpr) PositionRange() PositionRange {
	return PositionRange{
		Start: e.Expr.PositionRange().Start,
		End:   e.EndPos,
	}
}
func (e *NumberLiteral) PositionRange() PositionRange {
	return e.PosRange
}
func (e *ParenExpr) PositionRange() PositionRange {
	return e.PosRange
}
func (e *StringLiteral) PositionRange() PositionRange {
	return e.PosRange
}
func (e *UnaryExpr) PositionRange() PositionRange {
	return PositionRange{
		Start: e.StartPos,
		End:   e.Expr.PositionRange().End,
	}
}
func (e *VectorSelector) PositionRange() PositionRange {
	return e.PosRange
}
