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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// dBQualifiedNameables represents either a single sql.Nameable without a database (such as an alias),
// or multiple sql.Nameables each belonging to a different database.
type dBQualifiedNameables struct {
	unqualified sql.Nameable
	qualified   map[string]sql.Nameable
}

type TableAliases struct {
	aliases map[string]dBQualifiedNameables
}

// addQualified adds the given table alias (qualified by a database name), referring to the node given.
func (ta *TableAliases) addQualified(db string, alias string, target sql.Nameable) error {
	if alias == plan.DualTableName {
		return nil
	}

	if ta.aliases == nil {
		ta.aliases = make(map[string]dBQualifiedNameables)
	}

	lowerName := strings.ToLower(alias)
	candidates := ta.aliases[lowerName]
	// A table name can map to multiple tables from different databases (qualified)
	// or a single unqualified target, but not both.
	if candidates.unqualified != nil {
		return sql.ErrDuplicateAliasOrTable.New(alias)
	}

	if candidates.qualified == nil {
		candidates.qualified = make(map[string]sql.Nameable)
	}

	lowerDbName := strings.ToLower(db)
	_, hasExistingTarget := candidates.qualified[lowerDbName]
	if hasExistingTarget {
		return sql.ErrDuplicateAliasOrTable.New(alias)
	}

	candidates.qualified[lowerDbName] = target
	ta.aliases[lowerName] = candidates
	return nil
}

// addUnqualified adds the given table alias (not belonging a database), referring to the node given.
func (ta *TableAliases) addUnqualified(alias string, target sql.Nameable) error {
	if alias == plan.DualTableName {
		return nil
	}

	if ta.aliases == nil {
		ta.aliases = make(map[string]dBQualifiedNameables)
	}

	lowerName := strings.ToLower(alias)
	candidates := ta.aliases[lowerName]
	// A table name can map to multiple tables from different databases (qualified)
	// or a single unqualified target, but not both.
	if len(candidates.qualified) > 0 {
		return sql.ErrDuplicateAliasOrTable.New(alias)
	}

	if candidates.unqualified != nil {
		return sql.ErrDuplicateAliasOrTable.New(alias)
	}
	candidates.unqualified = target
	ta.aliases[lowerName] = candidates
	return nil
}

func (ta TableAliases) resolveName(name string) (sql.Nameable, bool, error) {
	candidates := ta.aliases[strings.ToLower(name)]

	// We already verified when adding aliases: a name can map to multiple tables
	// from different databases (qualified) or a single unqualified target, but not both.
	if candidates.unqualified != nil {
		return candidates.unqualified, true, nil
	}

	if len(candidates.qualified) > 1 {
		// This name maps to multiple tables from different databases.
		return nil, false, sql.ErrDuplicateAliasOrTable.New(name)
	}

	// If there's only one match, return it.
	for _, node := range candidates.qualified {
		return node, true, nil
	}

	// No matches.
	return nil, false, nil
}

func (ta TableAliases) resolveQualifiedName(db, name string) (sql.Nameable, error) {
	node := ta.aliases[strings.ToLower(name)].qualified[strings.ToLower(db)]
	if node == nil {
		return nil, sql.ErrTableNotFound.New(name)
	}
	return node, nil
}

// putAll adds all aliases in the given aliases to the receiver. Silently overwrites existing entries.
func (ta *TableAliases) putAll(other TableAliases) {
	for name, targets := range other.aliases {
		if ta.aliases == nil {
			ta.aliases = make(map[string]dBQualifiedNameables)
		}
		aliases := ta.aliases[name]
		aliases.unqualified = targets.unqualified
		ta.aliases[name] = aliases
		for db, target := range targets.qualified {
			_ = ta.addQualified(db, name, target)
		}

	}
}

// findConflicts returns a list of aliases that are in both sets of aliases, and a list of aliases that are just in
// the current set of aliases.
func (ta TableAliases) findConflicts(other TableAliases) (conflicts []string, nonConflicted []string) {
	conflicts = []string{}
	nonConflicted = []string{}

	for alias := range other.aliases {
		if _, ok := ta.aliases[alias]; ok {
			conflicts = append(conflicts, alias)
		} else {
			nonConflicted = append(nonConflicted, alias)
		}
	}

	return
}

