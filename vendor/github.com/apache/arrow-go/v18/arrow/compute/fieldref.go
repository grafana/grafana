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

package compute

import (
	"errors"
	"fmt"
	"hash/maphash"
	"reflect"
	"strconv"
	"strings"
	"unicode"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
)

var (
	ErrEmpty           = errors.New("cannot traverse empty field path")
	ErrNoChildren      = errors.New("trying to get child of type with no children")
	ErrIndexRange      = errors.New("index out of range")
	ErrMultipleMatches = errors.New("multiple matches")
	ErrNoMatch         = errors.New("no match")
	ErrInvalid         = errors.New("field ref invalid")
)

func getFields(typ arrow.DataType) []arrow.Field {
	if nested, ok := typ.(arrow.NestedType); ok {
		return nested.Fields()
	}
	return nil
}

type listvals interface {
	ListValues() arrow.Array
}

func getChildren(arr arrow.Array) (ret []arrow.Array) {
	switch arr := arr.(type) {
	case *array.Struct:
		ret = make([]arrow.Array, arr.NumField())
		for i := 0; i < arr.NumField(); i++ {
			ret[i] = arr.Field(i)
		}
	case listvals:
		ret = []arrow.Array{arr.ListValues()}
	}
	return
}

// FieldPath represents a path to a nested field using indices of child fields.
// For example, given the indices {5, 9, 3} the field could be retrieved with:
// schema.Field(5).Type().(*arrow.StructType).Field(9).Type().(*arrow.StructType).Field(3)
//
// Attempting to retrieve a child field using a FieldPath which is not valid for a given
// schema will get an error such as an out of range index, or an empty path.
//
// FieldPaths provide for drilling down to potentially nested children for convenience
// of accepting a slice of fields, a schema or a datatype (which should contain child fields).
//
// A fieldpath can also be used to retrieve a child arrow.Array or column from a record batch.
type FieldPath []int

func (f FieldPath) String() string {
	if len(f) == 0 {
		return "FieldPath(empty)"
	}

	var b strings.Builder
	b.WriteString("FieldPath(")
	for _, i := range f {
		fmt.Fprint(&b, i)
		b.WriteByte(' ')
	}
	ret := b.String()
	return ret[:len(ret)-1] + ")"
}

// Get retrieves the corresponding nested child field by drilling through the schema's
// fields as per the field path.
func (f FieldPath) Get(s *arrow.Schema) (*arrow.Field, error) {
	return f.GetFieldFromSlice(s.Fields())
}

// GetFieldFromSlice treats the slice as the top layer of fields, so the first value
// in the field path will index into the slice, and then drill down from there.
func (f FieldPath) GetFieldFromSlice(fields []arrow.Field) (*arrow.Field, error) {
	if len(f) == 0 {
		return nil, ErrEmpty
	}

	var (
		depth = 0
		out   *arrow.Field
	)
	for _, idx := range f {
		if len(fields) == 0 {
			return nil, fmt.Errorf("%w: %s", ErrNoChildren, out.Type)
		}

		if idx < 0 || idx >= len(fields) {
			return nil, fmt.Errorf("%w: indices=%s", ErrIndexRange, f[:depth+1])
		}

		out = &fields[idx]
		fields = getFields(out.Type)
		depth++
	}

	return out, nil
}

func (f FieldPath) getArray(arrs []arrow.Array) (arrow.Array, error) {
	if len(f) == 0 {
		return nil, ErrEmpty
	}

	var (
		depth = 0
		out   arrow.Array
	)
	for _, idx := range f {
		if len(arrs) == 0 {
			return nil, fmt.Errorf("%w: %s", ErrNoChildren, out.DataType())
		}

		if idx < 0 || idx >= len(arrs) {
			return nil, fmt.Errorf("%w. indices=%s", ErrIndexRange, f[:depth+1])
		}

		out = arrs[idx]
		arrs = getChildren(out)
		depth++
	}
	return out, nil
}

// GetFieldFromType returns the nested field from a datatype by drilling into it's
// child fields.
func (f FieldPath) GetFieldFromType(typ arrow.DataType) (*arrow.Field, error) {
	return f.GetFieldFromSlice(getFields(typ))
}

// GetField is equivalent to GetFieldFromType(field.Type)
func (f FieldPath) GetField(field arrow.Field) (*arrow.Field, error) {
	return f.GetFieldFromType(field.Type)
}

