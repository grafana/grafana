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
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// RuleFunc is the function to be applied in a rule.
type RuleFunc func(*sql.Context, *Analyzer, sql.Node, *plan.Scope, RuleSelector, *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error)

// RuleSelector filters analysis rules by id
type RuleSelector func(RuleId) bool

// Rule to transform nodes.
type Rule struct {
	Apply RuleFunc
	Id    RuleId
}

// BatchSelector filters analysis batches by name
type BatchSelector func(string) bool

// Batch executes a set of rules a specific number of times.
// When this number of times is reached, the actual node
// and ErrMaxAnalysisIters is returned.
type Batch struct {
	Desc       string
	Rules      []Rule
	Iterations int
}

// Eval executes the rules of the batch. On any error, the partially transformed node is returned along with the error.
// If the batch's max number of iterations is reached without achieving stabilization (batch evaluation no longer
// changes the node), then this method returns ErrMaxAnalysisIters.
func (b *Batch) Eval(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	return b.EvalWithSelector(ctx, a, n, scope, sel, qFlags)
}

func (b *Batch) EvalWithSelector(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if b.Iterations == 0 {
		return n, transform.SameTree, nil
	}
	a.PushDebugContext("0")
	cur, _, err := b.evalOnce(ctx, a, n, scope, sel, qFlags)
	a.PopDebugContext()
	if err != nil {
		return cur, transform.SameTree, err
	}
	return cur, transform.NewTree, nil
}

// evalOnce returns the result of evaluating a batch of rules on the node given. In the result of an error, the result
// of the last successful transformation is returned along with the error. If no transformation was successful, the
// input node is returned as-is.
func (b *Batch) evalOnce(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	var (
		same    = transform.SameTree
		allSame = transform.SameTree
		next    sql.Node
		prev    = n
	)
	for _, rule := range b.Rules {
		if !sel(rule.Id) {
			a.Log("Skipping rule %s", rule.Id)
			continue
		}
		var err error
		a.Log("Evaluating rule %s", rule.Id)
		a.PushDebugContext(rule.Id.String())
		next, same, err = rule.Apply(ctx, a, prev, scope, sel, qFlags)
		allSame = same && allSame
		if next != nil && !same {
			a.LogNode(next)
			// We should only do this if the result has changed, but some rules currently misbehave and falsely report nothing
			// changed
			a.LogDiff(prev, next)
		}
		a.PopDebugContext()
		if err != nil {
			// Returning the last node before the error is important. This is non-idiomatic, but in the case of partial
			// resolution before an error we want the last successful transformation result. Very important for resolving
			// subqueries.
			return prev, allSame, err
		}
		prev = next
	}

	return prev, allSame, nil
}