// getTableAliases returns a map of all aliases of resolved tables / subqueries in the node, keyed by their alias name.
// Unaliased tables are returned keyed by their original lower-cased name.
func getTableAliases(n sql.Node, scope *plan.Scope) (TableAliases, error) {
	var passAliases TableAliases
	var aliasFn func(node sql.Node) bool
	var analysisErr error
	var recScope *plan.Scope
	if !scope.IsEmpty() {
		recScope = recScope.WithMemos(scope.Memos)
	}

	aliasFn = func(node sql.Node) bool {
		if node == nil {
			return false
		}

		if at, ok := node.(*plan.TableAlias); ok {
			switch t := at.Child.(type) {
			case *plan.RecursiveCte:
			case sql.NameableNode:
				analysisErr = passAliases.addUnqualified(at.Name(), t)
			case *plan.UnresolvedTable:
				panic("Table not resolved")
			default:
				panic(fmt.Sprintf("Unexpected child type of TableAlias: %T", at.Child))
			}
			return false
		}

		switch node := node.(type) {
		case *plan.CreateTrigger:
			// trigger bodies are evaluated separately
			rt := getResolvedTable(node.Table)
			analysisErr = passAliases.addQualified(rt.Database().Name(), rt.Name(), rt)
			return false
		case *plan.Procedure:
			return false
		case *plan.TriggerBeginEndBlock:
			// blocks should not be parsed as a whole, just their statements individually
			for _, child := range node.Children() {
				_, analysisErr = getTableAliases(child, recScope)
				if analysisErr != nil {
					break
				}
			}
			return false
		case *plan.BeginEndBlock:
			// blocks should not be parsed as a whole, just their statements individually
			for _, child := range node.Children() {
				_, analysisErr = getTableAliases(child, recScope)
				if analysisErr != nil {
					break
				}
			}
			return false
		case *plan.Block:
			// blocks should not be parsed as a whole, just their statements individually
			for _, child := range node.Children() {
				_, analysisErr = getTableAliases(child, recScope)
				if analysisErr != nil {
					break
				}
			}
			return false
		case *plan.InsertInto:
			if rt := getResolvedTable(node.Destination); rt != nil {
				analysisErr = passAliases.addQualified(rt.Database().Name(), rt.Name(), rt)
			}
			return false
		case *plan.IndexedTableAccess:
			rt := getResolvedTable(node.TableNode)
			analysisErr = passAliases.addQualified(rt.Database().Name(), rt.Name(), node)
			return false
		case *plan.ResolvedTable:
			analysisErr = passAliases.addQualified(node.Database().Name(), node.Name(), node)
			return false
		case sql.Nameable:
			analysisErr = passAliases.addUnqualified(node.Name(), node)
			return false
		case *plan.UnresolvedTable:
			panic("Table not resolved")
		default:
		}

		if opaque, ok := node.(sql.OpaqueNode); ok && opaque.Opaque() {
			return false
		}

		return true
	}
	if analysisErr != nil {
		return TableAliases{}, analysisErr
	}

	// Inspect all of the scopes, outer to inner. Within a single scope, a name conflict is an error. But an inner scope
	// can overwrite a name in an outer scope, and it's not an error.
	aliases := TableAliases{}
	for _, scopeNode := range scope.OuterToInner() {
		passAliases = TableAliases{}
		transform.Inspect(scopeNode, aliasFn)
		if analysisErr != nil {
			return TableAliases{}, analysisErr
		}
		recScope = recScope.NewScope(scopeNode)
		aliases.putAll(passAliases)
	}

	passAliases = TableAliases{}
	transform.Inspect(n, aliasFn)
	if analysisErr != nil {
		return TableAliases{}, analysisErr
	}
	aliases.putAll(passAliases)

	return aliases, analysisErr
}

// aliasedExpressionsInNode returns a map of the aliased expressions defined in the first Projector node found (starting
// the search from the specified node), mapped from the expression string to the alias name. Returned
// map keys are normalized to lower case.
func aliasedExpressionsInNode(n sql.Node) map[string]string {
	projector := findFirstProjectorNode(n)
	if projector == nil {
		return nil
	}
	aliasesFromExpressionToName := make(map[string]string)
	for _, e := range projector.ProjectedExprs() {
		alias, ok := e.(*expression.Alias)
		if ok {
			aliasesFromExpressionToName[strings.ToLower(alias.Child.String())] = alias.Name()
		}
	}

	return aliasesFromExpressionToName
}

