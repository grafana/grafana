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

package plan

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// Scope of the analysis being performed, used when analyzing subqueries to give such analysis access to outer scope.
type Scope struct {
	// corr is the aggregated set of correlated columns tracked by the subquery
	// chain that produced this scope.
	corr       sql.ColSet
	Procedures *ProcedureCache

	// Stack of nested node scopes, with innermost scope first. A scope node is the node in which the subquery is
	// defined, or an appropriate sibling, NOT the child node of the Subquery node.
	nodes []sql.Node
	// Memo nodes are nodes in the execution context that shouldn't be considered for name resolution, but are still
	Memos        []sql.Node
	joinSiblings []sql.Node
	JoinTrees    []string

	// recursionDepth tracks how many times we've recursed with analysis, to avoid stack overflows from infinite recursion
	recursionDepth int

	// CurrentNodeIsFromSubqueryExpression is true when the last scope (i.e. the most inner of the outer scope levels) has been
	// created by a subquery expression. This is needed in order to calculate outer scope visibility for derived tables.
	CurrentNodeIsFromSubqueryExpression bool
	// EnforceReadOnly causes analysis to block all modification operations, as though a database is read only.
	EnforceReadOnly bool

	inJoin         bool
	inLateralJoin  bool
	inInsertSource bool
}

func (s *Scope) IsEmpty() bool {
	return s == nil || len(s.nodes) == 0
}

func (s *Scope) EnforcesReadOnly() bool {
	return s != nil && s.EnforceReadOnly
}

// OuterRelUnresolved returns true if the relations in the
// outer scope are not qualified and resolved.
// note: a subquery in the outer scope is itself a scope,
// and by definition not an outer relation
func (s *Scope) OuterRelUnresolved() bool {
	return !s.IsEmpty() && s.Schema() == nil && len(s.nodes[0].Children()) > 0
}

// NewScope creates a new Scope object with the additional innermost Node context. When constructing with a subquery,
// the Node given should be the sibling Node of the subquery.
func (s *Scope) NewScope(node sql.Node) *Scope {
	if s == nil {
		return &Scope{nodes: []sql.Node{node}}
	}
	var newNodes []sql.Node
	newNodes = append(newNodes, node)
	newNodes = append(newNodes, s.nodes...)
	return &Scope{
		nodes:          newNodes,
		Memos:          s.Memos,
		recursionDepth: s.recursionDepth + 1,
		Procedures:     s.Procedures,
		joinSiblings:   s.joinSiblings,
	}
}

// NewScopeFromSubqueryExpression returns a new subscope created from a
// subquery expression contained by the specified node. |corr| is the
// set of correlated columns referenced in this subquery, which is only
// implicit here because the subquery is distanced from its parent |node|.
func (s *Scope) NewScopeFromSubqueryExpression(node sql.Node, corr sql.ColSet) *Scope {
	subScope := s.NewScope(node)
	subScope.CurrentNodeIsFromSubqueryExpression = true
	subScope.corr = corr
	if s != nil {
		subScope.corr = s.corr.Union(corr)
	}
	return subScope
}

// NewScopeFromSubqueryExpression returns a new subscope created from a subquery expression contained by the specified
// node.
func (s *Scope) NewScopeInJoin(node sql.Node) *Scope {
	for {
		var done bool
		switch n := node.(type) {
		case *StripRowNode:
			node = n.Child
		default:
			done = true
		}
		if done {
			break
		}
	}
	if s == nil {
		return &Scope{joinSiblings: []sql.Node{node}}
	}

	var newNodes []sql.Node
	newNodes = append(newNodes, node)
	newNodes = append(newNodes, s.joinSiblings...)
	return &Scope{
		nodes:          s.nodes,
		Memos:          s.Memos,
		recursionDepth: s.recursionDepth + 1,
		Procedures:     s.Procedures,
		joinSiblings:   newNodes,
		corr:           s.corr,
	}
}

// newScopeFromSubqueryExpression returns a new subscope created from a subquery expression contained by the specified
// node.
func (s *Scope) NewScopeNoJoin() *Scope {
	return &Scope{
		nodes:           s.nodes,
		Memos:           s.Memos,
		recursionDepth:  s.recursionDepth + 1,
		Procedures:      s.Procedures,
		EnforceReadOnly: s.EnforceReadOnly,
		corr:            s.corr,
	}
}

// NewScopeFromSubqueryAlias returns a new subscope created from the specified SubqueryAlias. Subquery aliases, or
// derived tables, generally do NOT have any visibility to outer scopes, but when they are nested inside a subquery
// expression, they may reference tables from the scopes outside the subquery expression's scope.
func (s *Scope) NewScopeFromSubqueryAlias(sqa *SubqueryAlias) *Scope {
	subScope := newScopeWithDepth(s.RecursionDepth() + 1)
	subScope.corr = sqa.Correlated
	if s != nil {
		if len(s.nodes) > 0 {
			// As of MySQL 8.0.14, MySQL provides OUTER scope visibility to derived tables. Unlike LATERAL scope visibility, which
			// gives a derived table visibility to the adjacent expressions where the subquery is defined, OUTER scope visibility
			// gives a derived table visibility to the OUTER scope where the subquery is defined.
			// https://dev.mysql.com/blog-archive/supporting-all-kinds-of-outer-references-in-derived-tables-lateral-or-not/
			// We don't include the current inner node so that the outer scope nodes are still present, but not the lateral nodes
			if s.CurrentNodeIsFromSubqueryExpression { // TODO: probably copy this for lateral
				sqa.OuterScopeVisibility = true
				subScope.nodes = append(subScope.nodes, s.InnerToOuter()...)
			}
		}
		if len(s.joinSiblings) > 0 {
			subScope.joinSiblings = append(subScope.joinSiblings, s.joinSiblings...)
		}
		subScope.inJoin = s.inJoin
		subScope.inLateralJoin = s.inLateralJoin
		subScope.corr = s.corr.Union(sqa.Correlated)
	}

	return subScope
}

