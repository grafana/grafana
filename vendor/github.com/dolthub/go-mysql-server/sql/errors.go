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

package sql

import (
	"fmt"
	"io"

	"github.com/dolthub/vitess/go/mysql"
	"gopkg.in/src-d/go-errors.v1"
)

var (
	// ErrSyntaxError is returned when a syntax error in vitess is encountered.
	ErrSyntaxError = errors.NewKind("%s")

	// ErrUnsupportedFeature is thrown when a feature is not already supported
	ErrUnsupportedFeature = errors.NewKind("unsupported feature: %s")

	// ErrReadOnly is returned when the engine has been set to Read Only but a write operation was attempted.
	ErrReadOnly = errors.NewKind("database server is set to read only mode")

	// ErrInvalidSystemVariableValue is returned when a system variable is assigned a value that it does not accept.
	ErrInvalidSystemVariableValue = errors.NewKind("Variable '%s' can't be set to the value of '%v'")

	// ErrSystemVariableCodeFail is returned when failing to encode/decode a system variable.
	ErrSystemVariableCodeFail = errors.NewKind("unable to encode/decode value '%v' for '%s'")

	// ErrInvalidType is thrown when there is an unexpected type at some part of
	// the execution tree.
	ErrInvalidType = errors.NewKind("invalid type: %s")

	// ErrInvalidTimeZone is thrown when an invalid time zone is found
	ErrInvalidTimeZone = errors.NewKind("Unknown or incorrect time zone: %s")

	// ErrTableAlreadyExists is thrown when someone tries to create a
	// table with a name of an existing one
	ErrTableAlreadyExists = errors.NewKind("table with name %s already exists")

	// ErrTableNotFound is returned when the table is not available from the
	// current scope.
	ErrTableNotFound = errors.NewKind("table not found: %s")

	// ErrInvalidRefInView is returned when querying existing view that references non-existent table.
	// Creating new view or updating existing view to reference non-existent table/view do not apply here.
	ErrInvalidRefInView = errors.NewKind("View '%s.%s' references invalid table(s) or column(s) or function(s) or definer/invoker of view lack rights to use them")

	// ErrUnknownTable is returned when the non-table name is used for table actions.
	ErrUnknownTable = errors.NewKind("Unknown table '%s'")

	// ErrTableColumnNotFound is thrown when a column named cannot be found in scope
	ErrTableColumnNotFound = errors.NewKind("table %q does not have column %q")

	// ErrColumnNotFound is returned when the column does not exist in any
	// table in scope.
	ErrColumnNotFound = errors.NewKind("column %q could not be found in any table in scope")

	// ErrAmbiguousColumnName is returned when there is a column reference that
	// is present in more than one table.
	ErrAmbiguousColumnName = errors.NewKind("ambiguous column name %q, it's present in all these tables: %v")

	// ErrAmbiguousColumnOrAliasName is returned when a column or alias name can't be qualified to a table or alias definition
	ErrAmbiguousColumnOrAliasName = errors.NewKind("ambiguous column or alias name %q")

	// ErrAmbiguousColumnInOrderBy is returned when an order by column is ambiguous
	ErrAmbiguousColumnInOrderBy = errors.NewKind("Column %q in order clause is ambiguous")

	// ErrColumnExists is returned when an ALTER TABLE statement would create a duplicate column
	ErrColumnExists = errors.NewKind("Column %q already exists")

	// ErrCreateTableNotSupported is thrown when the database doesn't support table creation
	ErrCreateTableNotSupported = errors.NewKind("tables cannot be created on database %s")

	// ErrDropTableNotSupported is thrown when the database doesn't support dropping tables
	ErrDropTableNotSupported = errors.NewKind("tables cannot be dropped on database %s")

	// ErrRenameTableNotSupported is thrown when the database doesn't support renaming tables
	ErrRenameTableNotSupported = errors.NewKind("tables cannot be renamed on database %s")

	// ErrDatabaseCollationsNotSupported is thrown when a database does not allow updating its collation
	ErrDatabaseCollationsNotSupported = errors.NewKind("database %s does not support collation operations")

	// ErrTableCreatedNotFound is thrown when a table is created from CREATE TABLE but cannot be found immediately afterward
	ErrTableCreatedNotFound = errors.NewKind("table %q was created but could not be found")

	// ErrUnexpectedRowLength is thrown when the obtained row has more columns than the schema
	ErrUnexpectedRowLength = errors.NewKind("expected %d values, got %d")

	// ErrInvalidChildrenNumber is returned when the WithChildren method of a
	// node or expression is called with an invalid number of arguments.
	ErrInvalidChildrenNumber = errors.NewKind("%T: invalid children number, got %d, expected %d")

	// ErrInvalidExpressionNumber is returned when the WithExpression method of a node
	// is called with an invalid number of arguments.
	ErrInvalidExpressionNumber = errors.NewKind("%T: invalid expression number, got %d, expected %d")

	// ErrInvalidChildType is returned when the WithChildren method of a
	// node or expression is called with an invalid child type. This error is indicative of a bug.
	ErrInvalidChildType = errors.NewKind("%T: invalid child type, got %T, expected %T")

	// ErrInvalidJSONText is returned when a JSON string cannot be parsed or unmarshalled
	ErrInvalidJSONText = errors.NewKind("Invalid JSON text in argument %d to function %s: \"%s\"")

	// ErrInvalidJSONArgument is returned when a JSON function is called with a parameter that is not JSON or a string
	ErrInvalidJSONArgument = errors.NewKind("invalid data type for JSON data in argument %d to function %s; a JSON string or JSON type is required")

	// ErrDeleteRowNotFound is returned when row being deleted was not found
	ErrDeleteRowNotFound = errors.NewKind("row was not found when attempting to delete")

	// ErrDuplicateAliasOrTable should be returned when a query contains a duplicate alias / table name.
	ErrDuplicateAliasOrTable = errors.NewKind("Not unique table/alias: %s")

	// ErrPrimaryKeyViolation is returned when a primary key constraint is violated
	// This is meant to wrap a sql.UniqueKey error, which provides the key string
	ErrPrimaryKeyViolation = errors.NewKind("duplicate primary key given")

	// ErrUniqueKeyViolation is returned when a unique key constraint is violated
	// This is meant to wrap a sql.UniqueKey error, which provides the key string
	ErrUniqueKeyViolation = errors.NewKind("duplicate unique key given")

	// ErrMisusedAlias is returned when a alias is defined and used in the same projection.
	ErrMisusedAlias = errors.NewKind("column %q does not exist in scope, but there is an alias defined in" +
		" this projection with that name. Aliases cannot be used in the same projection they're defined in")

	// ErrInvalidAsOfExpression is returned when an expression for AS OF cannot be used
	ErrInvalidAsOfExpression = errors.NewKind("expression %s cannot be used in AS OF")

	// ErrIncompatibleDefaultType is returned when a provided default cannot be coerced into the type of the column
	ErrIncompatibleDefaultType = errors.NewKind("incompatible type for default value")

	// ErrColumnDefaultDatetimeOnlyFunc is returned when a non datetime/timestamp column attempts to declare now/current_timestamp as a default value literal.
	ErrColumnDefaultDatetimeOnlyFunc = errors.NewKind("only datetime/timestamp may declare default values of now()/current_timestamp() without surrounding parentheses")

	// ErrColumnDefaultSubquery is returned when a default value contains a subquery.
	ErrColumnDefaultSubquery = errors.NewKind("default value on column `%s` may not contain subqueries")

	// ErrInvalidColumnDefaultValue is returned when column default function value is not wrapped in parentheses for column types excluding datetime and timestamp
	ErrInvalidColumnDefaultValue = errors.NewKind("Invalid default value for '%s'")

	// ErrColumnDefaultUserVariable is returned when a column default expression contains user or system variables
	ErrColumnDefaultUserVariable = errors.NewKind("Default value expression of column '%s' cannot refer user or system variables.")

	// ErrInvalidDefaultValueOrder is returned when a default value references a column that comes after it and contains a default expression.
	ErrInvalidDefaultValueOrder = errors.NewKind(`default value of column "%s" cannot refer to a column defined after it if those columns have an expression default value`)

	// ErrColumnDefaultReturnedNull is returned when a default expression evaluates to nil but the column is non-nullable.
	ErrColumnDefaultReturnedNull = errors.NewKind(`default value attempted to return null but column is non-nullable`)

	// ErrDropColumnReferencedInDefault is returned when a column cannot be dropped as it is referenced by another column's default value.
	ErrDropColumnReferencedInDefault = errors.NewKind(`cannot drop column "%s" as default value of column "%s" references it`)

	// ErrTriggersNotSupported is returned when attempting to create a trigger on a database that doesn't support them
	ErrTriggersNotSupported = errors.NewKind(`database "%s" doesn't support triggers`)

	// ErrTriggerCreateStatementInvalid is returned when a TriggerDatabase returns a CREATE TRIGGER statement that is invalid
	ErrTriggerCreateStatementInvalid = errors.NewKind(`Invalid CREATE TRIGGER statement: %s`)

	// ErrTriggerDoesNotExist is returned when a trigger does not exist.
	ErrTriggerDoesNotExist = errors.NewKind(`trigger "%s" does not exist`)

	// ErrTriggerTableInUse is returned when trigger execution calls for a table that invoked a trigger being updated by it
	ErrTriggerTableInUse = errors.NewKind("Can't update table %s in stored function/trigger because it is already used by statement which invoked this stored function/trigger")

	// ErrTriggerCannotBeDropped is returned when dropping a trigger would cause another trigger to reference a non-existent trigger.
	ErrTriggerCannotBeDropped = errors.NewKind(`trigger "%s" cannot be dropped as it is referenced by trigger "%s"`)

	// ErrStoredProceduresNotSupported is returned when attempting to create a stored procedure on a database that doesn't support them.
	ErrStoredProceduresNotSupported = errors.NewKind(`database "%s" doesn't support stored procedures`)

	// ErrVersionedStoredProceduresNotSupported is returned when attempting to retrieve a versioned stored procedure on a database that doesn't support them.
	ErrVersionedStoredProceduresNotSupported = errors.NewKind(`database "%s" doesn't support versioned stored procedures`)

	// ErrStoredProcedureAlreadyExists is returned when a stored procedure does not exist.
	ErrStoredProcedureAlreadyExists = errors.NewKind(`stored procedure "%s" already exists`)

	// ErrStoredProcedureDoesNotExist is returned when a stored procedure does not exist.
	ErrStoredProcedureDoesNotExist = errors.NewKind(`stored procedure "%s" does not exist`)

	// ErrProcedureCreateStatementInvalid is returned when a StoredProcedureDatabase returns a CREATE PROCEDURE statement that is invalid.
	ErrProcedureCreateStatementInvalid = errors.NewKind(`Invalid CREATE PROCEDURE statement: %s`)

	// ErrProcedureRecursiveCall is returned when a stored procedure has a CALL statement that refers to itself.
	ErrProcedureRecursiveCall = errors.NewKind("recursive CALL on stored procedure `%s`")

	// ErrProcedureNestedCallAsOf is returned when a stored procedure has a CALL ... AS OF statement, which is currently not allowed.
	ErrProcedureNestedCallAsOf = errors.NewKind("CALL ... AS OF in stored procedure `%s`")

	// ErrProcedureCallAsOfReadOnly is returned when a CALL ... AS OF statement attempts to modify a table.
	ErrProcedureCallAsOfReadOnly = errors.NewKind("CALL ... AS OF converts databases to read only")

	// ErrProcedureInvalidBodyStatement is returned when a stored procedure has a statement that is invalid inside of procedures.
	ErrProcedureInvalidBodyStatement = errors.NewKind("`%s` statements are invalid inside of stored procedures")

	// ErrExternalProcedureAmbiguousOverload is returned when an external stored procedure is overloaded and has two
	// functions with the same number of parameters.
	ErrExternalProcedureAmbiguousOverload = errors.NewKind("overloaded stored procedure `%s` may only have a single variant with `%d` parameters")

	// ErrExternalProcedureNonFunction is returned when an external stored procedure is given something other than the
	// expected function type.
	ErrExternalProcedureNonFunction = errors.NewKind("received `%T` in place of a function for an external stored procedure")

	// ErrExternalProcedureMissingContextParam is returned when an external stored procedure's first parameter is not
	// the context.
	ErrExternalProcedureMissingContextParam = errors.NewKind("external stored procedures require the first parameter to be the context")

	// ErrExternalProcedurePointerVariadic is returned when an external stored procedure's variadic parameter has a pointer type.
	ErrExternalProcedurePointerVariadic = errors.NewKind("an external stored procedures's variadiac parameter may not have a pointer type")

	// ErrExternalProcedureReturnTypes is returned when an external stored procedure's return types are incorrect.
	ErrExternalProcedureReturnTypes = errors.NewKind("external stored procedures must return a RowIter and error")

	// ErrExternalProcedureFirstReturn is returned when an external stored procedure's first return type is incorrect.
	ErrExternalProcedureFirstReturn = errors.NewKind("external stored procedures require the first return value to be the RowIter")

	// ErrExternalProcedureSecondReturn is returned when an external stored procedure's second return type is incorrect.
	ErrExternalProcedureSecondReturn = errors.NewKind("external stored procedures require the second return value to be the error")

	// ErrExternalProcedureInvalidParamType is returned when one of an external stored procedure's parameters have an
	// invalid type.
	ErrExternalProcedureInvalidParamType = errors.NewKind("external stored procedures do not support parameters with type `%s`")

	// ErrCallIncorrectParameterCount is returned when a CALL statement has the incorrect number of parameters.
	ErrCallIncorrectParameterCount = errors.NewKind("`%s` expected `%d` parameters but got `%d`")

	// ErrEventsNotSupported is returned when attempting to create an event on a database that doesn't support them.
	ErrEventsNotSupported = errors.NewKind("database '%s' doesn't support events")

	// ErrEventAlreadyExists is returned when an event does not exist.
	ErrEventAlreadyExists = errors.NewKind("Event '%s' already exists")

	// ErrEventDoesNotExist is returned when an event does not exist.
	ErrEventDoesNotExist = errors.NewKind("Event '%s' does not exist")

	// ErrUndceclaredVariable is return when a variable is undeclared.
	ErrUndeclaredVariable = errors.NewKind("Undeclared variable: %s")

	// ErrUnknownEvent is returned when a query references an event that doesn't exist
	ErrUnknownEvent = errors.NewKind("Unknown event '%s'")

	// ErrEventCreateStatementInvalid is returned when an EventDatabase returns a CREATE EVENT statement that is invalid
	ErrEventCreateStatementInvalid = errors.NewKind(`Invalid CREATE TRIGGER statement: %s`)

	// ErrUnknownSystemVariable is returned when a query references a system variable that doesn't exist
	ErrUnknownSystemVariable = errors.NewKind(`Unknown system variable '%s'`)

	// ErrUnknownStatusVariable is returned when a query references a status variable that doesn't exist
	ErrUnknownStatusVariable = errors.NewKind(`Unknown status variable '%s'`)

	// ErrUnknownUserVariable is returned when a query references a user variable that doesn't exist
	ErrUnknownUserVariable = errors.NewKind(`Unknown user variable '%s'`)

	// ErrSystemVariableReadOnly is returned when attempting to set a value to a non-Dynamic system variable.
	ErrSystemVariableReadOnly = errors.NewKind(`Variable '%s' is a read only variable`)

	ErrSystemVariableReinitialized = errors.NewKind(`Variable '%s' was initialized more than 1x`)

	// ErrSystemVariableSessionOnly is returned when attempting to set a SESSION-only variable using SET GLOBAL.
	ErrSystemVariableSessionOnly = errors.NewKind(`Variable '%s' is a SESSION variable and can't be used with SET GLOBAL`)

	// ErrSystemVariableGlobalOnly is returned when attempting to set a GLOBAL-only variable using SET SESSION.
	ErrSystemVariableGlobalOnly = errors.NewKind(`Variable '%s' is a GLOBAL variable and should be set with SET GLOBAL`)

	// ErrUserVariableNoDefault is returned when attempting to set the default value on a user variable.
	ErrUserVariableNoDefault = errors.NewKind(`User variable '%s' does not have a default value`)

	// ErrInvalidUseOfOldNew is returned when a trigger attempts to make use of OLD or NEW references when they don't exist
	ErrInvalidUseOfOldNew = errors.NewKind("There is no %s row in on %s trigger")

	// ErrInvalidUpdateOfOldRow is returned when a trigger attempts to assign to an old row's value with SET
	ErrInvalidUpdateOfOldRow = errors.NewKind("Updating of old row is not allowed in trigger")

	// ErrInvalidUpdateInAfterTrigger is returned when a trigger attempts to assign to a new row in an AFTER trigger
	ErrInvalidUpdateInAfterTrigger = errors.NewKind("Updating of new row is not allowed in after trigger")

	// ErrUnknownColumn is returned when the given column is not found in referenced table
	ErrUnknownColumn = errors.NewKind("Unknown column '%s' in '%s'")

	// ErrUnboundPreparedStatementVariable is returned when a query is executed without a binding for one its variables.
	ErrUnboundPreparedStatementVariable = errors.NewKind(`unbound variable "%s" in query`)

	// ErrUnknownPreparedStatement is returned when an unknown query is executed.
	ErrUnknownPreparedStatement = errors.NewKind(`Unknown prepared statement handler (%s) given to EXECUTE`)

	// ErrTruncateReferencedFromForeignKey is returned when a table is referenced in a foreign key and TRUNCATE is called on it.
	ErrTruncateReferencedFromForeignKey = errors.NewKind("cannot truncate table %s as it is referenced in foreign key %s on table %s")

	// ErrInvalidColTypeDefinition is returned when a column type-definition has argument violations.
	ErrInvalidColTypeDefinition = errors.NewKind("column %s type definition is invalid: %s")

	// ErrDatabaseExists is returned when CREATE DATABASE attempts to create a database that already exists.
	ErrDatabaseExists = errors.NewKind("can't create database %s; database exists")

	// ErrDatabaseSchemaExists is returned when CREATE SCHEMA attempts to create a schema that already exists.
	ErrDatabaseSchemaExists = errors.NewKind("can't create schema %s; schema exists")

	// ErrDatabaseNoDatabaseSchemaSelectedCreate is returned when CREATE TABLE is called without a schema selected and one is required.
	ErrDatabaseNoDatabaseSchemaSelectedCreate = errors.NewKind("no schema has been selected to create in")

	// ErrInvalidDatabaseName is returned when a database name is invalid.
	ErrInvalidDatabaseName = errors.NewKind("invalid database name: %s")

	// ErrInvalidConstraintFunctionNotSupported is returned when a CONSTRAINT CHECK is called with an unsupported function expression.
	ErrInvalidConstraintFunctionNotSupported = errors.NewKind("Invalid constraint expression, function not supported: %s")

	// ErrInvalidConstraintSubqueryNotSupported is returned when a CONSTRAINT CHECK is called with a sub-query expression.
	ErrInvalidConstraintSubqueryNotSupported = errors.NewKind("Invalid constraint expression, sub-queries not supported: %s")

	// ErrCheckConstraintViolated is returned when a CONSTRAINT CHECK is called with a sub-query expression.
	ErrCheckConstraintViolated = errors.NewKind("Check constraint %q violated")

	// ErrCheckConstraintInvalidatedByColumnAlter is returned when an alter column statement would invalidate a check constraint.
	ErrCheckConstraintInvalidatedByColumnAlter = errors.NewKind("can't alter column %q because it would invalidate check constraint %q")

	// ErrColumnCountMismatch is returned when a view, derived table or common table expression has a declared column
	// list with a different number of columns than the schema of the table.
	ErrColumnCountMismatch = errors.NewKind("In definition of view, derived table or common table expression, SELECT list and column names list have different column counts")

	// ErrColValCountMismatch is returned when not all rows in values constructor are of equal length.
	ErrColValCountMismatch = errors.NewKind("Column count doesn't match value count at row %d")

	// ErrUuidUnableToParse is returned when a UUID is unable to be parsed.
	ErrUuidUnableToParse = errors.NewKind("unable to parse '%s' to UUID: %s")

	// ErrLoadDataCannotOpen is returned when a LOAD DATA operation is unable to open the file specified.
	ErrLoadDataCannotOpen = errors.NewKind("LOAD DATA is unable to open file: %s")

	// ErrLoadDataCharacterLength is returned when a symbol is of the wrong character length for a LOAD DATA operation.
	ErrLoadDataCharacterLength = errors.NewKind("%s must be 1 character long")

	// ErrJSONObjectAggNullKey is returned when JSON_OBJECTAGG is run on a table with NULL keys
	ErrJSONObjectAggNullKey = errors.NewKind("JSON documents may not contain NULL member names")

	// ErrDeclareConditionOrderInvalid is returned when a DECLARE ... CONDITION statement is at an invalid location.
	ErrDeclareConditionOrderInvalid = errors.NewKind("DECLARE ... CONDITION may only exist at the beginning of a BEGIN/END block")

	// ErrDeclareVariableOrderInvalid is returned when a DECLARE statement, for variables, is at an invalid location.
	ErrDeclareVariableOrderInvalid = errors.NewKind("DECLARE variables may only exist at the beginning of a BEGIN/END block")

	// ErrDeclareCursorOrderInvalid is returned when a DECLARE ... CURSOR statement is at an invalid location.
	ErrDeclareCursorOrderInvalid = errors.NewKind("DECLARE ... CURSOR may only exist at the beginning of a BEGIN/END block, following all variables and conditions")

	// ErrDeclareHandlerOrderInvalid is returned when a DECLARE ... HANDLER statement is at an invalid location.
	ErrDeclareHandlerOrderInvalid = errors.NewKind("DECLARE ... HANDLER may only exist at the beginning of a BEGIN/END block, following all variables, conditions, and cursors")

	// ErrDeclareConditionNotFound is returned when SIGNAL/RESIGNAL references a non-existent DECLARE CONDITION.
	ErrDeclareConditionNotFound = errors.NewKind("condition %s does not exist")

	// ErrDeclareConditionDuplicate is returned when a DECLARE CONDITION statement with the same name was declared in the current scope.
	ErrDeclareConditionDuplicate = errors.NewKind("duplicate condition '%s'")

	// ErrDeclareVariableDuplicate is returned when a DECLARE statement reuses an existing variable name in the current scope.
	ErrDeclareVariableDuplicate = errors.NewKind("duplicate variable '%s'")

	// ErrDeclareCursorDuplicate is returned when a DECLARE ... CURSOR statement reuses an existing name in the current scope.
	ErrDeclareCursorDuplicate = errors.NewKind("duplicate cursor '%s'")

	// ErrDeclareHandlerDuplicate is returned when a DECLARE ... HANDLER statement has a duplicate in the same block.
	ErrDeclareHandlerDuplicate = errors.NewKind("duplicate handler declared in the same block")

	// ErrDeclareHandlerUndo is returned when a DECLARE ... HANDLER statement has the UNDO action, which is currently unsupported.
	ErrDeclareHandlerUndo = errors.NewKind("DECLARE ... HANDLER does not support the UNDO action")

	// ErrLoopRedefinition is returned when a loop with the same label has already been declared in the current block.
	ErrLoopRedefinition = errors.NewKind("redefining label '%s'")

	// ErrLoopLabelNotFound is returned when a control flow statement references a non-existent loop.
	ErrLoopLabelNotFound = errors.NewKind("%s with no matching label: '%s'")

	// ErrCursorNotFound is returned when a CURSOR cannot be found.
	ErrCursorNotFound = errors.NewKind("cursor '%s' does not exist")

	// ErrCursorAlreadyOpen is returned when a CURSOR is already open.
	ErrCursorAlreadyOpen = errors.NewKind("cursor '%s' is already open")

	// ErrCursorNotOpen is returned when a CURSOR has not yet been opened.
	ErrCursorNotOpen = errors.NewKind("cursor '%s' is not open")

	// ErrFetchIncorrectCount is returned when a FETCH does not use the correct number of variables.
	ErrFetchIncorrectCount = errors.NewKind("incorrect number of FETCH variables")

	// ErrSignalOnlySqlState is returned when SIGNAL/RESIGNAL references a DECLARE CONDITION for a MySQL error code.
	ErrSignalOnlySqlState = errors.NewKind("SIGNAL/RESIGNAL can only use a condition defined with SQLSTATE")

	// ErrExpectedSingleRow is returned when a subquery executed in normal queries or aggregation function returns
	// more than 1 row without an attached IN clause.
	ErrExpectedSingleRow = errors.NewKind("the subquery returned more than 1 row")

	// ErrUnknownConstraint is returned when a DROP CONSTRAINT statement refers to a constraint that doesn't exist
	ErrUnknownConstraint = errors.NewKind("Constraint %q does not exist")

	// ErrInsertIntoNonNullableDefaultNullColumn is returned when an INSERT excludes a field which is non-nullable and has no default/autoincrement.
	ErrInsertIntoNonNullableDefaultNullColumn = errors.NewKind("Field '%s' doesn't have a default value")

	// ErrAlterTableNotSupported is thrown when the table doesn't support ALTER TABLE statements
	ErrAlterTableNotSupported = errors.NewKind("table %s cannot be altered")

	// ErrAlterTableCollationNotSupported is thrown when the table doesn't support ALTER TABLE COLLATE statements
	ErrAlterTableCollationNotSupported = errors.NewKind("table %s cannot have its collation altered")

	// ErrAlterTableCommentNotSupported is thrown when the table doesn't support ALTER TABLE COMMENT statements
	ErrAlterTableCommentNotSupported = errors.NewKind("table %s cannot have its comment altered")

	// ErrCollationNotSupportedOnUniqueTextIndex is thrown when a unique index is created on a TEXT column, with no
	// prefix length specified, and the collation is case-insensitive or accent-insensitive, meaning we can't
	// reliably use a content-hashed field to detect uniqueness.
	ErrCollationNotSupportedOnUniqueTextIndex = errors.NewKind("unable to create a unique index on TEXT columns without " +
		"a prefix length specified when using a case-insensitive or accent-insensitive collation")

	// ErrPartitionNotFound is thrown when a partition key on a table is not found
	ErrPartitionNotFound = errors.NewKind("partition not found %q")

	// ErrInsertIntoNonNullableProvidedNull is called when a null value is inserted into a non-nullable column
	ErrInsertIntoNonNullableProvidedNull = errors.NewKind("column name '%v' is non-nullable but attempted to set a value of null")

	// ErrForeignKeyChildViolation is called when a rows is added but there is no parent row, and a foreign key constraint fails. Add the parent row first.
	ErrForeignKeyChildViolation = errors.NewKind("cannot add or update a child row - Foreign key violation on fk: `%s`, table: `%s`, referenced table: `%s`, key: `%s`")

	// ErrForeignKeyParentViolation is called when a parent row that is deleted has children, and a foreign key constraint fails. Delete the children first.
	ErrForeignKeyParentViolation = errors.NewKind("cannot delete or update a parent row - Foreign key violation on fk: `%s`, table: `%s`, referenced table: `%s`, key: `%s`")

	// ErrForeignKeyColumnCountMismatch is called when the declared column and referenced column counts do not match.
	ErrForeignKeyColumnCountMismatch = errors.NewKind("the foreign key must reference an equivalent number of columns")

	// ErrForeignKeyColumnTypeMismatch is returned when the declared column's type and referenced column's type do not match.
	ErrForeignKeyColumnTypeMismatch = errors.NewKind("column type mismatch on `%s` and `%s`")

	// ErrForeignKeyNotResolved is called when an add or update is attempted on a foreign key that has not been resolved yet.
	ErrForeignKeyNotResolved = errors.NewKind("cannot add or update a child row: a foreign key constraint fails (`%s`.`%s`, CONSTRAINT `%s` FOREIGN KEY (`%s`) REFERENCES `%s` (`%s`))")

	// ErrNoForeignKeySupport is returned when the table does not support FOREIGN KEY operations.
	ErrNoForeignKeySupport = errors.NewKind("the table does not support foreign key operations: %s")

	// ErrForeignKeyMissingColumns is returned when an ALTER TABLE ADD FOREIGN KEY statement does not provide any columns
	ErrForeignKeyMissingColumns = errors.NewKind("cannot create a foreign key without columns")

	// ErrForeignKeyDropColumn is returned when attempting to drop a column used in a foreign key
	ErrForeignKeyDropColumn = errors.NewKind("cannot drop column `%s` as it is used in foreign key `%s`")

	// ErrForeignKeyDropTable is returned when attempting to drop a table used in a foreign key
	ErrForeignKeyDropTable = errors.NewKind("cannot drop table `%s` as it is referenced in foreign key `%s`")

	// ErrForeignKeyDropIndex is returned when attempting to drop an index used in a foreign key when there are no other
	// indexes which may be used in its place.
	ErrForeignKeyDropIndex = errors.NewKind("cannot drop index: `%s` is used by foreign key `%s`")

	// ErrForeignKeyDuplicateName is returned when a foreign key already exists with the given name.
	ErrForeignKeyDuplicateName = errors.NewKind("duplicate foreign key constraint name `%s`")

	// ErrAddForeignKeyDuplicateColumn is returned when an ALTER TABLE ADD FOREIGN KEY statement has the same column multiple times
	ErrAddForeignKeyDuplicateColumn = errors.NewKind("cannot have duplicates of columns in a foreign key: `%v`")

	// ErrTemporaryTablesForeignKeySupport is returned when a user tries to create a temporary table with a foreign key
	ErrTemporaryTablesForeignKeySupport = errors.NewKind("temporary tables do not support foreign keys")

	// ErrForeignKeyNotFound is returned when a foreign key was not found.
	ErrForeignKeyNotFound = errors.NewKind("foreign key `%s` was not found on the table `%s`")

	// ErrForeignKeySetDefault is returned when attempting to set a referential action as SET DEFAULT.
	ErrForeignKeySetDefault = errors.NewKind(`"SET DEFAULT" is not supported`)

	// ErrForeignKeySetNullNonNullable is returned when attempting to set a referential action as SET NULL when the
	// column is non-nullable.
	ErrForeignKeySetNullNonNullable = errors.NewKind("cannot use SET NULL as column `%s` is non-nullable")

	// ErrForeignKeyTypeChangeSetNull is returned when attempting to change a column's type to disallow NULL values when
	// a foreign key referential action is SET NULL.
	ErrForeignKeyTypeChangeSetNull = errors.NewKind("column `%s` must allow NULL values as foreign key `%s` has SET NULL")

	// ErrForeignKeyMissingReferenceIndex is returned when the referenced columns in a foreign key do not have an index.
	ErrForeignKeyMissingReferenceIndex = errors.NewKind("missing index for foreign key `%s` on the referenced table `%s`")

	// ErrForeignKeyTextBlob is returned when a TEXT or BLOB column is used in a foreign key, which are not valid types.
	ErrForeignKeyTextBlob = errors.NewKind("TEXT/BLOB are not valid types for foreign keys")

	// ErrForeignKeyTypeChange is returned when attempting to change the type of some column used in a foreign key.
	ErrForeignKeyTypeChange = errors.NewKind("unable to change type of column `%s` as it is used by foreign keys")

	// ErrForeignKeyDepthLimit is returned when the CASCADE depth limit has been reached.
	ErrForeignKeyDepthLimit = errors.NewKind("Foreign key cascade delete/update exceeds max depth of 15.")

	// ErrDuplicateKey is returned when a duplicate key is defined on a table.
	ErrDuplicateKey = errors.NewKind("Duplicate key name '%s'")

	// ErrDuplicateEntry is returns when a duplicate entry is placed on an index such as a UNIQUE or a Primary Key.
	ErrDuplicateEntry = errors.NewKind("Duplicate entry for key '%s'")

	// ErrDuplicateColumn is returned when a table has two columns with the same name.
	ErrDuplicateColumn = errors.NewKind("duplicate column name: `%s`")

	// ErrInvalidIdentifier is returned when an identifier is invalid
	ErrInvalidIdentifier = errors.NewKind("invalid identifier: `%s`")

	// ErrIdentifierIsTooLong is returned when creating a resource, but the identifier is longer than a name limit
	ErrIdentifierIsTooLong = errors.NewKind("Identifier name '%s' is too long")

	// ErrInvalidArgument is returned when an argument to a function is invalid.
	ErrInvalidArgument = errors.NewKind("Invalid argument to %s")

	// ErrInvalidArgumentType is thrown when a function receives invalid argument types
	ErrInvalidArgumentType = errors.NewKind("function '%s' received invalid argument types")

	// ErrInvalidArgumentDetails is returned when the argument is invalid with details of a specific function
	ErrInvalidArgumentDetails = errors.NewKind("Invalid argument to %s: %s")

	// ErrSavepointDoesNotExist is returned when a RELEASE SAVEPOINT or ROLLBACK TO SAVEPOINT statement references a
	// non-existent savepoint identifier
	ErrSavepointDoesNotExist = errors.NewKind("SAVEPOINT %s does not exist")

	// ErrTemporaryTableNotSupported is thrown when an integrator attempts to create a temporary tables without temporary table
	// support.
	ErrTemporaryTableNotSupported = errors.NewKind("database does not support temporary tables")

	// ErrInvalidSyntax is returned for syntax errors that aren't picked up by the parser, e.g. the wrong type of
	// expression used in part of statement.
	ErrInvalidSyntax = errors.NewKind("Invalid syntax: %s")

	// ErrTableCopyingNotSupported is returned when a table invokes the TableCopierDatabase interface's
	// CopyTableData method without supporting the interface
	ErrTableCopyingNotSupported = errors.NewKind("error: Table copying not supported")

	// ErrMultiplePrimaryKeysDefined is returned when a table invokes CreatePrimaryKey with a primary key already
	// defined.
	ErrMultiplePrimaryKeysDefined = errors.NewKind("error: Multiple primary keys defined")

	// ErrWrongAutoKey is returned when a table invokes DropPrimaryKey without first removing the auto increment property
	// (if it exists) on it.
	ErrWrongAutoKey = errors.NewKind("error: incorrect table definition: there can be only one auto column and it must be defined as a key")

	// ErrKeyColumnDoesNotExist is returned when a table invoked CreatePrimaryKey with a non-existent column.
	ErrKeyColumnDoesNotExist = errors.NewKind("key column '%s' doesn't exist in table")

	// ErrCantDropFieldOrKey is returned when a table invokes DropPrimaryKey on a keyless table.
	ErrCantDropFieldOrKey = errors.NewKind("error: can't drop '%s'; check that column/key exists")

	// ErrCantDropIndex is return when a table can't drop an index due to a foreign key relationship.
	ErrCantDropIndex = errors.NewKind("error: can't drop index '%s': needed in foreign key constraint %s")

	// ErrImmutableDatabaseProvider is returned when attempting to edit an immutable database databaseProvider.
	ErrImmutableDatabaseProvider = errors.NewKind("error: can't modify database databaseProvider")

	// ErrInvalidValue is returned when a given value does not match what is expected.
	ErrInvalidValue = errors.NewKind(`error: '%v' is not a valid value for '%v'`)

	// ErrInvalidValueType is returned when a given value's type does not match what is expected.
	ErrInvalidValueType = errors.NewKind(`error: '%T' is not a valid value type for '%v'`)

	// ErrFunctionNotFound is thrown when a function is not found
	ErrFunctionNotFound = errors.NewKind("function: '%s' not found")

	// ErrConflictingExternalQuery is thrown when a scope's parent has a conflicting sort or limit node
	ErrConflictingExternalQuery = errors.NewKind("found external scope with conflicting ORDER BY/LIMIT")

	// ErrTableFunctionNotFound is thrown when a table function is not found
	ErrTableFunctionNotFound = errors.NewKind("table function: '%s' not found")

	// ErrNonAggregatedColumnWithoutGroupBy is thrown when an aggregate function is used with the implicit, all-rows
	// grouping and another projected expression contains a non-aggregated column.
	// MySQL error code: 1140, SQL state: 42000
	ErrNonAggregatedColumnWithoutGroupBy = errors.NewKind("in aggregated query without GROUP BY, expression #%d of SELECT list contains nonaggregated column '%s'; " +
		"this is incompatible with sql_mode=only_full_group_by")

	// ErrInvalidArgumentNumber is returned when the number of arguments to call a
	// function is different from the function arity.
	ErrInvalidArgumentNumber = errors.NewKind("function '%s' expected %v arguments, %v received")

	// ErrDatabaseNotFound is thrown when a database is not found
	ErrDatabaseNotFound = errors.NewKind("database not found: %s")

	// ErrDatabaseSchemaNotFound is thrown when a database schema is not found
	ErrDatabaseSchemaNotFound = errors.NewKind("database schema not found: %s")

	// ErrDatabaseSchemasNotSupported is thrown when a database does not support schemas
	ErrDatabaseSchemasNotSupported = errors.NewKind("database '%s' does not support schemas")

	// ErrNoDatabaseSelected is thrown when a database is not selected and the query requires one
	ErrNoDatabaseSelected = errors.NewKind("no database selected")

	// ErrAsOfNotSupported is thrown when an AS OF query is run on a database that can't support it
	ErrAsOfNotSupported = errors.NewKind("AS OF not supported for database %s")

	// ErrIncompatibleAsOf is thrown when an AS OF clause is used in an incompatible manner, such as when using an AS OF
	// expression with a view when the view definition has its own AS OF expressions.
	ErrIncompatibleAsOf = errors.NewKind("incompatible use of AS OF: %s")

	// ErrPidAlreadyUsed is returned when the pid is already registered.
	ErrPidAlreadyUsed = errors.NewKind("pid %d is already in use")

	// ErrInvalidOperandColumns is returned when the columns in the left
	// operand and the elements of the right operand don't match. Also
	// returned for invalid number of columns in projections, filters,
	// joins, etc.
	ErrInvalidOperandColumns = errors.NewKind("operand should have %d columns, but has %d")

	// ErrReadOnlyTransaction is returned when a write query is executed in a READ ONLY transaction.
	ErrReadOnlyTransaction = errors.NewKind("cannot execute statement in a READ ONLY transaction")

	// ErrLockDeadlock is the go-mysql-server equivalent of ER_LOCK_DEADLOCK. Transactions throwing this error
	// are automatically rolled back. Clients receiving this error must retry the transaction.
	ErrLockDeadlock = errors.NewKind("serialization failure: %s, try restarting transaction.")

	// ErrViewCreateStatementInvalid is returned when a ViewDatabase returns a CREATE VIEW statement that is invalid
	ErrViewCreateStatementInvalid = errors.NewKind(`Invalid CREATE VIEW statement: %s`)

	// ErrViewsNotSupported is returned when attempting to access a view on a database that doesn't support them.
	ErrViewsNotSupported = errors.NewKind("database '%s' doesn't support views")

	// ErrExpectedTableFoundView is returned when attempting to rename a view using ALTER TABLE statement.
	ErrExpectedTableFoundView = errors.NewKind("expected a table and found view: '%s' ")

	// ErrExistingView is returned when a CREATE VIEW statement uses a name that already exists
	ErrExistingView = errors.NewKind("the view %s.%s already exists")

	// ErrViewDoesNotExist is returned when a DROP VIEW statement drops a view that does not exist
	ErrViewDoesNotExist = errors.NewKind("the view %s.%s does not exist")

	// ErrSessionDoesNotSupportPersistence is thrown when a feature is not already supported
	ErrSessionDoesNotSupportPersistence = errors.NewKind("session does not support persistence")

	// ErrInvalidGISData is thrown when a "ST_<spatial_type>FromText" function receives a malformed string
	ErrInvalidGISData = errors.NewKind("invalid GIS data provided to function %s")

	// ErrIllegalGISValue is thrown when a spatial type constructor receives a non-geometric when one should be provided
	ErrIllegalGISValue = errors.NewKind("illegal non geometric '%v' value found during parsing")

	// ErrDiffSRIDs is thrown when comparing two spatial types that have different SRIDs when they should be the same
	ErrDiffSRIDs = errors.NewKind("binary geometry function %s given two geometries of different srids: %v and %v, which should have been identical")

	// ErrUnsupportedSRID is thrown for spatial functions over unsupported SRIDs
	ErrUnsupportedSRID = errors.NewKind("SRID %v has not been implemented for geographic spatial reference systems.")

	// ErrSRIDOnNonGeomCol is thrown when attempting to define SRID over a non-geometry column
	ErrSRIDOnNonGeomCol = errors.NewKind("incorrect usage of SRID and non-geometry column")

	// ErrTooManyKeyParts is thrown when creating an index with too many columns
	ErrTooManyKeyParts = errors.NewKind("too many key parts specified; max %d parts allowed")

	// ErrNullableSpatialIdx is thrown when creating a SPATIAL index with a nullable column
	ErrNullableSpatialIdx = errors.NewKind("All parts of a SPATIAL index must be NOT NULL")

	// ErrBadSpatialIdxCol is thrown when attempting to define a SPATIAL index over a non-geometry column
	ErrBadSpatialIdxCol = errors.NewKind("a SPATIAL index may only contain a geometrical type column")

	// ErrNoSRID is thrown when attempting to create a Geometry with a non-existent SRID
	ErrNoSRID = errors.NewKind("There's no spatial reference with SRID %d")

	// ErrInvalidSRID is thrown when attempting to create a Geometry with an invalid SRID
	ErrInvalidSRID = errors.NewKind("SRID value is out of range in %s")

	// ErrSpatialRefSysAlreadyExists is thrown when attempting to create a spatial reference system with an existing SRID
	ErrSpatialRefSysAlreadyExists = errors.NewKind("There is already a spatial reference system with SRID %v")

	// ErrUnsupportedGISTypeForSpatialFunc is a temporary error because geometry is hard
	// TODO: remove this error when all types are full supported by spatial type functions
	ErrUnsupportedGISTypeForSpatialFunc = errors.NewKind("unsupported spatial type: %s for function %s")

	// ErrUnsupportedGISType is thrown when attempting to convert an unsupported geospatial value to a geometry struct
	ErrUnsupportedGISType = errors.NewKind("unsupported geospatial type: %s from value: 0x%s")

	// ErrUnsupportedSyntax is returned when syntax that parses correctly is not supported
	ErrUnsupportedSyntax = errors.NewKind("unsupported syntax: %s")

	// ErrInvalidSQLValType is returned when a SQL value is of the incorrect type during parsing
	ErrInvalidSQLValType = errors.NewKind("invalid SQLVal of type: %d")

	// ErrUnknownIndexColumn is returned when a column in an index is not in the table
	ErrUnknownIndexColumn = errors.NewKind("unknown column: '%s' in index '%s'")

	// ErrInvalidAutoIncCols is returned when an auto_increment column cannot be applied
	ErrInvalidAutoIncCols = errors.NewKind("there can be only one auto_increment column and it must be defined as a key")

	// ErrInvalidColumnSpecifier is returned when an invalid column specifier is used
	ErrInvalidColumnSpecifier = errors.NewKind("Incorrect column specifier for column '%s'")

	// ErrUnknownConstraintDefinition is returned when an unknown constraint type is used
	ErrUnknownConstraintDefinition = errors.NewKind("unknown constraint definition: %s, %T")

	// ErrInvalidCheckConstraint is returned when a check constraint is defined incorrectly
	ErrInvalidCheckConstraint = errors.NewKind("invalid constraint definition: %s")

	// ErrUserCreationFailure is returned when attempting to create a user and it fails for any reason.
	ErrUserCreationFailure = errors.NewKind("Operation CREATE USER failed for %s")

	// ErrUserNameTooLong is returned when a CREATE USER statement uses a name that is longer than 32 chars.
	ErrUserNameTooLong = errors.NewKind("String '%s' is too long for user name (should be no longer than 32)")

	// ErrUserHostTooLong is returned when a CREATE USER statement uses a host that is longer than 255 chars.
	ErrUserHostTooLong = errors.NewKind("String '%s' is too long for host name (should be no longer than 255)")

	// ErrUserAlterFailure is returned when attempting to alter a user and it fails for any reason.
	ErrUserAlterFailure = errors.NewKind("Operation ALTER USER failed for %s")

	// ErrRoleCreationFailure is returned when attempting to create a role and it fails for any reason.
	ErrRoleCreationFailure = errors.NewKind("Operation CREATE ROLE failed for %s")

	// ErrUserDeletionFailure is returned when attempting to create a user and it fails for any reason.
	ErrUserDeletionFailure = errors.NewKind("Operation DROP USER failed for %s")

	// ErrRoleDeletionFailure is returned when attempting to create a role and it fails for any reason.
	ErrRoleDeletionFailure = errors.NewKind("Operation DROP ROLE failed for %s")

	// ErrDatabaseAccessDeniedForUser is returned when attempting to access a database that the user does not have
	// permission for, regardless of whether that database actually exists.
	ErrDatabaseAccessDeniedForUser = errors.NewKind("Access denied for user %s to database '%s'")

	// ErrTableAccessDeniedForUser is returned when attempting to access a table that the user does not have permission
	// for, regardless of whether that table actually exists.
	ErrTableAccessDeniedForUser = errors.NewKind("Access denied for user %s to table '%s'")

	// ErrPrivilegeCheckFailed is returned when a user does not have the correct privileges to perform an operation.
	ErrPrivilegeCheckFailed = errors.NewKind("command denied to user %s")

	// ErrGrantUserDoesNotExist is returned when a user does not exist when attempting to grant them privileges.
	ErrGrantUserDoesNotExist = errors.NewKind("You are not allowed to create a user with GRANT")

	// ErrRevokeUserDoesNotExist is returned when a user does not exist when attempting to revoke privileges from them.
	ErrRevokeUserDoesNotExist = errors.NewKind("There is no such grant defined for user '%s' on host '%s'")

	// ErrGrantRevokeRoleDoesNotExist is returned when a user or role does not exist when attempting to grant or revoke roles.
	ErrGrantRevokeRoleDoesNotExist = errors.NewKind("Unknown authorization ID %s")

	// ErrShowGrantsUserDoesNotExist is returned when a user does not exist when attempting to show their grants.
	ErrShowGrantsUserDoesNotExist = errors.NewKind("There is no such grant defined for user '%s' on host '%s'")

	// ErrRecursiveCTEMissingUnion is returned when a recursive CTE is not a UNION or UNION ALL node.
	ErrRecursiveCTEMissingUnion = errors.NewKind("Recursive Common Table Expression '%s' should contain a UNION")

	// ErrRecursiveCTENotUnion is returned when an INTERSECT or EXCEPT includes a Recursive CTE.
	ErrRecursiveCTENotUnion = errors.NewKind("Recursive table reference in EXCEPT or INTERSECT operand is not allowed")

	// ErrCteRecursionLimitExceeded is returned when a recursive CTE's execution stack depth exceeds the static limit.
	ErrCteRecursionLimitExceeded = errors.NewKind("WITH RECURSIVE iteration limit exceeded")

	// ErrGrantRevokeIllegalPrivilege is returned when a GRANT or REVOKE statement is malformed, or attempts to use privilege incorrectly.
	ErrGrantRevokeIllegalPrivilege = errors.NewKind("Illegal GRANT/REVOKE command")

	// ErrGrantRevokeIllegalPrivilegeWithMessage is returned when a GRANT or REVOKE statement is malformed, or attempts
	// to use privilege incorrectly and an additional message needs to be provided to the user.
	ErrGrantRevokeIllegalPrivilegeWithMessage = errors.NewKind("Illegal GRANT/REVOKE command: %s")

	// ErrInvalidWindowInheritance is returned when a window and its dependency contains conflicting partitioning, ordering, or framing clauses
	ErrInvalidWindowInheritance = errors.NewKind("window '%s' cannot inherit '%s' since %s")

	// ErrCircularWindowInheritance is returned when a WINDOW clause has a circular dependency
	ErrCircularWindowInheritance = errors.NewKind("there is a circularity in the window dependency graph")

	// ErrCannotCopyWindowFrame is returned when we inherit a window frame with a frame clause (replacement without parenthesis is OK)
	ErrCannotCopyWindowFrame = errors.NewKind("cannot copy window '%s' because it has a frame clause")

	// ErrUnknownWindowName is returned when an over by clause references an unknown window definition
	ErrUnknownWindowName = errors.NewKind("named window not found: '%s'")

	// ErrUnexpectedNilRow is returned when an invalid operation is applied to an empty row
	ErrUnexpectedNilRow = errors.NewKind("unexpected nil row")

	// ErrMoreThanOneRow is returned when the result consists of multiple rows, when only one row is expected
	ErrMoreThanOneRow = errors.NewKind("Result consisted of more than one row")

	// ErrColumnNumberDoesNotMatch is returned when the number of columns in result does not match expected number of variables
	ErrColumnNumberDoesNotMatch = errors.NewKind("The used SELECT statements have a different number of columns")

	// ErrUnsupportedJoinFactorCount is returned for a query with more commutable join tables than we support
	ErrUnsupportedJoinFactorCount = errors.NewKind("unsupported join factor count: expected fewer than %d tables, found %d")

	// ErrSecureFilePriv is returned when an outfile/dumpfile path is invalid or not under the secure-file-priv directory
	ErrSecureFilePriv = errors.NewKind("The MySQL server is running with the --secure-file-priv option so it cannot execute this statement")

	// ErrFileExists is returned when a file already exists
	ErrFileExists = errors.NewKind("File '%s' already exists")

	// ErrUnexpectedSeparator is returned when an invalid separator is used
	ErrUnexpectedSeparator = errors.NewKind("Field separator argument is not what is expected; check the manual")

	// ErrNotMatchingSRID is returned for SRID values not matching
	ErrNotMatchingSRID = errors.NewKind("The SRID of the geometry is %v, but the SRID of the column is %v. Consider changing the SRID of the geometry or the SRID property of the column.")

	// ErrNotMatchingSRIDWithColName is returned for error of SRID values not matching with column name detail
	ErrNotMatchingSRIDWithColName = errors.NewKind("The SRID of the geometry does not match the SRID of the column '%s'. %v")

	// ErrSpatialTypeConversion is returned when one spatial type cannot be converted to the other spatial type
	ErrSpatialTypeConversion = errors.NewKind("Cannot get geometry object from data you sent to the GEOMETRY field")

	// ErrUnsupportedIndexPrefix is returned for an index on a string column with a prefix
	ErrUnsupportedIndexPrefix = errors.NewKind("prefix index on string column '%s' unsupported")

	// ErrInvalidIndexPrefix is returned for an index prefix on a non-string column, or the prefix is longer than string itself, or just unsupported
	ErrInvalidIndexPrefix = errors.NewKind("incorrect prefix key '%s'; the used key part isn't a string, the used length is longer than the key part, or the storage engine doesn't support unique prefix keys")

	// ErrInvalidBlobTextKey is returned for an index on a blob or text column with no key length specified
	ErrInvalidBlobTextKey = errors.NewKind("blob/text column '%s' used in key specification without a key length")

	// ErrKeyTooLong is returned for an index on a blob or text column that is longer than 3072 bytes
	ErrKeyTooLong = errors.NewKind("specified key was too long; max key length is 3072 bytes")

	// ErrKeyZero is returned for an index on a blob or text column that is 0 in length
	ErrKeyZero = errors.NewKind("key part '%s' length cannot be 0")

	// ErrDatabaseWriteLocked is returned when a database is locked in read-only mode to avoid
	// conflicts with an active server
	ErrDatabaseWriteLocked = errors.NewKind("database is locked to writes")

	// ErrCollationMalformedString is returned when a malformed string is encountered during a collation-related operation.
	ErrCollationMalformedString = errors.NewKind("malformed string encountered while %s")

	// ErrCollatedExprWrongType is returned when the wrong type is given to a CollatedExpression.
	ErrCollatedExprWrongType = errors.NewKind("wrong type in collated expression")

	// ErrCollationInvalidForCharSet is returned when the wrong collation is given for the character set when parsing.
	ErrCollationInvalidForCharSet = errors.NewKind("COLLATION '%s' is not valid for CHARACTER SET '%s'")

	// ErrCollationUnknown is returned when the collation is not a recognized MySQL collation.
	ErrCollationUnknown = errors.NewKind("Unknown collation: %v")

	// ErrCollationNotYetImplementedTemp is returned when the collation is valid but has not yet been implemented.
	// This error is temporary, and will be removed once all collations have been added.
	ErrCollationNotYetImplementedTemp = errors.NewKind("The collation `%s` has not yet been implemented, " +
		"please create an issue at https://github.com/dolthub/go-mysql-server/issues/new and the DoltHub developers will implement it")

	// ErrCollationIllegalMix is returned when two different collations are used in a scenario where they are not compatible.
	ErrCollationIllegalMix = errors.NewKind("Illegal mix of collations (%v) and (%v)")

	// ErrCharSetIntroducer is returned when a character set introducer is not attached to a string
	ErrCharSetIntroducer = errors.NewKind("CHARACTER SET introducer must be attached to a string")

	// ErrCharSetInvalidString is returned when an invalid string is given for a character set.
	ErrCharSetInvalidString = errors.NewKind("invalid string for character set `%s`: \"%s\"")

	// ErrCharSetFailedToEncode is returned when a character set fails encoding
	ErrCharSetFailedToEncode = errors.NewKind("failed to encode: `%s`, valid string: `%v`, snippet: `%s`")

	// ErrCharSetUnknown is returned when the character set is not a recognized MySQL character set
	ErrCharSetUnknown = errors.NewKind("Unknown character set: %v")

	// ErrCharSetNotYetImplementedTemp is returned when the character set is valid but has not yet been implemented.
	// This error is temporary, and will be removed once all character sets have been added.
	ErrCharSetNotYetImplementedTemp = errors.NewKind("The character set `%s` has not yet been implemented, " +
		"please create an issue at https://github.com/dolthub/go-mysql-server/issues/new and the DoltHub developers will implement it")

	// ErrNoTablesUsed is returned when there is no table provided or dual table is defined with column access.
	ErrNoTablesUsed = errors.NewKind("No tables used")

	// ErrInvalidJson is returned when a JSON string doesn't represent valid JSON.
	ErrInvalidJson = errors.NewKind("Invalid JSON text: %s")

	// ErrNoAutoIncrementCol is returned when there is no auto increment column defined on a table.
	ErrNoAutoIncrementCol = fmt.Errorf("this table has no AUTO_INCREMENT columns")

	// ErrValueOutOfRange is returned when a value is out of range for a type.
	ErrValueOutOfRange = errors.NewKind("%v out of range for %v")

	ErrConvertingToSet   = errors.NewKind("value %v is not valid for this set")
	ErrDuplicateEntrySet = errors.NewKind("duplicate entry: %v")
	ErrInvalidSetValue   = errors.NewKind("value %v was not found in the set")
	ErrTooLargeForSet    = errors.NewKind(`value "%v" is too large for this set`)
	ErrNotPoint          = errors.NewKind("value of type %T is not a point")
	ErrNotLineString     = errors.NewKind("value of type %T is not a linestring")

	// ErrMergeJoinExpectsComparerFilters is returned when we attempt to build a merge join with an invalid filter.
	ErrMergeJoinExpectsComparerFilters = errors.NewKind("merge join expects expression.Comparer filters, found: %T")

	// ErrNoJoinFilters is returned when we attempt to build a filtered join without filters
	ErrNoJoinFilters = errors.NewKind("join expected non-nil filters")

	// ErrDroppedJoinFilters is returned when we removed filters from a join, but failed to re-insert them
	ErrDroppedJoinFilters = errors.NewKind("dropped filters from join, but failed to re-insert them")

	// ErrInvalidIndexName is called when we try to create an index with an unusable name.
	ErrInvalidIndexName = errors.NewKind("invalid index name '%s'")

	// ErrStarUnsupported is called for * expressions seen outside: raw projections, count(*), and arrayagg(*)
	ErrStarUnsupported = errors.NewKind(
		"a '*' is in a context where it is not allowed.",
	)

	// ErrAggregationUnsupported is returned when the analyzer has failed
	// to push down an Aggregation in an expression to a GroupBy node.
	ErrAggregationUnsupported = errors.NewKind(
		"an aggregation remained in the expression '%s' after analysis, outside of a node capable of evaluating it; this query is currently unsupported.",
	)

	ErrWindowUnsupported = errors.NewKind(
		"a window function '%s' is in a context where it cannot be evaluated.",
	)

	// ErrFullTextNotSupported is returned when a table does not support the creation of Full-Text indexes.
	ErrFullTextNotSupported = errors.NewKind("table does not support FULLTEXT indexes")

	// ErrFullTextDatabaseNotSupported is returned when a database does not support the creation of Full-Text indexes.
	ErrFullTextDatabaseNotSupported = errors.NewKind("database does not support FULLTEXT indexes")

	// ErrIncompleteFullTextIntegration is returned when some portions of Full-Text are implemented but not all of them
	ErrIncompleteFullTextIntegration = errors.NewKind("proper Full-Text support requires all interfaces to be implemented")

	// ErrNoFullTextIndexFound is returned when the relevant Full-Text index cannot be found.
	ErrNoFullTextIndexFound = errors.NewKind("no matching Full-Text index found on table `%s`")

	// ErrFullTextMatchAgainstNotColumns is returned when the provided MATCH(...) columns are not column names.
	ErrFullTextMatchAgainstNotColumns = errors.NewKind("match columns must be column names")

	// ErrFullTextMatchAgainstSameTable is returned when the provided MATCH(...) columns belong to different tables.
	ErrFullTextMatchAgainstSameTable = errors.NewKind("match columns must refer to the same table")

	// ErrFullTextDifferentCollations is returned when creating a Full-Text index on columns that have different collations.
	ErrFullTextDifferentCollations = errors.NewKind("Full-Text index columns must have the same collation")

	// ErrFullTextMissingColumn is returned when a Full-Text column cannot be found.
	ErrFullTextMissingColumn = errors.NewKind("Full-Text index could not find the column `%s`")

	// ErrFullTextDuplicateColumn is returned when a Full-Text index declares the same column multiple times.
	ErrFullTextDuplicateColumn = errors.NewKind("cannot have duplicate columns in a Full-Text index: `%s`")

	// ErrFullTextInvalidColumnType is returned when a Full-Text index is declared on a non-text column.
	ErrFullTextInvalidColumnType = errors.NewKind("all Full-Text columns must be declared on a non-binary text type")

	// ErrVectorInvalidColumnType is returned when a Vector index is declared on a non-vector column.
	ErrVectorInvalidColumnType = errors.NewKind("a vector index colum must be a vector or JSON")

	// ErrGeneratedColumnValue is returned when a value is provided for a generated column
	ErrGeneratedColumnValue = errors.NewKind("The value specified for generated column %q in table %q is not allowed.")

	// ErrVirtualColumnPrimaryKey is returned when a virtual column is defined as a primary key
	ErrVirtualColumnPrimaryKey = errors.NewKind("Defining a virtual generated column as primary key is not supported")

	// ErrGeneratedColumnWithDefault is returned when a column specifies both a default and a generated value
	ErrGeneratedColumnWithDefault = errors.NewKind("Incorrect usage of DEFAULT and generated column")

	// ErrJSONIndex is returned when attempting to create an index over a JSON column directly
	ErrJSONIndex = errors.NewKind("JSON column '%s' supports indexing only via generated columns on a specified JSON path")

	ErrInvalidOnUpdate = errors.NewKind("Invalid ON UPDATE clause for '%s' column")

	ErrInsertIntoMismatchValueCount = errors.NewKind("number of values does not match number of columns provided")

	ErrInvalidTypeForLimit = errors.NewKind("invalid limit. expected %T, found %T")

	ErrColumnSpecifiedTwice = errors.NewKind("column '%v' specified twice")

	ErrEnumTypeTruncated = errors.NewKind("new enum type change truncates value")

	// ErrTruncatedIncorrect is thrown when converting a value results in portions of the data to be trimmed.
	ErrTruncatedIncorrect = errors.NewKind("Truncated incorrect %s value: %v")

	// ErrUnresolvedTableLock is returned when a FOR UPDATE OF clause references a table that doesn't exist in the query context.
	ErrUnresolvedTableLock = errors.NewKind("unresolved table name `%s` in locking clause.")
)