// GetColumn will return the correct child array by traversing the fieldpath
// going to the nested arrays of the columns in the record batch.
func (f FieldPath) GetColumn(batch arrow.Record) (arrow.Array, error) {
	return f.getArray(batch.Columns())
}

func (f FieldPath) findAll(fields []arrow.Field) []FieldPath {
	_, err := f.GetFieldFromSlice(fields)
	if err == nil {
		return []FieldPath{f}
	}
	return nil
}

// a nameref represents a FieldRef by name of the field
type nameRef string

func (n nameRef) String() string {
	return "Name(" + string(n) + ")"
}

func (ref nameRef) findAll(fields []arrow.Field) []FieldPath {
	out := []FieldPath{}
	for i, f := range fields {
		if f.Name == string(ref) {
			out = append(out, FieldPath{i})
		}
	}
	return out
}

func (ref nameRef) hash(h *maphash.Hash) { h.WriteString(string(ref)) }

type matches struct {
	prefixes []FieldPath
	refs     []*arrow.Field
}

func (m *matches) add(prefix, suffix FieldPath, fields []arrow.Field) {
	f, err := suffix.GetFieldFromSlice(fields)
	if err != nil {
		panic(err)
	}

	m.refs = append(m.refs, f)
	m.prefixes = append(m.prefixes, append(prefix, suffix...))
}

// refList represents a list of references to use to determine which nested
// field is being referenced. allowing combinations of field indices and names
type refList []FieldRef

func (r refList) String() string {
	var b strings.Builder
	b.WriteString("Nested(")
	for _, f := range r {
		fmt.Fprint(&b, f)
		b.WriteByte(' ')
	}
	ret := b.String()
	return ret[:len(ret)-1] + ")"
}

func (ref refList) hash(h *maphash.Hash) {
	for _, r := range ref {
		r.hash(h)
	}
}

func (ref refList) findAll(fields []arrow.Field) []FieldPath {
	if len(ref) == 0 {
		return nil
	}

	m := matches{}
	for _, list := range ref[0].FindAll(fields) {
		m.add(FieldPath{}, list, fields)
	}

	for _, r := range ref[1:] {
		next := matches{}
		for i, f := range m.refs {
			for _, match := range r.FindAllField(*f) {
				next.add(m.prefixes[i], match, getFields(f.Type))
			}
		}
		m = next
	}
	return m.prefixes
}

type refImpl interface {
	fmt.Stringer
	findAll(fields []arrow.Field) []FieldPath
	hash(h *maphash.Hash)
}

// FieldRef is a descriptor of a (potentially nested) field within a schema.
//
// Unlike FieldPath (which is exclusively indices of child fields), FieldRef
// may reference a field by name. It can be constructed from either
// a field index, field name, or field path.
//
// Nested fields can be referenced as well, given the schema:
//
//			arrow.NewSchema([]arrow.Field{
//				{Name: "a", Type: arrow.StructOf(arrow.Field{Name: "n", Type: arrow.Null})},
//	 		{Name: "b", Type: arrow.PrimitiveTypes.Int32},
//			})
//
// the following all indicate the nested field named "n":
//
//	FieldRefPath(FieldPath{0, 0})
//	FieldRefList("a", 0)
//	FieldRefList("a", "n")
//	FieldRefList(0, "n")
//	NewFieldRefFromDotPath(".a[0]")
//
// FieldPaths matching a FieldRef are retrieved with the FindAll* functions
// Multiple matches are possible because field names may be duplicated within
// a schema. For example:
//
//	aIsAmbiguous := arrow.NewSchema([]arrow.Field{
//		{Name: "a", Type: arrow.PrimitiveTypes.Int32},
//		{Name: "a", Type: arrow.PrimitiveTypes.Float32},
//	})
//	matches := FieldRefName("a").FindAll(aIsAmbiguous)
//	assert.Len(matches, 2)
//	assert.True(matches[0].Get(aIsAmbiguous).Equals(aIsAmbiguous.Field(0))
//	assert.True(matches[1].Get(aIsAmbiguous).Equals(aIsAmbiguous.Field(1))
type FieldRef struct {
	impl refImpl
}

// FieldRefPath constructs a FieldRef from a given FieldPath
func FieldRefPath(p FieldPath) FieldRef {
	return FieldRef{impl: p}
}

// FieldRefIndex is a convenience function to construct a FieldPath reference
// of a single index
func FieldRefIndex(i int) FieldRef {
	return FieldRef{impl: FieldPath{i}}
}

