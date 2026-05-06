// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package flightsql

import (
	pb "github.com/apache/arrow-go/v18/arrow/flight/gen/flight"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/anypb"
)

// Constants for Action types
const (
	CreatePreparedStatementActionType     = "CreatePreparedStatement"
	ClosePreparedStatementActionType      = "ClosePreparedStatement"
	CreatePreparedSubstraitPlanActionType = "CreatePreparedSubstraitPlan"
	CancelQueryActionType                 = "CancelQuery"
	BeginSavepointActionType              = "BeginSavepoint"
	BeginTransactionActionType            = "BeginTransaction"
	EndTransactionActionType              = "EndTransaction"
	EndSavepointActionType                = "EndSavepoint"
)

func toCrossTableRef(cmd *pb.CommandGetCrossReference) CrossTableRef {
	return CrossTableRef{
		PKRef: TableRef{
			Catalog:  cmd.PkCatalog,
			DBSchema: cmd.PkDbSchema,
			Table:    cmd.PkTable,
		},
		FKRef: TableRef{
			Catalog:  cmd.FkCatalog,
			DBSchema: cmd.FkDbSchema,
			Table:    cmd.FkTable,
		},
	}
}

func pkToTableRef(cmd *pb.CommandGetPrimaryKeys) TableRef {
	return TableRef{
		Catalog:  cmd.Catalog,
		DBSchema: cmd.DbSchema,
		Table:    cmd.Table,
	}
}

func exkToTableRef(cmd *pb.CommandGetExportedKeys) TableRef {
	return TableRef{
		Catalog:  cmd.Catalog,
		DBSchema: cmd.DbSchema,
		Table:    cmd.Table,
	}
}

func impkToTableRef(cmd *pb.CommandGetImportedKeys) TableRef {
	return TableRef{
		Catalog:  cmd.Catalog,
		DBSchema: cmd.DbSchema,
		Table:    cmd.Table,
	}
}

// CreateStatementQueryTicket is a helper that constructs a properly
// serialized TicketStatementQuery containing a given opaque binary handle
// for use with constructing a ticket to return from GetFlightInfoStatement.
func CreateStatementQueryTicket(handle []byte) ([]byte, error) {
	query := &pb.TicketStatementQuery{StatementHandle: handle}
	var ticket anypb.Any
	ticket.MarshalFrom(query)

	return proto.Marshal(&ticket)
}

type (
	// GetDBSchemasOpts contains the options to request Database Schemas:
	// an optional Catalog and a Schema Name filter pattern.
	GetDBSchemasOpts pb.CommandGetDbSchemas
	// GetTablesOpts contains the options for retrieving a list of tables:
	// optional Catalog, Schema filter pattern, Table name filter pattern,
	// a filter of table types, and whether or not to include the schema
	// in the response.
	GetTablesOpts pb.CommandGetTables

	// SqlInfoResultMap is a mapping of SqlInfo ids to the desired response.
	// This is part of a Server and used for registering responses to a
	// SqlInfo request.
	SqlInfoResultMap map[uint32]interface{}

	// TableRef is a helpful struct for referencing a specific Table
	// by its catalog, schema, and table name.
	TableRef struct {
		// Catalog specifies the catalog this table belongs to.
		// An empty string refers to tables without a catalog.
		// If nil, can reference a table in any catalog.
		Catalog *string
		// DBSchema specifies the database schema the table belongs to.
		// An empty string refers to a table which does not belong to
		// a database schema.
		// If nil, can reference a table in any database schema.
		DBSchema *string
		// Table is the name of the table that is being referenced.
		Table string
	}

	// CrossTableRef contains a reference to a Primary Key table
	// and a Foreign Key table.
	CrossTableRef struct {
		PKRef TableRef
		FKRef TableRef
	}

	// since we are hiding the Protobuf internals in an internal
	// package, we need to provide enum values for the SqlInfo enum here
	SqlInfo uint32

	// SubstraitPlan represents a plan to be executed, along with
	// the associated metadata
	SubstraitPlan struct {
		// the serialized plan
		Plan []byte
		// the substrait release, e.g. "0.23.0"
		Version string
	}

	// ExecuteIngestOpts contains the options for executing a bulk ingestion:
	//
	// Required:
	// - TableDefinitionOptions: Specifies the behavior for creating or updating table definitions
	// - Table: The destination table to load into
	//
	// Optional:
	// - Schema: The DB schema containing the destination table
	// - Catalog: The catalog containing the destination table
	// - Temporary: Use a temporary table as the destination
	// - TransactionId: Ingest as part of this transaction
	// - Options: Additional, backend-specific options
	ExecuteIngestOpts pb.CommandStatementIngest
)

