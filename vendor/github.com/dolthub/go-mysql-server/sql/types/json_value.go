// Copyright 2022 Dolthub, Inc.
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

package types

import (
	"bytes"
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"

	"github.com/dolthub/jsonpath"
	"github.com/shopspring/decimal"

	"github.com/dolthub/go-mysql-server/sql"
)

// JsonToMySqlString generates a string representation of a sql.JSONWrapper that is compatible with MySQL's JSON output, including spaces.
func JsonToMySqlString(ctx context.Context, jsonWrapper sql.JSONWrapper) (string, error) {
	val, err := jsonWrapper.ToInterface(ctx)
	if err != nil {
		return "", err
	}
	return marshalToMySqlString(val)
}

// JsonToMySqlBytes generates a byte slice representation of a sql.JSONWrapper that is compatible with MySQL's JSON output, including spaces.
func JsonToMySqlBytes(ctx context.Context, jsonWrapper sql.JSONWrapper) ([]byte, error) {
	val, err := jsonWrapper.ToInterface(ctx)
	if err != nil {
		return nil, err
	}
	return marshalToMySqlBytes(val)
}

// JSONBytes are values which can be represented as JSON.
type JSONBytes interface {
	sql.JSONWrapper
	GetBytes(ctx context.Context) ([]byte, error)
}

func MarshallJsonValue(value interface{}) ([]byte, error) {
	buffer := &bytes.Buffer{}
	encoder := json.NewEncoder(buffer)
	// Prevents special characters like <, >, or & from being escaped.
	encoder.SetEscapeHTML(false)
	err := encoder.Encode(value)
	if err != nil {
		return nil, err
	}
	// json.Encoder appends a newline character so we trim it.
	// SELECT cast('6\n' as JSON) returns only 6 in MySQL.
	out := bytes.TrimRight(buffer.Bytes(), "\n")
	return out, err
}

// JSONBytes returns or generates a byte array for the JSON representation of the underlying sql.JSONWrapper
func MarshallJson(ctx context.Context, jsonWrapper sql.JSONWrapper) ([]byte, error) {
	if bytes, ok := jsonWrapper.(JSONBytes); ok {
		return bytes.GetBytes(ctx)
	}
	val, err := jsonWrapper.ToInterface(ctx)
	if err != nil {
		return []byte{}, err
	}
	return MarshallJsonValue(val)
}

type JsonObject = map[string]interface{}
type JsonArray = []interface{}

type SearchableJSON interface {
	sql.JSONWrapper
	Lookup(ctx context.Context, path string) (sql.JSONWrapper, error)
}

type ComparableJSON interface {
	sql.JSONWrapper
	Compare(ctx context.Context, other interface{}) (int, error)
	JsonType(ctx context.Context) (string, error)
}

// MutableJSON is a JSON value that can be efficiently modified. These modifications return the new value, but they
// are not required to preserve the state of the original value. If you want to preserve the old value, call |Clone|
// first and modify the clone, which is guaranteed to not affect the original.
type MutableJSON interface {
	sql.JSONWrapper
	// Insert Adds the value at the given path, only if it is not present. Updated value returned, and bool indicating if
	// a change was made.
	Insert(ctx context.Context, path string, val sql.JSONWrapper) (MutableJSON, bool, error)
	// Remove the value at the given path. Updated value returned, and bool indicating if a change was made.
	Remove(ctx context.Context, path string) (MutableJSON, bool, error)
	// Set the value at the given path. Updated value returned, and bool indicating if a change was made.
	Set(ctx context.Context, path string, val sql.JSONWrapper) (MutableJSON, bool, error)
	// Replace the value at the given path with the new value. If the path does not exist, no modification is made.
	Replace(ctx context.Context, path string, val sql.JSONWrapper) (MutableJSON, bool, error)
	// ArrayInsert inserts into the array object referenced by the given path. If the path does not exist, no modification is made.
	ArrayInsert(ctx context.Context, path string, val sql.JSONWrapper) (MutableJSON, bool, error)
	// ArrayAppend appends to an  array object referenced by the given path. If the path does not exist, no modification is made,
	// or if the path exists and is not an array, the element will be converted into an array and the element will be
	// appended to it.
	ArrayAppend(ctx context.Context, path string, val sql.JSONWrapper) (MutableJSON, bool, error)
}

type JSONDocument struct {
	Val interface{}
}

var _ sql.JSONWrapper = JSONDocument{}
var _ MutableJSON = JSONDocument{}
var _ SearchableJSON = JSONDocument{}

func (doc JSONDocument) ToInterface(context.Context) (interface{}, error) {
	return doc.Val, nil
}

func (doc JSONDocument) Compare(ctx context.Context, other sql.JSONWrapper) (int, error) {
	otherVal, err := other.ToInterface(ctx)
	if err != nil {
		return 0, err
	}
	return CompareJSON(ctx, doc.Val, otherVal)
}

func (doc JSONDocument) JSONString() (string, error) {
	return marshalToMySqlString(doc.Val)
}