// FieldRefName constructs a FieldRef by name
func FieldRefName(n string) FieldRef {
	return FieldRef{impl: nameRef(n)}
}

// FieldRefList takes an arbitrary number of arguments which can be either
// strings or ints. This will panic if anything other than a string or int
// is passed in.
func FieldRefList(elems ...interface{}) FieldRef {
	list := make(refList, len(elems))
	for i, e := range elems {
		switch e := e.(type) {
		case string:
			list[i] = FieldRefName(e)
		case int:
			list[i] = FieldRefIndex(e)
		}
	}
	return FieldRef{impl: list}
}

// NewFieldRefFromDotPath parses a dot path into a field ref.
//
// dot_path = '.' name
//
//	| '[' digit+ ']'
//	| dot_path+
//
// Examples
//
//	".alpha" => FieldRefName("alpha")
//	"[2]" => FieldRefIndex(2)
//	".beta[3]" => FieldRefList("beta", 3)
//	"[5].gamma.delta[7]" => FieldRefList(5, "gamma", "delta", 7)
//	".hello world" => FieldRefName("hello world")
//	`.\[y\]\\tho\.\` => FieldRef(`[y]\tho.\`)
//
// Note: when parsing a name, a '\' preceding any other character will be
// dropped from the resulting name. therefore if a name must contain the characters
// '.', '\', '[' or ']' then they must be escaped with a preceding '\'.
func NewFieldRefFromDotPath(dotpath string) (out FieldRef, err error) {
	if len(dotpath) == 0 {
		return out, fmt.Errorf("%w dotpath was empty", ErrInvalid)
	}

	parseName := func() string {
		var name string
		for {
			idx := strings.IndexAny(dotpath, `\[.`)
			if idx == -1 {
				name += dotpath
				dotpath = ""
				break
			}

			if dotpath[idx] != '\\' {
				// subscript for a new field ref
				name += dotpath[:idx]
				dotpath = dotpath[idx:]
				break
			}

			if len(dotpath) == idx+1 {
				// dotpath ends with a backslash; consume it all
				name += dotpath
				dotpath = ""
				break
			}

			// append all characters before backslash, then the character which follows it
			name += dotpath[:idx] + string(dotpath[idx+1])
			dotpath = dotpath[idx+2:]
		}
		return name
	}

	children := make([]FieldRef, 0)

	for len(dotpath) > 0 {
		subscript := dotpath[0]
		dotpath = dotpath[1:]
		switch subscript {
		case '.':
			// next element is a name
			children = append(children, FieldRef{nameRef(parseName())})
		case '[':
			subend := strings.IndexFunc(dotpath, func(r rune) bool { return !unicode.IsDigit(r) })
			if subend == -1 || dotpath[subend] != ']' {
				return out, fmt.Errorf("%w: dot path '%s' contained an unterminated index", ErrInvalid, dotpath)
			}
			idx, _ := strconv.Atoi(dotpath[:subend])
			children = append(children, FieldRef{FieldPath{idx}})
			dotpath = dotpath[subend+1:]
		default:
			return out, fmt.Errorf("%w: dot path must begin with '[' or '.' got '%s'", ErrInvalid, dotpath)
		}
	}

	out.flatten(children)
	return
}

func (f FieldRef) hash(h *maphash.Hash) { f.impl.hash(h) }

// Hash produces a hash of this field reference and takes in a seed so that
// it can maintain consistency across multiple places / processes /etc.
func (f FieldRef) Hash(seed maphash.Seed) uint64 {
	h := maphash.Hash{}
	h.SetSeed(seed)
	f.hash(&h)
	return h.Sum64()
}

// IsName returns true if this fieldref is a name reference
func (f *FieldRef) IsName() bool {
	_, ok := f.impl.(nameRef)
	return ok
}

// IsFieldPath returns true if this FieldRef uses a fieldpath
func (f *FieldRef) IsFieldPath() bool {
	_, ok := f.impl.(FieldPath)
	return ok
}

// IsNested returns true if this FieldRef expects to represent
// a nested field.
func (f *FieldRef) IsNested() bool {
	switch impl := f.impl.(type) {
	case nameRef:
		return false
	case FieldPath:
		return len(impl) > 1
	default:
		return true
	}
}

// Name returns the name of the field this references if it is
// a Name reference, otherwise the empty string
func (f *FieldRef) Name() string {
	n, _ := f.impl.(nameRef)
	return string(n)
}

