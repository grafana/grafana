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
	"fmt"
	"strings"

	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/types"
)

func (b *Builder) buildLoad(inScope *scope, d *ast.Load) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, d.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	dbName := strings.ToLower(d.Table.DbQualifier.String())
	if dbName == "" {
		dbName = b.ctx.GetCurrentDatabase()
	}

	destScope, ok := b.buildResolvedTableForTablename(inScope, d.Table, nil)
	if !ok {
		b.handleErr(sql.ErrTableNotFound.New(d.Table.Name.String()))
	}
	var db sql.Database
	var rt *plan.ResolvedTable
	switch n := destScope.node.(type) {
	case *plan.ResolvedTable:
		rt = n
		db = rt.Database()
	case *plan.UnresolvedTable:
		db = n.Database()
	default:
		b.handleErr(fmt.Errorf("expected insert destination to be resolved or unresolved table"))
	}
	if rt == nil {
		if b.TriggerCtx().Active && !b.TriggerCtx().Call {
			b.TriggerCtx().UnresolvedTables = append(b.TriggerCtx().UnresolvedTables, d.Table.Name.String())
		} else {
			err := fmt.Errorf("expected resolved table: %s", d.Table.Name.String())
			b.handleErr(err)
		}
	}

	var ignoreNumVal int64 = 0
	if d.IgnoreNum != nil {
		ignoreNumVal = b.getInt64Value(inScope, d.IgnoreNum, "Cannot parse ignore Value")
	}

	dest := destScope.node
	sch := dest.Schema()
	if rt != nil {
		sch = b.resolveSchemaDefaults(destScope, rt.Schema())
	}

	colsOrVars := columnsToStrings(d.Columns)
	colNames := make([]string, 0, len(d.Columns))
	userVars := make([]sql.Expression, max(len(sch), len(d.Columns)))
	for i, name := range colsOrVars {
		varName, varScope, _, err := ast.VarScope(name)
		if err != nil {
			b.handleErr(err)
		}
		switch varScope {
		case ast.SetScope_None:
			colNames = append(colNames, name)
			userVars[i] = nil
		case ast.SetScope_User:
			// find matching column name, use that instead
			if sch.IndexOfColName(name) != -1 {
				colNames = append(colNames, name)
				userVars[i] = nil
				continue
			}
			userVar := expression.NewUserVar(varName)
			getField := expression.NewGetField(i, types.Text, name, true)
			userVars[i] = expression.NewSetField(userVar, getField)
		default:
			// TODO: system variable names are ok if they are escaped
			b.handleErr(sql.ErrSyntaxError.New(fmt.Errorf("syntax error near '%s'", name)))
		}
	}

	ld := plan.NewLoadData(bool(d.Local), d.Infile, sch, colNames, userVars, ignoreNumVal, d.IgnoreOrReplace)
	if d.Charset != "" {
		// TODO: deal with charset; ignore for now
		ld.Charset = d.Charset
	}

	if d.Fields != nil {
		if d.Fields.TerminatedBy != nil && len(d.Fields.TerminatedBy.Val) != 0 {
			ld.FieldsTerminatedBy = string(d.Fields.TerminatedBy.Val)
		}

		if d.Fields.EnclosedBy != nil {
			ld.FieldsEnclosedBy = string(d.Fields.EnclosedBy.Delim.Val)
			if len(ld.FieldsEnclosedBy) > 1 {
				b.handleErr(sql.ErrUnexpectedSeparator.New())
			}
			if d.Fields.EnclosedBy.Optionally {
				ld.FieldsEnclosedByOpt = true
			}
		}

		if d.Fields.EscapedBy != nil {
			ld.FieldsEscapedBy = string(d.Fields.EscapedBy.Val)
			if len(ld.FieldsEscapedBy) > 1 {
				b.handleErr(sql.ErrUnexpectedSeparator.New())
			}
		}
	}

	if d.Lines != nil {
		if d.Lines.StartingBy != nil {
			ld.LinesStartingBy = string(d.Lines.StartingBy.Val)
		}
		if d.Lines.TerminatedBy != nil {
			ld.LinesTerminatedBy = string(d.Lines.TerminatedBy.Val)
		}
	}

	if d.SetExprs != nil {
		ld.SetExprs = make([]sql.Expression, len(sch))
		for _, expr := range d.SetExprs {
			col := b.buildScalar(destScope, expr.Name)
			gf, isGf := col.(*expression.GetField)
			if !isGf {
				continue
			}
			colName := gf.Name()
			colIdx := sch.IndexOfColName(colName)
			if colIdx == -1 {
				b.handleErr(fmt.Errorf("column not found"))
			}
			ld.SetExprs[colIdx] = b.buildScalar(destScope, expr.Expr)

			// Add set column names missing from ld.ColNames, so they're not trimmed from projection
			exists := false
			for _, name := range ld.ColNames {
				if strings.EqualFold(name, colName) {
					exists = true
					break
				}
			}
			if !exists {
				// Only append to ld.ColNames if it's not empty
				if len(ld.ColNames) != 0 {
					ld.ColNames = append(ld.ColNames, colName)
				}
				// Must also append to ld.UserVars, so we build the fieldToCol map correctly later
				ld.UserVars = append(ld.UserVars, nil)
			}
		}
	}

	outScope = inScope.push()
	ins := plan.NewInsertInto(db, plan.NewInsertDestination(sch, dest), ld, ld.IsReplace, ld.ColNames, nil, ld.IsIgnore)
	b.validateInsert(ins)
	outScope.node = ins
	if rt != nil {
		checks := b.loadChecksFromTable(destScope, rt.Table)
		outScope.node = ins.WithChecks(checks)
	}
	return outScope
}