// JSONDocument implements the fmt.Stringer interface.
func (doc JSONDocument) String() string {
	result, err := doc.JSONString()
	if err != nil {
		return fmt.Sprintf("(Error marshalling JSON: %s, %s)", doc.Val, err.Error())
	}
	return result
}

func (doc JSONDocument) Lookup(ctx context.Context, path string) (sql.JSONWrapper, error) {
	return lookupJson(doc.Val, path)
}

func (doc JSONDocument) Clone(context.Context) sql.JSONWrapper {
	return &JSONDocument{Val: DeepCopyJson(doc.Val)}
}

// LazyJSONDocument is an implementation of sql.JSONWrapper that wraps a JSON string and defers deserializing
// it unless needed. This is more efficient for queries that interact with JSON values but don't care about their structure.
type LazyJSONDocument struct {
	interfaceFunc func() (interface{}, error)
	Bytes         []byte
}

var _ sql.JSONWrapper = &LazyJSONDocument{}
var _ JSONBytes = &LazyJSONDocument{}
var _ fmt.Stringer = &LazyJSONDocument{}
var _ driver.Valuer = &LazyJSONDocument{}

func NewLazyJSONDocument(bytes []byte) sql.JSONWrapper {
	return &LazyJSONDocument{
		Bytes: bytes,
		interfaceFunc: sync.OnceValues(func() (interface{}, error) {
			var val interface{}
			err := json.Unmarshal(bytes, &val)
			if err != nil {
				return nil, err
			}
			return val, nil
		}),
	}
}

// Clone implements sql.JSONWrapper.
func (j *LazyJSONDocument) Clone(context.Context) sql.JSONWrapper {
	return NewLazyJSONDocument(j.Bytes)
}

func (j *LazyJSONDocument) ToInterface(context.Context) (interface{}, error) {
	return j.interfaceFunc()
}

func (j *LazyJSONDocument) GetBytes(_ context.Context) ([]byte, error) {
	return j.Bytes, nil
}

// Value implements driver.Valuer for interoperability with other go libraries
func (j *LazyJSONDocument) Value() (driver.Value, error) {
	return JsonToMySqlString(context.Background(), j)
}

// LazyJSONDocument implements the fmt.Stringer interface.
func (j *LazyJSONDocument) String() string {
	s, err := JsonToMySqlString(context.Background(), j)
	if err != nil {
		return fmt.Sprintf("error while stringifying JSON: %s", err.Error())
	}
	return s
}

func LookupJSONValue(ctx context.Context, j sql.JSONWrapper, path string) (sql.JSONWrapper, error) {
	if path == "$" {
		// Special case the identity operation to handle a nil value for doc.Val
		return j, nil
	}

	if searchableJson, ok := j.(SearchableJSON); ok {
		ctx := context.Background()
		return searchableJson.Lookup(ctx, path)
	}

	r, err := j.ToInterface(ctx)
	if err != nil {
		return nil, err
	}
	if j == nil {
		return nil, nil
	}

	return lookupJson(r, path)
}

func lookupJson(j interface{}, path string) (SearchableJSON, error) {
	// Lookup(obj) throws an error if obj is nil. We want lookups on a json null
	// to always result in sql NULL, except in the case of the identity lookup
	// $.
	if j == nil {
		return nil, nil
	}

	c, err := jsonpath.Compile(path)
	if err != nil {
		// Until we throw out jsonpath, let's at least make this error better.
		if err.Error() == "should start with '$'" {
			err = fmt.Errorf("Invalid JSON path expression. Path must start with '$', but received: '%s'", path)
		}
		// jsonpath poorly handles unmatched [] in paths.
		if strings.Contains(err.Error(), "len(tail) should") {
			return nil, fmt.Errorf("Invalid JSON path expression. Missing ']'")
		}
		return nil, err
	}

	// For non-object, non-array candidates, if the path is not "$", return SQL NULL
	_, isObject := j.(JsonObject)
	_, isArray := j.(JsonArray)
	if !isObject && !isArray {
		return nil, nil
	}

	val, err := c.Lookup(j)
	if err != nil {
		if strings.Contains(err.Error(), "key error") {
			// A missing key results in a SQL null
			return nil, nil
		}
		if strings.Contains(err.Error(), "index out of range") {
			// A array index out of bounds results in a SQL null
			return nil, nil
		}
		return nil, err
	}

	return JSONDocument{Val: val}, nil
}

var _ driver.Valuer = JSONDocument{}

// Value implements driver.Valuer for interoperability with other go libraries
func (doc JSONDocument) Value() (driver.Value, error) {
	if doc.Val == nil {
		return nil, nil
	}

	mysqlString, err := marshalToMySqlString(doc.Val)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal document: %w", err)
	}

	return mysqlString, nil
}

func ConcatenateJSONValues(ctx *sql.Context, vals ...sql.JSONWrapper) (sql.JSONWrapper, error) {
	var err error
	arr := make(JsonArray, len(vals))
	for i, v := range vals {
		arr[i], err = v.ToInterface(ctx)
		if err != nil {
			return nil, err
		}
	}
	return JSONDocument{Val: arr}, nil
}