// FieldPath returns the fieldpath that this FieldRef uses, otherwise
// an empty FieldPath if it's not a FieldPath reference
func (f *FieldRef) FieldPath() FieldPath {
	p, _ := f.impl.(FieldPath)
	return p
}

func (f *FieldRef) Equals(other FieldRef) bool {
	return reflect.DeepEqual(f.impl, other.impl)
}

func (f *FieldRef) flatten(children []FieldRef) {
	out := make([]FieldRef, 0, len(children))

	var populate func(refImpl)
	populate = func(refs refImpl) {
		switch r := refs.(type) {
		case nameRef:
			out = append(out, FieldRef{r})
		case FieldPath:
			out = append(out, FieldRef{r})
		case refList:
			for _, c := range r {
				populate(c.impl)
			}
		}
	}

	populate(refList(children))

	if len(out) == 1 {
		f.impl = out[0].impl
	} else {
		f.impl = refList(out)
	}
}

// FindAll returns all the fieldpaths which this FieldRef matches in the given
// slice of fields.
func (f FieldRef) FindAll(fields []arrow.Field) []FieldPath {
	return f.impl.findAll(fields)
}

// FindAllField returns all the fieldpaths that this FieldRef matches against
// the type of the given field.
func (f FieldRef) FindAllField(field arrow.Field) []FieldPath {
	return f.impl.findAll(getFields(field.Type))
}

// FindOneOrNone is a convenience helper that will either return 1 fieldpath,
// or an empty fieldpath, and will return an error if there are multiple matches.
func (f FieldRef) FindOneOrNone(schema *arrow.Schema) (FieldPath, error) {
	matches := f.FindAll(schema.Fields())
	if len(matches) > 1 {
		return nil, fmt.Errorf("%w for %s in %s", ErrMultipleMatches, f, schema)
	}
	if len(matches) == 0 {
		return nil, nil
	}
	return matches[0], nil
}

// FindOneOrNoneRecord is like FindOneOrNone but for the schema of a record,
// returning an error only if there are multiple matches.
func (f FieldRef) FindOneOrNoneRecord(root arrow.Record) (FieldPath, error) {
	return f.FindOneOrNone(root.Schema())
}

// FindOne returns an error if the field isn't matched or if there are multiple matches
// otherwise it returns the path to the single valid match.
func (f FieldRef) FindOne(schema *arrow.Schema) (FieldPath, error) {
	matches := f.FindAll(schema.Fields())
	if len(matches) == 0 {
		return nil, fmt.Errorf("%w for %s in %s", ErrNoMatch, f, schema)
	}
	if len(matches) > 1 {
		return nil, fmt.Errorf("%w for %s in %s", ErrMultipleMatches, f, schema)
	}
	return matches[0], nil
}

// GetAllColumns gets all the matching column arrays from the given record that
// this FieldRef references.
func (f FieldRef) GetAllColumns(root arrow.Record) ([]arrow.Array, error) {
	out := make([]arrow.Array, 0)
	for _, m := range f.FindAll(root.Schema().Fields()) {
		n, err := m.GetColumn(root)
		if err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, nil
}

// GetOneField will return a pointer to a field or an error if it is not found
// or if there are multiple matches.
func (f FieldRef) GetOneField(schema *arrow.Schema) (*arrow.Field, error) {
	match, err := f.FindOne(schema)
	if err != nil {
		return nil, err
	}

	return match.GetFieldFromSlice(schema.Fields())
}

// GetOneOrNone will return a field or a nil if the field is found or not, and
// only errors if there are multiple matches.
func (f FieldRef) GetOneOrNone(schema *arrow.Schema) (*arrow.Field, error) {
	match, err := f.FindOneOrNone(schema)
	if err != nil {
		return nil, err
	}
	if len(match) == 0 {
		return nil, nil
	}
	return match.GetFieldFromSlice(schema.Fields())
}

// GetOneColumnOrNone returns either a nil or the referenced array if it can be
// found, erroring only if there is an ambiguous multiple matches.
func (f FieldRef) GetOneColumnOrNone(root arrow.Record) (arrow.Array, error) {
	match, err := f.FindOneOrNoneRecord(root)
	if err != nil {
		return nil, err
	}
	if len(match) == 0 {
		return nil, nil
	}
	return match.GetColumn(root)
}

func (f FieldRef) String() string {
	return "FieldRef." + f.impl.String()
}
