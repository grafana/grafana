// Copyright 2021 Dolthub, Inc.
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

package json

import (
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

// ErrUnsupportedJSONFunction is returned when a unsupported JSON function is called.
var ErrUnsupportedJSONFunction = errors.NewKind("unsupported JSON function: %s")

// value MEMBER OF(json_array)
//
// Returns true (1) if value is an element of json_array, otherwise returns false (0). value must be a scalar or a JSON
// document; if it is a scalar, the operator attempts to treat it as an element of a JSON array. Queries using
// MEMBER OF() on JSON columns of InnoDB tables in the WHERE clause can be optimized using multi-valued indexes. See
// Multi-Valued Indexes, for detailed information and examples.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-search-functions.html#operator_member-of
// TODO(andy): relocate

//////////////////////////
// JSON table functions //
//////////////////////////

// JSON_TABLE(expr, path COLUMNS (column_list) [AS] alias)
//
// JSONTable Extracts data from a JSON document and returns it as a relational table having the specified columns.
// TODO(andy): this doc was heavily truncated
//
// https://dev.mysql.com/doc/refman/8.0/en/json-table-functions.html#function_json-table
type JSONTable struct {
	sql.Expression
}

var _ sql.FunctionExpression = JSONTable{}

// NewJSONTable creates a new JSONTable function.
func NewJSONTable(args ...sql.Expression) (sql.Expression, error) {
	return nil, ErrUnsupportedJSONFunction.New(JSONTable{}.FunctionName())
}

// FunctionName implements sql.FunctionExpression
func (j JSONTable) FunctionName() string {
	return "json_table"
}

// Description implements sql.FunctionExpression
func (j JSONTable) Description() string {
	return "returns data from a JSON expression as a relational table."
}

// IsUnsupported implements sql.UnsupportedFunctionStub
func (j JSONTable) IsUnsupported() bool {
	return true
}

///////////////////////////////
// JSON validation functions //
///////////////////////////////

// JSON_SCHEMA_VALID(schema,document)
//
// JSONSchemaValid Validates a JSON document against a JSON schema. Both schema and document are required. The schema
// must be a valid JSON object; the document must be a valid JSON document. Provided that these conditions are met: If
// the document validates against the schema, the function returns true (1); otherwise, it returns false (0).
// https://dev.mysql.com/doc/refman/8.0/en/json-validation-functions.html#function_json-schema-valid
type JSONSchemaValid struct {
	sql.Expression
}

var _ sql.FunctionExpression = JSONSchemaValid{}

// NewJSONSchemaValid creates a new JSONSchemaValid function.
func NewJSONSchemaValid(args ...sql.Expression) (sql.Expression, error) {
	return nil, ErrUnsupportedJSONFunction.New(JSONSchemaValid{}.FunctionName())
}

// FunctionName implements sql.FunctionExpression
func (j JSONSchemaValid) FunctionName() string {
	return "json_schema_valid"
}

// Description implements sql.FunctionExpression
func (j JSONSchemaValid) Description() string {
	return "validates JSON document against JSON schema; returns TRUE/1 if document validates against schema, or FALSE/0 if it does not."
}

// IsUnsupported implements sql.UnsupportedFunctionStub
func (j JSONSchemaValid) IsUnsupported() bool {
	return true
}

// JSON_SCHEMA_VALIDATION_REPORT(schema,document)
//
// JSONSchemaValidationReport Validates a JSON document against a JSON schema. Both schema and document are required.
// As with JSONSchemaValid, the schema must be a valid JSON object, and the document must be a valid JSON document.
// Provided that these conditions are met, the function returns a report, as a JSON document, on the outcome of the
// validation. If the JSON document is considered valid according to the JSON Schema, the function returns a JSON object
// with one property valid having the value "true". If the JSON document fails validation, the function returns a JSON
// object which includes the properties listed here:
//   - valid: Always "false" for a failed schema validation
//   - reason: A human-readable string containing the reason for the failure
//   - schema-location: A JSON pointer URI fragment identifier indicating where in the JSON schema the validation failed
//     (see Note following this list)
//   - document-location: A JSON pointer URI fragment identifier indicating where in the JSON document the validation
//     failed (see Note following this list)
//   - schema-failed-keyword: A string containing the name of the keyword or property in the JSON schema that was
//     violated
//
// https://dev.mysql.com/doc/refman/8.0/en/json-validation-functions.html#function_json-schema-validation-report
type JSONSchemaValidationReport struct {
	sql.Expression
}

var _ sql.FunctionExpression = JSONSchemaValidationReport{}

// NewJSONSchemaValidationReport creates a new JSONSchemaValidationReport function.
func NewJSONSchemaValidationReport(args ...sql.Expression) (sql.Expression, error) {
	return nil, ErrUnsupportedJSONFunction.New(JSONSchemaValidationReport{}.FunctionName())
}

// FunctionName implements sql.FunctionExpression
func (j JSONSchemaValidationReport) FunctionName() string {
	return "json_schema_validation_report"
}

// Description implements sql.FunctionExpression
func (j JSONSchemaValidationReport) Description() string {
	return "validates JSON document against JSON schema; returns report in JSON format on outcome on validation including success or failure and reasons for failure."
}

// IsUnsupported implements sql.UnsupportedFunctionStub
func (j JSONSchemaValidationReport) IsUnsupported() bool {
	return true
}

////////////////////////////
// JSON utility functions //
////////////////////////////

// JSON_STORAGE_FREE(json_val)
//
// JSONStorageFree For a JSON column value, this function shows how much storage space was freed in its binary
// representation after it was updated in place using JSON_SET(), JSON_REPLACE(), or JSON_REMOVE(). The argument can
// also be a valid JSON document or a string which can be parsed as one—either as a literal value or as the value of a
// user variable—in which case the function returns 0. It returns a positive, nonzero value if the argument is a JSON
// column value which has been updated as described previously, such that its binary representation takes up less space
// than it did prior to the update. For a JSON column which has been updated such that its binary representation is the
// same as or larger than before, or if the update was not able to take advantage of a partial update, it returns 0; it
// returns NULL if the argument is NULL. If json_val is not NULL, and neither is a valid JSON document nor can be
// successfully parsed as one, an error results.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-utility-functions.html#function_json-storage-size
type JSONStorageFree struct {
	sql.Expression
}

var _ sql.FunctionExpression = JSONStorageFree{}

// NewJSONStorageFree creates a new JSONStorageFree function.
func NewJSONStorageFree(args ...sql.Expression) (sql.Expression, error) {
	return nil, ErrUnsupportedJSONFunction.New(JSONStorageFree{}.FunctionName())
}

// FunctionName implements sql.FunctionExpression
func (j JSONStorageFree) FunctionName() string {
	return "json_storage_free"
}

// Description implements sql.FunctionExpression
func (j JSONStorageFree) Description() string {
	return "returns freed space within binary representation of JSON column value following partial update."
}

// IsUnsupported implements sql.UnsupportedFunctionStub
func (j JSONStorageFree) IsUnsupported() bool {
	return true
}

// JSON_STORAGE_SIZE(json_val)
//
// JSONStorageSize This function returns the number of bytes used to store the binary representation of a JSON document.
// When the argument is a JSON column, this is the space used to store the JSON document as it was inserted into the
// column, prior to any partial updates that may have been performed on it afterwards. json_val must be a valid JSON
// document or a string which can be parsed as one. In the case where it is string, the function returns the amount of
// storage space in the JSON binary representation that is created by parsing the string as JSON and converting it to
// binary. It returns NULL if the argument is NULL. An error results when json_val is not NULL, and is not—or cannot be
// successfully parsed as—a JSON document.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-utility-functions.html#function_json-storage-size
type JSONStorageSize struct {
	sql.Expression
}

var _ sql.FunctionExpression = JSONStorageSize{}

// NewJSONStorageSize creates a new JSONStorageSize function.
func NewJSONStorageSize(args ...sql.Expression) (sql.Expression, error) {
	return nil, ErrUnsupportedJSONFunction.New(JSONStorageSize{}.FunctionName())
}

// FunctionName implements sql.FunctionExpression
func (j JSONStorageSize) FunctionName() string {
	return "json_storage_size"
}

// Description implements sql.FunctionExpression
func (j JSONStorageSize) Description() string {
	return "returns space used for storage of binary representation of a JSON document."
}

// IsUnsupported implements sql.UnsupportedFunctionStub
func (j JSONStorageSize) IsUnsupported() bool {
	return true
}