func ContainsJSON(a, b interface{}) (bool, error) {
	if a == nil {
		return b == nil, nil
	}

	switch a := a.(type) {
	case JsonArray:
		return containsJSONArray(a, b)
	case JsonObject:
		return containsJSONObject(a, b)
	case bool:
		return containsJSONBool(a, b)
	case string:
		return containsJSONString(a, b)
	case float64:
		return containsJSONNumber(a, b)
	default:
		return false, sql.ErrInvalidType.New(a)
	}
}

func containsJSONBool(a bool, b interface{}) (bool, error) {
	switch b := b.(type) {
	case bool:
		return a == b, nil
	default:
		return false, nil
	}
}

// containsJSONArray returns true if b is contained in the JSON array a. From the official
// MySQL docs: "A candidate array is contained in a target array if and only if every
// element in the candidate is contained in *some* element of the target. A candidate
// non-array is contained in a target array if and only if the candidate is contained
// in some element of the target."
//
// Examples:
//
//	select json_contains('[1, [1, 2, 3], 10]', '[1, 10]'); => true
//	select json_contains('[1, [1, 2, 3, 10]]', '[1, 10]'); => true
//	select json_contains('[1, [1, 2, 3], [10]]', '[1, [10]]'); => true
func containsJSONArray(a JsonArray, b interface{}) (bool, error) {
	if _, ok := b.(JsonArray); ok {
		for _, bb := range b.(JsonArray) {
			contains, err := containsJSONArray(a, bb)
			if err != nil {
				return false, err
			}
			if contains == false {
				return false, nil
			}
		}
		return true, nil
	} else {
		// A candidate non-array is contained in a target array if and only if the candidate is contained in some element of the target.
		for _, aa := range a {
			contains, err := ContainsJSON(aa, b)
			if err != nil {
				return false, err
			}
			if contains == true {
				return true, nil
			}
		}
	}

	return false, nil
}

// containsJSONObject returns true if b is contained in the JSON object a. From the
// official MySQL docs: "A candidate object is contained in a target object if and only
// if for each key in the candidate there is a key with the same name in the target and
// the value associated with the candidate key is contained in the value associated with
// the target key."
//
// Examples:
//
//	select json_contains('{"b": {"a": [1, 2, 3]}}', '{"a": [1]}'); => false
//	select json_contains('{"a": [1, 2, 3, 4], "b": {"c": "foo", "d": true}}', '{"a": [1]}'); => true
//	select json_contains('{"a": [1, 2, 3, 4], "b": {"c": "foo", "d": true}}', '{"a": []}'); => true
//	select json_contains('{"a": [1, 2, 3, 4], "b": {"c": "foo", "d": true}}', '{"a": {}}'); => false
//	select json_contains('{"a": [1, [2, 3], 4], "b": {"c": "foo", "d": true}}', '{"a": [2, 4]}'); => true
//	select json_contains('{"a": [1, [2, 3], 4], "b": {"c": "foo", "d": true}}', '[2]'); => false
//	select json_contains('{"a": [1, [2, 3], 4], "b": {"c": "foo", "d": true}}', '2'); => false
func containsJSONObject(a JsonObject, b interface{}) (bool, error) {
	_, isMap := b.(JsonObject)
	if !isMap {
		// If b is a scalar or an array, json_contains always returns false when
		// testing containment in a JSON object
		return false, nil
	}

	for key, bvalue := range b.(JsonObject) {
		avalue, ok := a[key]
		if !ok {
			return false, nil
		}

		contains, err := ContainsJSON(avalue, bvalue)
		if err != nil {
			return false, err
		}
		if contains == false {
			return false, nil
		}
	}
	return true, nil
}

func containsJSONString(a string, b interface{}) (bool, error) {
	switch b := b.(type) {
	case string:
		return a == b, nil
	default:
		return false, nil
	}
}

func containsJSONNumber(a float64, b interface{}) (bool, error) {
	switch b := b.(type) {
	case float64:
		return a == b, nil
	case int64:
		return a == float64(b), nil
	default:
		return false, nil
	}
}