// normalizeExpressions returns the expressions given after normalizing them to replace table and expression aliases
// with their underlying names. This is necessary to match such expressions against those declared by implementors of
// various interfaces that declare expressions to handle, such as Index.Expressions(), FilteredTable, etc.
func normalizeExpressions(tableAliases TableAliases, expr ...sql.Expression) []sql.Expression {
	expressions := make([]sql.Expression, len(expr))

	for i, e := range expr {
		expressions[i] = normalizeExpression(tableAliases, e)
	}

	return expressions
}

// normalizeExpression returns the expression given after normalizing it to replace table aliases with their underlying
// names. This is necessary to match such expressions against those declared by implementors of various interfaces that
// declare expressions to handle, such as Index.Expressions(), FilteredTable, etc.
func normalizeExpression(tableAliases TableAliases, e sql.Expression) sql.Expression {
	// If the query has table aliases, use them to replace any table aliases in column expressions
	normalized, _, _ := transform.Expr(e, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		if field, ok := e.(*expression.GetField); ok {
			table := strings.ToLower(field.Table())
			if rt, ok, _ := tableAliases.resolveName(table); ok {
				return field.WithTable(strings.ToLower(rt.Name())).WithName(strings.ToLower(field.Name())), transform.NewTree, nil
			} else {
				return field.WithTable(strings.ToLower(field.Table())).WithName(strings.ToLower(field.Name())), transform.NewTree, nil
			}
		}

		return e, transform.SameTree, nil
	})

	return normalized
}

// renameAliasesInExpressions returns expressions where any table references are renamed to the new table name.
func renameAliasesInExpressions(expressions []sql.Expression, oldNameLower string, newName string) ([]sql.Expression, error) {
	for i, e := range expressions {
		newExpression, same, err := renameAliasesInExp(e, oldNameLower, newName)
		if err != nil {
			return nil, err
		}
		if !same {
			expressions[i] = newExpression
		}
	}
	return expressions, nil
}

// renameAliasesInExp returns an expression where any table references are renamed to the new table name.
func renameAliasesInExp(exp sql.Expression, oldNameLower string, newName string) (sql.Expression, transform.TreeIdentity, error) {
	return transform.Expr(exp, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		switch e := e.(type) {
		case *expression.GetField:
			if strings.EqualFold(e.Table(), oldNameLower) {
				gf := e.WithTable(newName)
				return gf, transform.NewTree, nil
			}
		case *expression.UnresolvedColumn:
			if strings.EqualFold(e.Table(), oldNameLower) {
				return expression.NewUnresolvedQualifiedColumn(newName, e.Name()), transform.NewTree, nil
			}
		case *plan.Subquery:
			newSubquery, tree, err := renameAliases(e.Query, oldNameLower, newName)
			if err != nil {
				return nil, tree, err
			}
			if tree == transform.NewTree {
				e.WithQuery(newSubquery)
			}
			return e, tree, nil
		}
		return e, transform.SameTree, nil
	})
}

// renameAliasesInExp returns a node where any table references are renamed to the new table name.
func renameAliases(node sql.Node, oldNameLower string, newName string) (sql.Node, transform.TreeIdentity, error) {
	return transform.Node(node, func(node sql.Node) (sql.Node, transform.TreeIdentity, error) {
		newNode := node
		allSame := transform.SameTree

		// update node
		if nameable, ok := node.(sql.Nameable); ok && strings.EqualFold(nameable.Name(), oldNameLower) {
			allSame = transform.NewTree
			if renameable, ok := node.(sql.RenameableNode); ok {
				newNode = renameable.WithName(newName)
			} else {
				newNode = plan.NewTableAlias(newName, node)
			}
		}

		// update expressions
		newNode, same, err := transform.NodeExprs(newNode, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
			return renameAliasesInExp(e, oldNameLower, newName)
		})
		if err != nil {
			return nil, transform.SameTree, err
		}

		allSame = allSame && same
		if allSame {
			return node, transform.SameTree, nil
		} else {
			return newNode, transform.NewTree, nil
		}
	})
}
