package analyzer

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

// getBatchesForNode returns a partial analyzer ruleset for simple node
// types that require little prior validation before execution.
func getBatchesForNode(node sql.Node) ([]*Batch, bool) {
	switch n := node.(type) {
	case *plan.Commit:
		return nil, true
	case *plan.StartTransaction:
		return nil, true
	case *plan.InsertInto:
		if n.LiteralValueSource {
			return []*Batch{
				{
					Desc:       "alwaysBeforeDefault",
					Iterations: 1,
					Rules:      AlwaysBeforeDefault,
				},
				{
					Desc:       "simpleInsert",
					Iterations: 1,
					Rules: []Rule{
						{
							Id:    applyForeignKeysId,
							Apply: applyForeignKeys,
						},
						{
							Id:    validateReadOnlyDatabaseId,
							Apply: validateReadOnlyDatabase,
						},
						{
							Id:    validateReadOnlyTransactionId,
							Apply: validateReadOnlyTransaction,
						},
					},
				},
				{
					Desc:       "onceAfterAll",
					Iterations: 1,
					Rules:      OnceAfterAll,
				},
			}, true
		}
	case *plan.Update:
		if n.HasSingleRel && !n.IsJoin {
			return []*Batch{
				{
					Desc:       "alwaysBeforeDefault",
					Iterations: 1,
					Rules:      AlwaysBeforeDefault,
				},
				{
					Desc:       "simpleUpdate",
					Iterations: 1,
					Rules: []Rule{
						{
							Id:    validateReadOnlyDatabaseId,
							Apply: validateReadOnlyDatabase,
						},
						{
							Id:    validateReadOnlyTransactionId,
							Apply: validateReadOnlyTransaction,
						},
						{
							Id:    applyForeignKeysId,
							Apply: applyForeignKeys,
						},
						{
							Id:    optimizeJoinsId,
							Apply: optimizeJoins,
						},
						{
							Id:    applyHashInId,
							Apply: applyHashIn,
						},
					},
				},
				{
					Desc:       "onceAfterAll",
					Iterations: 1,
					Rules:      OnceAfterAll,
				},
			}, true
		}
	case *plan.DeleteFrom:
		if !n.HasExplicitTargets() && n.RefsSingleRel {
			return []*Batch{
				{
					Desc:       "alwaysBeforeDefault",
					Iterations: 1,
					Rules:      AlwaysBeforeDefault,
				},
				{
					Desc:       "simpleDelete",
					Iterations: 1,
					Rules: []Rule{
						{
							Id:    validateReadOnlyDatabaseId,
							Apply: validateReadOnlyDatabase,
						},
						{
							Id:    validateReadOnlyTransactionId,
							Apply: validateReadOnlyTransaction,
						},
						{
							Id:    processTruncateId,
							Apply: processTruncate,
						},
						{
							Id:    applyForeignKeysId,
							Apply: applyForeignKeys,
						},
						{
							Id:    optimizeJoinsId,
							Apply: optimizeJoins,
						},
						{
							Id:    applyHashInId,
							Apply: applyHashIn,
						},
					},
				},
				{
					Desc:       "onceAfterAll",
					Iterations: 1,
					Rules:      OnceAfterAll,
				},
			}, true
		}
	default:
	}

	return nil, false
}