// CompareJSON compares two JSON values. It returns 0 if the values are equal, -1 if a < b, and 1 if a > b.
// JSON values can be compared using the =, <, <=, >, >=, <>, !=, and <=> operators. BETWEEN IN() GREATEST() LEAST() are
// not yet supported with JSON values.
//
// For comparison of JSON and non-JSON values, the non-JSON value is first converted to JSON (see JsonType.Convert()).
// Comparison of JSON values takes place at two levels. The first level of comparison is based on the JSON types of the
// compared values. If the types differ, the comparison result is determined solely by which type has higher precedence.
// If the two values have the same JSON type, a second level of comparison occurs using type-specific rules. The
// following list shows the precedences of JSON types, from highest precedence to the lowest. (The type names are those
// returned by the JSON_TYPE() function.) Types shown together on a line have the same precedence. Any value having a
// JSON type listed earlier in the list compares greater than any value having a JSON type listed later in the list.
//
//			BLOB, BIT, OPAQUE, DATETIME, TIME, DATE, BOOLEAN, ARRAY, OBJECT, STRING, INTEGER, DOUBLE, NULL
//			TODO(andy): implement BLOB BIT OPAQUE DATETIME TIME DATE
//	     current precedence: BOOLEAN, ARRAY, OBJECT, STRING, DOUBLE, NULL
//
// For JSON values of the same precedence, the comparison rules are type specific:
//
//   - ARRAY
//     Two JSON arrays are equal if they have the same length and values in corresponding positions in the arrays are
//     equal. If the arrays are not equal, their order is determined by the elements in the first position where there
//     is a difference. The array with the smaller value in that position is ordered first. If all values of the
//     shorter array are equal to the corresponding values in the longer array, the shorter array is ordered first.
//     e.g.    [] < ["a"] < ["ab"] < ["ab", "cd", "ef"] < ["ab", "ef"]
//
//   - BOOLEAN
//     The JSON false literal is less than the JSON true literal.
//
//   - OBJECT
//     Two JSON objects are equal if they have the same set of keys, and each key has the same value in both objects.
//     The order of two objects that are not equal is unspecified but deterministic.
//     e.g.   {"a": 1, "b": 2} = {"b": 2, "a": 1}
//
//   - STRING
//     Strings are ordered lexically on the first N bytes of the utf8mb4 representation of the two strings being
//     compared, where N is the length of the shorter string. If the first N bytes of the two strings are identical,
//     the shorter string is considered smaller than the longer string.
//     e.g.   "a" < "ab" < "b" < "bc"
//     This ordering is equivalent to the ordering of SQL strings with collation utf8mb4_bin. Because utf8mb4_bin is a
//     binary collation, comparison of JSON values is case-sensitive:
//     e.g.   "A" < "a"
//
//   - DOUBLE
//     JSON values can contain exact-value numbers and approximate-value numbers. For a general discussion of these
//     types of numbers, see Section 9.1.2, “Numeric Literals”. The rules for comparing native MySQL numeric types are
//     discussed in Section 12.3, “Type Conversion in Expression Evaluation”, but the rules for comparing numbers
//     within JSON values differ somewhat:
//
//   - In a comparison between two columns that use the native MySQL INT and DOUBLE numeric types, respectively,
//     it is known that all comparisons involve an integer and a double, so the integer is converted to double for
//     all rows. That is, exact-value numbers are converted to approximate-value numbers.
//
//   - On the other hand, if the query compares two JSON columns containing numbers, it cannot be known in advance
//     whether numbers are integer or double. To provide the most consistent behavior across all rows, MySQL
//     converts approximate-value numbers to exact-value numbers. The resulting ordering is consistent and does
//     not lose precision for the exact-value numbers.
//     e.g.   9223372036854775805 < 9223372036854775806 < 9223372036854775807 < 9.223372036854776e18
//     = 9223372036854776000 < 9223372036854776001
//
//   - NULL
//     For comparison of any JSON value to SQL NULL, the result is UNKNOWN.
//
//     TODO(andy): BLOB, BIT, OPAQUE, DATETIME, TIME, DATE, INTEGER
//
// https://dev.mysql.com/doc/refman/8.0/en/json.html#json-comparison
func CompareJSON(ctx context.Context, a, b interface{}) (int, error) {
	var err error
	if hasNulls, res := CompareNulls(b, a); hasNulls {
		return res, nil
	}

	if comparableA, ok := a.(ComparableJSON); ok {
		return comparableA.Compare(ctx, b)
	}

	if comparableB, ok := b.(ComparableJSON); ok {
		result, err := comparableB.Compare(ctx, a)
		return -result, err
	}

	switch a := a.(type) {
	case bool:
		return compareJSONBool(a, b)
	case JsonArray:
		return compareJSONArray(ctx, a, b)
	case JsonObject:
		return compareJSONObject(ctx, a, b)
	case string:
		return compareJSONString(a, b)
	case int:
		return compareJSONNumber(float64(a), b)
	case uint8:
		return compareJSONNumber(float64(a), b)
	case uint16:
		return compareJSONNumber(float64(a), b)
	case uint32:
		return compareJSONNumber(float64(a), b)
	case uint64:
		return compareJSONNumber(float64(a), b)
	case int8:
		return compareJSONNumber(float64(a), b)
	case int16:
		return compareJSONNumber(float64(a), b)
	case int32:
		return compareJSONNumber(float64(a), b)
	case int64:
		return compareJSONNumber(float64(a), b)
	case float32:
		return compareJSONNumber(float64(a), b)
	case float64:
		return compareJSONNumber(a, b)
	case decimal.Decimal:
		af, _ := a.Float64()
		return compareJSONNumber(af, b)
	case sql.JSONWrapper:
		if jw, ok := b.(sql.JSONWrapper); ok {
			b, err = jw.ToInterface(ctx)
			if err != nil {
				return 0, err
			}
		}
		aVal, err := a.ToInterface(ctx)
		if err != nil {
			return 0, err
		}
		return CompareJSON(ctx, aVal, b)
	default:
		return 0, sql.ErrInvalidType.New(a)
	}
}

