// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package arrow

import (
	"fmt"
	"sort"
	"strings"
)

type Metadata struct {
	keys   []string
	values []string
}

func NewMetadata(keys, values []string) Metadata {
	if len(keys) != len(values) {
		panic("arrow: len mismatch")
	}

	n := len(keys)
	if n == 0 {
		return Metadata{}
	}

	md := Metadata{
		keys:   make([]string, n),
		values: make([]string, n),
	}
	copy(md.keys, keys)
	copy(md.values, values)
	return md
}

func MetadataFrom(kv map[string]string) Metadata {
	md := Metadata{
		keys:   make([]string, 0, len(kv)),
		values: make([]string, 0, len(kv)),
	}
	for k := range kv {
		md.keys = append(md.keys, k)
	}
	sort.Strings(md.keys)
	for _, k := range md.keys {
		md.values = append(md.values, kv[k])
	}
	return md
}

func (md Metadata) Len() int         { return len(md.keys) }
func (md Metadata) Keys() []string   { return md.keys }
func (md Metadata) Values() []string { return md.values }

func (md Metadata) String() string {
	o := new(strings.Builder)
	fmt.Fprintf(o, "[")
	for i := range md.keys {
		if i > 0 {
			fmt.Fprintf(o, ", ")
		}
		fmt.Fprintf(o, "%q: %q", md.keys[i], md.values[i])
	}
	fmt.Fprintf(o, "]")
	return o.String()
}

// FindKey returns the index of the key-value pair with the provided key name,
// or -1 if such a key does not exist.
func (md Metadata) FindKey(k string) int {
	for i, v := range md.keys {
		if v == k {
			return i
		}
	}
	return -1
}

func (md Metadata) clone() Metadata {
	if len(md.keys) == 0 {
		return Metadata{}
	}

	o := Metadata{
		keys:   make([]string, len(md.keys)),
		values: make([]string, len(md.values)),
	}
	copy(o.keys, md.keys)
	copy(o.values, md.values)

	return o
}

// Schema is a sequence of Field values, describing the columns of a table or
// a record batch.
type Schema struct {
	fields []Field
	index  map[string][]int
	meta   Metadata
}

// NewSchema returns a new Schema value from the slice of fields and metadata.
//
// NewSchema panics if there is a field with an invalid DataType.
func NewSchema(fields []Field, metadata *Metadata) *Schema {
	sc := &Schema{
		fields: make([]Field, 0, len(fields)),
		index:  make(map[string][]int, len(fields)),
	}
	if metadata != nil {
		sc.meta = metadata.clone()
	}
	for i, field := range fields {
		if field.Type == nil {
			panic("arrow: field with nil DataType")
		}
		sc.fields = append(sc.fields, field)
		sc.index[field.Name] = append(sc.index[field.Name], i)
	}
	return sc
}

func (sc *Schema) Metadata() Metadata { return sc.meta }
func (sc *Schema) Fields() []Field    { return sc.fields }
func (sc *Schema) Field(i int) Field  { return sc.fields[i] }

func (sc *Schema) FieldsByName(n string) ([]Field, bool) {
	indices, ok := sc.index[n]
	if !ok {
		return nil, ok
	}
	fields := make([]Field, 0, len(indices))
	for _, v := range indices {
		fields = append(fields, sc.fields[v])
	}
	return fields, ok
}

// FieldIndices returns the indices of the named field or nil.
func (sc *Schema) FieldIndices(n string) []int {
	return sc.index[n]
}

func (sc *Schema) HasField(n string) bool { return len(sc.FieldIndices(n)) > 0 }
func (sc *Schema) HasMetadata() bool      { return len(sc.meta.keys) > 0 }

// Equal returns whether two schema are equal.
// Equal does not compare the metadata.
func (sc *Schema) Equal(o *Schema) bool {
	switch {
	case sc == o:
		return true
	case sc == nil || o == nil:
		return false
	case len(sc.fields) != len(o.fields):
		return false
	}

	for i := range sc.fields {
		if !sc.fields[i].Equal(o.fields[i]) {
			return false
		}
	}
	return true
}

func (s *Schema) String() string {
	o := new(strings.Builder)
	fmt.Fprintf(o, "schema:\n  fields: %d\n", len(s.Fields()))
	for i, f := range s.Fields() {
		if i > 0 {
			o.WriteString("\n")
		}
		fmt.Fprintf(o, "    - %v", f)
	}
	if meta := s.Metadata(); meta.Len() > 0 {
		fmt.Fprintf(o, "\n  metadata: %v", meta)
	}
	return o.String()
}
