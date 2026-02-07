// Copyright 2021 Dolthub, Inc.
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
	"slices"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/planbuilder"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// loadStoredProcedures loads non-built-in stored procedures for all databases on relevant calls.
func loadStoredProcedures(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector) (*plan.Scope, error) {
	if scope.ProceduresPopulating() {
		return scope, nil
	}
	referencesProcedures := hasProcedureCall(n)
	if !referencesProcedures {
		return scope, nil
	}
	scope = scope.WithProcedureCache(plan.NewProcedureCache())
	scope.Procedures.IsPopulating = true
	defer func() {
		scope.Procedures.IsPopulating = false
	}()

	allDatabases := a.Catalog.AllDatabases(ctx)
	for _, database := range allDatabases {
		pdb, ok := database.(sql.StoredProcedureDatabase)
		if !ok {
			continue
		}
		procedures, err := pdb.GetStoredProcedures(ctx)
		if err != nil {
			return nil, err
		}
		for _, procedure := range procedures {
			if procedure.Name != "" {
			}
			proc, _, err := planbuilder.BuildProcedureHelper(ctx, a.Catalog, false, nil, database, nil, procedure)
			if err != nil {
				// TODO: alternatively just have BuildProcedureHelper always return a procedure with validation error
				proc = &plan.Procedure{
					Name:                  procedure.Name,
					CreateProcedureString: procedure.CreateStatement,
					CreatedAt:             procedure.CreatedAt,
					ModifiedAt:            procedure.ModifiedAt,
					ValidationError:       err,
				}
			}
			err = scope.Procedures.Register(database.Name(), proc)
			if err != nil {
				return nil, err
			}
		}
	}
	return scope, nil
}

func hasProcedureCall(n sql.Node) bool {
	referencesProcedures := false
	transform.Inspect(n, func(n sql.Node) bool {
		if _, ok := n.(*plan.Call); ok {
			referencesProcedures = true
			return false
		} else if rt, ok := n.(*plan.ResolvedTable); ok {
			_, rOk := rt.Table.(RoutineTable)
			if rOk {
				referencesProcedures = true
				return false
			}
		}
		return true
	})
	return referencesProcedures
}

// analyzeProcedureBodies analyzes each statement in a procedure's body individually, as the analyzer is designed to
// inspect single statements rather than a collection of statements, which is usually the body of a stored procedure.
func analyzeProcedureBodies(ctx *sql.Context, a *Analyzer, node sql.Node, skipCall bool, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	children := node.Children()
	newChildren := make([]sql.Node, len(children))
	var err error
	procSel := NewProcRuleSelector(sel)
	for i, child := range children {
		var newChild sql.Node
		switch child := child.(type) {
		case plan.RepresentsBlock:
			// Many analyzer rules only check the top-level node, so we have to recursively analyze each child
			newChild, _, err = analyzeProcedureBodies(ctx, a, child, skipCall, scope, sel, qFlags)
			if err != nil {
				return nil, transform.SameTree, err
			}
			// If a block node also has expressions (e.g. IfConditional), then we need to run the
			// finalizeSubqueries analyzer rule in case the expressions contain any subqueries.
			var rulesToRun []RuleId
			if _, ok := child.(sql.Expressioner); ok {
				rulesToRun = append(rulesToRun, finalizeSubqueriesId, assignExecIndexesId)
			}
			newChild, _, err = a.analyzeWithSelector(ctx, newChild, scope, SelectAllBatches, func(id RuleId) bool {
				return slices.Contains(rulesToRun, id)
			}, qFlags)
		case *plan.Call:
			if skipCall {
				newChild = child
			} else {
				newChild, _, err = a.analyzeWithSelector(ctx, child, scope, SelectAllBatches, procSel, qFlags)
			}
		case *plan.InsertInto:
			qFlags.Set(sql.QFlagInsert)
			newChild, _, err = a.analyzeWithSelector(ctx, child, scope, SelectAllBatches, procSel, qFlags)
			qFlags.Unset(sql.QFlagInsert)
		case *plan.Update:
			qFlags.Set(sql.QFlagUpdate)
			newChild, _, err = a.analyzeWithSelector(ctx, child, scope, SelectAllBatches, procSel, qFlags)
			qFlags.Unset(sql.QFlagUpdate)
		case *plan.DeleteFrom:
			qFlags.Set(sql.QFlagDelete)
			newChild, _, err = a.analyzeWithSelector(ctx, child, scope, SelectAllBatches, procSel, qFlags)
			qFlags.Unset(sql.QFlagDelete)
		default:
			newChild, _, err = a.analyzeWithSelector(ctx, child, scope, SelectAllBatches, procSel, qFlags)
		}
		if err != nil {
			return nil, transform.SameTree, err
		}
		newChildren[i] = newChild
	}
	node, err = node.WithChildren(newChildren...)
	if err != nil {
		return nil, transform.SameTree, err
	}
	return node, transform.NewTree, nil
}