// CastSQLError returns a *mysql.SQLError with the error code and in some cases, also a SQL state, populated for the
// specified error object. Using this method enables Vitess to return an error code, instead of just "unknown error".
// Many tools (e.g. ORMs, SQL workbenches) rely on this error metadata to work correctly. If the specified error is nil,
// nil will be returned. If the error is already of type *mysql.SQLError, the error will be returned as is.
func CastSQLError(err error) *mysql.SQLError {
	if err == nil {
		return nil
	}
	if mysqlErr, ok := err.(*mysql.SQLError); ok {
		return mysqlErr
	}

	var code int
	var sqlState string = ""

	if w, ok := err.(WrappedInsertError); ok {
		return CastSQLError(w.Cause)
	}

	if wm, ok := err.(WrappedTypeConversionError); ok {
		return CastSQLError(wm.Err)
	}

	switch {
	case ErrTableNotFound.Is(err):
		code = mysql.ERNoSuchTable
	case ErrDatabaseExists.Is(err):
		code = mysql.ERDbCreateExists
	case ErrDatabaseNotFound.Is(err):
		code = mysql.ERBadDb
	case ErrExpectedSingleRow.Is(err):
		code = mysql.ERSubqueryNo1Row
	case ErrInvalidOperandColumns.Is(err):
		code = mysql.EROperandColumns
	case ErrInsertIntoNonNullableProvidedNull.Is(err):
		code = mysql.ERBadNullError
	case ErrNonAggregatedColumnWithoutGroupBy.Is(err):
		code = mysql.ERMixOfGroupFuncAndFields
	case ErrPrimaryKeyViolation.Is(err):
		code = mysql.ERDupEntry
	case ErrUniqueKeyViolation.Is(err):
		code = mysql.ERDupEntry
	case ErrPartitionNotFound.Is(err):
		code = 1526 // TODO: Needs to be added to vitess
	case ErrForeignKeyChildViolation.Is(err):
		code = mysql.ErNoReferencedRow2 // test with mysql returns 1452 vs 1216
	case ErrForeignKeyParentViolation.Is(err):
		code = mysql.ERRowIsReferenced2 // test with mysql returns 1451 vs 1215
	case ErrDuplicateEntry.Is(err):
		code = mysql.ERDupEntry
	case ErrInvalidJSONText.Is(err):
		code = 3141 // TODO: Needs to be added to vitess
	case ErrMultiplePrimaryKeysDefined.Is(err):
		code = mysql.ERMultiplePriKey
	case ErrWrongAutoKey.Is(err):
		code = mysql.ERWrongAutoKey
	case ErrKeyColumnDoesNotExist.Is(err):
		code = mysql.ERKeyColumnDoesNotExist
	case ErrCantDropFieldOrKey.Is(err):
		code = mysql.ERCantDropFieldOrKey
	case ErrReadOnlyTransaction.Is(err):
		code = 1792 // TODO: Needs to be added to vitess
	case ErrCantDropIndex.Is(err):
		code = 1553 // TODO: Needs to be added to vitess
	case ErrInvalidValue.Is(err):
		code = mysql.ERTruncatedWrongValueForField
	case ErrUnknownColumn.Is(err):
		code = mysql.ERBadFieldError
	case ErrColumnSpecifiedTwice.Is(err):
		code = mysql.ERFieldSpecifiedTwice
	case ErrLockDeadlock.Is(err):
		// ER_LOCK_DEADLOCK signals that the transaction was rolled back
		// due to a deadlock between concurrent transactions.
		// MySQL maps this error to the ANSI SQLSTATE code of 40001 which
		// has the more general meaning of "serialization failure".
		// 	https://mariadb.com/kb/en/mariadb-error-codes/
		// 	https://en.wikipedia.org/wiki/SQLSTATE
		code = mysql.ERLockDeadlock
		sqlState = mysql.SSLockDeadlock
	default:
		code = mysql.ERUnknownError
	}

	return mysql.NewSQLError(code, sqlState, "%s", err.Error())
}