func compareJSONBool(a bool, b interface{}) (int, error) {
	switch b := b.(type) {
	case bool:
		// The JSON false literal is less than the JSON true literal.
		if a == b {
			return 0, nil
		}
		if a {
			// a > b
			return 1, nil
		} else {
			// a < b
			return -1, nil
		}

	default:
		// a is higher precedence
		return 1, nil
	}
}

func compareJSONArray(ctx context.Context, a JsonArray, b interface{}) (int, error) {
	switch b := b.(type) {
	case bool:
		// a is lower precedence
		return -1, nil

	case JsonArray:
		// Two JSON arrays are equal if they have the same length and values in corresponding positions in the arrays
		// are equal. If the arrays are not equal, their order is determined by the elements in the first position
		// where there is a difference. The array with the smaller value in that position is ordered first.
		for i, aa := range a {
			// If all values of the shorter array are equal to the corresponding values in the longer array,
			// the shorter array is ordered first (is less).
			if i >= len(b) {
				return 1, nil
			}

			cmp, err := CompareJSON(ctx, aa, b[i])
			if err != nil {
				return 0, err
			}
			if cmp != 0 {
				return cmp, nil
			}
		}
		if len(a) < len(b) {
			return -1, nil
		} else {
			return 0, nil
		}

	default:
		// a is higher precedence
		return 1, nil
	}
}

func compareJSONObject(ctx context.Context, a JsonObject, b interface{}) (int, error) {
	switch b := b.(type) {
	case
		bool,
		JsonArray:
		// a is lower precedence
		return -1, nil

	case JsonObject:
		// Two JSON objects are equal if they have the same set of keys, and each key has the same value in both
		// objects. The order of two objects that are not equal is unspecified but deterministic.
		inter := jsonObjectKeyIntersection(a, b)
		for _, key := range inter {
			cmp, err := CompareJSON(ctx, a[key], b[key])
			if err != nil {
				return 0, err
			}
			if cmp != 0 {
				return cmp, nil
			}
		}
		if len(a) == len(b) && len(a) == len(inter) {
			return 0, nil
		}
		return jsonObjectDeterministicOrder(a, b, inter)

	default:
		// a is higher precedence
		return 1, nil
	}
}

func compareJSONString(a string, b interface{}) (int, error) {
	switch b := b.(type) {
	case
		bool,
		JsonArray,
		JsonObject:
		// a is lower precedence
		return -1, nil

	case string:
		return strings.Compare(a, b), nil

	default:
		// a is higher precedence
		return 1, nil
	}
}

func compareJSONNumber(a float64, b interface{}) (int, error) {
	switch b := b.(type) {
	case
		bool,
		JsonArray,
		JsonObject,
		string:
		// a is lower precedence
		return -1, nil
	case int:
		return compareJSONNumber(a, float64(b))
	case uint8:
		return compareJSONNumber(a, float64(b))
	case uint16:
		return compareJSONNumber(a, float64(b))
	case uint32:
		return compareJSONNumber(a, float64(b))
	case uint64:
		return compareJSONNumber(a, float64(b))
	case int8:
		return compareJSONNumber(a, float64(b))
	case int16:
		return compareJSONNumber(a, float64(b))
	case int32:
		return compareJSONNumber(a, float64(b))
	case int64:
		return compareJSONNumber(a, float64(b))
	case float32:
		return compareJSONNumber(a, float64(b))
	case float64:
		if a > b {
			return 1, nil
		}
		if a < b {
			return -1, nil
		}
		return 0, nil
	case decimal.Decimal:
		bf, _ := b.Float64()
		return compareJSONNumber(a, bf)
	default:
		// a is higher precedence
		return 1, nil
	}
}

func jsonObjectKeyIntersection(a, b JsonObject) (ks []string) {
	for key := range a {
		if _, ok := b[key]; ok {
			ks = append(ks, key)
		}
	}
	slices.Sort(ks)
	return
}

func jsonObjectDeterministicOrder(a, b JsonObject, inter []string) (int, error) {
	if len(a) > len(b) {
		return 1, nil
	}
	if len(a) < len(b) {
		return -1, nil
	}

	// if equal length, compare least non-intersection key
	iset := make(map[string]bool)
	for _, key := range inter {
		iset[key] = true
	}

	var aa string
	for key := range a {
		if _, ok := iset[key]; !ok {
			if key < aa || aa == "" {
				aa = key
			}
		}
	}

	var bb string
	for key := range b {
		if _, ok := iset[key]; !ok {
			if key < bb || bb == "" {
				bb = key
			}
		}
	}

	return strings.Compare(aa, bb), nil
}

func (doc JSONDocument) Insert(ctx context.Context, path string, val sql.JSONWrapper) (MutableJSON, bool, error) {
	path = strings.TrimSpace(path)
	return doc.unwrapAndExecute(ctx, path, val, INSERT)
}

func (doc JSONDocument) Remove(ctx context.Context, path string) (MutableJSON, bool, error) {
	path = strings.TrimSpace(path)
	if path == "$" {
		return nil, false, fmt.Errorf("The path expression '$' is not allowed in this context.")
	}

	return doc.unwrapAndExecute(ctx, path, nil, REMOVE)
}

