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

package variables

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
)

// validateCharacterSet is used in NotifyChange to validate that the given character set is valid.
func validateCharacterSet(ctx *sql.Context, _ sql.SystemVariableScope, value sql.SystemVarValue) error {
	charset, ok := value.Val.(string)
	if !ok {
		return fmt.Errorf("character set variables expect the `string` type, but received `%T`", value.Val)
	}
	_, err := sql.ParseCharacterSet(charset)
	return err
}

// validateCollation is used in NotifyChange to validate that the given collation is valid.
func validateCollation(ctx *sql.Context, _ sql.SystemVariableScope, value sql.SystemVarValue) error {
	collation, ok := value.Val.(string)
	if !ok {
		return fmt.Errorf("collation variables expect the `string` type, but received `%T`", value.Val)
	}
	_, err := sql.ParseCollation("", collation, false)
	return err
}