// SqlInfo enum values
const (
	// Server Information
	// Values [0-500): Provide information about the Flight SQL Server itself

	// Retrieves a UTF-8 string with the name of the Flight SQL Server.
	SqlInfoFlightSqlServerName = SqlInfo(pb.SqlInfo_FLIGHT_SQL_SERVER_NAME)
	// Retrieves a UTF-8 string with the native version of the Flight SQL Server.
	SqlInfoFlightSqlServerVersion = SqlInfo(pb.SqlInfo_FLIGHT_SQL_SERVER_VERSION)
	// Retrieves a UTF-8 string with the Arrow format version of the Flight SQL Server.
	SqlInfoFlightSqlServerArrowVersion = SqlInfo(pb.SqlInfo_FLIGHT_SQL_SERVER_ARROW_VERSION)

	// Retrieves a boolean value indicating whether the Flight SQL Server is read only.
	//
	// Returns:
	// - false: if read-write
	// - true: if read only
	SqlInfoFlightSqlServerReadOnly = SqlInfo(pb.SqlInfo_FLIGHT_SQL_SERVER_READ_ONLY)

	// Retrieves a boolean value indicating whether the Flight SQL Server supports executing
	// SQL queries.
	//
	// Note that the absence of this info (as opposed to a false value) does not necessarily
	// mean that SQL is not supported, as this property was not originally defined.
	SqlInfoFlightSqlServerSql = SqlInfo(pb.SqlInfo_FLIGHT_SQL_SERVER_SQL)

	// Retrieves a boolean value indicating whether the Flight SQL Server supports executing
	// Substrait plans.
	SqlInfoFlightSqlServerSubstrait = SqlInfo(pb.SqlInfo_FLIGHT_SQL_SERVER_SUBSTRAIT)

	// Retrieves a string value indicating the minimum supported Substrait version, or null
	// if Substrait is not supported.
	SqlInfoFlightSqlServerSubstraitMinVersion = SqlInfo(pb.SqlInfo_FLIGHT_SQL_SERVER_SUBSTRAIT_MIN_VERSION)

	// Retrieves a string value indicating the maximum supported Substrait version, or null
	// if Substrait is not supported.
	SqlInfoFlightSqlServerSubstraitMaxVersion = SqlInfo(pb.SqlInfo_FLIGHT_SQL_SERVER_SUBSTRAIT_MAX_VERSION)

	// Retrieves an int32 indicating whether the Flight SQL Server supports the
	// BeginTransaction/EndTransaction/BeginSavepoint/EndSavepoint actions.
	//
	// Even if this is not supported, the database may still support explicit "BEGIN
	// TRANSACTION"/"COMMIT" SQL statements (see SQL_TRANSACTIONS_SUPPORTED); this property
	// is only about whether the server implements the Flight SQL API endpoints.
	//
	// The possible values are listed in `SqlSupportedTransaction`.
	SqlInfoFlightSqlServerTransaction = SqlInfo(pb.SqlInfo_FLIGHT_SQL_SERVER_TRANSACTION)

	// Retrieves a boolean value indicating whether the Flight SQL Server supports explicit
	// query cancellation (the CancelQuery action).
	SqlInfoFlightSqlServerCancel = SqlInfo(pb.SqlInfo_FLIGHT_SQL_SERVER_CANCEL)

	// Retrieves an int32 indicating the timeout (in milliseconds) for prepared statement handles.
	//
	// If 0, there is no timeout.  Servers should reset the timeout when the handle is used in a command.
	SqlInfoFlightSqlServerStatementTimeout = SqlInfo(pb.SqlInfo_FLIGHT_SQL_SERVER_STATEMENT_TIMEOUT)

	// Retrieves an int32 indicating the timeout (in milliseconds) for transactions, since transactions are not tied to a connection.
	//
	// If 0, there is no timeout.  Servers should reset the timeout when the handle is used in a command.
	SqlInfoFlightSqlServerTransactionTimeout = SqlInfo(pb.SqlInfo_FLIGHT_SQL_SERVER_TRANSACTION_TIMEOUT)

	// Retrieves a boolean value indicating whether the Flight SQL Server supports executing
	// bulk ingestion.
	SqlInfoFlightSqlServerBulkIngestion = SqlInfo(pb.SqlInfo_FLIGHT_SQL_SERVER_BULK_INGESTION)
	// Retrieves a boolean value indicating whether transactions are supported for bulk ingestion. If not, invoking
	// the method commit in the context of a bulk ingestion is a noop, and the isolation level is
	// `arrow.flight.protocol.sql.SqlTransactionIsolationLevel.TRANSACTION_NONE`.
	//
	// Returns:
	// - false: if bulk ingestion transactions are unsupported;
	// - true: if bulk ingestion transactions are supported.
	SqlInfoFlightSqlServerIngestTransactionsSupported = SqlInfo(pb.SqlInfo_FLIGHT_SQL_SERVER_INGEST_TRANSACTIONS_SUPPORTED)

	// SQL Syntax Information
	// Values [500-1000): provide information about the supported SQL Syntax

	// Retrieves a boolean value indicating whether the Flight SQL Server supports CREATE and DROP of catalogs.
	//
	// Returns:
	// - false: if it doesn't support CREATE and DROP of catalogs.
	// - true: if it supports CREATE and DROP of catalogs.
	SqlInfoDDLCatalog = SqlInfo(pb.SqlInfo_SQL_DDL_CATALOG)

	// Retrieves a boolean value indicating whether the Flight SQL Server supports CREATE and DROP of schemas.
	//
	// Returns:
	// - false: if it doesn't support CREATE and DROP of schemas.
	// - true: if it supports CREATE and DROP of schemas.
	SqlInfoDDLSchema = SqlInfo(pb.SqlInfo_SQL_DDL_SCHEMA)

	// Indicates whether the Flight SQL Server supports CREATE and DROP of tables.
	//
	// Returns:
	// - false: if it doesn't support CREATE and DROP of tables.
	// - true: if it supports CREATE and DROP of tables.
	SqlInfoDDLTable = SqlInfo(pb.SqlInfo_SQL_DDL_TABLE)

	// Retrieves a int32 ordinal representing the case sensitivity of catalog, table, schema and table names.
	//
	// The possible values are listed in `arrow.flight.protocol.sql.SqlSupportedCaseSensitivity`.
	SqlInfoIdentifierCase = SqlInfo(pb.SqlInfo_SQL_IDENTIFIER_CASE)
	// Retrieves a UTF-8 string with the supported character(s) used to surround a delimited identifier.
	SqlInfoIdentifierQuoteChar = SqlInfo(pb.SqlInfo_SQL_IDENTIFIER_QUOTE_CHAR)

	// Retrieves a int32 describing the case sensitivity of quoted identifiers.
	//
	// The possible values are listed in `arrow.flight.protocol.sql.SqlSupportedCaseSensitivity`.
	SqlInfoQuotedIdentifierCase = SqlInfo(pb.SqlInfo_SQL_QUOTED_IDENTIFIER_CASE)

	// Retrieves a boolean value indicating whether all tables are selectable.
	//
	// Returns:
	// - false: if not all tables are selectable or if none are;
	// - true: if all tables are selectable.
	SqlInfoAllTablesAreASelectable = SqlInfo(pb.SqlInfo_SQL_ALL_TABLES_ARE_SELECTABLE)

	// Retrieves the null ordering.
	//
	// Returns a int32 ordinal for the null ordering being used, as described in
	// `arrow.flight.protocol.sql.SqlNullOrdering`.
	SqlInfoNullOrdering = SqlInfo(pb.SqlInfo_SQL_NULL_ORDERING)
	// Retrieves a UTF-8 string list with values of the supported keywords.
	SqlInfoKeywords = SqlInfo(pb.SqlInfo_SQL_KEYWORDS)
	// Retrieves a UTF-8 string list with values of the supported numeric functions.
	SqlInfoNumericFunctions = SqlInfo(pb.SqlInfo_SQL_NUMERIC_FUNCTIONS)
	// Retrieves a UTF-8 string list with values of the supported string functions.
	SqlInfoStringFunctions = SqlInfo(pb.SqlInfo_SQL_STRING_FUNCTIONS)
	// Retrieves a UTF-8 string list with values of the supported system functions.
	SqlInfoSystemFunctions = SqlInfo(pb.SqlInfo_SQL_SYSTEM_FUNCTIONS)
	// Retrieves a UTF-8 string list with values of the supported datetime functions.
	SqlInfoDateTimeFunctions = SqlInfo(pb.SqlInfo_SQL_DATETIME_FUNCTIONS)

	// Retrieves the UTF-8 string that can be used to escape wildcard characters.
	// This is the string that can be used to escape '_' or '%' in the catalog search parameters that are a pattern
	// (and therefore use one of the wildcard characters).
	// The '_' character represents any single character; the '%' character represents any sequence of zero or more
	// characters.
	SqlInfoSearchStringEscape = SqlInfo(pb.SqlInfo_SQL_SEARCH_STRING_ESCAPE)

	// Retrieves a UTF-8 string with all the "extra" characters that can be used in unquoted identifier names
	// (those beyond a-z, A-Z, 0-9 and _).
	SqlInfoExtraNameChars = SqlInfo(pb.SqlInfo_SQL_EXTRA_NAME_CHARACTERS)

	// Retrieves a boolean value indicating whether column aliasing is supported.
	// If so, the SQL AS clause can be used to provide names for computed columns or to provide alias names for columns
	// as required.
	//
	// Returns:
	// - false: if column aliasing is unsupported;
	// - true: if column aliasing is supported.
	SqlInfoSupportsColumnAliasing = SqlInfo(pb.SqlInfo_SQL_SUPPORTS_COLUMN_ALIASING)

	// Retrieves a boolean value indicating whether concatenations between null and non-null values being
	// null are supported.
	//
	// - Returns:
	// - false: if concatenations between null and non-null values being null are unsupported;
	// - true: if concatenations between null and non-null values being null are supported.
	SqlInfoNullPlusNullIsNull = SqlInfo(pb.SqlInfo_SQL_NULL_PLUS_NULL_IS_NULL)

	// Retrieves a map where the key is the type to convert from and the value is a list with the types to convert to,
	// indicating the supported conversions. Each key and each item on the list value is a value to a predefined type on
	// SqlSupportsConvert enum.
	// The returned map will be:  map<int32, list<int32>>
	SqlInfoSupportsConvert = SqlInfo(pb.SqlInfo_SQL_SUPPORTS_CONVERT)

	// Retrieves a boolean value indicating whether, when table correlation names are supported,
	// they are restricted to being different from the names of the tables.
	//
	// Returns:
	// - false: if table correlation names are unsupported;
	// - true: if table correlation names are supported.
	SqlInfoSupportsTableCorrelationNames = SqlInfo(pb.SqlInfo_SQL_SUPPORTS_TABLE_CORRELATION_NAMES)

	// Retrieves a boolean value indicating whether, when table correlation names are supported,
	// they are restricted to being different from the names of the tables.
	//
	// Returns:
	// - false: if different table correlation names are unsupported;
	// - true: if different table correlation names are supported
	SqlInfoSupportsDifferentTableCorrelationNames = SqlInfo(pb.SqlInfo_SQL_SUPPORTS_DIFFERENT_TABLE_CORRELATION_NAMES)

	// Retrieves a boolean value indicating whether expressions in ORDER BY lists are supported.
	//
	// Returns:
	// - false: if expressions in ORDER BY are unsupported;
	// - true: if expressions in ORDER BY are supported;
	SqlInfoSupportsExpressionsInOrderBy = SqlInfo(pb.SqlInfo_SQL_SUPPORTS_EXPRESSIONS_IN_ORDER_BY)

	// Retrieves a boolean value indicating whether using a column that is not in the SELECT statement in a GROUP BY
	// clause is supported.
	//
	// Returns:
	// - false: if using a column that is not in the SELECT statement in a GROUP BY clause is unsupported;
	// - true: if using a column that is not in the SELECT statement in a GROUP BY clause is supported.
	SqlInfoSupportsOrderByUnrelated = SqlInfo(pb.SqlInfo_SQL_SUPPORTS_ORDER_BY_UNRELATED)

	// Retrieves the supported GROUP BY commands;
	//
	// Returns an int32 bitmask value representing the supported commands.
	// The returned bitmask should be parsed in order to retrieve the supported commands.
	//
	// For instance:
	// - return 0 (\b0)   => [] (GROUP BY is unsupported);
	// - return 1 (\b1)   => [SQL_GROUP_BY_UNRELATED];
	// - return 2 (\b10)  => [SQL_GROUP_BY_BEYOND_SELECT];
	// - return 3 (\b11)  => [SQL_GROUP_BY_UNRELATED, SQL_GROUP_BY_BEYOND_SELECT].
	// Valid GROUP BY types are described under `arrow.flight.protocol.sql.SqlSupportedGroupBy`.
	SqlInfoSupportedGroupBy = SqlInfo(pb.SqlInfo_SQL_SUPPORTED_GROUP_BY)

	// Retrieves a boolean value indicating whether specifying a LIKE escape clause is supported.
	//
	// Returns:
	// - false: if specifying a LIKE escape clause is unsupported;
	// - true: if specifying a LIKE escape clause is supported.
	SqlInfoSupportsLikeEscapeClause = SqlInfo(pb.SqlInfo_SQL_SUPPORTS_LIKE_ESCAPE_CLAUSE)

	// Retrieves a boolean value indicating whether columns may be defined as non-nullable.
	//
	// Returns:
	// - false: if columns cannot be defined as non-nullable;
	// - true: if columns may be defined as non-nullable.
	SqlInfoSupportsNonNullableColumns = SqlInfo(pb.SqlInfo_SQL_SUPPORTS_NON_NULLABLE_COLUMNS)

	// Retrieves the supported SQL grammar level as per the ODBC specification.
	//
	// Returns an int32 bitmask value representing the supported SQL grammar level.
	// The returned bitmask should be parsed in order to retrieve the supported grammar levels.
	//
	// For instance:
	// - return 0 (\b0)   => [] (SQL grammar is unsupported);
	// - return 1 (\b1)   => [SQL_MINIMUM_GRAMMAR];
	// - return 2 (\b10)  => [SQL_CORE_GRAMMAR];
	// - return 3 (\b11)  => [SQL_MINIMUM_GRAMMAR, SQL_CORE_GRAMMAR];
	// - return 4 (\b100) => [SQL_EXTENDED_GRAMMAR];
	// - return 5 (\b101) => [SQL_MINIMUM_GRAMMAR, SQL_EXTENDED_GRAMMAR];
	// - return 6 (\b110) => [SQL_CORE_GRAMMAR, SQL_EXTENDED_GRAMMAR];
	// - return 7 (\b111) => [SQL_MINIMUM_GRAMMAR, SQL_CORE_GRAMMAR, SQL_EXTENDED_GRAMMAR].
	// Valid SQL grammar levels are described under `arrow.flight.protocol.sql.SupportedSqlGrammar`.
	SqlInfoSupportedGrammar = SqlInfo(pb.SqlInfo_SQL_SUPPORTED_GRAMMAR)

	// Retrieves the supported ANSI92 SQL grammar level.
	//
	// Returns an int32 bitmask value representing the supported ANSI92 SQL grammar level.
	// The returned bitmask should be parsed in order to retrieve the supported commands.
	//
	// For instance:
	// - return 0 (\b0)   => [] (ANSI92 SQL grammar is unsupported);
	// - return 1 (\b1)   => [ANSI92_ENTRY_SQL];
	// - return 2 (\b10)  => [ANSI92_INTERMEDIATE_SQL];
	// - return 3 (\b11)  => [ANSI92_ENTRY_SQL, ANSI92_INTERMEDIATE_SQL];
	// - return 4 (\b100) => [ANSI92_FULL_SQL];
	// - return 5 (\b101) => [ANSI92_ENTRY_SQL, ANSI92_FULL_SQL];
	// - return 6 (\b110) => [ANSI92_INTERMEDIATE_SQL, ANSI92_FULL_SQL];
	// - return 7 (\b111) => [ANSI92_ENTRY_SQL, ANSI92_INTERMEDIATE_SQL, ANSI92_FULL_SQL].
	// Valid ANSI92 SQL grammar levels are described under `arrow.flight.protocol.sql.SupportedAnsi92SqlGrammarLevel`.
	SqlInfoANSI92SupportedLevel = SqlInfo(pb.SqlInfo_SQL_ANSI92_SUPPORTED_LEVEL)

	// Retrieves a boolean value indicating whether the SQL Integrity Enhancement Facility is supported.
	//
	// Returns:
	// - false: if the SQL Integrity Enhancement Facility is supported;
	// - true: if the SQL Integrity Enhancement Facility is supported.
	SqlInfoSupportsIntegrityEnhancementFacility = SqlInfo(pb.SqlInfo_SQL_SUPPORTS_INTEGRITY_ENHANCEMENT_FACILITY)

	// Retrieves the support level for SQL OUTER JOINs.
	//
	// Returns a int32 ordinal for the SQL ordering being used, as described in
	// `arrow.flight.protocol.sql.SqlOuterJoinsSupportLevel`.
	SqlInfoOuterJoinsSupportLevel = SqlInfo(pb.SqlInfo_SQL_OUTER_JOINS_SUPPORT_LEVEL)

	// Retrieves a UTF-8 string with the preferred term for "schema".
	SqlInfoSchemaTerm = SqlInfo(pb.SqlInfo_SQL_SCHEMA_TERM)
	// Retrieves a UTF-8 string with the preferred term for "procedure".
	SqlInfoProcedureTerm = SqlInfo(pb.SqlInfo_SQL_PROCEDURE_TERM)

	// Retrieves a UTF-8 string with the preferred term for "catalog".
	// If a empty string is returned its assumed that the server does NOT supports catalogs.
	SqlInfoCatalogTerm = SqlInfo(pb.SqlInfo_SQL_CATALOG_TERM)

	// Retrieves a boolean value indicating whether a catalog appears at the start of a fully qualified table name.
	//
	// - false: if a catalog does not appear at the start of a fully qualified table name;
	// - true: if a catalog appears at the start of a fully qualified table name.
	SqlInfoCatalogAtStart = SqlInfo(pb.SqlInfo_SQL_CATALOG_AT_START)

	// Retrieves the supported actions for a SQL schema.
	//
	// Returns an int32 bitmask value representing the supported actions for a SQL schema.
	// The returned bitmask should be parsed in order to retrieve the supported actions for a SQL schema.
	//
	// For instance:
	// - return 0 (\b0)   => [] (no supported actions for SQL schema);
	// - return 1 (\b1)   => [SQL_ELEMENT_IN_PROCEDURE_CALLS];
	// - return 2 (\b10)  => [SQL_ELEMENT_IN_INDEX_DEFINITIONS];
	// - return 3 (\b11)  => [SQL_ELEMENT_IN_PROCEDURE_CALLS, SQL_ELEMENT_IN_INDEX_DEFINITIONS];
	// - return 4 (\b100) => [SQL_ELEMENT_IN_PRIVILEGE_DEFINITIONS];
	// - return 5 (\b101) => [SQL_ELEMENT_IN_PROCEDURE_CALLS, SQL_ELEMENT_IN_PRIVILEGE_DEFINITIONS];
	// - return 6 (\b110) => [SQL_ELEMENT_IN_INDEX_DEFINITIONS, SQL_ELEMENT_IN_PRIVILEGE_DEFINITIONS];
	// - return 7 (\b111) => [SQL_ELEMENT_IN_PROCEDURE_CALLS, SQL_ELEMENT_IN_INDEX_DEFINITIONS, SQL_ELEMENT_IN_PRIVILEGE_DEFINITIONS].
	// Valid actions for a SQL schema described under `arrow.flight.protocol.sql.SqlSupportedElementActions`.
	SqlInfoSchemasSupportedActions = SqlInfo(pb.SqlInfo_SQL_SCHEMAS_SUPPORTED_ACTIONS)

	// Retrieves the supported actions for a SQL schema.
	//
	// Returns an int32 bitmask value representing the supported actions for a SQL catalog.
	// The returned bitmask should be parsed in order to retrieve the supported actions for a SQL catalog.
	//
	// For instance:
	// - return 0 (\b0)   => [] (no supported actions for SQL catalog);
	// - return 1 (\b1)   => [SQL_ELEMENT_IN_PROCEDURE_CALLS];
	// - return 2 (\b10)  => [SQL_ELEMENT_IN_INDEX_DEFINITIONS];
	// - return 3 (\b11)  => [SQL_ELEMENT_IN_PROCEDURE_CALLS, SQL_ELEMENT_IN_INDEX_DEFINITIONS];
	// - return 4 (\b100) => [SQL_ELEMENT_IN_PRIVILEGE_DEFINITIONS];
	// - return 5 (\b101) => [SQL_ELEMENT_IN_PROCEDURE_CALLS, SQL_ELEMENT_IN_PRIVILEGE_DEFINITIONS];
	// - return 6 (\b110) => [SQL_ELEMENT_IN_INDEX_DEFINITIONS, SQL_ELEMENT_IN_PRIVILEGE_DEFINITIONS];
	// - return 7 (\b111) => [SQL_ELEMENT_IN_PROCEDURE_CALLS, SQL_ELEMENT_IN_INDEX_DEFINITIONS, SQL_ELEMENT_IN_PRIVILEGE_DEFINITIONS].
	// Valid actions for a SQL catalog are described under `arrow.flight.protocol.sql.SqlSupportedElementActions`.
	SqlInfoCatalogsSupportedActions = SqlInfo(pb.SqlInfo_SQL_CATALOGS_SUPPORTED_ACTIONS)

	// Retrieves the supported SQL positioned commands.
	//
	// Returns an int32 bitmask value representing the supported SQL positioned commands.
	// The returned bitmask should be parsed in order to retrieve the supported SQL positioned commands.
	//
	// For instance:
	// - return 0 (\b0)   => [] (no supported SQL positioned commands);
	// - return 1 (\b1)   => [SQL_POSITIONED_DELETE];
	// - return 2 (\b10)  => [SQL_POSITIONED_UPDATE];
	// - return 3 (\b11)  => [SQL_POSITIONED_DELETE, SQL_POSITIONED_UPDATE].
	// Valid SQL positioned commands are described under `arrow.flight.protocol.sql.SqlSupportedPositionedCommands`.
	SqlInfoSupportedPositionedCommands = SqlInfo(pb.SqlInfo_SQL_SUPPORTED_POSITIONED_COMMANDS)

	// Retrieves a boolean value indicating whether SELECT FOR UPDATE statements are supported.
	//
	// Returns:
	// - false: if SELECT FOR UPDATE statements are unsupported;
	// - true: if SELECT FOR UPDATE statements are supported.
	SqlInfoSelectForUpdateSupported = SqlInfo(pb.SqlInfo_SQL_SELECT_FOR_UPDATE_SUPPORTED)

	// Retrieves a boolean value indicating whether stored procedure calls that use the stored procedure escape syntax
	// are supported.
	//
	// Returns:
	// - false: if stored procedure calls that use the stored procedure escape syntax are unsupported;
	// - true: if stored procedure calls that use the stored procedure escape syntax are supported.
	SqlInfoStoredProceduresSupported = SqlInfo(pb.SqlInfo_SQL_STORED_PROCEDURES_SUPPORTED)

	// Retrieves the supported SQL subqueries.
	//
	// Returns an int32 bitmask value representing the supported SQL subqueries.
	// The returned bitmask should be parsed in order to retrieve the supported SQL subqueries.
	//
	// For instance:
	// - return 0   (\b0)     => [] (no supported SQL subqueries);
	// - return 1   (\b1)     => [SQL_SUBQUERIES_IN_COMPARISONS];
	// - return 2   (\b10)    => [SQL_SUBQUERIES_IN_EXISTS];
	// - return 3   (\b11)    => [SQL_SUBQUERIES_IN_COMPARISONS, SQL_SUBQUERIES_IN_EXISTS];
	// - return 4   (\b100)   => [SQL_SUBQUERIES_IN_INS];
	// - return 5   (\b101)   => [SQL_SUBQUERIES_IN_COMPARISONS, SQL_SUBQUERIES_IN_INS];
	// - return 6   (\b110)   => [SQL_SUBQUERIES_IN_INS, SQL_SUBQUERIES_IN_EXISTS];
	// - return 7   (\b111)   => [SQL_SUBQUERIES_IN_COMPARISONS, SQL_SUBQUERIES_IN_EXISTS, SQL_SUBQUERIES_IN_INS];
	// - return 8   (\b1000)  => [SQL_SUBQUERIES_IN_QUANTIFIEDS];
	// - return 9   (\b1001)  => [SQL_SUBQUERIES_IN_COMPARISONS, SQL_SUBQUERIES_IN_QUANTIFIEDS];
	// - return 10  (\b1010)  => [SQL_SUBQUERIES_IN_EXISTS, SQL_SUBQUERIES_IN_QUANTIFIEDS];
	// - return 11  (\b1011)  => [SQL_SUBQUERIES_IN_COMPARISONS, SQL_SUBQUERIES_IN_EXISTS, SQL_SUBQUERIES_IN_QUANTIFIEDS];
	// - return 12  (\b1100)  => [SQL_SUBQUERIES_IN_INS, SQL_SUBQUERIES_IN_QUANTIFIEDS];
	// - return 13  (\b1101)  => [SQL_SUBQUERIES_IN_COMPARISONS, SQL_SUBQUERIES_IN_INS, SQL_SUBQUERIES_IN_QUANTIFIEDS];
	// - return 14  (\b1110)  => [SQL_SUBQUERIES_IN_EXISTS, SQL_SUBQUERIES_IN_INS, SQL_SUBQUERIES_IN_QUANTIFIEDS];
	// - return 15  (\b1111)  => [SQL_SUBQUERIES_IN_COMPARISONS, SQL_SUBQUERIES_IN_EXISTS, SQL_SUBQUERIES_IN_INS, SQL_SUBQUERIES_IN_QUANTIFIEDS];
	// - ...
	// Valid SQL subqueries are described under `arrow.flight.protocol.sql.SqlSupportedSubqueries`.
	SqlInfoSupportedSubqueries = SqlInfo(pb.SqlInfo_SQL_SUPPORTED_SUBQUERIES)

	// Retrieves a boolean value indicating whether correlated subqueries are supported.
	//
	// Returns:
	// - false: if correlated subqueries are unsupported;
	// - true: if correlated subqueries are supported.
	SqlInfoCorrelatedSubqueriesSupported = SqlInfo(pb.SqlInfo_SQL_CORRELATED_SUBQUERIES_SUPPORTED)

	// Retrieves the supported SQL UNIONs.
	//
	// Returns an int32 bitmask value representing the supported SQL UNIONs.
	// The returned bitmask should be parsed in order to retrieve the supported SQL UNIONs.
	//
	// For instance:
	// - return 0 (\b0)   => [] (no supported SQL positioned commands);
	// - return 1 (\b1)   => [SQL_UNION];
	// - return 2 (\b10)  => [SQL_UNION_ALL];
	// - return 3 (\b11)  => [SQL_UNION, SQL_UNION_ALL].
	// Valid SQL positioned commands are described under `arrow.flight.protocol.sql.SqlSupportedUnions`.
	SqlInfoSupportedUnions = SqlInfo(pb.SqlInfo_SQL_SUPPORTED_UNIONS)

	// Retrieves a int64 value representing the maximum number of hex characters allowed in an inline binary literal.
	SqlInfoMaxBinaryLiteralLen = SqlInfo(pb.SqlInfo_SQL_MAX_BINARY_LITERAL_LENGTH)
	// Retrieves a int64 value representing the maximum number of characters allowed for a character literal.
	SqlInfoMaxCharLiteralLen = SqlInfo(pb.SqlInfo_SQL_MAX_CHAR_LITERAL_LENGTH)
	// Retrieves a int64 value representing the maximum number of characters allowed for a column name.
	SqlInfoMaxColumnNameLen = SqlInfo(pb.SqlInfo_SQL_MAX_COLUMN_NAME_LENGTH)
	// Retrieves a int64 value representing the maximum number of columns allowed in a GROUP BY clause.
	SqlInfoMaxColumnsInGroupBy = SqlInfo(pb.SqlInfo_SQL_MAX_COLUMNS_IN_GROUP_BY)
	// Retrieves a int64 value representing the maximum number of columns allowed in an index.
	SqlInfoMaxColumnsInIndex = SqlInfo(pb.SqlInfo_SQL_MAX_COLUMNS_IN_INDEX)
	// Retrieves a int64 value representing the maximum number of columns allowed in an ORDER BY clause.
	SqlInfoMaxColumnsInOrderBy = SqlInfo(pb.SqlInfo_SQL_MAX_COLUMNS_IN_ORDER_BY)
	// Retrieves a int64 value representing the maximum number of columns allowed in a SELECT list.
	SqlInfoMaxColumnsInSelect = SqlInfo(pb.SqlInfo_SQL_MAX_COLUMNS_IN_SELECT)
	// Retrieves a int64 value representing the maximum number of columns allowed in a table.
	SqlInfoMaxColumnsInTable = SqlInfo(pb.SqlInfo_SQL_MAX_COLUMNS_IN_TABLE)
	// Retrieves a int64 value representing the maximum number of concurrent connections possible.
	SqlInfoMaxConnections = SqlInfo(pb.SqlInfo_SQL_MAX_CONNECTIONS)
	// Retrieves a int64 value the maximum number of characters allowed in a cursor name.
	SqlInfoMaxCursorNameLen = SqlInfo(pb.SqlInfo_SQL_MAX_CURSOR_NAME_LENGTH)

	// Retrieves a int64 value representing the maximum number of bytes allowed for an index,
	// including all of the parts of the index.
	SqlInfoMaxIndexLen = SqlInfo(pb.SqlInfo_SQL_MAX_INDEX_LENGTH)
	// Retrieves a int64 value representing the maximum number of characters allowed in a schema name.
	SqlInfoDBSchemaNameLen = SqlInfo(pb.SqlInfo_SQL_DB_SCHEMA_NAME_LENGTH)
	// Retrieves a int64 value representing the maximum number of characters allowed in a procedure name.
	SqlInfoMaxProcedureNameLen = SqlInfo(pb.SqlInfo_SQL_MAX_PROCEDURE_NAME_LENGTH)
	// Retrieves a int64 value representing the maximum number of characters allowed in a catalog name.
	SqlInfoMaxCatalogNameLen = SqlInfo(pb.SqlInfo_SQL_MAX_CATALOG_NAME_LENGTH)
	// Retrieves a int64 value representing the maximum number of bytes allowed in a single row.
	SqlInfoMaxRowSize = SqlInfo(pb.SqlInfo_SQL_MAX_ROW_SIZE)

	// Retrieves a boolean indicating whether the return value for the JDBC method getMaxRowSize includes the SQL
	// data types LONGVARCHAR and LONGVARBINARY.
	//
	// Returns:
	// - false: if return value for the JDBC method getMaxRowSize does
	//          not include the SQL data types LONGVARCHAR and LONGVARBINARY;
	// - true: if return value for the JDBC method getMaxRowSize includes
	//         the SQL data types LONGVARCHAR and LONGVARBINARY.
	SqlInfoMaxRowSizeIncludesBlobs = SqlInfo(pb.SqlInfo_SQL_MAX_ROW_SIZE_INCLUDES_BLOBS)

	// Retrieves a int64 value representing the maximum number of characters allowed for an SQL statement;
	// a result of 0 (zero) means that there is no limit or the limit is not known.
	SqlInfoMaxStatementLen = SqlInfo(pb.SqlInfo_SQL_MAX_STATEMENT_LENGTH)
	// Retrieves a int64 value representing the maximum number of active statements that can be open at the same time.
	SqlInfoMaxStatements = SqlInfo(pb.SqlInfo_SQL_MAX_STATEMENTS)
	// Retrieves a int64 value representing the maximum number of characters allowed in a table name.
	SqlInfoMaxTableNameLen = SqlInfo(pb.SqlInfo_SQL_MAX_TABLE_NAME_LENGTH)
	// Retrieves a int64 value representing the maximum number of tables allowed in a SELECT statement.
	SqlInfoMaxTablesInSelect = SqlInfo(pb.SqlInfo_SQL_MAX_TABLES_IN_SELECT)
	// Retrieves a int64 value representing the maximum number of characters allowed in a user name.
	SqlInfoMaxUsernameLen = SqlInfo(pb.SqlInfo_SQL_MAX_USERNAME_LENGTH)

	// Retrieves this database's default transaction isolation level as described in
	// `arrow.flight.protocol.sql.SqlTransactionIsolationLevel`.
	//
	// Returns a int32 ordinal for the SQL transaction isolation level.
	SqlInfoDefaultTransactionIsolation = SqlInfo(pb.SqlInfo_SQL_DEFAULT_TRANSACTION_ISOLATION)

	// Retrieves a boolean value indicating whether transactions are supported. If not, invoking the method commit is a
	// noop, and the isolation level is `arrow.flight.protocol.sql.SqlTransactionIsolationLevel.TRANSACTION_NONE`.
	//
	// Returns:
	// - false: if transactions are unsupported;
	// - true: if transactions are supported.
	SqlInfoTransactionsSupported = SqlInfo(pb.SqlInfo_SQL_TRANSACTIONS_SUPPORTED)

	// Retrieves the supported transactions isolation levels.
	//
	// Returns an int32 bitmask value representing the supported transactions isolation levels.
	// The returned bitmask should be parsed in order to retrieve the supported transactions isolation levels.
	//
	// For instance:
	// - return 0   (\b0)     => [] (no supported SQL transactions isolation levels);
	// - return 1   (\b1)     => [SQL_TRANSACTION_NONE];
	// - return 2   (\b10)    => [SQL_TRANSACTION_READ_UNCOMMITTED];
	// - return 3   (\b11)    => [SQL_TRANSACTION_NONE, SQL_TRANSACTION_READ_UNCOMMITTED];
	// - return 4   (\b100)   => [SQL_TRANSACTION_REPEATABLE_READ];
	// - return 5   (\b101)   => [SQL_TRANSACTION_NONE, SQL_TRANSACTION_REPEATABLE_READ];
	// - return 6   (\b110)   => [SQL_TRANSACTION_READ_UNCOMMITTED, SQL_TRANSACTION_REPEATABLE_READ];
	// - return 7   (\b111)   => [SQL_TRANSACTION_NONE, SQL_TRANSACTION_READ_UNCOMMITTED, SQL_TRANSACTION_REPEATABLE_READ];
	// - return 8   (\b1000)  => [SQL_TRANSACTION_REPEATABLE_READ];
	// - return 9   (\b1001)  => [SQL_TRANSACTION_NONE, SQL_TRANSACTION_REPEATABLE_READ];
	// - return 10  (\b1010)  => [SQL_TRANSACTION_READ_UNCOMMITTED, SQL_TRANSACTION_REPEATABLE_READ];
	// - return 11  (\b1011)  => [SQL_TRANSACTION_NONE, SQL_TRANSACTION_READ_UNCOMMITTED, SQL_TRANSACTION_REPEATABLE_READ];
	// - return 12  (\b1100)  => [SQL_TRANSACTION_REPEATABLE_READ, SQL_TRANSACTION_REPEATABLE_READ];
	// - return 13  (\b1101)  => [SQL_TRANSACTION_NONE, SQL_TRANSACTION_REPEATABLE_READ, SQL_TRANSACTION_REPEATABLE_READ];
	// - return 14  (\b1110)  => [SQL_TRANSACTION_READ_UNCOMMITTED, SQL_TRANSACTION_REPEATABLE_READ, SQL_TRANSACTION_REPEATABLE_READ];
	// - return 15  (\b1111)  => [SQL_TRANSACTION_NONE, SQL_TRANSACTION_READ_UNCOMMITTED, SQL_TRANSACTION_REPEATABLE_READ, SQL_TRANSACTION_REPEATABLE_READ];
	// - return 16  (\b10000) => [SQL_TRANSACTION_SERIALIZABLE];
	// - ...
	// Valid SQL positioned commands are described under `arrow.flight.protocol.sql.SqlTransactionIsolationLevel`.
	SqlInfoSupportedTransactionsIsolationlevels = SqlInfo(pb.SqlInfo_SQL_SUPPORTED_TRANSACTIONS_ISOLATION_LEVELS)

	// Retrieves a boolean value indicating whether a data definition statement within a transaction forces
	// the transaction to commit.
	//
	// Returns:
	// - false: if a data definition statement within a transaction does not force the transaction to commit;
	// - true: if a data definition statement within a transaction forces the transaction to commit.
	SqlInfoDataDefinitionCausesTransactionCommit = SqlInfo(pb.SqlInfo_SQL_DATA_DEFINITION_CAUSES_TRANSACTION_COMMIT)

	// Retrieves a boolean value indicating whether a data definition statement within a transaction is ignored.
	//
	// Returns:
	// - false: if a data definition statement within a transaction is taken into account;
	// - true: a data definition statement within a transaction is ignored.
	SqlInfoDataDefinitionsInTransactionsIgnored = SqlInfo(pb.SqlInfo_SQL_DATA_DEFINITIONS_IN_TRANSACTIONS_IGNORED)

	// Retrieves an int32 bitmask value representing the supported result set types.
	// The returned bitmask should be parsed in order to retrieve the supported result set types.
	//
	// For instance:
	// - return 0   (\b0)     => [] (no supported result set types);
	// - return 1   (\b1)     => [SQL_RESULT_SET_TYPE_UNSPECIFIED];
	// - return 2   (\b10)    => [SQL_RESULT_SET_TYPE_FORWARD_ONLY];
	// - return 3   (\b11)    => [SQL_RESULT_SET_TYPE_UNSPECIFIED, SQL_RESULT_SET_TYPE_FORWARD_ONLY];
	// - return 4   (\b100)   => [SQL_RESULT_SET_TYPE_SCROLL_INSENSITIVE];
	// - return 5   (\b101)   => [SQL_RESULT_SET_TYPE_UNSPECIFIED, SQL_RESULT_SET_TYPE_SCROLL_INSENSITIVE];
	// - return 6   (\b110)   => [SQL_RESULT_SET_TYPE_FORWARD_ONLY, SQL_RESULT_SET_TYPE_SCROLL_INSENSITIVE];
	// - return 7   (\b111)   => [SQL_RESULT_SET_TYPE_UNSPECIFIED, SQL_RESULT_SET_TYPE_FORWARD_ONLY, SQL_RESULT_SET_TYPE_SCROLL_INSENSITIVE];
	// - return 8   (\b1000)  => [SQL_RESULT_SET_TYPE_SCROLL_SENSITIVE];
	// - ...
	// Valid result set types are described under `arrow.flight.protocol.sql.SqlSupportedResultSetType`.
	SqlInfoSupportedResultSetTypes = SqlInfo(pb.SqlInfo_SQL_SUPPORTED_RESULT_SET_TYPES)

	// Returns an int32 bitmask value concurrency types supported for
	// `arrow.flight.protocol.sql.SqlSupportedResultSetType.SQL_RESULT_SET_TYPE_UNSPECIFIED`.
	//
	// For instance:
	// - return 0 (\b0)   => [] (no supported concurrency types for this result set type)
	// - return 1 (\b1)   => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED]
	// - return 2 (\b10)  => [SQL_RESULT_SET_CONCURRENCY_READ_ONLY]
	// - return 3 (\b11)  => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED, SQL_RESULT_SET_CONCURRENCY_READ_ONLY]
	// - return 4 (\b100) => [SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// - return 5 (\b101) => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED, SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// - return 6 (\b110)  => [SQL_RESULT_SET_CONCURRENCY_READ_ONLY, SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// - return 7 (\b111)  => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED, SQL_RESULT_SET_CONCURRENCY_READ_ONLY, SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// Valid result set types are described under `arrow.flight.protocol.sql.SqlSupportedResultSetConcurrency`.
	SqlInfoSupportedConcurrenciesForResultSetUnspecified = SqlInfo(pb.SqlInfo_SQL_SUPPORTED_CONCURRENCIES_FOR_RESULT_SET_UNSPECIFIED)

	// Returns an int32 bitmask value concurrency types supported for
	// `arrow.flight.protocol.sql.SqlSupportedResultSetType.SQL_RESULT_SET_TYPE_FORWARD_ONLY`.
	//
	// For instance:
	// - return 0 (\b0)   => [] (no supported concurrency types for this result set type)
	// - return 1 (\b1)   => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED]
	// - return 2 (\b10)  => [SQL_RESULT_SET_CONCURRENCY_READ_ONLY]
	// - return 3 (\b11)  => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED, SQL_RESULT_SET_CONCURRENCY_READ_ONLY]
	// - return 4 (\b100) => [SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// - return 5 (\b101) => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED, SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// - return 6 (\b110)  => [SQL_RESULT_SET_CONCURRENCY_READ_ONLY, SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// - return 7 (\b111)  => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED, SQL_RESULT_SET_CONCURRENCY_READ_ONLY, SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// Valid result set types are described under `arrow.flight.protocol.sql.SqlSupportedResultSetConcurrency`.
	SqlInfoSupportedConcurrenciesForResultSetForwardOnly = SqlInfo(pb.SqlInfo_SQL_SUPPORTED_CONCURRENCIES_FOR_RESULT_SET_FORWARD_ONLY)

	// Returns an int32 bitmask value concurrency types supported for
	// `arrow.flight.protocol.sql.SqlSupportedResultSetType.SQL_RESULT_SET_TYPE_SCROLL_SENSITIVE`.
	//
	// For instance:
	// - return 0 (\b0)   => [] (no supported concurrency types for this result set type)
	// - return 1 (\b1)   => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED]
	// - return 2 (\b10)  => [SQL_RESULT_SET_CONCURRENCY_READ_ONLY]
	// - return 3 (\b11)  => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED, SQL_RESULT_SET_CONCURRENCY_READ_ONLY]
	// - return 4 (\b100) => [SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// - return 5 (\b101) => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED, SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// - return 6 (\b110)  => [SQL_RESULT_SET_CONCURRENCY_READ_ONLY, SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// - return 7 (\b111)  => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED, SQL_RESULT_SET_CONCURRENCY_READ_ONLY, SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// Valid result set types are described under `arrow.flight.protocol.sql.SqlSupportedResultSetConcurrency`.
	SqlInfoSupportedConcurrenciesForResultSetScrollSensitive = SqlInfo(pb.SqlInfo_SQL_SUPPORTED_CONCURRENCIES_FOR_RESULT_SET_SCROLL_SENSITIVE)

	// Returns an int32 bitmask value concurrency types supported for
	// `arrow.flight.protocol.sql.SqlSupportedResultSetType.SQL_RESULT_SET_TYPE_SCROLL_INSENSITIVE`.
	//
	// For instance:
	// - return 0 (\b0)   => [] (no supported concurrency types for this result set type)
	// - return 1 (\b1)   => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED]
	// - return 2 (\b10)  => [SQL_RESULT_SET_CONCURRENCY_READ_ONLY]
	// - return 3 (\b11)  => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED, SQL_RESULT_SET_CONCURRENCY_READ_ONLY]
	// - return 4 (\b100) => [SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// - return 5 (\b101) => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED, SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// - return 6 (\b110)  => [SQL_RESULT_SET_CONCURRENCY_READ_ONLY, SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// - return 7 (\b111)  => [SQL_RESULT_SET_CONCURRENCY_UNSPECIFIED, SQL_RESULT_SET_CONCURRENCY_READ_ONLY, SQL_RESULT_SET_CONCURRENCY_UPDATABLE]
	// Valid result set types are described under `arrow.flight.protocol.sql.SqlSupportedResultSetConcurrency`.
	SqlInfoSupportedConcurrenciesForResultSetScrollInsensitive = SqlInfo(pb.SqlInfo_SQL_SUPPORTED_CONCURRENCIES_FOR_RESULT_SET_SCROLL_INSENSITIVE)

	// Retrieves a boolean value indicating whether this database supports batch updates.
	//
	// - false: if this database does not support batch updates;
	// - true: if this database supports batch updates.
	SqlInfoBatchUpdatesSupported = SqlInfo(pb.SqlInfo_SQL_BATCH_UPDATES_SUPPORTED)

	// Retrieves a boolean value indicating whether this database supports savepoints.
	//
	// Returns:
	// - false: if this database does not support savepoints;
	// - true: if this database supports savepoints.
	SqlInfoSavePointsSupported = SqlInfo(pb.SqlInfo_SQL_SAVEPOINTS_SUPPORTED)

	// Retrieves a boolean value indicating whether named parameters are supported in callable statements.
	//
	// Returns:
	// - false: if named parameters in callable statements are unsupported;
	// - true: if named parameters in callable statements are supported.
	SqlInfoNamedParametersSupported = SqlInfo(pb.SqlInfo_SQL_NAMED_PARAMETERS_SUPPORTED)

	// Retrieves a boolean value indicating whether updates made to a LOB are made on a copy or directly to the LOB.
	//
	// Returns:
	// - false: if updates made to a LOB are made directly to the LOB;
	// - true: if updates made to a LOB are made on a copy.
	SqlInfoLocatorsUpdateCopy = SqlInfo(pb.SqlInfo_SQL_LOCATORS_UPDATE_COPY)

	// Retrieves a boolean value indicating whether invoking user-defined or vendor functions
	// using the stored procedure escape syntax is supported.
	//
	// Returns:
	// - false: if invoking user-defined or vendor functions using the stored procedure escape syntax is unsupported;
	// - true: if invoking user-defined or vendor functions using the stored procedure escape syntax is supported.
	SqlInfoStoredFunctionsUsingCallSyntaxSupported = SqlInfo(pb.SqlInfo_SQL_STORED_FUNCTIONS_USING_CALL_SYNTAX_SUPPORTED)
)

