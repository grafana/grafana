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

package sqlparser

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/dolthub/vitess/go/sqltypes"

	querypb "github.com/dolthub/vitess/go/vt/proto/query"
)

// ParsedQuery represents a parsed query where
// bind locations are precompued for fast substitutions.
type ParsedQuery struct {
	Query         string
	bindLocations []bindLocation
}

type bindLocation struct {
	offset, length int
}

// NewParsedQuery returns a ParsedQuery of the ast.
func NewParsedQuery(node SQLNode) *ParsedQuery {
	buf := NewTrackedBuffer(nil)
	buf.Myprintf("%v", node)
	return buf.ParsedQuery()
}

// GenerateQuery generates a query by substituting the specified
// bindVariables. The extras parameter specifies special parameters
// that can perform custom encoding.
func (pq *ParsedQuery) GenerateQuery(bindVariables map[string]*querypb.BindVariable, extras map[string]Encodable) (string, error) {
	if len(pq.bindLocations) == 0 {
		return pq.Query, nil
	}
	var buf strings.Builder
	buf.Grow(len(pq.Query))
	if err := pq.Append(&buf, bindVariables, extras); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// Append appends the generated query to the provided buffer.
func (pq *ParsedQuery) Append(buf *strings.Builder, bindVariables map[string]*querypb.BindVariable, extras map[string]Encodable) error {
	// TODO error if excess or not enough bind vars
	used := make(map[string]bool)
	current := 0
	for _, loc := range pq.bindLocations {
		buf.WriteString(pq.Query[current:loc.offset])
		name := pq.Query[loc.offset : loc.offset+loc.length]
		used[name] = true
		if encodable, ok := extras[name[1:]]; ok {
			encodable.EncodeSQL(buf)
		} else {
			supplied, _, err := FetchBindVar(name, bindVariables)
			if err != nil {
				return err
			}
			EncodeValue(buf, supplied)
		}
		current = loc.offset + loc.length
	}
	if len(used) < len(bindVariables) {
		return fmt.Errorf("invalid arguments. expected: %d, found: %d", len(used), len(bindVariables))
	}
	buf.WriteString(pq.Query[current:])
	return nil
}

// MarshalJSON is a custom JSON marshaler for ParsedQuery.
// Note that any queries longer that 512 bytes will be truncated.
func (pq *ParsedQuery) MarshalJSON() ([]byte, error) {
	return json.Marshal(TruncateForUI(pq.Query))
}

// EncodeValue encodes one bind variable value into the query.
func EncodeValue(buf *strings.Builder, value *querypb.BindVariable) {
	if value.Type != querypb.Type_TUPLE {
		// Since we already check for TUPLE, we don't expect an error.
		v, _ := sqltypes.BindVariableToValue(value)
		v.EncodeSQL(buf)
		return
	}

	// It's a TUPLE.
	buf.WriteByte('(')
	for i, bv := range value.Values {
		if i != 0 {
			buf.WriteString(", ")
		}
		sqltypes.ProtoToValue(bv).EncodeSQL(buf)
	}
	buf.WriteByte(')')
}

// FetchBindVar resolves the bind variable by fetching it from bindVariables.
func FetchBindVar(name string, bindVariables map[string]*querypb.BindVariable) (val *querypb.BindVariable, isList bool, err error) {
	name = name[1:]
	if name[0] == ':' {
		name = name[1:]
		isList = true
	}
	supplied, ok := bindVariables[name]
	if !ok {
		return nil, false, fmt.Errorf("missing bind var %s", name)
	}

	if isList {
		if supplied.Type != querypb.Type_TUPLE {
			return nil, false, fmt.Errorf("unexpected list arg type (%v) for key %s", supplied.Type, name)
		}
		if len(supplied.Values) == 0 {
			return nil, false, fmt.Errorf("empty list supplied for %s", name)
		}
		return supplied, true, nil
	}

	if supplied.Type == querypb.Type_TUPLE {
		return nil, false, fmt.Errorf("unexpected arg type (TUPLE) for non-list key %s", name)
	}

	return supplied, false, nil
}
