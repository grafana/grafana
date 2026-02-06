// Copyright 2023 Dolthub, Inc.
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

package analyzer

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/planbuilder"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// assignExecIndexes walks a query plan in-order and rewrites GetFields to use
// execution appropriate indexing.
func assignExecIndexes(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	s := &idxScope{}
	if !scope.IsEmpty() {
		// triggers
		s.triggerScope = true
		s.insertSourceScope = scope.InInsertSource()
		s.addSchema(scope.Schema())
		s = s.push()
	}
	switch n := n.(type) {
	case *plan.InsertInto:
		if n.LiteralValueSource && len(n.Checks()) == 0 && len(n.OnDupExprs) == 0 && len(n.Returning) == 0 {
			return n, transform.SameTree, nil
		}
	case *plan.Update:
		if n.HasSingleRel && !n.IsJoin && scope.IsEmpty() && !n.IsProcNested {
			// joins, subqueries, triggers, and procedures preclude fast indexing
			if cols, ok := relIsProjected(n.Child); !ok {
				// simplest case, no projection
				return offsetAssignIndexes(n), transform.NewTree, nil
			} else if cols.Len() > 0 {
				// if projection column set is valid, use that to assign
				return projAssignIndexes(n, cols), transform.NewTree, nil
			}
		}
	case *plan.DeleteFrom:
		if n.RefsSingleRel && !n.HasExplicitTargets() && scope.IsEmpty() && !n.IsProcNested {
			// joins, subqueries, triggers, and procedures preclude fast indexing
			return offsetAssignIndexes(n), transform.NewTree, nil
		}
	default:
	}
	ret, _, err := assignIndexesHelper(n, s)
	if err != nil {
		return n, transform.SameTree, err
	}
	return ret, transform.NewTree, nil
}

// relIsProjected returns a relation's column set and whether
// the set is projected from the underlying table source.
func relIsProjected(n sql.Node) (sql.ColSet, bool) {
	proj := true
	var cols sql.ColSet
	transform.Inspect(n, func(n sql.Node) bool {
		var table sql.Table
		switch n := n.(type) {
		case *plan.IndexedTableAccess:
			table = n.Table
			cols = n.Columns()
		case *plan.ResolvedTable:
			table = n.Table
			cols = n.Columns()
		default:
		}
		if _, ok := table.(*plan.VirtualColumnTable); ok {
			cols = sql.ColSet{}
		}
		pt, ok := table.(sql.ProjectedTable)
		if ok {
			if pt.Projections() == nil {
				proj = false
			}
			return false
		}
		return true
	})
	return cols, proj
}

// offsetAssignIndexes assumes all expressions are from one table source
// and execution indices will be offset-1 from the expression ids.
func offsetAssignIndexes(n sql.Node) sql.Node {
	ret, _, _ := transform.NodeExprs(n, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		switch e := e.(type) {
		case *expression.GetField:
			return e.WithIndex(int(e.Id()) - 1), transform.NewTree, nil
		default:
			return e, transform.SameTree, nil
		}
	})
	return ret
}

// projAssignIndexes performs a quick execution index assignment
// for a projected update/delete expression. We assume projected
// expressions have few columns.
func projAssignIndexes(n sql.Node, cols sql.ColSet) sql.Node {
	ret, _, _ := transform.NodeExprs(n, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		switch e := e.(type) {
		case *expression.GetField:
			idx := 0
			for i, ok := cols.Next(1); ok; i, ok = cols.Next(i + 1) {
				if i == e.Id() {
					return e.WithIndex(idx), transform.NewTree, nil
				}
				idx++
			}
			return e, transform.SameTree, fmt.Errorf("column not found: %s", e)
		default:
			return e, transform.SameTree, nil
		}
	})
	return ret
}

func assignIndexesHelper(n sql.Node, inScope *idxScope) (sql.Node, *idxScope, error) {
	// copy scope, otherwise parent/lateral edits have non-local effects
	outScope := inScope.copy()
	err := outScope.visitChildren(n)
	if err != nil {
		return nil, nil, err
	}
	err = outScope.visitSelf(n)
	if err != nil {
		return nil, nil, err
	}
	ret, err := outScope.finalizeSelf(n)
	return ret, outScope, err
}