// newScopeWithDepth returns a new scope object with the recursion depth given
func newScopeWithDepth(depth int) *Scope {
	return &Scope{recursionDepth: depth}
}

// Memo creates a new Scope object with the Memo node given. Memo nodes don't affect name resolution, but are used in
// other parts of analysis, such as error handling for trigger / procedure execution.
func (s *Scope) Memo(node sql.Node) *Scope {
	if s == nil {
		return &Scope{Memos: []sql.Node{node}}
	}
	var newNodes []sql.Node
	newNodes = append(newNodes, node)
	newNodes = append(newNodes, s.Memos...)
	return &Scope{
		Memos:      newNodes,
		nodes:      s.nodes,
		Procedures: s.Procedures,
	}
}

// WithMemos returns a new scope object identical to the receiver, but with its memos replaced with the ones given.
func (s *Scope) WithMemos(memoNodes []sql.Node) *Scope {
	if s == nil {
		return &Scope{Memos: memoNodes}
	}
	return &Scope{
		Memos:      memoNodes,
		nodes:      s.nodes,
		Procedures: s.Procedures,
	}
}

func (s *Scope) MemoNodes() []sql.Node {
	if s == nil {
		return nil
	}
	return s.Memos
}

func (s *Scope) RecursionDepth() int {
	if s == nil {
		return 0
	}
	return s.recursionDepth
}

func (s *Scope) ProcedureCache() *ProcedureCache {
	if s == nil {
		return nil
	}
	return s.Procedures
}

func (s *Scope) WithProcedureCache(cache *ProcedureCache) *Scope {
	if s == nil {
		return &Scope{Procedures: cache}
	}
	return &Scope{
		Memos:      s.Memos,
		nodes:      s.nodes,
		Procedures: cache,
	}
}

func (s *Scope) ProceduresPopulating() bool {
	return s != nil && s.Procedures != nil && s.Procedures.IsPopulating
}

// InnerToOuter returns the scope Nodes in order of innermost scope to outermost scope. When using these nodes for
// analysis, always inspect the children of the nodes, rather than the nodes themselves. The children define the schema
// of the rows being processed by the scope node itself.
func (s *Scope) InnerToOuter() []sql.Node {
	if s == nil {
		return nil
	}
	return s.nodes
}

// OuterToInner returns the scope nodes in order of outermost scope to innermost scope. When using these nodes for
// analysis, always inspect the children of the nodes, rather than the nodes themselves. The children define the schema
// of the rows being processed by the scope node itself.
func (s *Scope) OuterToInner() []sql.Node {
	if s == nil {
		return nil
	}
	reversed := make([]sql.Node, len(s.nodes))
	for i := range s.nodes {
		reversed[i] = s.nodes[len(s.nodes)-i-1]
	}
	return reversed
}

// Schema returns the equivalent schema of this scope, which consists of the schemas of all constituent scope nodes
// concatenated from outer to inner. Because we can only calculate the Schema() of nodes that are Resolved(), this
// method fills in place holder columns as necessary.
func (s *Scope) Schema() sql.Schema {
	var schema sql.Schema
	for _, n := range s.OuterToInner() {
		for _, n := range n.Children() {
			if n.Resolved() {
				schema = append(schema, n.Schema()...)
				continue
			}

			// If this scope node isn't resolved, we can't use Schema() on it. Instead, assemble an equivalent Schema, with
			// placeholder columns where necessary, for the purpose of analysis.
			switch n := n.(type) {
			case *Project:
				for _, expr := range n.Projections {
					var col *sql.Column
					if expr.Resolved() {
						col = transform.ExpressionToColumn(expr, AliasSubqueryString(expr))
					} else {
						// TODO: a new type here?
						col = &sql.Column{
							Name:   "",
							Source: "",
						}
					}
					schema = append(schema, col)
				}
			default:
				// TODO: log this
				// panic(fmt.Sprintf("Unsupported scope node %T", n))
			}
		}
	}
	if s != nil && s.inJoin {
		for _, n := range s.joinSiblings {
			schema = append(schema, n.Schema()...)
		}
	}
	return schema
}

func (s *Scope) SetJoin(b bool) {
	if s == nil {
		return
	}
	s.inJoin = b
}

func (s *Scope) SetLateralJoin(b bool) {
	if s == nil {
		return
	}
	s.inLateralJoin = b
}

func (s *Scope) SetInInsertSource(b bool) {
	if s == nil {
		return
	}
	s.inInsertSource = b
}

func (s *Scope) InJoin() bool {
	return s != nil && s.inJoin
}

func (s *Scope) InLateralJoin() bool {
	return s != nil && s.inLateralJoin
}

func (s *Scope) InInsertSource() bool {
	return s != nil && s.inInsertSource
}

func (s *Scope) JoinSiblings() []sql.Node {
	return s.joinSiblings
}

func (s *Scope) Correlated() sql.ColSet {
	return s.corr
}
