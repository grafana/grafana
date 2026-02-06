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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/planbuilder"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// loadTriggers loads any triggers that are required for a plan node to operate properly (except for nodes dealing with
// trigger execution).
func loadTriggers(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("loadTriggers")
	defer span.End()

	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		switch node := n.(type) {
		case *plan.ShowTriggers:
			newShowTriggers := *node
			loadedTriggers, err := loadTriggersFromDb(ctx, a, newShowTriggers.Database(), false)
			if err != nil {
				return nil, transform.SameTree, err
			}
			if len(loadedTriggers) != 0 {
				newShowTriggers.Triggers = loadedTriggers
			} else {
				newShowTriggers.Triggers = make([]*plan.CreateTrigger, 0)
			}
			return &newShowTriggers, transform.NewTree, nil
		case *plan.DropTrigger:
			loadedTriggers, err := loadTriggersFromDb(ctx, a, node.Database(), true)
			if err != nil {
				return nil, transform.SameTree, err
			}
			for _, trigger := range loadedTriggers {
				if strings.EqualFold(node.TriggerName, trigger.TriggerName) {
					node.TriggerName = trigger.TriggerName
					continue
				}
				if trigger.TriggerOrder != nil && strings.EqualFold(node.TriggerName, trigger.TriggerOrder.OtherTriggerName) {
					return nil, transform.SameTree, sql.ErrTriggerCannotBeDropped.New(node.TriggerName, trigger.TriggerName)
				}
			}
			return node, transform.NewTree, nil
		case *plan.DropTable:
			// if there is no table left after filtering out non-existent tables, no need to load triggers
			if len(node.Tables) == 0 {
				return node, transform.SameTree, nil
			}

			// the table has to be TableNode as this rule is executed after resolve-table rule
			var dropTableDb sql.Database
			if t, ok := node.Tables[0].(*plan.ResolvedTable); ok {
				dropTableDb = t.SqlDatabase
			}

			loadedTriggers, err := loadTriggersFromDb(ctx, a, dropTableDb, false)
			if err != nil {
				return nil, transform.SameTree, err
			}
			lowercasedNames := make(map[string]struct{})
			tblNames, err := node.TableNames()
			if err != nil {
				return nil, transform.SameTree, err
			}
			for _, tableName := range tblNames {
				lowercasedNames[strings.ToLower(tableName)] = struct{}{}
			}
			var triggersForTable []string
			for _, trigger := range loadedTriggers {
				if _, ok := lowercasedNames[strings.ToLower(trigger.Table.(sql.Nameable).Name())]; ok {
					triggersForTable = append(triggersForTable, trigger.TriggerName)
				}
			}
			return node.WithTriggers(triggersForTable), transform.NewTree, nil
		default:
			return node, transform.SameTree, nil
		}
	})
}

func loadTriggersFromDb(ctx *sql.Context, a *Analyzer, db sql.Database, ignoreParseErrors bool) ([]*plan.CreateTrigger, error) {
	var loadedTriggers []*plan.CreateTrigger
	if triggerDb, ok := db.(sql.TriggerDatabase); ok {
		triggers, err := triggerDb.GetTriggers(ctx)
		if err != nil {
			return nil, err
		}
		for _, trigger := range triggers {
			var parsedTrigger sql.Node
			sqlMode := sql.NewSqlModeFromString(trigger.SqlMode)
			// TODO: should perhaps add the auth query handler to the analyzer? does this even use auth?
			parsedTrigger, _, err = planbuilder.ParseWithOptions(ctx, a.Catalog, trigger.CreateStatement, sqlMode.ParserOptions())
			if err != nil {
				// We want to be able to drop invalid triggers, so ignore any parser errors and return the name of the trigger
				if !ignoreParseErrors {
					return nil, err
				}
				// TODO: we won't have TriggerOrder information for this unparseable trigger,
				//   but it will still be referenced by any valid triggers.
				fakeTrigger := &plan.CreateTrigger{
					TriggerName: trigger.Name,
				}
				loadedTriggers = append(loadedTriggers, fakeTrigger)
				continue
			}
			triggerPlan, ok := parsedTrigger.(*plan.CreateTrigger)
			if !ok {
				return nil, sql.ErrTriggerCreateStatementInvalid.New(trigger.CreateStatement)
			}
			triggerPlan.CreatedAt = trigger.CreatedAt // use the stored created time
			loadedTriggers = append(loadedTriggers, triggerPlan)
		}
	}
	return loadedTriggers, nil
}