func (doc JSONDocument) Set(ctx context.Context, path string, val sql.JSONWrapper) (MutableJSON, bool, error) {
	path = strings.TrimSpace(path)
	return doc.unwrapAndExecute(ctx, path, val, SET)
}

func (doc JSONDocument) Replace(ctx context.Context, path string, val sql.JSONWrapper) (MutableJSON, bool, error) {
	path = strings.TrimSpace(path)
	return doc.unwrapAndExecute(ctx, path, val, REPLACE)
}

func (doc JSONDocument) ArrayAppend(ctx context.Context, path string, val sql.JSONWrapper) (MutableJSON, bool, error) {
	path = strings.TrimSpace(path)
	return doc.unwrapAndExecute(ctx, path, val, ARRAY_APPEND)
}

func (doc JSONDocument) ArrayInsert(ctx context.Context, path string, val sql.JSONWrapper) (MutableJSON, bool, error) {
	path = strings.TrimSpace(path)

	if path == "$" {
		// json_array_insert is the only function that produces an error for the '$' path no matter what the value is.
		return nil, false, fmt.Errorf("Path expression is not a path to a cell in an array: $")
	}

	return doc.unwrapAndExecute(ctx, path, val, ARRAY_INSERT)
}

const (
	SET = iota
	INSERT
	REPLACE
	REMOVE
	ARRAY_APPEND
	ARRAY_INSERT
)

// unwrapAndExecute unwraps the JSONDocument and executes the given path on the unwrapped value. The path string passed
// in at this point should be unmodified.
func (doc JSONDocument) unwrapAndExecute(ctx context.Context, path string, val sql.JSONWrapper, mode int) (MutableJSON, bool, error) {
	if path == "" {
		return nil, false, fmt.Errorf("Invalid JSON path expression. Empty path")
	}

	var err error
	var unmarshalled interface{}
	if val != nil {
		unmarshalled, err = val.ToInterface(ctx)
		if err != nil {
			return nil, false, err
		}
	} else if mode != REMOVE {
		return nil, false, fmt.Errorf("Invariant violation. value may not be nil")
	}

	if path[0] != '$' {
		return nil, false, fmt.Errorf("Invalid JSON path expression. Path must start with '$'")
	}

	path = path[1:]
	// Cursor is used to track how many characters have been parsed in the path. It is used to enable better error messages,
	// and is passed as a pointer because some function parse a variable number of characters.
	cursor := 1

	resultRaw, changed, parseErr := walkPathAndUpdate(path, doc.Val, unmarshalled, mode, &cursor)
	if parseErr != nil {
		err = fmt.Errorf("%s at character %d of $%s", parseErr.msg, parseErr.character, path)
		return nil, false, err
	}
	return JSONDocument{Val: resultRaw}, changed, nil
}

// parseErr is used to track errors that occur during parsing of the path, specifically to track the index of the character
// where we believe there is a problem.
type parseErr struct {
	msg       string
	character int
}

// walkPathAndUpdate walks the path and updates the document.
// JSONPath Spec (as documented) https://dev.mysql.com/doc/refman/8.0/en/json.html#json-path-syntax
//
// This function recursively consumes the path until it reaches the end, at which point it applies the mutation operation.
//
// Currently, our implementation focuses specifically on the mutation operations, so '*','**', and range index paths are
// not supported.
func walkPathAndUpdate(path string, doc interface{}, val interface{}, mode int, cursor *int) (interface{}, bool, *parseErr) {
	if path == "" {
		// End of Path is kind of a special snowflake for each type and mode.
		switch mode {
		case SET, REPLACE:
			return val, true, nil
		case INSERT:
			return doc, false, nil
		case ARRAY_APPEND:
			if arr, ok := doc.(JsonArray); ok {
				doc = append(arr, val)
				return doc, true, nil
			} else {
				// Otherwise, turn it into an array and append to it, and append to it.
				doc = JsonArray{doc, val}
				return doc, true, nil
			}
		case ARRAY_INSERT, REMOVE:
			// Some mutations should never reach the end of the path.
			return nil, false, &parseErr{msg: "Runtime error when processing json path", character: *cursor}
		default:
			return nil, false, &parseErr{msg: "Invalid JSON path expression. End of path reached", character: *cursor}
		}
	}

	if path[0] == '.' {
		path = path[1:]
		*cursor = *cursor + 1
		strMap, ok := doc.(JsonObject)
		if !ok {
			// json_array_insert is the only function that produces an error when the path is to an object which
			// lookup fails in this way. All other functions return the document unchanged. Go figure.
			if mode == ARRAY_INSERT {
				return nil, false, &parseErr{msg: "A path expression is not a path to a cell in an array", character: *cursor}
			}
			// not a map, can't do anything. NoOp
			return doc, false, nil
		}
		return updateObject(path, strMap, val, mode, cursor)
	} else if path[0] == '[' {
		*cursor = *cursor + 1
		right := strings.Index(path, "]")
		if right == -1 {
			return nil, false, &parseErr{msg: "Invalid JSON path expression. Missing ']'", character: *cursor}
		}

		remaining := path[right+1:]
		indexString := path[1:right]

		if arr, ok := doc.(JsonArray); ok {
			return updateArray(indexString, remaining, arr, val, mode, cursor)
		} else {
			return updateObjectTreatAsArray(indexString, doc, val, mode, cursor)
		}
	} else {
		return nil, false, &parseErr{msg: "Invalid JSON path expression. Expected '.' or '['", character: *cursor}
	}
}

