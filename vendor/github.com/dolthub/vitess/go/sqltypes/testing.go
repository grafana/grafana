/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package sqltypes

import (
	"bytes"
	"fmt"
	"strings"

	querypb "github.com/dolthub/vitess/go/vt/proto/query"
)

// Functions in this file should only be used for testing.
// This is an experiment to see if test code bloat can be
// reduced and readability improved.

// MakeTestFields builds a []*querypb.Field for testing.
//   fields := sqltypes.MakeTestFields(
//     "a|b",
//     "int64|varchar",
//   )
// The field types are as defined in querypb and are case
// insensitive. Column delimiters must be used only to sepearate
// strings and not at the beginning or the end.
func MakeTestFields(names, types string) []*querypb.Field {
	n := split(names)
	t := split(types)
	var fields []*querypb.Field
	for i := range n {
		fields = append(fields, &querypb.Field{
			Name: n[i],
			Type: querypb.Type(querypb.Type_value[strings.ToUpper(t[i])]),
		})
	}
	return fields
}

// MakeTestResult builds a *sqltypes.Result object for testing.
//   result := sqltypes.MakeTestResult(
//     fields,
//     " 1|a",
//     "10|abcd",
//   )
// The field type values are set as the types for the rows built.
// Spaces are trimmed from row values. "null" is treated as NULL.
func MakeTestResult(fields []*querypb.Field, rows ...string) *Result {
	result := &Result{
		Fields: fields,
	}
	if len(rows) > 0 {
		result.Rows = make([][]Value, len(rows))
	}
	for i, row := range rows {
		result.Rows[i] = make([]Value, len(fields))
		for j, col := range split(row) {
			if col == "null" {
				continue
			}
			result.Rows[i][j] = MakeTrusted(fields[j].Type, []byte(col))
		}
	}
	result.RowsAffected = uint64(len(result.Rows))
	return result
}

// MakeTestStreamingResults builds a list of results for streaming.
//   results := sqltypes.MakeStreamingResults(
//     fields,
//		 "1|a",
//     "2|b",
//     "---",
//     "c|c",
//   )
// The first result contains only the fields. Subsequent results
// are built using the field types. Every input that starts with a "-"
// is treated as streaming delimiter for one result. A final
// delimiter must not be supplied.
func MakeTestStreamingResults(fields []*querypb.Field, rows ...string) []*Result {
	var results []*Result
	results = append(results, &Result{Fields: fields})
	start := 0
	cur := 0
	// Add a final streaming delimiter to simplify the loop below.
	rows = append(rows, "-")
	for cur < len(rows) {
		if rows[cur][0] != '-' {
			cur++
			continue
		}
		result := MakeTestResult(fields, rows[start:cur]...)
		result.Fields = nil
		result.RowsAffected = 0
		results = append(results, result)
		start = cur + 1
		cur = start
	}
	return results
}

// TestBindVariable makes a *querypb.BindVariable from
// an interface{}.It panics on invalid input.
// This function should only be used for testing.
func TestBindVariable(v interface{}) *querypb.BindVariable {
	if v == nil {
		return NullBindVariable
	}
	bv, err := BuildBindVariable(v)
	if err != nil {
		panic(err)
	}
	return bv
}

// TestValue builds a Value from typ and val.
// This function should only be used for testing.
func TestValue(typ querypb.Type, val string) Value {
	return MakeTrusted(typ, []byte(val))
}

// PrintResults prints []*Results into a string.
// This function should only be used for testing.
func PrintResults(results []*Result) string {
	b := new(bytes.Buffer)
	for i, r := range results {
		if i == 0 {
			fmt.Fprintf(b, "%v", r)
			continue
		}
		fmt.Fprintf(b, ", %v", r)
	}
	return b.String()
}

func split(str string) []string {
	splits := strings.Split(str, "|")
	for i, v := range splits {
		splits[i] = strings.TrimSpace(v)
	}
	return splits
}
