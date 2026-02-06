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

package fulltext

import (
	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

const maxWordLength = 84

var (
	// SchemaConfig is the schema for the config table, which is a pseudo-index implementation of a Full-Text index.
	SchemaConfig = sql.Schema{
		{Name: "id", Type: types.Int32, Nullable: false, PrimaryKey: true},
		{Name: "stopword_table", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 2048), Nullable: false, PrimaryKey: false},
		{Name: "use_stopword", Type: types.Boolean, Nullable: false, PrimaryKey: false},
	}
	// SchemaPosition is the schema for the table that returns a word's position, which is a pseudo-index implementation of a Full-Text index.
	SchemaPosition = sql.Schema{
		{Name: "word", Type: types.MustCreateString(sqltypes.VarChar, maxWordLength, sql.Collation_Default), Nullable: false, PrimaryKey: true},
		// Key columns go here
		{Name: "position", Type: types.Uint64, Nullable: false, PrimaryKey: true},
	}
	// SchemaDocCount is the schema for the table that returns a word's document count, which is a pseudo-index implementation of a Full-Text index.
	SchemaDocCount = sql.Schema{
		{Name: "word", Type: types.MustCreateString(sqltypes.VarChar, maxWordLength, sql.Collation_Default), Nullable: false, PrimaryKey: true},
		// Key columns go here
		{Name: "doc_count", Type: types.Uint64, Nullable: false, PrimaryKey: false},
	}
	// SchemaGlobalCount is the schema for the table that returns a word's global document count, which is a pseudo-index implementation of a Full-Text index.
	SchemaGlobalCount = sql.Schema{
		{Name: "word", Type: types.MustCreateString(sqltypes.VarChar, maxWordLength, sql.Collation_Default), Nullable: false, PrimaryKey: true},
		{Name: "global_count", Type: types.Uint64, Nullable: false, PrimaryKey: false},
	}
	// SchemaRowCount is the schema for the table that contains a count for each row's hash, which is a pseudo-index implementation of a Full-Text index.
	SchemaRowCount = sql.Schema{
		{Name: "row_hash", Type: types.MustCreateString(sqltypes.VarChar, maxWordLength, sql.Collation_Default), Nullable: false, PrimaryKey: true},
		{Name: "row_count", Type: types.Uint64, Nullable: false, PrimaryKey: false},
		{Name: "unique_words", Type: types.Uint64, Nullable: false, PrimaryKey: false},
	}
)