func (s SqlInfo) String() string { return pb.SqlInfo(int32(s)).String() }

type SqlSupportedTransaction = pb.SqlSupportedTransaction

const (
	// Unknown/not indicated/no support
	SqlTransactionNone = pb.SqlSupportedTransaction_SQL_SUPPORTED_TRANSACTION_NONE
	// Transactions, but not savepoints.
	// a savepoint is a mark within a transaction that can be individually
	// rolled back to. Not all databases support savepoints.
	SqlTransactionTransaction = pb.SqlSupportedTransaction_SQL_SUPPORTED_TRANSACTION_TRANSACTION
	// Transactions AND Savepoints supported
	SqlTransactionSavepoint = pb.SqlSupportedTransaction_SQL_SUPPORTED_TRANSACTION_SAVEPOINT
)

// SqlSupportedCaseSensitivity indicates whether something
// (e.g. an identifier) is case-sensitive
//
// duplicated from protobuf to avoid relying directly on the protobuf
// generated code, also making them shorter and easier to use
type SqlSupportedCaseSensitivity = pb.SqlSupportedCaseSensitivity

const (
	SqlCaseSensitivityUnknown         = pb.SqlSupportedCaseSensitivity_SQL_CASE_SENSITIVITY_UNKNOWN
	SqlCaseSensitivityCaseInsensitive = pb.SqlSupportedCaseSensitivity_SQL_CASE_SENSITIVITY_CASE_INSENSITIVE
	SqlCaseSensitivityUpperCase       = pb.SqlSupportedCaseSensitivity_SQL_CASE_SENSITIVITY_UPPERCASE
	SqlCaseSensitivityLowerCase       = pb.SqlSupportedCaseSensitivity_SQL_CASE_SENSITIVITY_LOWERCASE
)

