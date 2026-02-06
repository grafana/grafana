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

package json

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// JSON_CONTAINS_PATH(json_doc, one_or_all, path[, path] ...)
//
// JSONContainsPath Returns 0 or 1 to indicate whether a JSON document contains data at a given path or paths. Returns
// NULL if any argument is NULL. An error occurs if the json_doc argument is not a valid JSON document, any path
// argument is not a valid path expression, or one_or_all is not 'one' or 'all'. To check for a specific value at a
// path, use JSON_CONTAINS() instead.
//
// The return value is 0 if no specified path exists within the document. Otherwise, the return value depends on the
// one_or_all argument:
//   - 'one': 1 if at least one path exists within the document, 0 otherwise.
//   - 'all': 1 if all paths exist within the document, 0 otherwise.
//
// https://dev.mysql.com/doc/refman/8.0/en/json-search-functions.html#function_json-contains-path
//
// Above is the documentation from MySQL's documentation. Minor Nit - the observed behavior for NULL
// paths is that if a NULL path is found before the search can terminate, then NULL is returned.
type JSONContainsPath struct {
	doc   sql.Expression
	all   sql.Expression
	paths []sql.Expression
}

func (j JSONContainsPath) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	target, err := getSearchableJSONVal(ctx, row, j.doc)
	if err != nil || target == nil {
		return nil, getJsonFunctionError("json_contains_path", 1, err)
	}

	oneOrAll, err := j.all.Eval(ctx, row)
	if err != nil || oneOrAll == nil {
		return nil, err
	}
	oneOrAll, _, err = types.LongText.Convert(ctx, oneOrAll)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(oneOrAll.(string), "one") && !strings.EqualFold(oneOrAll.(string), "all") {
		return nil, fmt.Errorf("The oneOrAll argument to json_contains_path may take these values: 'one' or 'all'")
	}
	findAllPaths := strings.EqualFold(oneOrAll.(string), "all")

	// MySQL Behavior differs from their docs. The docs say that if any path is NULL, the result is NULL. However,
	// they only return NULL when they search far enough to find one, so we match that behavior.
	for _, path := range j.paths {
		path, err := path.Eval(ctx, row)
		if err != nil || path == nil {
			return nil, err
		}

		path, _, err = types.LongText.Convert(ctx, path)
		if err != nil {
			return nil, err
		}

		result, err := types.LookupJSONValue(ctx, target, path.(string))
		if err != nil {
			return nil, err
		}

		if result == nil && findAllPaths {
			return false, nil
		}
		if result != nil && !findAllPaths {
			return true, nil
		}
	}

	// If we got this far, then we had no reason to terminate the search. For all, that means they all matched.
	// For one, that means none matched. The result is the value of findAllPaths.
	return findAllPaths, nil
}

func (j JSONContainsPath) Resolved() bool {
	for _, child := range j.Children() {
		if child != nil && !child.Resolved() {
			return false
		}
	}
	return true
}

func (j JSONContainsPath) String() string {
	children := j.Children()
	var parts = make([]string, len(children))

	for i, c := range children {
		parts[i] = c.String()
	}
	return fmt.Sprintf("%s(%s)", j.FunctionName(), strings.Join(parts, ","))
}

func (j JSONContainsPath) Type() sql.Type {
	return types.Boolean
}

func (j JSONContainsPath) IsNullable() bool {
	for _, path := range j.paths {
		if path.IsNullable() {
			return true
		}
	}
	if j.all.IsNullable() {
		return true
	}
	return j.doc.IsNullable()
}
func (j JSONContainsPath) Children() []sql.Expression {
	answer := make([]sql.Expression, 0, len(j.paths)+2)

	answer = append(answer, j.doc)
	answer = append(answer, j.all)
	answer = append(answer, j.paths...)

	return answer
}

func (j JSONContainsPath) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(j.Children()) != len(children) {
		return nil, fmt.Errorf("json_contains_path did not receive the correct amount of args")
	}
	return NewJSONContainsPath(children...)
}

var _ sql.FunctionExpression = JSONContainsPath{}

// NewJSONContainsPath creates a new JSONContainsPath function.
func NewJSONContainsPath(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("JSON_CONTAINS_PATH", "3 or more", len(args))
	}

	return &JSONContainsPath{args[0], args[1], args[2:]}, nil
}

// FunctionName implements sql.FunctionExpression
func (j JSONContainsPath) FunctionName() string {
	return "json_contains_path"
}

// Description implements sql.FunctionExpression
func (j JSONContainsPath) Description() string {
	return "returns whether JSON document contains any data at path."
}

// IsUnsupported implements sql.UnsupportedFunctionStub
func (j JSONContainsPath) IsUnsupported() bool {
	return false
}
