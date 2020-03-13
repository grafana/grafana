// Package data provides data structures that Grafana recognizes. The Frame
// object represents a Grafana Dataframe which can represent data such as tables
// and time series.
package data

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
)

// Frame represents a columnar storage with optional labels.
type Frame struct {
	Name   string
	Fields []*Field

	RefID    string
	Meta     *QueryResultMeta
	Warnings []Warning
}

// Field represents a column of data with a specific type.
type Field struct {
	Name   string
	Config *FieldConfig
	vector vector // TODO? in the frontend, the variable is called "Values"
	Labels Labels
}

// Fields is a slice of Field pointers.
type Fields []*Field

// AppendRow adds a new row to the Frame by appending to each element of vals to
// the corresponding Field in the data.
// The Frame's Fields must be initalized or AppendRow will panic.
// The number of arguments must match the number of Fields in the Frame and each type must coorespond
// to the Field type or AppendRow will panic.
func (f *Frame) AppendRow(vals ...interface{}) {
	for i, v := range vals {
		f.Fields[i].vector.Append(v)
	}
}

// RowCopy returns an interface slice that contains the values of each Field for the given rowIdx.
func (f *Frame) RowCopy(rowIdx int) []interface{} {
	vals := make([]interface{}, len(f.Fields))
	for i := range f.Fields {
		vals[i] = f.CopyAt(i, rowIdx)
	}
	return vals
}

// AppendWarning adds warnings to the data frame.
func (f *Frame) AppendWarning(message string, details string) {
	f.Warnings = append(f.Warnings, Warning{Message: message, Details: details})
}

// AppendRowSafe adds a new row to the Frame by appending to each each element of vals to
// the corresponding Field in the data. It has the some constraints as AppendRow but will
// return an error under those conditions instead of panicing.
func (f *Frame) AppendRowSafe(vals ...interface{}) error {
	if len(vals) != len(f.Fields) {
		return fmt.Errorf("failed to append vals to Frame. Frame has %v fields but was given %v to append", len(f.Fields), len(vals))
	}
	// check validity before any modification
	for i, v := range vals {
		if f.Fields[i] == nil || f.Fields[i].vector == nil {
			return fmt.Errorf("can not append to uninitalized Field at field index %v", i)
		}
		dfPType := f.Fields[i].Type()
		if v == nil {
			if !dfPType.Nullable() {
				return fmt.Errorf("can not append nil to non-nullable vector with underlying type %s at field index %v", dfPType, i)
			}
		}
		if v != nil && fieldTypeFromVal(v) != dfPType {
			return fmt.Errorf("invalid type appending row at index %v, got %T want %v", i, v, dfPType.ItemTypeString())
		}
		f.Fields[i].vector.Append(v)
	}
	return nil
}

// FilterRowsByField returns a copy of frame f (as per EmptyCopy()) that includes rows
// where the filter returns true and no error. If filter returns an error, then an error is returned.
func (f *Frame) FilterRowsByField(fieldIdx int, filter func(i interface{}) (bool, error)) (*Frame, error) {
	filteredFrame := f.EmptyCopy()
	rowLen, err := f.RowLen()
	if err != nil {
		return nil, err
	}
	for inRowIdx := 0; inRowIdx < rowLen; inRowIdx++ {
		match, err := filter(f.At(fieldIdx, inRowIdx))
		if err != nil {
			return nil, err
		}
		if !match {
			continue
		}
		filteredFrame.AppendRow(f.RowCopy(inRowIdx)...)
	}
	return filteredFrame, nil
}

// EmptyCopy returns a copy of Frame f but with Fields of zero length, and no copy of the FieldConfigs, Metadata, or Warnings.
func (f *Frame) EmptyCopy() *Frame {
	newFrame := &Frame{
		Name:   f.Name,
		RefID:  f.RefID,
		Fields: make(Fields, 0, len(f.Fields)),
	}

	for _, field := range f.Fields {
		copy := NewFieldFromFieldType(field.Type(), 0)
		copy.Name = field.Name
		copy.Labels = field.Labels.Copy()
		newFrame.Fields = append(newFrame.Fields, copy)
	}
	return newFrame
}

// TypeIndices returns a slice of Field index positions for the given pTypes.
func (f *Frame) TypeIndices(pTypes ...FieldType) []int {
	indices := []int{}
	if f.Fields == nil {
		return indices
	}
	for fieldIdx, f := range f.Fields {
		vecType := f.Type()
		for _, pType := range pTypes {
			if pType == vecType {
				indices = append(indices, fieldIdx)
				break
			}
		}
	}
	return indices
}

// NewField returns a new instance of Field.
func NewField(name string, labels Labels, values interface{}) *Field {
	var vec vector
	switch v := values.(type) {
	case []int8:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*int8:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []int16:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*int16:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []int32:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*int32:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []int64:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*int64:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []uint8:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*uint8:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []uint16:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*uint16:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []uint32:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*uint32:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []uint64:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*uint64:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []float32:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*float32:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []float64:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*float64:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []string:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*string:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []bool:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*bool:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []time.Time:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*time.Time:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	default:
		panic(fmt.Errorf("unsupported field type %T", v))
	}

	return &Field{
		Name:   name,
		vector: vec,
		Labels: labels,
	}
}

// Set sets the Field's value at index idx to val.
// It will panic if idx is out of range.
func (f *Field) Set(idx int, val interface{}) {
	f.vector.Set(idx, val)
}

// Append appends element i to the Field.
func (f *Field) Append(i interface{}) {
	f.vector.Append(i)
}

