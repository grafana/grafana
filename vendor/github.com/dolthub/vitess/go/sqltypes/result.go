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
	"reflect"

	"google.golang.org/protobuf/proto"

	querypb "github.com/dolthub/vitess/go/vt/proto/query"
)

// Result represents a query result.
type Result struct {
	Fields       []*querypb.Field      `json:"fields"`
	RowsAffected uint64                `json:"rows_affected"`
	InsertID     uint64                `json:"insert_id"`
	Info         string                `json:"info"`
	Rows         [][]Value             `json:"rows"`
	Extras       *querypb.ResultExtras `json:"extras"`
}

// ResultStream is an interface for receiving Result. It is used for
// RPC interfaces.
type ResultStream interface {
	// Recv returns the next result on the stream.
	// It will return io.EOF if the stream ended.
	Recv() (*Result, error)
}

// Repair fixes the type info in the rows
// to conform to the supplied field types.
func (result *Result) Repair(fields []*querypb.Field) {
	// Usage of j is intentional.
	for j, f := range fields {
		for _, r := range result.Rows {
			if r[j].typ != Null {
				r[j].typ = f.Type
			}
		}
	}
}

// Copy creates a deep copy of Result.
func (result *Result) Copy() *Result {
	out := &Result{
		InsertID:     result.InsertID,
		RowsAffected: result.RowsAffected,
	}
	if result.Fields != nil {
		fieldsp := make([]*querypb.Field, len(result.Fields))
		fields := make([]querypb.Field, len(result.Fields))
		for i, f := range result.Fields {
			fields[i] = *f
			fieldsp[i] = &fields[i]
		}
		out.Fields = fieldsp
	}
	if result.Rows != nil {
		out.Rows = make([][]Value, 0, len(result.Rows))
		for _, r := range result.Rows {
			out.Rows = append(out.Rows, CopyRow(r))
		}
	}
	if result.Extras != nil {
		out.Extras = &querypb.ResultExtras{
			Fresher: result.Extras.Fresher,
		}
		if result.Extras.EventToken != nil {
			out.Extras.EventToken = &querypb.EventToken{
				Timestamp: result.Extras.EventToken.Timestamp,
				Shard:     result.Extras.EventToken.Shard,
				Position:  result.Extras.EventToken.Position,
			}
		}
	}
	return out
}

// CopyRow makes a copy of the row.
func CopyRow(r []Value) []Value {
	// The raw bytes of the values are supposed to be treated as read-only.
	// So, there's no need to copy them.
	out := make([]Value, len(r))
	copy(out, r)
	return out
}

// Truncate returns a new Result with all the rows truncated
// to the specified number of columns.
func (result *Result) Truncate(l int) *Result {
	if l == 0 {
		return result
	}

	out := &Result{
		InsertID:     result.InsertID,
		RowsAffected: result.RowsAffected,
	}
	if result.Fields != nil {
		out.Fields = result.Fields[:l]
	}
	if result.Rows != nil {
		out.Rows = make([][]Value, 0, len(result.Rows))
		for _, r := range result.Rows {
			out.Rows = append(out.Rows, r[:l])
		}
	}
	if result.Extras != nil {
		out.Extras = &querypb.ResultExtras{
			Fresher: result.Extras.Fresher,
		}
		if result.Extras.EventToken != nil {
			out.Extras.EventToken = &querypb.EventToken{
				Timestamp: result.Extras.EventToken.Timestamp,
				Shard:     result.Extras.EventToken.Shard,
				Position:  result.Extras.EventToken.Position,
			}
		}
	}
	return out
}

// FieldsEqual compares two arrays of fields.
// reflect.DeepEqual shouldn't be used because of the protos.
func FieldsEqual(f1, f2 []*querypb.Field) bool {
	if len(f1) != len(f2) {
		return false
	}
	for i, f := range f1 {
		if !proto.Equal(f, f2[i]) {
			return false
		}
	}
	return true
}