// UnwrapError removes any wrapping errors (e.g. WrappedInsertError) around the specified error and
// returns the first non-wrapped error type.
func UnwrapError(err error) error {
	switch wrappedError := err.(type) {
	case WrappedInsertError:
		return UnwrapError(wrappedError.Cause)
	case WrappedTypeConversionError:
		return UnwrapError(wrappedError.Err)
	default:
		return err
	}
}

type UniqueKeyError struct {
	keyStr   string
	Existing Row
	IsPK     bool
}

func NewUniqueKeyErr(keyStr string, isPK bool, existing Row) error {
	ue := UniqueKeyError{
		keyStr:   keyStr,
		IsPK:     isPK,
		Existing: existing,
	}

	if isPK {
		return ErrPrimaryKeyViolation.Wrap(ue)
	} else {
		return ErrUniqueKeyViolation.Wrap(ue)
	}
}

func (ue UniqueKeyError) Error() string {
	return fmt.Sprintf("%s", ue.keyStr)
}

type WrappedInsertError struct {
	Cause        error
	OffendingRow Row
}

func NewWrappedInsertError(r Row, err error) WrappedInsertError {
	return WrappedInsertError{
		OffendingRow: r,
		Cause:        err,
	}
}

func (w WrappedInsertError) Error() string {
	return w.Cause.Error()
}

// Format implements fmt.Formatter
func (w WrappedInsertError) Format(s fmt.State, verb rune) {
	if fmtErr, ok := w.Cause.(fmt.Formatter); ok {
		fmtErr.Format(s, verb)
		return
	}
	_, _ = io.WriteString(s, w.Error())
}

// IgnorableError is used propagate information about an error that needs to be ignored and does not interfere with
// any update accumulators
type IgnorableError struct {
	OffendingRow Row
}

func NewIgnorableError(row Row) IgnorableError {
	return IgnorableError{OffendingRow: row}
}

func (e IgnorableError) Error() string {
	return "An ignorable error should never be printed"
}

type WrappedTypeConversionError struct {
	OffendingVal interface{}
	Err          error
	OffendingIdx int
}

func NewWrappedTypeConversionError(offendingVal interface{}, idx int, err error) WrappedTypeConversionError {
	return WrappedTypeConversionError{OffendingVal: offendingVal, OffendingIdx: idx, Err: err}
}

func (w WrappedTypeConversionError) Error() string {
	return w.Err.Error()
}
