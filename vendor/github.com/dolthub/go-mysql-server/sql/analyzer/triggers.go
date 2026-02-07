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

package analyzer

import (
	"fmt"
	"strings"

	"github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/planbuilder"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// maxTriggerNameLength is the maximum length for the name of a trigger. Note that MySQL applies a limit of 64 characters,
// but we allow 96 characters to avoid breaking customers who were relying on the previous behavior where we didn't
// check the length.
const maxTriggerNameLength = 96

// validateCreateTrigger handles CreateTrigger nodes, resolving references to "old" and "new" table references in
// the trigger body. Also validates that these old and new references are being used appropriately -- they are only
// valid for certain kinds of triggers and certain statements.
func validateCreateTrigger(ctx *sql.Context, a *Analyzer, node sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	ct, ok := node.(*plan.CreateTrigger)
	if !ok {
		return node, transform.SameTree, nil
	}

	if len(ct.TriggerName) > maxTriggerNameLength {
		return node, transform.SameTree, sql.ErrIdentifierIsTooLong.New(ct.TriggerName)
	}

	// We just want to verify that the trigger is correctly defined before creating it. If it is, we replace the
	// UnresolvedColumn expressions with placeholder expressions that say they are Resolved().
	// TODO: this might work badly for databases with tables named new and old. Needs tests.
	var err error
	transform.InspectExpressions(ct.Body, func(e sql.Expression) bool {
		switch e := e.(type) {
		case *expression.UnresolvedColumn:
			if strings.ToLower(e.Table()) == "new" {
				if ct.TriggerEvent == sqlparser.DeleteStr {
					err = sql.ErrInvalidUseOfOldNew.New("new", ct.TriggerEvent)
				}
			}
			if strings.ToLower(e.Table()) == "old" {
				if ct.TriggerEvent == sqlparser.InsertStr {
					err = sql.ErrInvalidUseOfOldNew.New("old", ct.TriggerEvent)
				}
			}
		}
		return true
	})

	if err != nil {
		return nil, transform.SameTree, err
	}

	// Check to see if the plan sets a value for "old" rows, or if an AFTER trigger assigns to NEW. Both are illegal.
	transform.InspectExpressionsWithNode(ct.Body, func(n sql.Node, e sql.Expression) bool {
		if _, ok := n.(*plan.Set); !ok {
			return true
		}

		switch e := e.(type) {
		case *expression.SetField:
			switch left := e.LeftChild.(type) {
			case column:
				if strings.ToLower(left.Table()) == "old" {
					err = sql.ErrInvalidUpdateOfOldRow.New()
				}
				if ct.TriggerTime == sqlparser.AfterStr && strings.ToLower(left.Table()) == "new" {
					err = sql.ErrInvalidUpdateInAfterTrigger.New()
				}
			}
		}

		return true
	})

	if err != nil {
		return nil, transform.SameTree, err
	}

	trigTable := getResolvedTable(ct.Table)
	sch := trigTable.Schema()
	colsList := make(map[string]struct{})
	for _, c := range sch {
		colsList[c.Name] = struct{}{}
	}

	// Check to see if the columns with "new" and "old" table reference are valid columns from the trigger table.
	transform.InspectExpressions(ct.Body, func(e sql.Expression) bool {
		switch e := e.(type) {
		case *expression.UnresolvedColumn:
			if strings.ToLower(e.Table()) == "old" || strings.ToLower(e.Table()) == "new" {
				if _, ok := colsList[e.Name()]; !ok {
					err = sql.ErrUnknownColumn.New(e.Name(), e.Table())
				}
			}
		}
		return true
	})

	if err != nil {
		return nil, transform.SameTree, err
	}
	return node, transform.NewTree, nil
}

func applyTriggers(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !qFlags.DmlIsSet() {
		return n, transform.SameTree, nil
	}

	// Skip this step for CreateTrigger statements
	if _, ok := n.(*plan.CreateTrigger); ok {
		return n, transform.SameTree, nil
	}

	switch n := n.(type) {
	case *plan.TriggerBeginEndBlock, *plan.BeginEndBlock, *plan.Block:
		// Apply triggers to individual statements inside of blocks
		newChildren := make([]sql.Node, len(n.Children()))
		allSame := transform.SameTree
		for i, c := range n.Children() {
			nc, same, err := applyTriggers(ctx, a, c, scope, sel, qFlags)
			if err != nil {
				return nil, transform.SameTree, err
			}
			allSame = allSame && same
			newChildren[i] = nc
		}
		if allSame {
			return n, transform.SameTree, nil
		}
		newNode, err := n.WithChildren(newChildren...)
		if err != nil {
			return nil, transform.SameTree, err
		}
		return newNode, transform.NewTree, nil
	}

	var affectedTables []string
	var triggerEvent plan.TriggerEvent
	db := ctx.GetCurrentDatabase()
	transform.Inspect(n, func(n sql.Node) bool {
		switch n := n.(type) {
		case *plan.InsertInto:
			affectedTables = append(affectedTables, getTableName(n))
			triggerEvent = plan.InsertTrigger
			if n.Database() != nil && n.Database().Name() != "" {
				db = n.Database().Name()
			}
		case *plan.Update:
			if n.IsJoin {
				uj := n.Child.(*plan.UpdateJoin)
				updateTargets := uj.UpdateTargets
				for _, updateTarget := range updateTargets {
					affectedTables = append(affectedTables, getTableName(updateTarget))
				}
			} else {
				affectedTables = append(affectedTables, getTableName(n))
			}
			triggerEvent = plan.UpdateTrigger
			if n.Database() != "" {
				db = n.Database()
			}
		case *plan.DeleteFrom:
			for _, target := range n.GetDeleteTargets() {
				affectedTables = append(affectedTables, getTableName(target))
			}
			triggerEvent = plan.DeleteTrigger
			if n.Database() != "" {
				db = n.Database()
			}
		}
		return true
	})

	if len(affectedTables) == 0 {
		return n, transform.SameTree, nil
	}

	// TODO: database should be dependent on the table being inserted / updated, but we don't have that info available
	//  from the table object yet.
	database, err := a.Catalog.Database(ctx, db)
	if err != nil {
		return nil, transform.SameTree, err
	}

	var affectedTriggers []*plan.CreateTrigger
	if tdb, ok := database.(sql.TriggerDatabase); ok {
		triggers, err := tdb.GetTriggers(ctx)
		if err != nil {
			return nil, transform.SameTree, err
		}

		b := planbuilder.New(ctx, a.Catalog, nil, nil)
		b.DisableAuth()
		prevActive := b.TriggerCtx().Active
		b.TriggerCtx().Active = true
		defer func() {
			b.TriggerCtx().Active = prevActive
		}()

		for _, trigger := range triggers {
			var parsedTrigger sql.Node
			sqlMode := sql.NewSqlModeFromString(trigger.SqlMode)
			b.SetParserOptions(sqlMode.ParserOptions())
			parsedTrigger, _, _, _, err = b.Parse(trigger.CreateStatement, nil, false)
			b.Reset()
			if err != nil {
				return nil, transform.SameTree, err
			}

			ct, ok := parsedTrigger.(*plan.CreateTrigger)
			if !ok {
				return nil, transform.SameTree, sql.ErrTriggerCreateStatementInvalid.New(trigger.CreateStatement)
			}
			transform.Inspect(ct.Body, func(n sql.Node) bool {
				call, isCall := n.(*plan.Call)
				if !isCall {
					return true
				}
				if call.Procedure == nil {
					return true
				}
				if call.Procedure.ValidationError == nil {
					return true
				}
				err = call.Procedure.ValidationError
				return false
			})
			if err != nil {
				return nil, transform.SameTree, err
			}

			var triggerTable string
			switch t := ct.Table.(type) {
			case *plan.ResolvedTable:
				triggerTable = t.Name()
			default:
			}
			if stringContains(affectedTables, triggerTable) && triggerEventsMatch(triggerEvent, ct.TriggerEvent) {
				// first pass allows unresolved before we know whether trigger is relevant
				// TODO store destination table name with trigger, so we don't have to do parse twice
				b.TriggerCtx().Call = true
				parsedTrigger, _, _, _, err = b.Parse(trigger.CreateStatement, nil, false)
				b.TriggerCtx().Call = false
				b.Reset()
				if err != nil {
					return nil, transform.SameTree, err
				}

				ct, ok := parsedTrigger.(*plan.CreateTrigger)
				if !ok {
					return nil, transform.SameTree, sql.ErrTriggerCreateStatementInvalid.New(trigger.CreateStatement)
				}

				if block, ok := ct.Body.(*plan.BeginEndBlock); ok {
					ct.Body = plan.NewTriggerBeginEndBlock(block)
				}
				affectedTriggers = append(affectedTriggers, ct)
			}
		}
	}

	if len(affectedTriggers) == 0 {
		return n, transform.SameTree, nil
	}

	triggers := orderTriggersAndReverseAfter(affectedTriggers)
	originalNode := n
	same := transform.SameTree
	allSame := transform.SameTree
	for _, trigger := range triggers {
		err = validateNoCircularUpdates(trigger, originalNode, scope)
		if err != nil {
			return nil, transform.SameTree, err
		}

		n, same, err = applyTrigger(ctx, a, originalNode, n, scope, trigger, qFlags)
		if err != nil {
			return nil, transform.SameTree, err
		}
		allSame = same && allSame
	}

	return n, allSame, nil
}

// applyTrigger applies the trigger given to the node given, returning the resulting node
func applyTrigger(ctx *sql.Context, a *Analyzer, originalNode, n sql.Node, scope *plan.Scope, trigger *plan.CreateTrigger, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	qFlags.Set(sql.QFlagRelSubquery)

	triggerLogic, err := getTriggerLogic(ctx, a, originalNode, scope, trigger, qFlags)
	if err != nil {
		return nil, transform.SameTree, err
	}

	if _, ok := triggerLogic.(*plan.TriggerBeginEndBlock); ok {
		pRef := expression.NewProcedureReference()
		// assignProcParam transforms any ProcedureParams to reference the ProcedureReference
		assignProcParam := func(expr sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
			switch e := expr.(type) {
			case *expression.ProcedureParam:
				return e.WithParamReference(pRef), transform.NewTree, nil
			default:
				return expr, transform.SameTree, nil
			}
		}
		// assignProcRef calls assignProcParam on all nodes that sql.Expressioner
		assignProcRef := func(node sql.Node) (sql.Node, transform.TreeIdentity, error) {
			switch n := node.(type) {
			case sql.Expressioner:
				newExprs, same, err := transform.Exprs(n.Expressions(), assignProcParam)
				if err != nil {
					return nil, transform.SameTree, err
				}
				if same {
					return node, transform.SameTree, nil
				}
				newNode, err := n.WithExpressions(newExprs...)
				if err != nil {
					return nil, transform.SameTree, err
				}
				return newNode, transform.NewTree, nil
			default:
				return node, transform.SameTree, nil
			}
		}
		assignProcs := func(node sql.Node) (sql.Node, transform.TreeIdentity, error) {
			switch n := node.(type) {
			case *plan.InsertInto:
				newSource, same, err := transform.NodeWithOpaque(n.Source, assignProcRef)
				if err != nil {
					return nil, transform.SameTree, err
				}
				if same {
					return node, transform.SameTree, nil
				}
				return n.WithSource(newSource), transform.NewTree, nil
			case expression.ProcedureReferencable:
				newParamRef := n.WithParamReference(pRef)
				newNode, _, err := transform.NodeWithOpaque(newParamRef, assignProcRef)
				if err != nil {
					return nil, transform.SameTree, err
				}
				return newNode, transform.NewTree, nil
			default:
				return assignProcRef(node)
			}
		}
		triggerLogic, _, err = transform.NodeWithOpaque(triggerLogic, assignProcs)
		if err != nil {
			return nil, transform.SameTree, err
		}
	}

	canApplyTriggerExecutor := func(c transform.Context) bool {
		// Don't double-apply trigger executors to the bodies of triggers. To avoid this, don't apply the trigger if the
		// parent is a trigger body. Having this as a selector function will also prevent walking the child nodes in the
		// trigger execution logic.
		if _, ok := c.Parent.(*plan.TriggerExecutor); ok {
			if c.ChildNum == 1 { // Right child is the trigger execution logic
				return false
			}
		}
		return true
	}
	return transform.NodeWithCtx(n, canApplyTriggerExecutor, func(c transform.Context) (sql.Node, transform.TreeIdentity, error) {
		switch n := c.Node.(type) {
		case *plan.InsertInto:
			qFlags.Set(sql.QFlagTrigger)
			if trigger.TriggerTime == sqlparser.BeforeStr {
				triggerExecutor := plan.NewTriggerExecutor(n.Source, triggerLogic, plan.InsertTrigger, plan.TriggerTime(trigger.TriggerTime), sql.TriggerDefinition{
					Name:            trigger.TriggerName,
					CreateStatement: trigger.CreateTriggerString,
				})
				return n.WithSource(triggerExecutor), transform.NewTree, nil
			} else {
				n.HasAfterTrigger = true
				return plan.NewTriggerExecutor(n, triggerLogic, plan.InsertTrigger, plan.TriggerTime(trigger.TriggerTime), sql.TriggerDefinition{
					Name:            trigger.TriggerName,
					CreateStatement: trigger.CreateTriggerString,
				}), transform.NewTree, nil
			}
		case *plan.Update:
			qFlags.Set(sql.QFlagTrigger)
			if trigger.TriggerTime == sqlparser.BeforeStr {
				triggerExecutor := plan.NewTriggerExecutor(n.Child, triggerLogic, plan.UpdateTrigger, plan.TriggerTime(trigger.TriggerTime), sql.TriggerDefinition{
					Name:            trigger.TriggerName,
					CreateStatement: trigger.CreateTriggerString,
				})
				node, err := n.WithChildren(triggerExecutor)
				return node, transform.NewTree, err
			} else {
				return plan.NewTriggerExecutor(n, triggerLogic, plan.UpdateTrigger, plan.TriggerTime(trigger.TriggerTime), sql.TriggerDefinition{
					Name:            trigger.TriggerName,
					CreateStatement: trigger.CreateTriggerString,
				}), transform.NewTree, nil
			}
		case *plan.DeleteFrom:
			// TODO: This should work correctly when there is only one table that
			//       has a trigger on it, but it won't work if a DELETE FROM JOIN
			//       is deleting from two tables that both have triggers. Seems
			//       like we need something like a MultipleTriggerExecutor node
			//       that could execute multiple triggers on the same row from its
			//       wrapped iterator. There is also an issue with running triggers
			//       because their field indexes assume the row they evaluate will
			//       only ever contain the columns from the single table the trigger
			//       is based on.
			if n.HasExplicitTargets() {
				return nil, transform.SameTree, fmt.Errorf("delete from with explicit target tables " +
					"does not support triggers; retry with single table deletes")
			}

			qFlags.Set(sql.QFlagTrigger)
			if trigger.TriggerTime == sqlparser.BeforeStr {
				triggerExecutor := plan.NewTriggerExecutor(n.Child, triggerLogic, plan.DeleteTrigger, plan.TriggerTime(trigger.TriggerTime), sql.TriggerDefinition{
					Name:            trigger.TriggerName,
					CreateStatement: trigger.CreateTriggerString,
				})
				node, err := n.WithChildren(triggerExecutor)
				return node, transform.NewTree, err
			} else {
				// TODO: add HasAfterTrigger flag for DeleteFrom node once DELETE...RETURNING has been implemented
				return plan.NewTriggerExecutor(n, triggerLogic, plan.DeleteTrigger, plan.TriggerTime(trigger.TriggerTime), sql.TriggerDefinition{
					Name:            trigger.TriggerName,
					CreateStatement: trigger.CreateTriggerString,
				}), transform.NewTree, nil
			}
		}

		return c.Node, transform.SameTree, nil
	})
}

// getUpdateJoinSource looks for an UpdateJoin child in an Update node and get the UpdateSource and a map of table
// aliases
func getUpdateJoinSource(n sql.Node) (*plan.UpdateSource, map[string]string) {
	if updateNode, isUpdate := n.(*plan.Update); isUpdate {
		if updateJoin, isUpdateJoin := updateNode.Child.(*plan.UpdateJoin); isUpdateJoin {
			if updateSrc, isUpdateSrc := updateJoin.Child.(*plan.UpdateSource); isUpdateSrc {
				tableAliases := make(map[string]string)
				for alias, updateTarget := range updateJoin.UpdateTargets {
					tableAliases[alias] = getTableName(updateTarget)
				}
				return updateSrc, tableAliases
			}
		}
	}
	return nil, nil
}

// getTriggerLogic analyzes and returns the Node representing the trigger body for the trigger given, applied to the
// plan node given, which must be an insert, update, or delete.
func getTriggerLogic(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, trigger *plan.CreateTrigger, qFlags *sql.QueryFlags) (sql.Node, error) {
	// For the reference to the row in the trigger table, we use the scope mechanism. This is a little strange because
	// scopes for subqueries work with the child schemas of a scope node, but we don't have such a node here. Instead we
	// fabricate one with the right properties (its child schema matches the table schema, with the right aliased name)
	var triggerLogic sql.Node
	var err error
	qFlags = nil

	switch trigger.TriggerEvent {
	case sqlparser.InsertStr:
		scopeNode := plan.NewProject(
			[]sql.Expression{expression.NewStar()},
			plan.NewTableAlias("new", trigger.Table),
		)
		s := (*plan.Scope)(nil).NewScope(scopeNode).WithMemos(scope.Memo(n).MemoNodes()).WithProcedureCache(scope.ProcedureCache())
		triggerLogic, _, err = a.analyzeWithSelector(ctx, trigger.Body, s, SelectAllBatches, DefaultRuleSelector, qFlags)
	case sqlparser.UpdateStr:
		var scopeNode *plan.Project
		if updateSrc, tableAliases := getUpdateJoinSource(n); updateSrc == nil {
			scopeNode = plan.NewProject(
				[]sql.Expression{expression.NewStar()},
				plan.NewCrossJoin(
					plan.NewTableAlias("old", trigger.Table),
					plan.NewTableAlias("new", trigger.Table),
				),
			)
		} else {
			updateSrcCols := updateSrc.Child.Schema()
			triggerTableName := getTableName(trigger.Table)
			maskedColNames := make([]string, len(updateSrcCols))
			for i, col := range updateSrcCols {
				// To avoid confusion when joined tables share a column name, we mask the column names from
				// non-triggered tables
				if col.Source == triggerTableName || tableAliases[col.Source] == triggerTableName {
					maskedColNames[i] = col.Name
				} else {
					maskedColNames[i] = ""
				}
			}
			// The scopeNode for an UpdateJoin should contain every column in the updateSource as new and old.
			scopeNode = plan.NewProject(
				[]sql.Expression{expression.NewStar()},
				plan.NewCrossJoin(
					plan.NewSubqueryAlias("old", "", updateSrc.Child).WithColumnNames(maskedColNames),
					plan.NewSubqueryAlias("new", "", updateSrc.Child).WithColumnNames(maskedColNames),
				),
			)
		}
		// Triggers are wrapped in prepend nodes, which means that the parent scope is included
		s := (*plan.Scope)(nil).NewScope(scopeNode).WithMemos(scope.Memo(n).MemoNodes()).WithProcedureCache(scope.ProcedureCache())
		triggerLogic, _, err = a.analyzeWithSelector(ctx, trigger.Body, s, SelectAllBatches, DefaultRuleSelector, qFlags)
	case sqlparser.DeleteStr:
		scopeNode := plan.NewProject(
			[]sql.Expression{expression.NewStar()},
			plan.NewTableAlias("old", trigger.Table),
		)
		// Triggers are wrapped in prepend nodes, which means that the parent scope is included
		s := scope.NewScope(scopeNode)
		triggerLogic, _, err = a.analyzeWithSelector(ctx, trigger.Body, s, SelectAllBatches, DefaultRuleSelector, qFlags)
	}

	return triggerLogic, err
}

// validateNoCircularUpdates returns an error if the trigger logic attempts to update the table that invoked it (or any
// table being updated in an outer scope of this analysis)
func validateNoCircularUpdates(trigger *plan.CreateTrigger, n sql.Node, scope *plan.Scope) error {
	var circularRef error
	transform.Inspect(trigger.Body, func(node sql.Node) bool {
		switch node := node.(type) {
		case *plan.Update, *plan.InsertInto, *plan.DeleteFrom:
			for _, n := range append([]sql.Node{n}, scope.MemoNodes()...) {
				invokingTableName := getTableName(n)
				updatedTable := getTableName(node)
				// TODO: need to compare DB as well
				if updatedTable == invokingTableName {
					circularRef = sql.ErrTriggerTableInUse.New(updatedTable)
					return false
				}
			}
		}
		return true
	})

	return circularRef
}

func orderTriggersAndReverseAfter(triggers []*plan.CreateTrigger) []*plan.CreateTrigger {
	beforeTriggers, afterTriggers := plan.OrderTriggers(triggers)

	// Reverse the order of after triggers. This is because we always apply them to the Insert / Update / Delete node
	// that initiated the trigger, so after triggers, which wrap the Insert, need be applied in reverse order for them to
	// run in the correct order.
	for left, right := 0, len(afterTriggers)-1; left < right; left, right = left+1, right-1 {
		afterTriggers[left], afterTriggers[right] = afterTriggers[right], afterTriggers[left]
	}

	return append(beforeTriggers, afterTriggers...)
}

func triggerEventsMatch(event plan.TriggerEvent, event2 string) bool {
	return strings.ToLower((string)(event)) == strings.ToLower(event2)
}