// idxScope accumulates the information needed to rewrite node column
// references for execution, including parent/child scopes, lateral
// scopes (if in the middle of a join tree), and child nodes and expressions.
// Collecting this info in one place makes it easier to compartmentalize
// finalization into an after phase.
type idxScope struct {
	parentScopes  []*idxScope
	lateralScopes []*idxScope
	childScopes   []*idxScope
	ids           []sql.ColumnId
	columns       []string
	// Columns added from AddColumn are not included in the ResolvedTable yet. For columns that are added with a
	// constraint, we need to add the new columns to the scope so CreateCheck gets the right exec index
	addedColumns sql.Schema
	children     []sql.Node
	expressions  []sql.Expression
	checks       sql.CheckConstraints

	triggerScope      bool
	insertSourceScope bool
	subqueryScope     bool
}

func (s *idxScope) inTrigger() bool {
	if s == nil {
		return false
	}
	for _, ps := range s.parentScopes {
		if ps.inTrigger() {
			return true
		}
	}
	return s.triggerScope
}

func (s *idxScope) inInsertSource() bool {
	if s == nil {
		return false
	}
	for _, ps := range s.parentScopes {
		if ps.inInsertSource() {
			return true
		}
	}
	return s.insertSourceScope
}

func (s *idxScope) addSchema(sch sql.Schema) {
	for _, c := range sch {
		if c.Source == "" {
			s.columns = append(s.columns, c.Name)
		} else {
			s.columns = append(s.columns, c.Source+"."+c.Name)
		}
	}
}

func (s *idxScope) addScope(other *idxScope) {
	s.columns = append(s.columns, other.columns...)
	s.ids = append(s.ids, other.ids...)
}

func (s *idxScope) addLateral(other *idxScope) {
	s.lateralScopes = append(s.lateralScopes, other)
}

func (s *idxScope) addParent(other *idxScope) {
	s.parentScopes = append(s.parentScopes, other)
}

func isQualified(s string) bool {
	return strings.Contains(s, ".")
}

// unqualify is a helper function to remove the table prefix from a column, if it's present.
func unqualify(s string) string {
	if isQualified(s) {
		return strings.Split(s, ".")[1]
	}
	return s
}

func (s *idxScope) getIdxId(id sql.ColumnId, name string) (int, bool) {
	if s.triggerScope || id == 0 {
		// todo: add expr ids for trigger columns and procedure params
		return s.getIdx(name)
	}
	for i, c := range s.ids {
		if c == id {
			return i, true
		}
	}
	// todo: fix places where this is necessary
	return s.getIdx(name)
}

func (s *idxScope) getIdx(n string) (int, bool) {
	// We match the column closet to our current scope. We have already
	// resolved columns, so there will be no in-scope collisions.
	if isQualified(n) {
		for i := len(s.columns) - 1; i >= 0; i-- {
			if strings.EqualFold(n, s.columns[i]) {
				return i, true
			}
		}
		// TODO: we do not have a good way to match columns over set_ops where the column has the same name, but are
		//  from different tables and have different types.
		n = unqualify(n)
		for i := len(s.columns) - 1; i >= 0; i-- {
			if strings.EqualFold(n, s.columns[i]) {
				return i, true
			}
		}
	} else {
		for i := len(s.columns) - 1; i >= 0; i-- {
			if strings.EqualFold(n, unqualify(s.columns[i])) {
				return i, true
			}
		}
	}
	return -1, false
}

func (s *idxScope) copy() *idxScope {
	if s == nil {
		return &idxScope{}
	}
	var varsCopy []string
	if len(s.columns) > 0 {
		varsCopy = make([]string, len(s.columns))
		copy(varsCopy, s.columns)
	}
	var lateralCopy []*idxScope
	if len(s.lateralScopes) > 0 {
		lateralCopy = make([]*idxScope, len(s.lateralScopes))
		copy(lateralCopy, s.lateralScopes)
	}
	var parentCopy []*idxScope
	if len(s.parentScopes) > 0 {
		parentCopy = make([]*idxScope, len(s.parentScopes))
		copy(parentCopy, s.parentScopes)
	}
	if len(s.columns) > 0 {
		varsCopy = make([]string, len(s.columns))
		copy(varsCopy, s.columns)
	}
	var idsCopy []sql.ColumnId
	if len(s.ids) > 0 {
		idsCopy = make([]sql.ColumnId, len(s.ids))
		copy(idsCopy, s.ids)
	}
	return &idxScope{
		lateralScopes:     lateralCopy,
		parentScopes:      parentCopy,
		columns:           varsCopy,
		ids:               idsCopy,
		addedColumns:      s.addedColumns,
		subqueryScope:     s.subqueryScope,
		triggerScope:      s.triggerScope,
		insertSourceScope: s.insertSourceScope,
	}
}

