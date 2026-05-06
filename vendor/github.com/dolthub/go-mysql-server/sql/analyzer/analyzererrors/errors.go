// Copyright 2020-2023 Dolthub, Inc.
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

package analyzererrors

import "gopkg.in/src-d/go-errors.v1"

var (
	// ErrValidationResolved is returned when the plan can not be resolved.
	ErrValidationResolved = errors.NewKind("plan is not resolved because of node '%T'")

	// ErrValidationOrderBy is returned when the order by contains aggregation
	// expressions.
	ErrValidationOrderBy = errors.NewKind("OrderBy does not support aggregation expressions")

	// ErrValidationGroupBy is returned when a selected expression contains a nonaggregated column that does not appear
	// in the group by clause
	ErrValidationGroupBy = errors.NewKind(
		"Expression #%d of SELECT list is not in GROUP BY clause and contains nonaggregated column '%s' which " +
			"is not functionally dependent on columns in GROUP BY clause; " +
			"this is incompatible with sql_mode=only_full_group_by",
	)

	// ErrValidationGroupByOrderBy is returned when an order by expression contains a nonaggregated column that does not
	// appear in the group by clause
	ErrValidationGroupByOrderBy = errors.NewKind(
		"Expression #%d of ORDER BY clause is not in GROUP BY clause and contains nonaggregated column '%s' which " +
			"is not functionally dependent on columns in GROUP BY clause; " +
			"this is incompatible with sql_mode=only_full_group_by",
	)

	// ErrValidationSchemaSource is returned when there is any column source
	// that does not match the table name.
	ErrValidationSchemaSource = errors.NewKind("one or more schema sources are empty")

	// ErrUnknownIndexColumns is returned when there are columns in the expr
	// to index that are unknown in the table.
	ErrUnknownIndexColumns = errors.NewKind("unknown columns to index for table %q: %s")

	// ErrCaseResultType is returned when one or more of the types of the values in
	// a case expression don't match.
	ErrCaseResultType = errors.NewKind(
		"expecting all case branches to return values of type %s, " +
			"but found value %q of type %s on %s",
	)

	// ErrIntervalInvalidUse is returned when an interval expression is not
	// correctly used.
	ErrIntervalInvalidUse = errors.NewKind(
		"invalid use of an interval, which can only be used with DATE_ADD, " +
			"DATE_SUB and +/- operators to subtract from or add to a date",
	)

	// ErrExplodeInvalidUse is returned when an EXPLODE function is used
	// outside a Project node.
	ErrExplodeInvalidUse = errors.NewKind(
		"using EXPLODE is not supported outside a Project node",
	)

	// ErrSubqueryFieldIndex is returned when an expression subquery references a field outside the range of the rows it
	// works on.
	ErrSubqueryFieldIndex = errors.NewKind(
		"subquery field index out of range for expression %s: only %d columns available",
	)

	// ErrUnionSchemasMatch is returned when both sides of a UNION do not
	// have the same schema.
	ErrUnionSchemasMatch = errors.NewKind(
		"the schema of the left side of union does not match the right side, expected %s to match %s",
	)

	// ErrReadOnlyDatabase is returned when a write is attempted to a ReadOnlyDatabse.
	ErrReadOnlyDatabase = errors.NewKind("Database %s is read-only.")

	// ErrInvalidRowLength is returned when a DDL table spec exceeds the row length limit
	ErrInvalidRowLength = errors.NewKind("invalid table spec: expected size < %d, found %d")
)