// Extend extends the Field length by i.
func (f *Field) Extend(i int) {
	f.vector.Extend(i)
}

// At returns the the element at index idx of the Field.
// It will panic if idx is out of range.
func (f *Field) At(idx int) interface{} {
	return f.vector.At(idx)
}

// Len returns the number of elements in the Field.
func (f *Field) Len() int {
	return f.vector.Len()
}

// Type returns the underlying primitive type of the Field.
func (f *Field) Type() FieldType {
	return f.vector.Type()
}

// PointerAt returns a pointer to the value at idx of the Field.
// It will panic if idx is out of range.
func (f *Field) PointerAt(idx int) interface{} {
	return f.vector.PointerAt(idx)
}

// CopyAt returns a copy of the value of the specified index idx.
// It will panic if idx is out of range.
func (f *Field) CopyAt(idx int) interface{} {
	return f.vector.CopyAt(idx)
}

// ConcreteAt returns the concrete value at the specified index idx.
// A non-pointer type is returned regardless if the underlying vector is a pointer
// type or not. If the value is a pointer type, and is nil, then the zero value
// is returned and ok will be false.
func (f *Field) ConcreteAt(idx int) (val interface{}, ok bool) {
	return f.vector.ConcreteAt(idx)
}

// Nullable returns if the the Field's elements are nullable.
func (f *Field) Nullable() bool {
	return f.Type().Nullable()
}

// SetConfig modifies the Field's Config property to
// be set to conf and returns the Field.
func (f *Field) SetConfig(conf *FieldConfig) *Field {
	f.Config = conf
	return f
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

// Copy returns a copy of the labels.
func (l Labels) Copy() Labels {
	c := make(Labels, len(l))
	for k, v := range l {
		c[k] = v
	}
	return c
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
	if s == "" {
		return nil, nil
	}
	labels := make(map[string]string)

	for _, rawKV := range strings.Split(s, ", ") {
		kV := strings.SplitN(rawKV, "=", 2)
		if len(kV) != 2 {
			return nil, fmt.Errorf(`invalid label key=value pair "%v"`, rawKV)
		}
		labels[kV[0]] = kV[1]
	}

	return labels, nil
}

// NewFrame returns a new instance of a Frame.
func NewFrame(name string, fields ...*Field) *Frame {
	return &Frame{
		Name:   name,
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

// At returns the value of the specified fieldIdx and rowIdx.
// It will panic if either the fieldIdx or rowIdx are out of range.
func (f *Frame) At(fieldIdx int, rowIdx int) interface{} {
	return f.Fields[fieldIdx].vector.At(rowIdx)
}

// CopyAt returns a copy of the value of the specified fieldIdx and rowIdx.
// It will panic if either the fieldIdx or rowIdx are out of range.
func (f *Frame) CopyAt(fieldIdx int, rowIdx int) interface{} {
	return f.Fields[fieldIdx].vector.CopyAt(rowIdx)
}

// Set set the val to the specified fieldIdx and rowIdx.
// It will panic if either the fieldIdx or rowIdx are out of range.
func (f *Frame) Set(fieldIdx int, rowIdx int, val interface{}) {
	f.Fields[fieldIdx].vector.Set(rowIdx, val)
}

// Extend extends all the Fields by length by i.
func (f *Frame) Extend(i int) {
	for _, f := range f.Fields {
		f.vector.Extend(i)
	}
}

// ConcreteAt returns the concrete value at the specified fieldIdx and rowIdx.
// A non-pointer type is returned regardless if the underlying type is a pointer
// type or not. If the value is a pointer type, and is nil, then the zero value
// is returned and ok will be false.
func (f *Frame) ConcreteAt(fieldIdx int, rowIdx int) (val interface{}, ok bool) {
	return f.Fields[fieldIdx].vector.ConcreteAt(rowIdx)
}

// RowLen returns the the length of the Frame Fields.
// If the Length of all the Fields is not the same then error is returned.
// If the Frame's Fields are nil an error is returned.
func (f *Frame) RowLen() (int, error) {
	if f.Fields == nil || len(f.Fields) == 0 {
		return 0, fmt.Errorf("frame's fields are nil or of zero length")
	}

	var l int
	for i := 0; i < len(f.Fields); i++ {
		if f.Fields[i].vector == nil {
			return 0, fmt.Errorf("frame's field at index %v is nil", i)
		}
		if i == 0 {
			l = f.Fields[i].Len()
			continue
		}
		if l != f.Fields[i].Len() {
			return 0, fmt.Errorf("frame has different field lengths, field 0 is len %v but field %v is len %v", l, i, f.Fields[i].vector.Len())
		}

	}
	return l, nil
}

// FrameTestCompareOptions returns go-cmp testing options to allow testing of Frame equivelnce.
// The intent is to only use this for testing.
func FrameTestCompareOptions() []cmp.Option {
	confFloats := cmp.Comparer(func(x, y *ConfFloat64) bool {
		if x == nil && y == nil {
			return true
		}
		if y == nil {
			if math.IsNaN(float64(*x)) {
				return true
			}
			if math.IsInf(float64(*x), 1) {
				return true
			}
			if math.IsInf(float64(*x), -1) {
				return true
			}
		}
		if x == nil {
			if math.IsNaN(float64(*y)) {
				return true
			}
			if math.IsInf(float64(*y), 1) {
				return true
			}
			if math.IsInf(float64(*y), -1) {
				return true
			}
		}
		return *x == *y
	})

	unexportedField := cmp.AllowUnexported(Field{})
	return []cmp.Option{confFloats, unexportedField, cmpopts.EquateEmpty()}
}
