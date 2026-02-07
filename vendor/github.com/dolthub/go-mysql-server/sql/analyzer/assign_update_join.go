package analyzer

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// modifyUpdateExprsForJoin searches for a JOIN for UPDATE query and updates the child of the original update
// node to use a plan.UpdateJoin node as a child.
func modifyUpdateExprsForJoin(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	switch n := n.(type) {
	case *plan.Update:
		us, ok := n.Child.(*plan.UpdateSource)
		if !ok {
			return n, transform.SameTree, nil
		}

		var jn sql.Node
		transform.Inspect(us, func(node sql.Node) bool {
			switch node.(type) {
			case *plan.JoinNode:
				jn = node
				return false
			default:
				return true
			}
		})

		if jn == nil {
			return n, transform.SameTree, nil
		}

		updateTargets, err := getUpdateTargetsByTable(us, jn, n.IsJoin)
		if err != nil {
			return nil, transform.SameTree, err
		}

		uj := plan.NewUpdateJoin(updateTargets, us)
		ret, err := n.WithChildren(uj)
		if err != nil {
			return nil, transform.SameTree, err
		}

		return ret, transform.NewTree, nil
	}

	return n, transform.SameTree, nil
}

// getUpdateTargetsByTable maps a set of table names and aliases to their corresponding update target Node
func getUpdateTargetsByTable(node sql.Node, ij sql.Node, isJoin bool) (map[string]sql.Node, error) {
	namesOfTableToBeUpdated := plan.GetTablesToBeUpdated(node)
	resolvedTables := getTablesByName(ij)

	updateTargets := make(map[string]sql.Node)
	for tableToBeUpdated, _ := range namesOfTableToBeUpdated {
		resolvedTable, ok := resolvedTables[tableToBeUpdated]
		if !ok {
			return nil, plan.ErrUpdateForTableNotSupported.New(tableToBeUpdated)
		}

		var table = resolvedTable.UnderlyingTable()

		// If there is no UpdatableTable for a table being updated, error out
		updatable, ok := table.(sql.UpdatableTable)
		if !ok && updatable == nil {
			return nil, plan.ErrUpdateForTableNotSupported.New(tableToBeUpdated)
		}

		keyless := sql.IsKeyless(updatable.Schema())
		if keyless && isJoin {
			return nil, sql.ErrUnsupportedFeature.New("error: keyless tables unsupported for UPDATE JOIN")
		}

		updateTargets[tableToBeUpdated] = resolvedTable
	}

	return updateTargets, nil
}
