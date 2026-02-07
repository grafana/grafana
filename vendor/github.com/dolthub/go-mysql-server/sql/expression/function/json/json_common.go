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
	"context"
	goJson "encoding/json"
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var ErrInvalidPath = fmt.Errorf("Invalid JSON path expression")
var ErrPathWildcard = fmt.Errorf("Path expressions may not contain the * and ** tokens")

type invalidJson string

var _ error = invalidJson("")

func (err invalidJson) Error() string {
	return "invalid json"
}

// getMutableJSONVal returns a JSONValue from the given row and expression. The underling value is deeply copied so that
// you are free to use the mutation functions on the returned value.
// nil will be returned only if the inputs are nil. This will not return an error, so callers must check.
func getMutableJSONVal(ctx *sql.Context, row sql.Row, json sql.Expression) (types.MutableJSON, error) {
	doc, err := getJSONDocumentFromRow(ctx, row, json)
	if err != nil || doc == nil {
		return nil, err
	}

	return MutableJsonDoc(ctx, doc)
}

// getSearchableJSONVal returns a SearchableJSONValue from the given row and expression. The underlying value is not copied
// so it is intended to be used for read-only operations.
// nil will be returned only if the inputs are nil. This will not return an error, so callers must check.
func getSearchableJSONVal(ctx *sql.Context, row sql.Row, json sql.Expression) (sql.JSONWrapper, error) {
	return getJSONDocumentFromRow(ctx, row, json)
}

// getJSONDocumentFromRow returns a JSONDocument from the given row and expression. Helper function only intended to be
// used by functions in this file.
func getJSONDocumentFromRow(ctx *sql.Context, row sql.Row, json sql.Expression) (sql.JSONWrapper, error) {
	js, err := json.Eval(ctx, row)
	if err != nil || js == nil {
		return nil, err
	}

	var jsonData interface{}

	switch jsType := js.(type) {
	case string:
		// When coercing a string into a JSON object, don't use LazyJSONDocument; actually unmarshall it.
		// This guarantees that we validate and normalize the JSON.
		strData, _, err := types.LongBlob.Convert(ctx, js)
		if err != nil {
			return nil, err
		}
		if err = goJson.Unmarshal(strData.([]byte), &jsonData); err != nil {
			return nil, invalidJson(jsType)
		}
		return types.JSONDocument{Val: jsonData}, nil
	case sql.JSONWrapper:
		return jsType, nil
	default:
		return nil, sql.ErrInvalidArgument.New(fmt.Sprintf("%v", js))
	}
}

func getJsonFunctionError(functionName string, argumentPosition int, err error) error {
	if sql.ErrInvalidArgument.Is(err) {
		return sql.ErrInvalidJSONArgument.New(argumentPosition, functionName)
	}
	if ij, ok := err.(invalidJson); ok {
		return sql.ErrInvalidJSONText.New(argumentPosition, functionName, string(ij))
	}
	return err
}

// MutableJsonDoc returns a copy of |wrapper| that can be safely mutated.
func MutableJsonDoc(ctx context.Context, wrapper sql.JSONWrapper) (types.MutableJSON, error) {
	// Call Clone() even if |wrapper| isn't mutable. This is because some implementations (like LazyJsonDocument)
	// cache and reuse the result of ToInterface(), and mutating this map may cause unintended behavior.
	clonedJsonWrapper := wrapper.Clone(ctx)

	if mutable, ok := clonedJsonWrapper.(types.MutableJSON); ok {
		return mutable, nil
	}

	val, err := clonedJsonWrapper.ToInterface(ctx)
	if err != nil {
		return nil, err
	}
	return &types.JSONDocument{Val: val}, nil
}

// pathValPair is a helper struct for use by functions which take json paths paired with a json value. eg. JSON_SET, JSON_INSERT, etc.
type pathValPair struct {
	val  sql.JSONWrapper
	path string
}

// buildPath builds a path from the given row and expression
func buildPath(ctx *sql.Context, pathExp sql.Expression, row sql.Row) (*string, error) {
	path, err := pathExp.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if path == nil {
		return nil, nil
	}
	if s, ok := path.(string); ok {
		return &s, nil
	} else {
		return nil, ErrInvalidPath
	}
}

// buildPathValue builds a pathValPair from the given row and expressions. This is a common pattern in json methods to have
// pairs of arguments, and this ensures they are of the right type, non-nil, and they wrapped in a struct as a unit.
func buildPathValue(ctx *sql.Context, pathExp sql.Expression, valExp sql.Expression, row sql.Row) (*pathValPair, error) {
	path, err := buildPath(ctx, pathExp, row)
	if err != nil {
		return nil, err
	}
	if path == nil {
		return nil, nil
	}

	val, err := valExp.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	jsonVal, ok := val.(sql.JSONWrapper)
	if !ok {
		jsonVal = types.JSONDocument{Val: val}
	}

	return &pathValPair{path: *path, val: jsonVal}, nil
}
