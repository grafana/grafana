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
	"bytes"
	"fmt"

	. "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/planbuilder"
	"github.com/dolthub/go-mysql-server/sql/types"
)

const defaultRoutinesTableRowCount = 10

type routineTable struct {
	catalog    Catalog
	procedures map[string][]*plan.Procedure
	rowIter    func(*Context, Catalog, map[string][]*plan.Procedure) (RowIter, error)
	name       string
	schema     Schema
}

var (
	_ Table           = (*routineTable)(nil)
	_ Databaseable    = (*routineTable)(nil)
	_ StatisticsTable = (*routineTable)(nil)
)

func (r *routineTable) AssignCatalog(cat Catalog) Table {
	r.catalog = cat
	return r
}

func (r *routineTable) AssignProcedures(p map[string][]*plan.Procedure) Table {
	// TODO: should also assign functions
	r.procedures = p
	return r
}

// Database implements the sql.Databaseable interface.
func (r *routineTable) Database() string {
	return InformationSchemaDatabaseName
}

func (r *routineTable) DataLength(_ *Context) (uint64, error) {
	return uint64(len(r.Schema()) * int(types.Text.MaxByteLength()) * defaultRoutinesTableRowCount), nil
}

func (r *routineTable) RowCount(ctx *Context) (uint64, bool, error) {
	return defaultRoutinesTableRowCount, false, nil
}

// Name implements the sql.Table interface.
func (r *routineTable) Name() string {
	return r.name
}

// Schema implements the sql.Table interface.
func (r *routineTable) Schema() Schema {
	return r.schema
}

// Collation implements the sql.Table interface.
func (r *routineTable) Collation() CollationID {
	return Collation_Information_Schema_Default
}

func (r *routineTable) String() string {
	return printTable(r.Name(), r.Schema())
}

func (r *routineTable) Partitions(context *Context) (PartitionIter, error) {
	return &informationSchemaPartitionIter{informationSchemaPartition: informationSchemaPartition{partitionKey(r.Name())}}, nil
}

func (r *routineTable) PartitionRows(context *Context, partition Partition) (RowIter, error) {
	if !bytes.Equal(partition.Key(), partitionKey(r.Name())) {
		return nil, ErrPartitionNotFound.New(partition.Key())
	}
	if r.rowIter == nil {
		return RowsToRowIter(), nil
	}
	if r.catalog == nil {
		return nil, fmt.Errorf("nil catalog for info schema table %s", r.name)
	}

	return r.rowIter(context, r.catalog, r.procedures)
}

// routinesRowIter implements the sql.RowIter for the information_schema.ROUTINES table.
func routinesRowIter(ctx *Context, c Catalog, p map[string][]*plan.Procedure) (RowIter, error) {
	var rows []Row
	var (
		securityType    string
		isDeterministic string
		sqlDataAccess   string
	)

	characterSetClient, err := ctx.GetSessionVariable(ctx, "character_set_client")
	if err != nil {
		return nil, err
	}
	collationConnection, err := ctx.GetSessionVariable(ctx, "collation_connection")
	if err != nil {
		return nil, err
	}

	sysVal, err := ctx.Session.GetSessionVariable(ctx, "sql_mode")
	if err != nil {
		return nil, err
	}
	sqlMode, ok := sysVal.(string)
	if !ok {
		return nil, ErrSystemVariableCodeFail.New("sql_mode", sysVal)
	}

	showExternalProcedures, err := ctx.GetSessionVariable(ctx, "show_external_procedures")
	if err != nil {
		return nil, err
	}
	privSet, _ := ctx.GetPrivilegeSet()
	if privSet == nil {
		privSet = mysql_db.NewPrivilegeSet()
	}

	for dbName, procedures := range p {
		if !hasRoutinePrivsOnDB(privSet, dbName) {
			continue
		}
		db, err := c.Database(ctx, dbName)
		if err != nil {
			return nil, err
		}
		dbCollation := plan.GetDatabaseCollation(ctx, db)
		for _, procedure := range procedures {
			// We skip external procedures if the variable to show them is set to false
			if showExternalProcedures.(int8) == 0 && procedure.IsExternal() {
				continue
			}

			// todo shortcircuit routineDef->procedure.CreateProcedureString?
			// TODO: figure out how auth works in this case
			parsedProcedure, _, err := planbuilder.Parse(ctx, c, procedure.CreateProcedureString)
			if err != nil {
				continue
			}
			procedurePlan, ok := parsedProcedure.(*plan.CreateProcedure)
			if !ok {
				return nil, ErrProcedureCreateStatementInvalid.New(procedure.CreateProcedureString)
			}
			routineDef := procedurePlan.BodyString
			definer := removeBackticks(procedure.Definer)

			securityType = "DEFINER"
			isDeterministic = "NO" // YES or NO
			sqlDataAccess = "CONTAINS SQL"
			for _, ch := range procedure.Characteristics {
				if ch == plan.Characteristic_LanguageSql {

				}

				if ch == plan.Characteristic_Deterministic {
					isDeterministic = "YES"
				} else if ch == plan.Characteristic_NotDeterministic {
					isDeterministic = "NO"
				}

				if ch == plan.Characteristic_ContainsSql {
					sqlDataAccess = "CONTAINS SQL"
				} else if ch == plan.Characteristic_NoSql {
					sqlDataAccess = "NO SQL"
				} else if ch == plan.Characteristic_ReadsSqlData {
					sqlDataAccess = "READS SQL DATA"
				} else if ch == plan.Characteristic_ModifiesSqlData {
					sqlDataAccess = "MODIFIES SQL DATA"
				}
			}

			if procedure.SecurityContext == plan.ProcedureSecurityContext_Invoker {
				securityType = "INVOKER"
			}
			rows = append(rows, Row{
				procedure.Name,             // specific_name NOT NULL
				"def",                      // routine_catalog
				dbName,                     // routine_schema
				procedure.Name,             // routine_name NOT NULL
				"PROCEDURE",                // routine_type NOT NULL
				"",                         // data_type
				nil,                        // character_maximum_length
				nil,                        // character_octet_length
				nil,                        // numeric_precision
				nil,                        // numeric_scale
				nil,                        // datetime_precision
				nil,                        // character_set_name
				nil,                        // collation_name
				nil,                        // dtd_identifier
				"SQL",                      // routine_body NOT NULL
				routineDef,                 // routine_definition
				nil,                        // external_name
				"SQL",                      // external_language NOT NULL
				"SQL",                      // parameter_style NOT NULL
				isDeterministic,            // is_deterministic NOT NULL
				sqlDataAccess,              // sql_data_access NOT NULL
				nil,                        // sql_path
				securityType,               // security_type NOT NULL
				procedure.CreatedAt.UTC(),  // created NOT NULL
				procedure.ModifiedAt.UTC(), // last_altered NOT NULL
				sqlMode,                    // sql_mode NOT NULL
				procedure.Comment,          // routine_comment NOT NULL
				definer,                    // definer NOT NULL
				characterSetClient,         // character_set_client NOT NULL
				collationConnection,        // collation_connection NOT NULL
				dbCollation.String(),       // database_collation NOT NULL
			})
		}
	}

	// TODO: need to add FUNCTIONS routine_type

	return RowsToRowIter(rows...), nil
}