// applyProcedures applies the relevant stored procedures to the node given (if necessary).
func applyProcedures(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if _, ok := n.(*plan.CreateProcedure); ok {
		return n, transform.SameTree, nil
	}

	if _, isShowCreateProcedure := n.(*plan.ShowCreateProcedure); !hasProcedureCall(n) && !isShowCreateProcedure {
		return n, transform.SameTree, nil
	}

	call, newIdentity, err := transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		call, ok := n.(*plan.Call)
		if !ok {
			return n, transform.SameTree, nil
		}
		if call.Analyzed {
			return n, transform.SameTree, nil
		}
		if scope.IsEmpty() {
			scope = scope.WithProcedureCache(plan.NewProcedureCache())
		}
		if call.AsOf() != nil && !scope.EnforceReadOnly {
			scope.EnforceReadOnly = true
			defer func() {
				scope.EnforceReadOnly = false
			}()
		}

		esp, err := a.Catalog.ExternalStoredProcedure(ctx, call.Name, len(call.Params))
		if err != nil {
			return nil, transform.SameTree, err
		}
		if esp != nil {
			return call, transform.SameTree, nil
		}

		if _, isStoredProcDb := call.Database().(sql.StoredProcedureDatabase); !isStoredProcDb {
			return nil, transform.SameTree, sql.ErrStoredProceduresNotSupported.New(call.Database().Name())
		}

		qFlags.Set(sql.QFlagAnalyzeProcedure)
		analyzedNode, _, err := analyzeProcedureBodies(ctx, a, call.Procedure, false, scope, sel, qFlags)
		qFlags.Unset(sql.QFlagAnalyzeProcedure)
		if err != nil {
			return nil, transform.SameTree, err
		}
		analyzedProc, ok := analyzedNode.(*plan.Procedure)
		if !ok {
			return nil, transform.SameTree, fmt.Errorf("analyzed node %T and expected *plan.Procedure", analyzedNode)
		}
		// stored procedures nested within triggers may attempt to analyze this twice, causing problems like double projections
		newCall := call.WithProcedure(analyzedProc)
		newCall.Analyzed = true
		return newCall, transform.NewTree, nil
	})
	if err != nil {
		return nil, transform.SameTree, err
	}
	n = call

	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		switch n := n.(type) {
		case *plan.Call:
			return applyProceduresCall(ctx, a, n, scope, sel, qFlags)
		case *plan.ShowCreateProcedure:
			procedures, err := a.Catalog.ExternalStoredProcedures(ctx, n.ProcedureName)
			if err != nil {
				return n, transform.SameTree, err
			}
			if len(procedures) == 0 {
				// Not finding an external stored procedure is not an error, since we'll also later
				// search for a user-defined stored procedure with this name.
				return n, transform.SameTree, nil
			}
			return n.WithExternalStoredProcedure(procedures[0]), transform.NewTree, nil
		default:
			return n, newIdentity, nil
		}
	})
}

