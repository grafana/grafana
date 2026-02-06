// Copyright 2022 Dolthub, Inc.
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

package information_schema

import (
	"github.com/dolthub/vitess/go/sqltypes"

	. "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/planbuilder"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// newMySQLViewsTable returns a InformationSchemaTable for MySQL.
func newMySQLViewsTable() *InformationSchemaTable {
	return &InformationSchemaTable{
		TableName:   ViewsTableName,
		TableSchema: viewsSchema,
		Reader:      viewsRowIter,
	}
}

// NewViewsTable is used by Doltgres to inject its correct schema and row
// iter. In Dolt, this just returns the current views table implementation.
var NewViewsTable = newMySQLViewsTable

// viewsSchema is the schema for the information_schema.VIEWS table.
var viewsSchema = Schema{
	{Name: "TABLE_CATALOG", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: ViewsTableName},
	{Name: "TABLE_SCHEMA", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: ViewsTableName},
	{Name: "TABLE_NAME", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: ViewsTableName},
	{Name: "VIEW_DEFINITION", Type: types.LongText, Default: nil, Nullable: true, Source: ViewsTableName},
	{Name: "CHECK_OPTION", Type: types.MustCreateEnumType([]string{"NONE", "LOCAL", "CASCADED"}, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: ViewsTableName},
	{Name: "IS_UPDATABLE", Type: types.MustCreateEnumType([]string{"NO", "YES"}, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: ViewsTableName},
	{Name: "DEFINER", Type: types.MustCreateString(sqltypes.VarChar, 288, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: ViewsTableName},
	{Name: "SECURITY_TYPE", Type: types.MustCreateString(sqltypes.VarChar, 7, Collation_Information_Schema_Default), Default: nil, Nullable: true, Source: ViewsTableName},
	{Name: "CHARACTER_SET_CLIENT", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: false, Source: ViewsTableName},
	{Name: "COLLATION_CONNECTION", Type: types.MustCreateString(sqltypes.VarChar, 64, Collation_Information_Schema_Default), Default: nil, Nullable: false, Source: ViewsTableName},
}

// viewsRowIter implements the sql.RowIter for the information_schema.VIEWS table.
func viewsRowIter(ctx *Context, catalog Catalog) (RowIter, error) {
	var rows []Row
	privSet, _ := ctx.GetPrivilegeSet()
	if privSet == nil {
		return RowsToRowIter(rows...), nil
	}
	hasGlobalShowViewPriv := privSet.Has(PrivilegeType_ShowView)

	databases, err := AllDatabasesWithNames(ctx, catalog, false)
	if err != nil {
		return nil, err
	}

	for _, db := range databases {
		privDbSet := privSet.Database(db.Database.Name())
		hasDbShowViewPriv := privDbSet.Has(PrivilegeType_ShowView)

		views, err := ViewsInDatabase(ctx, db.Database)
		if err != nil {
			return nil, err
		}

		dbCollation := plan.GetDatabaseCollation(ctx, db.Database)
		charset := dbCollation.CharacterSet().String()
		collation := dbCollation.String()

		for _, view := range views {
			privTblSet := privDbSet.Table(view.Name)
			if !hasGlobalShowViewPriv && !hasDbShowViewPriv && !privTblSet.Has(PrivilegeType_ShowView) {
				continue
			}
			// TODO: figure out how auth works in this case
			parsedView, _, err := planbuilder.ParseWithOptions(ctx, catalog, view.CreateViewStatement, NewSqlModeFromString(view.SqlMode).ParserOptions())
			if err != nil {
				continue
			}
			viewPlan, ok := parsedView.(*plan.CreateView)
			if !ok {
				return nil, ErrViewCreateStatementInvalid.New(view.CreateViewStatement)
			}

			viewDef := viewPlan.Definition.TextDefinition
			definer := removeBackticks(viewPlan.Definer)

			// TODO: WITH CHECK OPTION is not supported yet.
			checkOpt := viewPlan.CheckOpt
			if checkOpt == "" {
				checkOpt = "NONE"
			}

			isUpdatable := "YES"
			// TODO: this function call should be done at CREATE VIEW time, not here
			if !plan.GetIsUpdatableFromCreateView(viewPlan) {
				isUpdatable = "NO"
			}

			securityType := viewPlan.Security
			if securityType == "" {
				securityType = "DEFINER"
			}

			rows = append(rows, Row{
				db.CatalogName, // table_catalog
				db.SchemaName,  // table_schema
				view.Name,      // table_name
				viewDef,        // view_definition
				checkOpt,       // check_option
				isUpdatable,    // is_updatable
				definer,        // definer
				securityType,   // security_type
				charset,        // character_set_client
				collation,      // collation_connection
			})
		}
	}

	return RowsToRowIter(rows...), nil
}
