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

package planbuilder

import (
	"encoding/json"
	"fmt"
	"strings"

	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/stats"
)

func (b *Builder) buildAnalyze(inScope *scope, n *ast.Analyze, query string) (outScope *scope) {
	defaultDb := b.ctx.GetCurrentDatabase()

	if n.Action == "" {
		return b.buildAnalyzeTables(inScope, n, query)
	}

	// table and columns
	if len(n.Tables) != 1 {
		err := fmt.Errorf("ANALYZE %s expected 1 table name, found %d", n.Action, len(n.Tables))
		b.handleErr(err)
	}

	if strings.ToLower(n.Tables[0].DbQualifier.String()) == "" && defaultDb == "" {
		b.handleErr(sql.ErrNoDatabaseSelected.New())
	}

	tableScope, ok := b.buildTablescan(inScope, n.Tables[0], nil)
	if !ok {
		err := sql.ErrTableNotFound.New(strings.ToLower(n.Tables[0].Name.String()))
		b.handleErr(err)
	}
	_, ok = tableScope.node.(*plan.ResolvedTable)
	if !ok {
		err := fmt.Errorf("can only update statistics for base tables, found %s: %s", strings.ToLower(n.Tables[0].Name.String()), tableScope.node)
		b.handleErr(err)
	}

	columns := make([]string, len(n.Columns))
	types := make([]sql.Type, len(n.Columns))
	for i, c := range n.Columns {
		col, ok := tableScope.resolveColumn(strings.ToLower(n.Tables[0].DbQualifier.String()), strings.ToLower(n.Tables[0].Name.String()), c.Lowered(), false, false)
		if !ok {
			err := sql.ErrTableColumnNotFound.New(strings.ToLower(n.Tables[0].Name.String()), c.Lowered())
			b.handleErr(err)
		}
		columns[i] = col.col
		types[i] = col.typ
	}

	switch n.Action {
	case ast.UpdateStr:
		sch := tableScope.node.Schema()
		return b.buildAnalyzeUpdate(inScope, n, strings.ToLower(n.Tables[0].DbQualifier.String()), strings.ToLower(n.Tables[0].SchemaQualifier.String()), strings.ToLower(n.Tables[0].Name.String()), sch, columns, types)
	case ast.DropStr:
		outScope = inScope.push()
		dbName := n.Tables[0].DbQualifier.String()
		if dbName == "" {
			dbName = b.ctx.GetCurrentDatabase()
		}
		if dbName == "" {
			b.handleErr(sql.ErrNoDatabaseSelected.New())
		}

		outScope.node = plan.NewDropHistogram(strings.ToLower(dbName), strings.ToLower(n.Tables[0].SchemaQualifier.String()), strings.ToLower(n.Tables[0].Name.String()), columns).WithProvider(b.cat)
	default:
		err := fmt.Errorf("invalid ANALYZE action: %s, expected UPDATE or DROP", n.Action)
		b.handleErr(err)
	}
	return
}

func (b *Builder) buildAnalyzeTables(inScope *scope, n *ast.Analyze, query string) (outScope *scope) {
	outScope = inScope.push()
	currentDb := b.ctx.GetCurrentDatabase()
	tables := make([]sql.Table, len(n.Tables))
	for i, table := range n.Tables {
		if table.DbQualifier.String() == "" && currentDb == "" {
			b.handleErr(sql.ErrNoDatabaseSelected.New())
		}

		tableName := strings.ToLower(table.Name.String())
		tableScope, ok := b.buildTablescan(inScope, table, nil)
		if !ok {
			err := sql.ErrTableNotFound.New(tableName)
			b.handleErr(err)
		}
		rt, ok := tableScope.node.(*plan.ResolvedTable)
		if !ok {
			err := fmt.Errorf("can only update statistics for base tables, found %s: %s", tableName, tableScope.node)
			b.handleErr(err)
		}

		tables[i] = rt.Table
	}
	analyze := plan.NewAnalyze(tables)
	outScope.node = analyze.WithDb(currentDb).WithStats(b.cat)
	return
}

func (b *Builder) buildAnalyzeUpdate(inScope *scope, n *ast.Analyze, dbName, schemaName, tableName string, sch sql.Schema, columns []string, types []sql.Type) (outScope *scope) {
	if dbName == "" {
		dbName = b.ctx.GetCurrentDatabase()
	}
	if dbName == "" {
		b.handleErr(sql.ErrNoDatabaseSelected.New())
	}

	outScope = inScope.push()
	statisticJ := new(stats.StatisticJSON)
	using := b.buildScalar(inScope, n.Using)
	if l, ok := using.(*expression.Literal); ok {
		if typ, ok := l.Type().(sql.StringType); ok {
			val, _, err := typ.Convert(b.ctx, l.Value())
			if err != nil {
				b.handleErr(err)
			}
			if str, ok := val.(string); ok {
				err := json.Unmarshal([]byte(str), statisticJ)
				if err != nil {
					err = ErrFailedToParseStats.New(err.Error(), str)
					b.handleErr(err)
				}
			}

		}
	}
	if statisticJ == nil {
		err := fmt.Errorf("no statistics found for update")
		b.handleErr(err)
	}
	indexName := statisticJ.Qual.Idx
	if indexName == "" {
		indexName = "primary"
	}

	statistic := statisticJ.ToStatistic()

	statistic.SetQualifier(sql.NewStatQualifier(strings.ToLower(dbName), strings.ToLower(schemaName), tableName, strings.ToLower(indexName)))
	statistic.SetColumns(columns)
	statistic.SetTypes(types)

	statCols := sql.ColSet{}
	for _, c := range columns {
		i := sch.IndexOfColName(c)
		statCols.Add(sql.ColumnId(i + 1))
	}
	allCols := sql.NewFastIntSet()
	allCols.AddRange(0, len(sch))
	allColset := sql.NewColSetFromIntSet(allCols)
	// TODO find if underlying index has strict/lax key
	fds := sql.NewTablescanFDs(allColset, nil, nil, allColset)
	updatedStat := statistic.WithColSet(statCols).WithFuncDeps(fds)
	updatedStat = stats.UpdateCounts(updatedStat)

	outScope.node = plan.NewUpdateHistogram(dbName, tableName, indexName, columns, updatedStat).WithProvider(b.cat)
	return outScope
}
