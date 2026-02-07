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

package mysql_db

import (
	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

const helpTopicTableName = "help_topic"
const helpKeywordTableName = "help_keyword"
const helpCategoryTableName = "help_category"
const helpRelationTableName = "help_relation"

var helpTopicSchema sql.Schema
var helpKeywordSchema sql.Schema
var helpCategorySchema sql.Schema
var helpRelationSchema sql.Schema

func init() {
	char64_utf8mb3_general_ci := types.MustCreateString(sqltypes.Char, 64, sql.Collation_utf8mb3_general_ci)
	text_utf8mb3_general_ci := types.MustCreateString(sqltypes.Text, types.TextBlobMax, sql.Collation_utf8mb3_general_ci)

	helpTopicSchema = sql.Schema{
		columnTemplate("help_topic_id", helpTopicTableName, true, &sql.Column{
			Type: types.Uint64,
		}),
		columnTemplate("name", helpTopicTableName, false, &sql.Column{
			Type: char64_utf8mb3_general_ci,
		}),
		columnTemplate("help_category_id", helpTopicTableName, false, &sql.Column{
			Type: types.Uint8,
		}),
		columnTemplate("description", helpTopicTableName, false, &sql.Column{
			Type: text_utf8mb3_general_ci,
		}),
		columnTemplate("example", helpTopicTableName, false, &sql.Column{
			Type: text_utf8mb3_general_ci,
		}),
		columnTemplate("url", helpTopicTableName, false, &sql.Column{
			Type: text_utf8mb3_general_ci,
		}),
	}

	helpKeywordSchema = sql.Schema{
		columnTemplate("help_keyword_id", helpKeywordTableName, true, &sql.Column{
			Type: types.Uint64,
		}),
		columnTemplate("name", helpKeywordTableName, false, &sql.Column{
			Type: char64_utf8mb3_general_ci,
		}),
	}

	helpCategorySchema = sql.Schema{
		columnTemplate("help_category_id", helpCategoryTableName, true, &sql.Column{
			Type: types.Uint8,
		}),
		columnTemplate("name", helpCategoryTableName, false, &sql.Column{
			Type: char64_utf8mb3_general_ci,
		}),
		columnTemplate("parent_category_id", helpCategoryTableName, false, &sql.Column{
			Type: types.Uint8,
		}),
		columnTemplate("url", helpCategoryTableName, false, &sql.Column{
			Type: text_utf8mb3_general_ci,
		}),
	}

	helpRelationSchema = sql.Schema{
		columnTemplate("help_keyword_id", helpRelationTableName, true, &sql.Column{
			Type: types.Uint64,
		}),
		columnTemplate("help_topic_id", helpRelationTableName, true, &sql.Column{
			Type: types.Uint64,
		}),
	}
}