// parametersRowIter implements the sql.RowIter for the information_schema.PARAMETERS table.
func parametersRowIter(ctx *Context, c Catalog, p map[string][]*plan.Procedure) (RowIter, error) {
	var rows []Row

	showExternalProcedures, err := ctx.GetSessionVariable(ctx, "show_external_procedures")
	if err != nil {
		return nil, err
	}
	privSet, _ := ctx.GetPrivilegeSet()
	if privSet == nil {
		privSet = mysql_db.NewPrivilegeSet()
	}
	for dbName, procedures := range p {
		if !hasRoutinePrivsOnDB(privSet, dbName) {
			continue
		}
		for _, procedure := range procedures {
			// We skip external procedures if the variable to show them is set to false
			if showExternalProcedures.(int8) == 0 && procedure.IsExternal() {
				continue
			}

			for i, param := range procedure.Params {
				var (
					ordinalPos        = uint64(i + 1)
					datetimePrecision interface{}
					parameterMode     interface{}
				)

				dtdId, dataType := getDtdIdAndDataType(param.Type)

				if param.Direction == plan.ProcedureParamDirection_In {
					parameterMode = "IN"
				} else if param.Direction == plan.ProcedureParamDirection_Inout {
					parameterMode = "INOUT"
				} else if param.Direction == plan.ProcedureParamDirection_Out {
					parameterMode = "OUT"
				}

				charName, collName, charMaxLen, charOctetLen := getCharAndCollNamesAndCharMaxAndOctetLens(ctx, param.Type)
				numericPrecision, numericScale := getColumnPrecisionAndScale(param.Type)
				// float types get nil for numericScale, but it gets 0 for this table
				if _, ok := param.Type.(NumberType); ok {
					numericScale = 0
				}

				if types.IsDatetimeType(param.Type) || types.IsTimestampType(param.Type) {
					datetimePrecision = 0
				} else if types.IsTimespan(param.Type) {
					// TODO: TIME length not yet supported
					datetimePrecision = 6
				}

				rows = append(rows, Row{
					"def",             // specific_catalog
					dbName,            // specific_schema
					procedure.Name,    // specific_name
					ordinalPos,        // ordinal_position - 0 for FUNCTIONS
					parameterMode,     // parameter_mode   - NULL for FUNCTIONS
					param.Name,        // parameter_name   - NULL for FUNCTIONS
					dataType,          // data_type
					charMaxLen,        // character_maximum_length
					charOctetLen,      // character_octet_length
					numericPrecision,  // numeric_precision
					numericScale,      // numeric_scale
					datetimePrecision, // datetime_precision
					charName,          // character_set_name
					collName,          // collation_name
					dtdId,             // dtd_identifier
					"PROCEDURE",       // routine_type
				})
			}
		}
	}
	// TODO: need to add FUNCTIONS routine_type

	return RowsToRowIter(rows...), nil
}

// hasRoutinePrivsOnDB returns bool value whether privilegeSet has either global or database level `CREATE ROUTINE` or `ALTER ROUTINE` or `EXECUTE` privileges.
func hasRoutinePrivsOnDB(privSet PrivilegeSet, dbName string) bool {
	return privSet.Has(PrivilegeType_CreateRoutine) || privSet.Has(PrivilegeType_AlterRoutine) || privSet.Has(PrivilegeType_Execute) ||
		privSet.Database(dbName).Has(PrivilegeType_CreateRoutine) || privSet.Database(dbName).Has(PrivilegeType_AlterRoutine) || privSet.Database(dbName).Has(PrivilegeType_Execute)
}