func (s *idxScope) push() *idxScope {
	return &idxScope{
		parentScopes: []*idxScope{s},
	}
}

// visitChildren walks children and gathers schema info for this node
func (s *idxScope) visitChildren(n sql.Node) error {
	switch n := n.(type) {
	case *plan.JoinNode:
		lateralScope := s.copy()
		for _, c := range n.Children() {
			newC, cScope, err := assignIndexesHelper(c, lateralScope)
			if err != nil {
				return err
			}
			// child scope is always a child to the current scope
			s.childScopes = append(s.childScopes, cScope)
			if n.Op.IsLateral() {
				// lateral promotes the scope to parent relative to other join children
				lateralScope.addParent(cScope)
			} else {
				// child scope is lateral scope to join children, hidden by default from
				// most expressions
				lateralScope.addLateral(cScope)
			}
			s.children = append(s.children, newC)
		}
	case *plan.SubqueryAlias:
		sqScope := s.copy()
		if !n.OuterScopeVisibility && !n.IsLateral {
			// TODO: this should not apply to subqueries inside of lateral joins
			// Subqueries with no visibility have no parent scopes. Lateral
			// join subquery aliases continue to enjoy full visibility.
			sqScope.parentScopes = sqScope.parentScopes[:0]
			sqScope.lateralScopes = sqScope.lateralScopes[:0]
			for _, p := range s.parentScopes {
				if p.triggerScope {
					sqScope.parentScopes = append(sqScope.parentScopes, p)
				}
			}
		}
		newC, cScope, err := assignIndexesHelper(n.Child, sqScope)
		if err != nil {
			return err
		}
		s.childScopes = append(s.childScopes, cScope)
		s.children = append(s.children, newC)
	case *plan.SetOp:
		var keepScope *idxScope
		for i, c := range n.Children() {
			newC, cScope, err := assignIndexesHelper(c, s)
			if err != nil {
				return err
			}
			if i == 0 {
				keepScope = cScope
			}
			s.children = append(s.children, newC)
		}
		// keep only the first union scope to avoid double counting
		s.childScopes = append(s.childScopes, keepScope)
	case *plan.InsertInto:
		newSrc, _, err := assignIndexesHelper(n.Source, s)
		if err != nil {
			return err
		}
		newDst, dScope, err := assignIndexesHelper(n.Destination, s)
		if err != nil {
			return err
		}
		s.children = append(s.children, newSrc)
		s.children = append(s.children, newDst)
		s.childScopes = append(s.childScopes, dScope)
	case *plan.Procedure, *plan.CreateTable:
		// do nothing

	case *plan.IfConditional:
		for _, c := range n.Children() {
			// Don't append the child scope because it's not visible from the conditional expression.
			newC, _, err := assignIndexesHelper(c, s)
			if err != nil {
				return err
			}
			s.children = append(s.children, newC)
		}
	default:
		for _, c := range n.Children() {
			newC, cScope, err := assignIndexesHelper(c, s)
			if err != nil {
				return err
			}
			if ac, ok := c.(*plan.AddColumn); ok {
				s.addedColumns = append(s.addedColumns, ac.Column())
			}
			s.childScopes = append(s.childScopes, cScope)
			s.children = append(s.children, newC)
		}
	}
	return nil
}