// SqlNullOrdering indicates how nulls are sorted
//
// duplicated from protobuf to avoid relying directly on the protobuf
// generated code, also making them shorter and easier to use
type SqlNullOrdering = pb.SqlNullOrdering

const (
	SqlNullOrderingSortHigh    = pb.SqlNullOrdering_SQL_NULLS_SORTED_HIGH
	SqlNullOrderingSortLow     = pb.SqlNullOrdering_SQL_NULLS_SORTED_LOW
	SqlNullOrderingSortAtStart = pb.SqlNullOrdering_SQL_NULLS_SORTED_AT_START
	SqlNullOrderingSortAtEnd   = pb.SqlNullOrdering_SQL_NULLS_SORTED_AT_END
)

// SqlSupportsConvert indicates support for converting between different
// types.
//
// duplicated from protobuf to avoid relying directly on the protobuf
// generated code, also making them shorter and easier to use
type SqlSupportsConvert = pb.SqlSupportsConvert

const (
	SqlConvertBigInt            = pb.SqlSupportsConvert_SQL_CONVERT_BIGINT
	SqlConvertBinary            = pb.SqlSupportsConvert_SQL_CONVERT_BINARY
	SqlConvertBit               = pb.SqlSupportsConvert_SQL_CONVERT_BIT
	SqlConvertChar              = pb.SqlSupportsConvert_SQL_CONVERT_CHAR
	SqlConvertDate              = pb.SqlSupportsConvert_SQL_CONVERT_DATE
	SqlConvertDecimal           = pb.SqlSupportsConvert_SQL_CONVERT_DECIMAL
	SqlConvertFloat             = pb.SqlSupportsConvert_SQL_CONVERT_FLOAT
	SqlConvertInteger           = pb.SqlSupportsConvert_SQL_CONVERT_INTEGER
	SqlConvertIntervalDayTime   = pb.SqlSupportsConvert_SQL_CONVERT_INTERVAL_DAY_TIME
	SqlConvertIntervalYearMonth = pb.SqlSupportsConvert_SQL_CONVERT_INTERVAL_YEAR_MONTH
	SqlConvertLongVarbinary     = pb.SqlSupportsConvert_SQL_CONVERT_LONGVARBINARY
	SqlConvertLongVarchar       = pb.SqlSupportsConvert_SQL_CONVERT_LONGVARCHAR
	SqlConvertNumeric           = pb.SqlSupportsConvert_SQL_CONVERT_NUMERIC
	SqlConvertReal              = pb.SqlSupportsConvert_SQL_CONVERT_REAL
	SqlConvertSmallInt          = pb.SqlSupportsConvert_SQL_CONVERT_SMALLINT
	SqlConvertTime              = pb.SqlSupportsConvert_SQL_CONVERT_TIME
	SqlConvertTimestamp         = pb.SqlSupportsConvert_SQL_CONVERT_TIMESTAMP
	SqlConvertTinyInt           = pb.SqlSupportsConvert_SQL_CONVERT_TINYINT
	SqlConvertVarbinary         = pb.SqlSupportsConvert_SQL_CONVERT_VARBINARY
	SqlConvertVarchar           = pb.SqlSupportsConvert_SQL_CONVERT_VARCHAR
)

