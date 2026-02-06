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
	"gopkg.in/src-d/go-errors.v1"
)

var (
	errInvalidDescribeFormat = errors.NewKind("invalid format %q for DESCRIBE, supported formats: %s")

	errInvalidSortOrder = errors.NewKind("invalid sort order: %s")

	ErrPrimaryKeyOnNullField = errors.NewKind("All parts of PRIMARY KEY must be NOT NULL")

	// ErrUnionSchemasDifferentLength is returned when the two sides of a
	// UNION do not have the same number of columns in their schemas.
	ErrUnionSchemasDifferentLength = errors.NewKind(
		"cannot union two queries whose schemas are different lengths; left has %d column(s) right has %d column(s).",
	)

	ErrQualifiedOrderBy = errors.NewKind("Table '%s' from one of the SELECTs cannot be used in global ORDER clause")

	ErrOrderByBinding = errors.NewKind("bindings in sort clauses not supported yet")

	ErrFailedToParseStats = errors.NewKind("failed to parse data: %s\n%s")
)