// visitSelf fixes expression indexes for this node. Assumes |s.childScopes|
// is set, any partial |s.lateralScopes| are filled, and the self scope is
// unset.
func (s *idxScope) visitSelf(n sql.Node) error {
	switch n := n.(type) {
	case *plan.JoinNode:
		// join on expressions see everything
		scopes := append(append(s.parentScopes, s.lateralScopes...), s.childScopes...)
		for _, e := range n.Expressions() {
			s.expressions = append(s.expressions, fixExprToScope(e, scopes...))
		}
	case *plan.RangeHeap:
		// value indexes other side of join
		newValue := fixExprToScope(n.ValueColumnGf, s.lateralScopes...)
		// min/are this child
		newMin := fixExprToScope(n.MinColumnGf, s.childScopes...)
		newMax := fixExprToScope(n.MaxColumnGf, s.childScopes...)
		n.MaxColumnGf = newMax
		n.MinColumnGf = newMin
		n.ValueColumnGf = newValue
		n.MaxColumnIndex = newMax.(*expression.GetField).Index()
		n.MinColumnIndex = newMin.(*expression.GetField).Index()
		n.ValueColumnIndex = newValue.(*expression.GetField).Index()
	case *plan.HashLookup:
		// right entry has parent and self visibility, no lateral join scope
		rightScopes := append(s.parentScopes, s.childScopes...)
		s.expressions = append(s.expressions, fixExprToScope(n.RightEntryKey, rightScopes...))
		// left probe is the join context accumulation
		leftScopes := append(s.parentScopes, s.lateralScopes...)
		s.expressions = append(s.expressions, fixExprToScope(n.LeftProbeKey, leftScopes...))
	case *plan.IndexedTableAccess:
		var scope []*idxScope
		switch n.Typ {
		case plan.ItaTypeStatic:
			// self-visibility
			scope = append(s.parentScopes, s.childScopes...)
		case plan.ItaTypeLookup:
			// join siblings
			scope = append(s.parentScopes, s.lateralScopes...)
		}
		for _, e := range n.Expressions() {
			s.expressions = append(s.expressions, fixExprToScope(e, scope...))
		}
	case *plan.ShowVariables:
		if n.Filter != nil {
			selfScope := s.copy()
			selfScope.addSchema(n.Schema())
			scope := append(s.parentScopes, selfScope)
			for _, e := range n.Expressions() {
				s.expressions = append(s.expressions, fixExprToScope(e, scope...))
			}
		}
	case *plan.JSONTable:
		scopes := append(s.parentScopes, s.lateralScopes...)
		for _, e := range n.Expressions() {
			s.expressions = append(s.expressions, fixExprToScope(e, scopes...))
		}
	case *plan.InsertInto:
		// schema = [oldrow][newrow]
		destSch := n.Destination.Schema()
		srcSch := n.Source.Schema()
		rightSchema := make(sql.Schema, len(destSch)*2)
		if values, isValues := n.Source.(*plan.Values); isValues {
			for oldRowIdx, c := range destSch {
				newC := c.Copy()
				newC.Source = values.AliasName
				if values.ColumnNames != nil {
					newC.Name = values.ColumnNames[newC.Name]
				}

				newRowIdx := len(destSch) + oldRowIdx
				rightSchema[oldRowIdx] = c
				rightSchema[newRowIdx] = newC
			}
		} else {
			for oldRowIdx, c := range destSch {
				// find source index that aligns with dest column
				var newC *sql.Column
				for j, sourceCol := range n.ColumnNames {
					if strings.EqualFold(c.Name, sourceCol) {
						newC = srcSch[j]
						break
					}
				}
				// unable to find column, use copy with OnDupValuesPrefix or fallback
				if newC == nil {
					if len(destSch) != len(srcSch) {
						newC = c.Copy()
						newC.Source = planbuilder.OnDupValuesPrefix
					} else {
						// todo: this is only used for load data. load data errors
						//  without a fallback, and fails to resolve defaults if I
						//  define the columns upfront.
						newC = srcSch[oldRowIdx]
					}
				}
				newRowIdx := len(destSch) + oldRowIdx

				rightSchema[oldRowIdx] = c
				rightSchema[newRowIdx] = newC
			}
		}

		rightScope := &idxScope{}
		rightScope.addSchema(rightSchema)
		dstScope := s.childScopes[0]

		for _, e := range n.OnDupExprs {
			set, ok := e.(*expression.SetField)
			if !ok {
				return fmt.Errorf("on duplicate update expressions should be *expression.SetField; found %T", e)
			}
			// left uses destination schema
			// right uses |rightSchema|
			newLeft := fixExprToScope(set.LeftChild, dstScope)
			newRight := fixExprToScope(set.RightChild, rightScope)
			s.expressions = append(s.expressions, expression.NewSetField(newLeft, newRight))
		}
		for _, c := range n.Checks() {
			newE := fixExprToScope(c.Expr, dstScope)
			newCheck := *c
			newCheck.Expr = newE
			s.checks = append(s.checks, &newCheck)
		}
		for _, r := range n.Returning {
			newE := fixExprToScope(r, dstScope)
			s.expressions = append(s.expressions, newE)
		}
	case *plan.Update:
		newScope := s.copy()
		srcScope := s.childScopes[0]
		// schema is |old_row|-|new_row|; checks only receive half
		newScope.columns = append(newScope.columns, srcScope.columns[:len(srcScope.columns)/2]...)
		for _, c := range n.Checks() {
			newE := fixExprToScope(c.Expr, newScope)
			newCheck := *c
			newCheck.Expr = newE
			s.checks = append(s.checks, &newCheck)
		}
		for _, r := range n.Returning {
			newE := fixExprToScope(r, srcScope)
			s.expressions = append(s.expressions, newE)
		}
	case *plan.LoadData:
		scope := &idxScope{}
		scope.addSchema(n.DestSch)
		for i, e := range n.SetExprs {
			if e == nil {
				continue
			}
			n.SetExprs[i] = fixExprToScope(e, scope)
		}
		for colIdx, col := range n.DestSch {
			if col.Default == nil {
				continue
			}
			newDef := fixExprToScope(sql.Expression(col.Default), scope)
			n.DestSch[colIdx].Default = newDef.(*sql.ColumnDefaultValue)
		}
	case *plan.CreateCheck:
		addedScope := &idxScope{}
		addedScope.addSchema(s.addedColumns)
		scope := append(append(s.parentScopes, s.childScopes...), addedScope)
		s.expressions = append(s.expressions, fixExprToScope(n.Check.Expr, scope...))
	default:
		// Group By and Window functions already account for the new/old columns present from triggers
		// This means that when indexing the Projections, we should not include the trigger scope(s), which are
		// within s.parentScopes.
		if proj, isProj := n.(*plan.Project); isProj {
			switch proj.Child.(type) {
			case *plan.GroupBy, *plan.Window:
				if s.inTrigger() && !s.subqueryScope {
					for _, e := range proj.Expressions() {
						s.expressions = append(s.expressions, fixExprToScope(e, s.childScopes...))
					}
					return nil
				}
			}
		}
		if ne, ok := n.(sql.Expressioner); ok {
			scope := append(s.parentScopes, s.childScopes...)
			// default nodes can't see lateral join nodes, unless we're in lateral
			// join and lateral scopes are promoted to parent status
			for _, e := range ne.Expressions() {
				// OrderedAggregations are special as they append a new field to the outer scope row
				// We need to account for this extra column in the rows when assigning indexes
				// Example: gms/expression/function/aggregation/group_concat.go:groupConcatBuffer.Update()
				if _, isOrdAgg := e.(sql.OrderedAggregation); isOrdAgg {
					selScope := &idxScope{}
					if idExpr, isIdExpr := e.(sql.IdExpression); isIdExpr {
						selScope.ids = append(selScope.ids, idExpr.Id())
					}
					selScope.columns = append(selScope.columns, e.String())
					scope = append(scope, selScope)
				}
				s.expressions = append(s.expressions, fixExprToScope(e, scope...))
			}
		}
	}
	return nil
}