type EndTransactionRequestType = pb.ActionEndTransactionRequest_EndTransaction

const (
	EndTransactionUnspecified = pb.ActionEndTransactionRequest_END_TRANSACTION_UNSPECIFIED
	// Commit the transaction
	EndTransactionCommit = pb.ActionEndTransactionRequest_END_TRANSACTION_COMMIT
	// Roll back the transaction
	EndTransactionRollback = pb.ActionEndTransactionRequest_END_TRANSACTION_ROLLBACK
)

type EndSavepointRequestType = pb.ActionEndSavepointRequest_EndSavepoint

const (
	EndSavepointUnspecified = pb.ActionEndSavepointRequest_END_SAVEPOINT_UNSPECIFIED
	// Release the savepoint
	EndSavepointRelease = pb.ActionEndSavepointRequest_END_SAVEPOINT_RELEASE
	// Roll back to a savepoint
	EndSavepointRollback = pb.ActionEndSavepointRequest_END_SAVEPOINT_ROLLBACK
)

type CancelResult = pb.ActionCancelQueryResult_CancelResult

const (
	// The cancellation status is unknown. Servers should avoid using
	// this value (send a NOT_FOUND error if the requested query is
	// not known). Clients can retry the request.
	CancelResultUnspecified = pb.ActionCancelQueryResult_CANCEL_RESULT_UNSPECIFIED
	// The cancellation request is complete. Subsequent requests with
	// the same payload may return CANCELLED or a NOT_FOUND error.
	CancelResultCancelled = pb.ActionCancelQueryResult_CANCEL_RESULT_CANCELLED
	// The cancellation request is in progress. The client may retry
	// the cancellation request.
	CancelResultCancelling = pb.ActionCancelQueryResult_CANCEL_RESULT_CANCELLING
	// The query is not cancellable. The client should not retry the
	// cancellation request.
	CancelResultNotCancellable = pb.ActionCancelQueryResult_CANCEL_RESULT_NOT_CANCELLABLE
)