// Equal compares the Result with another one.
// reflect.DeepEqual shouldn't be used because of the protos.
func (result *Result) Equal(other *Result) bool {
	// Check for nil cases
	if result == nil {
		return other == nil
	}
	if other == nil {
		return false
	}

	// Compare Fields, RowsAffected, InsertID, Rows, Extras.
	return FieldsEqual(result.Fields, other.Fields) &&
		result.RowsAffected == other.RowsAffected &&
		result.InsertID == other.InsertID &&
		reflect.DeepEqual(result.Rows, other.Rows) &&
		proto.Equal(result.Extras, other.Extras)
}

// ResultsEqual compares two arrays of Result.
// reflect.DeepEqual shouldn't be used because of the protos.
func ResultsEqual(r1, r2 []Result) bool {
	if len(r1) != len(r2) {
		return false
	}
	for i, r := range r1 {
		if !r.Equal(&r2[i]) {
			return false
		}
	}
	return true
}

// MakeRowTrusted converts a *querypb.Row to []Value based on the types
// in fields. It does not sanity check the values against the type.
// Every place this function is called, a comment is needed that explains
// why it's justified.
func MakeRowTrusted(fields []*querypb.Field, row *querypb.Row) []Value {
	sqlRow := make([]Value, len(row.Lengths))
	var offset int64
	for i, length := range row.Lengths {
		if length < 0 {
			continue
		}
		sqlRow[i] = MakeTrusted(fields[i].Type, row.Values[offset:offset+length])
		offset += length
	}
	return sqlRow
}

// IncludeFieldsOrDefault normalizes the passed Execution Options.
// It returns the default value if options is nil.
func IncludeFieldsOrDefault(options *querypb.ExecuteOptions) querypb.ExecuteOptions_IncludedFields {
	if options == nil {
		return querypb.ExecuteOptions_TYPE_AND_NAME
	}

	return options.IncludedFields
}

// StripMetadata will return a new Result that has the same Rows,
// but the Field objects will have their non-critical metadata emptied.  Note we don't
// proto.Copy each Field for performance reasons, but we only copy the
// individual fields.
func (result *Result) StripMetadata(incl querypb.ExecuteOptions_IncludedFields) *Result {
	if incl == querypb.ExecuteOptions_ALL || len(result.Fields) == 0 {
		return result
	}
	r := *result
	r.Fields = make([]*querypb.Field, len(result.Fields))
	newFieldsArray := make([]querypb.Field, len(result.Fields))
	for i, f := range result.Fields {
		r.Fields[i] = &newFieldsArray[i]
		newFieldsArray[i].Type = f.Type
		if incl == querypb.ExecuteOptions_TYPE_AND_NAME {
			newFieldsArray[i].Name = f.Name
		}
	}
	return &r
}

// AppendResult will combine the Results Objects of one result
// to another result.Note currently it doesn't handle cases like
// if two results have different fields.We will enhance this function.
func (result *Result) AppendResult(src *Result) {
	if src.RowsAffected == 0 && len(src.Fields) == 0 {
		return
	}
	if result.Fields == nil {
		result.Fields = src.Fields
	}
	result.RowsAffected += src.RowsAffected
	if src.InsertID != 0 {
		result.InsertID = src.InsertID
	}
	if len(result.Rows) == 0 {
		// we haven't gotten any result yet, just save the new extras.
		result.Extras = src.Extras
	} else {
		// Merge the EventTokens / Fresher flags within Extras.
		if src.Extras == nil {
			// We didn't get any from innerq. Have to clear any
			// we'd have gotten already.
			if result.Extras != nil {
				result.Extras.EventToken = nil
				result.Extras.Fresher = false
			}
		} else {
			// We may have gotten an EventToken from
			// innerqr.  If we also got one earlier, merge
			// it. If we didn't get one earlier, we
			// discard the new one.
			if result.Extras != nil {
				// Note if any of the two is nil, we get nil.
				result.Extras.EventToken = EventTokenMinimum(result.Extras.EventToken, src.Extras.EventToken)

				result.Extras.Fresher = result.Extras.Fresher && src.Extras.Fresher
			}
		}
	}
	result.Rows = append(result.Rows, src.Rows...)
}
