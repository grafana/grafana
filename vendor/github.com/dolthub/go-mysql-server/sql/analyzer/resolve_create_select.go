package analyzer

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// todo this should be split into two rules. The first should be in
// planbuilder and only bind the child select, strip/merge schemas.
// a second rule should finalize analysis of the source/dest nodes
// (skipping passthrough rule).
func resolveCreateSelect(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	ct, ok := n.(*plan.CreateTable)
	if !ok || ct.Select() == nil {
		return n, transform.SameTree, nil
	}

	analyzedSelect, err := a.Analyze(ctx, ct.Select(), scope, qFlags)
	if err != nil {
		return nil, transform.SameTree, err
	}

	// We don't want to carry any information about keys, constraints, defaults, etc. from a `create table as select`
	// statement. When the underlying select node is a table, we must remove all such info from its schema. The only
	// exception is NOT NULL constraints, which we leave alone.
	selectSchema := stripSchema(analyzedSelect.Schema())
	mergedSchema := mergeSchemas(ct.PkSchema().Schema, selectSchema)
	newSch := make(sql.Schema, len(mergedSchema))

	for i, col := range mergedSchema {
		tempCol := *col
		tempCol.Source = ct.Name()
		// replace system variable types with their underlying types
		if sysType, isSysTyp := tempCol.Type.(sql.SystemVariableType); isSysTyp {
			tempCol.Type = sysType.UnderlyingType()
		}
		newSch[i] = &tempCol
	}

	pkOrdinals := make([]int, 0)
	for i, col := range newSch {
		if col.PrimaryKey {
			pkOrdinals = append(pkOrdinals, i)
		}
	}

	newSpec := &plan.TableSpec{
		Schema: sql.NewPrimaryKeySchema(newSch, pkOrdinals...),
	}

	newCreateTable := plan.NewCreateTable(ct.Database(), ct.Name(), ct.IfNotExists(), ct.Temporary(), newSpec)
	analyzedCreate, err := a.Analyze(ctx, newCreateTable, scope, qFlags)
	if err != nil {
		return nil, transform.SameTree, err
	}

	return plan.NewTableCopier(ct.Database(), analyzedCreate, analyzedSelect, plan.CopierProps{}), transform.NewTree, nil
}

// stripSchema removes all non-type information from a schema, such as the key info, default value, etc.
func stripSchema(schema sql.Schema) sql.Schema {
	sch := schema.Copy()
	for i := range schema {
		sch[i].Generated = nil
		sch[i].AutoIncrement = false
		sch[i].PrimaryKey = false
		sch[i].Source = ""
		sch[i].Comment = ""
	}
	return sch
}

// mergeSchemas takes in the table spec of the CREATE TABLE and merges it with the schema used by the
// select query. The ultimate structure for the new table will be [CREATE TABLE exclusive columns, columns with the same
// name, SELECT exclusive columns]
func mergeSchemas(inputSchema sql.Schema, selectSchema sql.Schema) sql.Schema {
	if inputSchema == nil {
		return selectSchema
	}

	// Get the matching columns between the two via name
	matchingColumns := make([]*sql.Column, 0)
	leftExclusive := make([]*sql.Column, 0)
	for _, col := range inputSchema {
		found := false
		for _, col2 := range selectSchema {
			if col.Name == col2.Name {
				matchingColumns = append(matchingColumns, col)
				found = true
			}
		}

		if !found {
			leftExclusive = append(leftExclusive, col)
		}
	}

	rightExclusive := make([]*sql.Column, 0)
	for _, col := range selectSchema {
		found := false
		for _, col2 := range inputSchema {
			if col.Name == col2.Name {
				found = true
				break
			}
		}

		if !found {
			rightExclusive = append(rightExclusive, col)
		}
	}

	return append(append(leftExclusive, matchingColumns...), rightExclusive...)
}