type CreatePreparedStatementResult = pb.ActionCreatePreparedStatementResult

type (
	TableDefinitionOptions                    = pb.CommandStatementIngest_TableDefinitionOptions
	TableDefinitionOptionsTableNotExistOption = pb.CommandStatementIngest_TableDefinitionOptions_TableNotExistOption
	TableDefinitionOptionsTableExistsOption   = pb.CommandStatementIngest_TableDefinitionOptions_TableExistsOption
)

const (
	TableDefinitionOptionsTableNotExistOptionUnspecified = pb.CommandStatementIngest_TableDefinitionOptions_TABLE_NOT_EXIST_OPTION_UNSPECIFIED
	TableDefinitionOptionsTableNotExistOptionCreate      = pb.CommandStatementIngest_TableDefinitionOptions_TABLE_NOT_EXIST_OPTION_CREATE
	TableDefinitionOptionsTableNotExistOptionFail        = pb.CommandStatementIngest_TableDefinitionOptions_TABLE_NOT_EXIST_OPTION_FAIL

	TableDefinitionOptionsTableExistsOptionUnspecified = pb.CommandStatementIngest_TableDefinitionOptions_TABLE_EXISTS_OPTION_UNSPECIFIED
	TableDefinitionOptionsTableExistsOptionFail        = pb.CommandStatementIngest_TableDefinitionOptions_TABLE_EXISTS_OPTION_FAIL
	TableDefinitionOptionsTableExistsOptionAppend      = pb.CommandStatementIngest_TableDefinitionOptions_TABLE_EXISTS_OPTION_APPEND
	TableDefinitionOptionsTableExistsOptionReplace     = pb.CommandStatementIngest_TableDefinitionOptions_TABLE_EXISTS_OPTION_REPLACE
)
