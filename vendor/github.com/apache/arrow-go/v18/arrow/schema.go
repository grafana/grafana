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

	"github.com/apache/arrow-go/v18/arrow/endian"
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
func (md Metadata) ToMap() map[string]string {
	m := make(map[string]string, len(md.keys))
	for i := range md.keys {
		m[md.keys[i]] = md.values[i]
	}
	return m
}

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

// GetValue returns the value associated with the provided key name.
// If the key does not exist, the second return value is false.
func (md Metadata) GetValue(k string) (string, bool) {
	i := md.FindKey(k)
	if i < 0 {
		return "", false
	}
	return md.values[i], true
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

func (md Metadata) sortedIndices() []int {
	idxes := make([]int, len(md.keys))
	for i := range idxes {
		idxes[i] = i
	}

	sort.Slice(idxes, func(i, j int) bool {
		return md.keys[idxes[i]] < md.keys[idxes[j]]
	})
	return idxes
}

func (md Metadata) Equal(rhs Metadata) bool {
	if md.Len() != rhs.Len() {
		return false
	}

	idxes := md.sortedIndices()
	rhsIdxes := rhs.sortedIndices()
	for i := range idxes {
		j := idxes[i]
		k := rhsIdxes[i]
		if md.keys[j] != rhs.keys[k] || md.values[j] != rhs.values[k] {
			return false
		}
	}
	return true
}

// Schema is a sequence of Field values, describing the columns of a table or
// a record batch.
type Schema struct {
	fields     []Field
	index      map[string][]int
	meta       Metadata
	endianness endian.Endianness
}

// NewSchema returns a new Schema value from the slice of fields and metadata.
//
// NewSchema panics if there is a field with an invalid DataType.
func NewSchema(fields []Field, metadata *Metadata) *Schema {
	return NewSchemaWithEndian(fields, metadata, endian.NativeEndian)
}

func NewSchemaWithEndian(fields []Field, metadata *Metadata, e endian.Endianness) *Schema {
	sc := &Schema{
		fields:     make([]Field, 0, len(fields)),
		index:      make(map[string][]int, len(fields)),
		endianness: e,
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

func (sc *Schema) WithEndianness(e endian.Endianness) *Schema {
	return NewSchemaWithEndian(sc.fields, &sc.meta, e)
}

func (sc *Schema) Endianness() endian.Endianness { return sc.endianness }
func (sc *Schema) IsNativeEndian() bool          { return sc.endianness == endian.NativeEndian }
func (sc *Schema) Metadata() Metadata            { return sc.meta }
func (sc *Schema) Fields() []Field {
	fields := make([]Field, len(sc.fields))
	copy(fields, sc.fields)
	return fields
}
func (sc *Schema) Field(i int) Field { return sc.fields[i] }
func (sc *Schema) NumFields() int    { return len(sc.fields) }

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
	case sc.endianness != o.endianness:
		return false
	}

	for i := range sc.fields {
		if !sc.fields[i].Equal(o.fields[i]) {
			return false
		}
	}
	return true
}

// AddField adds a field at the given index and return a new schema.
func (s *Schema) AddField(i int, field Field) (*Schema, error) {
	if i < 0 || i > len(s.fields) {
		return nil, fmt.Errorf("arrow: invalid field index %d", i)
	}

	fields := make([]Field, len(s.fields)+1)
	copy(fields[:i], s.fields[:i])
	fields[i] = field
	copy(fields[i+1:], s.fields[i:])
	return NewSchema(fields, &s.meta), nil
}

func (s *Schema) String() string {
	o := new(strings.Builder)
	fmt.Fprintf(o, "schema:\n  fields: %d\n", s.NumFields())
	for i, f := range s.fields {
		if i > 0 {
			o.WriteString("\n")
		}
		fmt.Fprintf(o, "    - %v", f)
	}
	if s.endianness != endian.NativeEndian {
		fmt.Fprintf(o, "\n  endianness: %v", s.endianness)
	}
	if meta := s.Metadata(); meta.Len() > 0 {
		fmt.Fprintf(o, "\n  metadata: %v", meta)
	}
	return o.String()
}

func (s *Schema) Fingerprint() string {
	if s == nil {
		return ""
	}

	var b strings.Builder
	b.WriteString("S{")
	for _, f := range s.fields {
		fieldFingerprint := f.Fingerprint()
		if fieldFingerprint == "" {
			return ""
		}

		b.WriteString(fieldFingerprint)
		b.WriteByte(';')
	}
	if s.endianness == endian.LittleEndian {
		b.WriteByte('L')
	} else {
		b.WriteByte('B')
	}
	b.WriteByte('}')
	return b.String()
}