// updateObject Take a JsonObject and update the value at the given path. If we are not at the end of the path,
// the object is looked up and the walkPathAndUpdate function is called recursively.
func updateObject(path string, doc JsonObject, val interface{}, mode int, cursor *int) (interface{}, bool, *parseErr) {
	name, remainingPath, err := parseNameAfterDot(path, cursor)
	if err != nil {
		return nil, false, err
	}

	if remainingPath == "" {
		if mode == ARRAY_APPEND {
			newDoc, ok := doc[name]
			if !ok {
				// end of the path with a nil value - no-op
				return doc, false, nil
			}
			newObj, changed, err := walkPathAndUpdate(remainingPath, newDoc, val, mode, cursor)
			if err != nil {
				return nil, false, err
			}
			if changed {
				doc[name] = newObj
			}
			return doc, changed, nil
		}

		// Found an item, and it must be an array in one case only.
		if mode == ARRAY_INSERT {
			return nil, false, &parseErr{msg: "A path expression is not a path to a cell in an array", character: *cursor}
		}

		// does the name exist in the map?
		updated := false
		_, destructive := doc[name]
		if mode == SET ||
			(!destructive && mode == INSERT) ||
			(destructive && mode == REPLACE) {
			doc[name] = val
			updated = true
		} else if destructive && mode == REMOVE {
			delete(doc, name)
			updated = true
		}
		return doc, updated, nil
	} else {
		// go deeper.
		newObj, changed, err := walkPathAndUpdate(remainingPath, doc[name], val, mode, cursor)
		if err != nil {
			return nil, false, err
		}
		if changed {
			doc[name] = newObj
			return doc, true, nil
		}
		return doc, false, nil
	}
}

// compiled regex used to parse the name of a field after a '.' in a JSON path.
var regex = regexp.MustCompile(`^(\w+)(.*)$`)

// findNextUnescapedOccurrence finds the first unescaped occurrence of the provided byte in the string.
// This can be used to find an ASCII codepoint without any risk of false positives. This is because strings
// are UTF-8, and bytes in the ASCII range (<128) cannot appear as part of a multi-byte codepoint.
func findNextUnescapedOccurrence(path string, target byte) int {
	index := 0
	for {
		if index >= len(path) {
			return -1
		}
		if path[index] == '\\' {
			index++
		} else if path[index] == target {
			break
		}
		index++
	}
	return index
}

// parseNameAfterDot parses the json path immediately after a '.'. It returns the name of the field and the remaining path,
// and modifies the cursor to point to the end of the parsed path.
func parseNameAfterDot(path string, cursor *int) (name string, remainingPath string, err *parseErr) {
	if path == "" {
		return "", "", &parseErr{msg: "Invalid JSON path expression. Expected field name after '.'", character: *cursor}
	}

	if path[0] == '"' {
		right := findNextUnescapedOccurrence(path[1:], '"')
		if right < 0 {
			return "", "", &parseErr{msg: "Invalid JSON path expression. '\"' expected", character: *cursor}
		}
		name = path[1 : right+1]
		// if the name in the path contains escaped double quotes, unescape them.
		name = strings.Replace(name, `\"`, `"`, -1)
		remainingPath = path[right+2:]
		*cursor = *cursor + right + 2
	} else {
		matches := regex.FindStringSubmatch(path)
		if len(matches) != 3 {
			return "", "", &parseErr{msg: "Invalid JSON path expression. Expected field name after '.'", character: *cursor}
		}
		name = matches[1]
		remainingPath = matches[2]
		*cursor = *cursor + len(name)
	}

	return
}

// updateArray will update an array element appropriately when the path element is an array. This includes parsing
// the special indexes. If there are more elements in the path after this element look up, the update will be performed
// by the walkPathAndUpdate function.
func updateArray(indexString string, remaining string, arr JsonArray, val interface{}, mode int, cursor *int) (interface{}, bool, *parseErr) {
	index, err := parseIndex(indexString, len(arr)-1, cursor)
	if err != nil {
		return nil, false, err
	}

	// All operations, except for SET, ignore the underflow case.
	if index.underflow && (mode != SET) {
		return arr, false, nil
	}

	if len(arr) > index.index && !index.overflow {
		// index exists in the array.
		if remaining == "" && mode != ARRAY_APPEND {
			updated := false
			if mode == SET || mode == REPLACE {
				arr[index.index] = val
				updated = true
			} else if mode == REMOVE {
				arr = append(arr[:index.index], arr[index.index+1:]...)
				updated = true
			} else if mode == ARRAY_INSERT {
				newArr := make(JsonArray, len(arr)+1)
				copy(newArr, arr[:index.index])
				newArr[index.index] = val
				copy(newArr[index.index+1:], arr[index.index:])
				arr = newArr
				updated = true
			}
			return arr, updated, nil
		} else {
			newVal, changed, err := walkPathAndUpdate(remaining, arr[index.index], val, mode, cursor)
			if err != nil {
				return nil, false, err
			}
			if changed {
				arr[index.index] = newVal
			}
			return arr, changed, nil
		}
	} else {
		if mode == SET || mode == INSERT || mode == ARRAY_INSERT {
			newArr := append(arr, val)
			return newArr, true, nil
		}
		return arr, false, nil
	}
}

