package dataframe

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// FieldType is used to describe the type of data in a field.
type FieldType int

// All valid field types.
const (
	FieldTypeOther FieldType = iota
	FieldTypeTime
	FieldTypeNumber
	FieldTypeString
	FieldTypeBoolean
)

func (f FieldType) String() string {
	switch f {
	case FieldTypeOther:
		return "other"
	case FieldTypeNumber:
		return "number"
	case FieldTypeString:
		return "string"
	case FieldTypeBoolean:
		return "boolean"
	case FieldTypeTime:
		return "time"
	default:
		return "unknown"
	}
}

// Field represents a column of data with a specific type.
type Field struct {
	Name   string
	Type   FieldType
	Vector Vector
}

type Fields []*Field

func assertFieldType(got, want FieldType) {
	if got != want {
		panic(fmt.Sprintf("values doesn't match the specified field type"))
	}
}

// NewField returns a new instance of Field.
func NewField(name string, fieldType FieldType, values interface{}) *Field {
	var vec Vector

	switch v := values.(type) {
	case []*float64:
		assertFieldType(fieldType, FieldTypeNumber)
		vec = newVector(fieldType, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*int64:
		assertFieldType(fieldType, FieldTypeNumber)
		vec = newVector(fieldType, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*time.Time:
		assertFieldType(fieldType, FieldTypeTime)
		vec = newVector(fieldType, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*string:
		assertFieldType(fieldType, FieldTypeString)
		vec = newVector(fieldType, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*bool:
		assertFieldType(fieldType, FieldTypeBoolean)
		vec = newVector(fieldType, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []float64:
		assertFieldType(fieldType, FieldTypeNumber)
		vec = newVector(fieldType, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, &v[i])
		}
	case []int64:
		assertFieldType(fieldType, FieldTypeNumber)
		vec = newVector(fieldType, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, &v[i])
		}
	case []time.Time:
		assertFieldType(fieldType, FieldTypeTime)
		vec = newVector(fieldType, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, &v[i])
		}
	case []string:
		assertFieldType(fieldType, FieldTypeString)
		vec = newVector(fieldType, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, &v[i])
		}
	case []bool:
		assertFieldType(fieldType, FieldTypeBoolean)
		vec = newVector(fieldType, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, &v[i])
		}
	}

	return &Field{
		Name:   name,
		Type:   fieldType,
		Vector: vec,
	}
}

// Len returns the number of elements in the field.
func (f *Field) Len() int {
	return f.Vector.Len()
}

// Labels are used to add metadata to an object.
type Labels map[string]string

// Equals returns true if the argument has the same k=v pairs as the receiver.
func (l Labels) Equals(arg Labels) bool {
	if len(l) != len(arg) {
		return false
	}
	for k, v := range l {
		if argVal, ok := arg[k]; !ok || argVal != v {
			return false
		}
	}
	return true
}

// Contains returns true if all k=v pairs of the argument are in the receiver.
func (l Labels) Contains(arg Labels) bool {
	if len(arg) > len(l) {
		return false
	}
	for k, v := range arg {
		if argVal, ok := l[k]; !ok || argVal != v {
			return false
		}
	}
	return true
}

func (l Labels) String() string {
	// Better structure, should be sorted, copy prom probably
	keys := make([]string, len(l))
	i := 0
	for k := range l {
		keys[i] = k
		i++
	}
	sort.Strings(keys)

	var sb strings.Builder

	i = 0
	for _, k := range keys {
		sb.WriteString(k)
		sb.WriteString("=")
		sb.WriteString(l[k])
		if i != len(keys)-1 {
			sb.WriteString(", ")
		}
		i++
	}
	return sb.String()
}

// LabelsFromString parses the output of Labels.String() into
// a Labels object. It probably has some flaws.
func LabelsFromString(s string) (Labels, error) {
	labels := make(map[string]string)
	if s == "" {
		return labels, nil
	}

	for _, rawKV := range strings.Split(s, ", ") {
		kV := strings.SplitN(rawKV, "=", 2)
		if len(kV) != 2 {
			return nil, fmt.Errorf(`invalid label key=value pair "%v"`, rawKV)
		}
		labels[kV[0]] = kV[1]
	}

	return labels, nil
}

// Frame represents a columnar storage with optional labels.
type Frame struct {
	Name   string
	Labels Labels
	Fields []*Field

	RefID string
}

// New returns a new instance of a Frame.
func New(name string, labels Labels, fields ...*Field) *Frame {
	return &Frame{
		Name:   name,
		Labels: labels,
		Fields: fields,
	}
}

// Rows returns the number of rows in the frame.
func (f *Frame) Rows() int {
	if len(f.Fields) > 0 {
		return f.Fields[0].Len()
	}
	return 0
}