// finalizeSelf builds the output node and fixes the return scope
func (s *idxScope) finalizeSelf(n sql.Node) (sql.Node, error) {
	// assumes children scopes have been set
	switch n := n.(type) {
	case *plan.InsertInto:
		s.addSchema(n.Destination.Schema())
		nn := *n
		nn.Source = s.children[0]
		nn.Destination = s.children[1]
		nn.OnDupExprs = s.expressions[:len(n.OnDupExprs)]
		nn.Returning = s.expressions[len(n.OnDupExprs):]
		return nn.WithChecks(s.checks), nil
	default:
		if nn, ok := n.(*plan.Update); ok {
			nn.Returning = s.expressions
		}

		s.ids = columnIdsForNode(n)
		s.addSchema(n.Schema())
		var err error
		if s.children != nil {
			n, err = n.WithChildren(s.children...)
			if err != nil {
				return nil, err
			}
		}
		if ne, ok := n.(sql.Expressioner); ok && s.expressions != nil {
			n, err = ne.WithExpressions(s.expressions...)
			if err != nil {
				return nil, err
			}
		}
		if nc, ok := n.(sql.CheckConstraintNode); ok && s.checks != nil {
			n = nc.WithChecks(s.checks)
		}
		if jn, ok := n.(*plan.JoinNode); ok {
			if len(s.parentScopes) == 0 {
				return n, nil
			}
			// TODO: combine scopes?
			scopeLen := len(s.parentScopes[0].columns)
			if scopeLen == 0 {
				return n, nil
			}
			n = jn.WithScopeLen(scopeLen)
			n, err = n.WithChildren(
				plan.NewStripRowNode(jn.Left(), scopeLen),
				plan.NewStripRowNode(jn.Right(), scopeLen),
			)
			if err != nil {
				return nil, err
			}
		}
		return n, nil
	}
}