// updateObjectTreatAsArray handles the case where the user is treating an object or scalar as an array. The behavior in MySQL here
// is a little nutty, but we try to match it as closely as possible. In particular, each mode has a different behavior,
// and the behavior defies logic. This is  mimicking MySQL because it's not dangerous, and there may be some crazy
// use case which expects this behavior.
func updateObjectTreatAsArray(indexString string, doc interface{}, val interface{}, mode int, cursor *int) (interface{}, bool, *parseErr) {
	parsedIndex, err := parseIndex(indexString, 0, cursor)
	if err != nil {
		return nil, false, err
	}

	if parsedIndex.underflow {
		if mode == SET || mode == INSERT {
			// SET and INSERT convert {}, to [val, {}]
			var newArr = make(JsonArray, 0, 2)
			newArr = append(newArr, val)
			newArr = append(newArr, doc)
			return newArr, true, nil
		}
	} else if parsedIndex.overflow {
		if mode == SET || mode == INSERT {
			// SET and INSERT convert {}, to [{}, val]
			var newArr = make(JsonArray, 0, 2)
			newArr = append(newArr, doc)
			newArr = append(newArr, val)
			return newArr, true, nil
		}
	} else if mode == SET || mode == REPLACE {
		return val, true, nil
	} else if mode == ARRAY_APPEND {
		// ARRAY APPEND converts {}, to [{}, val] - Does nothing in the over/underflow cases.
		var newArr = make(JsonArray, 0, 2)
		newArr = append(newArr, doc)
		newArr = append(newArr, val)
		return newArr, true, nil
	}
	return doc, false, nil
}

// parseIndexResult is the result of parsing an index by the parseIndex function.
type parseIndexResult struct {
	underflow bool // true if the index was under 0 - will only happen with last-1000, for example.
	overflow  bool // true if the index was greater than the length of the array.
	index     int  // the index to use. Will be 0 if underflow is true, or the length of the array if overflow is true.
}

// parseIndex parses an array index string. These are of the form:
// 1. standard integer
// 2. "last"
// 3. "last-NUMBER" - to get the second to last element in an array.
// 4. "M to N", "last-4 to N", "M to last-4", "last-4 to last-2" (Currently we don't support this)
//
// White space is ignored completely.
//
// The lastIndex sets index of the last element. -1 for an empty array.
func parseIndex(indexStr string, lastIndex int, cursor *int) (*parseIndexResult, *parseErr) {
	// trim whitespace off the ends
	indexStr = strings.TrimSpace(indexStr)

	if indexStr == "last" {
		if lastIndex < 0 {
			lastIndex = 0 // This happens for an empty array
		}
		return &parseIndexResult{index: lastIndex}, nil
	} else {
		// Attempt to split the string on "-". "last-2" gets the second to last element in an array.
		parts := strings.Split(indexStr, "-")
		if len(parts) == 2 {
			part1, part2 := strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
			if part1 == "last" {
				lastMinus, err := strconv.Atoi(part2)
				if err != nil || lastMinus < 0 {
					*cursor = *cursor + 4 // len("last")
					return nil, &parseErr{msg: "Invalid JSON path expression. Expected a positive integer after 'last-'", character: *cursor}
				}

				underFlow := false
				reducedIdx := lastIndex - lastMinus
				if reducedIdx < 0 {
					reducedIdx = 0
					underFlow = true
				}
				return &parseIndexResult{index: reducedIdx, underflow: underFlow}, nil
			} else {
				return nil, &parseErr{msg: "Invalid JSON path expression. Expected 'last-N'", character: *cursor}
			}
		}
	}

	val, err := strconv.Atoi(indexStr)
	if err != nil {
		msg := fmt.Sprintf("Invalid JSON path expression. Unable to convert %s to an int", indexStr)
		return nil, &parseErr{msg: msg, character: *cursor}
	}

	overflow := false
	if val > lastIndex {
		val = lastIndex
		overflow = true
	}

	return &parseIndexResult{index: val, overflow: overflow}, nil
}

type JSONIter struct {
	doc  *JsonObject
	keys []string
	idx  int
}

func NewJSONIter(json JsonObject) JSONIter {
	json = maps.Clone(json)
	keys := slices.Sorted(maps.Keys(json))
	return JSONIter{
		doc:  &json,
		keys: keys,
		idx:  0,
	}
}

func (iter *JSONIter) Next() (key string, value interface{}, err error) {
	if iter.idx >= len(iter.keys) {
		return "", nil, io.EOF
	}
	key = iter.keys[iter.idx]
	iter.idx++
	value = (*iter.doc)[key]
	return key, value, nil
}

func (iter *JSONIter) HasNext() bool {
	return iter.idx < len(iter.keys)
}
