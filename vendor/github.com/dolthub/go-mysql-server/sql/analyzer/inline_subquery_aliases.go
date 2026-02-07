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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

type aliasScope struct {
	aliases map[string]sql.Expression
	parent  *aliasScope
}

func (a *aliasScope) push() *aliasScope {
	return &aliasScope{
		parent: a,
	}
}

func (a *aliasScope) addRef(alias *expression.Alias) {
	if a.aliases == nil {
		a.aliases = make(map[string]sql.Expression)
	}
	a.aliases[alias.Name()] = alias.Child
}

func (a *aliasScope) isOuterRef(name string) (sql.Expression, bool) {
	if a.aliases != nil {
		if a, ok := a.aliases[name]; ok {
			return a, false
		}
	}
	if a.parent == nil {
		return nil, false
	}
	found, _ := a.parent.isOuterRef(name)
	if found != nil {
		return found, true
	}
	return nil, false
}

// inlineSubqueryAliasRefs matches the pattern:
// SELECT expr as <alias>, (SELECT <alias> ...) ...
// and performs a variable replacement:
// SELECT expr as <alias>, (SELECT expr ...) ...
// Outer alias references can occur anywhere in subquery expressions,
// as written this is a fairly unflexible rule.
// TODO: extend subquery search to WHERE filters and other scalar expressions
// TODO: convert subquery expressions to lateral joins to avoid this hack
func inlineSubqueryAliasRefs(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !qFlags.SubqueryIsSet() {
		return n, transform.SameTree, nil
	}
	ret, err := inlineSubqueryAliasRefsHelper(&aliasScope{}, n)
	return ret, transform.NewTree, err
}

func inlineSubqueryAliasRefsHelper(scope *aliasScope, n sql.Node) (sql.Node, error) {
	ret := n
	switch n := n.(type) {
	case *plan.Project:
		var newProj []sql.Expression
		for i, e := range n.Projections {
			e, same, err := transform.Expr(e, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
				switch e := e.(type) {
				case *expression.AliasReference:
				case *expression.Alias:
					// new def
					if !e.Unreferencable() {
						scope.addRef(e)
					}
				case *expression.GetField:
					// is an alias ref?
					// check if in parent scope
					if alias, inOuter := scope.isOuterRef(strings.ToLower(e.Name())); e.Table() == "" && alias != nil && inOuter {
						return alias, transform.NewTree, nil
					}
				case *plan.Subquery:
					subqScope := scope.push()
					newQ, err := inlineSubqueryAliasRefsHelper(subqScope, e.Query)
					if err != nil {
						return e, transform.SameTree, err
					}
					ret := *e
					ret.Query = newQ
					return &ret, transform.NewTree, nil
				default:
				}
				return e, transform.SameTree, nil
			})
			if err != nil {
				return nil, err
			}
			if !same {
				if newProj == nil {
					newProj = make([]sql.Expression, len(n.Projections))
					copy(newProj, n.Projections)
				}
				newProj[i] = e
			}
		}
		if newProj != nil {
			ret = plan.NewProject(newProj, n.Child)
		}
	default:
	}

	newChildren := make([]sql.Node, len(n.Children()))
	var err error
	for i, c := range ret.Children() {
		newChildren[i], err = inlineSubqueryAliasRefsHelper(scope, c)
		if err != nil {
			return nil, err
		}
	}
	ret, err = ret.WithChildren(newChildren...)
	if err != nil {
		return nil, err
	}
	if err != nil {
		panic(err)
	}
	return ret, nil
}