// applyProceduresCall applies the relevant stored procedure to the given *plan.Call.
func applyProceduresCall(ctx *sql.Context, a *Analyzer, call *plan.Call, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	procedure := call.Procedure
	if procedure.HasVariadicParameter() {
		procedure = procedure.ExtendVariadic(ctx, len(call.Params))
	}
	pRef := expression.NewProcedureReference()
	call = call.WithParamReference(pRef)

	var procParamTransformFunc transform.ExprFunc
	procParamTransformFunc = func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		switch expr := e.(type) {
		case *expression.ProcedureParam:
			return expr.WithParamReference(pRef), transform.NewTree, nil
		case sql.ExpressionWithNodes:
			children := expr.NodeChildren()
			var newChildren []sql.Node
			for i, child := range children {
				newChild, same, err := transform.NodeExprsWithOpaque(child, procParamTransformFunc)
				if err != nil {
					return nil, transform.SameTree, err
				}
				if same == transform.NewTree {
					if newChildren == nil {
						newChildren = make([]sql.Node, len(children))
						copy(newChildren, children)
					}
					newChildren[i] = newChild
				}
			}
			if len(newChildren) > 0 {
				newExpr, err := expr.WithNodeChildren(newChildren...)
				if err != nil {
					return nil, transform.SameTree, err
				}
				return newExpr, transform.NewTree, nil
			}
			return e, transform.SameTree, nil
		default:
			return e, transform.SameTree, nil
		}
	}
	transformedProcedure, _, err := transform.NodeExprsWithOpaque(procedure, procParamTransformFunc)
	if err != nil {
		return nil, transform.SameTree, err
	}
	// Some nodes do not expose all of their children, so we need to handle them here.
	transformedProcedure, _, err = transform.NodeWithOpaque(transformedProcedure, func(node sql.Node) (sql.Node, transform.TreeIdentity, error) {
		switch n := node.(type) {
		case plan.DisjointedChildrenNode:
			same := transform.SameTree
			disjointedChildGroups := n.DisjointedChildren()
			newDisjointedChildGroups := make([][]sql.Node, len(disjointedChildGroups))
			for groupIdx, disjointedChildGroup := range disjointedChildGroups {
				newDisjointedChildGroups[groupIdx] = make([]sql.Node, len(disjointedChildGroup))
				for childIdx, disjointedChild := range disjointedChildGroup {
					var childIdentity transform.TreeIdentity
					if newDisjointedChildGroups[groupIdx][childIdx], childIdentity, err = transform.NodeExprsWithOpaque(disjointedChild, procParamTransformFunc); err != nil {
						return nil, transform.SameTree, err
					} else if childIdentity == transform.NewTree {
						same = childIdentity
					}
				}
			}
			if same == transform.NewTree {
				if newChild, err := n.WithDisjointedChildren(newDisjointedChildGroups); err != nil {
					return nil, transform.SameTree, err
				} else {
					return newChild, transform.NewTree, nil
				}
			}
			return n, transform.SameTree, nil
		case expression.ProcedureReferencable:
			// BeginEndBlocks need to reference the same ParameterReference as the Call
			return n.WithParamReference(pRef), transform.NewTree, nil
		default:
			return transform.NodeExprsWithOpaque(n, procParamTransformFunc)
		}
	})
	if err != nil {
		return nil, transform.SameTree, err
	}

	transformedProcedure, _, err = transform.Node(transformedProcedure, func(node sql.Node) (sql.Node, transform.TreeIdentity, error) {
		rt, ok := node.(*plan.ResolvedTable)
		if !ok {
			return node, transform.SameTree, nil
		}
		return plan.NewProcedureResolvedTable(rt), transform.NewTree, nil
	})

	transformedProcedure, _, err = applyProcedures(ctx, a, transformedProcedure, scope, sel, qFlags)
	if err != nil {
		return nil, transform.SameTree, err
	}

	var ok bool
	procedure, ok = transformedProcedure.(*plan.Procedure)
	if !ok {
		return nil, transform.SameTree, fmt.Errorf("expected `*plan.Procedure` but got `%T`", transformedProcedure)
	}

	if len(procedure.Params) != len(call.Params) {
		return nil, transform.SameTree, sql.ErrCallIncorrectParameterCount.New(procedure.Name, len(procedure.Params), len(call.Params))
	}

	call = call.WithProcedure(procedure)
	return call, transform.NewTree, nil
}