// columnIdsForNode collects the column ids of a node's return schema.
// Projector nodes can return a subset of the full sql.PrimaryTableSchema.
// todo: pruning projections should update plan.TableIdNode .Columns()
// to avoid schema/column discontinuities.
func columnIdsForNode(n sql.Node) []sql.ColumnId {
	var ret []sql.ColumnId
	switch n := n.(type) {
	case sql.Projector:
		for _, e := range n.ProjectedExprs() {
			if ide, ok := e.(sql.IdExpression); ok {
				ret = append(ret, ide.Id())
			} else {
				ret = append(ret, 0)
			}
		}
	case *plan.TableCountLookup:
		ret = append(ret, n.Id())
	case *plan.TableAlias:
		// Table alias's child either exposes 1) child ids or 2) is custom
		// table function. We currently do not update table columns in response
		// to table pruning, so we need to manually distinguish these cases.
		// todo: prune columns should update column ids and table alias ids
		switch n.Child.(type) {
		case sql.TableFunction:
			// todo: table functions that implement sql.Projector are not going
			// to work. Need to fix prune.
			n.Columns().ForEach(func(col sql.ColumnId) {
				ret = append(ret, col)
			})
		default:
			ret = append(ret, columnIdsForNode(n.Child)...)
		}
	case *plan.SetOp:
		ret = append(ret, columnIdsForNode(n.Left())...)
	case plan.TableIdNode:
		if rt, ok := n.(*plan.ResolvedTable); ok && plan.IsDualTable(rt.Table) {
			ret = append(ret, 0)
			break
		}

		cols := n.(plan.TableIdNode).Columns()
		if tn, ok := n.(sql.TableNode); ok {
			if pkt, ok := tn.UnderlyingTable().(sql.PrimaryKeyTable); ok && len(pkt.PrimaryKeySchema().Schema) != len(n.Schema()) {
				firstcol, _ := cols.Next(1)
				for _, c := range n.Schema() {
					ord := pkt.PrimaryKeySchema().IndexOfColName(c.Name)
					colId := firstcol + sql.ColumnId(ord)
					ret = append(ret, colId)
				}
				break
			}
		}
		// TODO: columns are appended in increasing order by ColumnId instead of how they are actually ordered. likely
		// needs to be fixed
		cols.ForEach(func(col sql.ColumnId) {
			ret = append(ret, col)
		})
	case *plan.JoinNode:
		if n.Op.IsPartial() {
			ret = append(ret, columnIdsForNode(n.Left())...)
		} else {
			ret = append(ret, columnIdsForNode(n.Left())...)
			ret = append(ret, columnIdsForNode(n.Right())...)
		}
	case *plan.ShowStatus:
		for i := range n.Schema() {
			ret = append(ret, sql.ColumnId(i+1))
		}
	case *plan.Concat:
		ret = append(ret, columnIdsForNode(n.Left())...)
	default:
		for _, c := range n.Children() {
			ret = append(ret, columnIdsForNode(c)...)
		}
	}
	return ret
}

func fixExprToScope(e sql.Expression, scopes ...*idxScope) sql.Expression {
	newScope := &idxScope{}
	for _, s := range scopes {
		newScope.triggerScope = newScope.triggerScope || s.triggerScope
		newScope.addScope(s)
	}
	ret, _, _ := transform.Expr(e, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		switch e := e.(type) {
		case *expression.GetField:
			// TODO: this is a swallowed error in some cases. It triggers falsely in queries involving the dual table, or
			//  queries where the columns being selected are only found in subqueries. Conversely, we actually want to ignore
			//  this error for the case of DEFAULT in a `plan.Values`, since we analyze the insert source in isolation (we
			//  don't have the destination schema, and column references in default values are determined in the build phase)

			// TODO: If we don't find a valid index for a field, we should report an error
			idx, _ := newScope.getIdxId(e.Id(), e.String())
			if idx >= 0 {
				return e.WithIndex(idx), transform.NewTree, nil
			}
			return e, transform.SameTree, nil
		case *plan.Subquery:
			// this |outScope| prepends the subquery scope
			subqueryScope := newScope.push()
			subqueryScope.subqueryScope = true
			newQ, _, err := assignIndexesHelper(e.Query, subqueryScope)
			if err != nil {
				return nil, transform.SameTree, err
			}
			return e.WithQuery(newQ), transform.NewTree, nil
		default:
			return e, transform.SameTree, nil
		}
	})
	return ret
}
