// Package data provides data structures that Grafana recognizes.
//
// The Frame object represents a Grafana Dataframe which can represent data such as tables
// and time series.
//
// Frames can be encoded using Apache Arrow (https://arrow.apache.org/) for transmission.
//
// The corresponding Grafana frontend package the @grafana/data package
// (https://github.com/grafana/grafana/tree/master/packages/grafana-data).
package data

import (
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"strings"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/olekukonko/tablewriter"
)

// Frame is a columnar data structure where each column is a Field.
//
// Each Field is well typed by its FieldType and supports optional Labels.
//
// A Frame is a general data container for Grafana. A Frame can be table data
// or time series data depending on its content and field types.
type Frame struct {
	// Name is used in some Grafana visualizations.
	Name string

	// Fields are the columns of a frame.
	// All Fields must be of the same the length when marshalling the Frame for transmission.
	Fields []*Field

	// RefID is a property that can be set to match a Frame to its orginating query.
	RefID string

	// Meta is metadata about the Frame, and includes space for custom metadata.
	Meta *FrameMeta
}

// UnmarshalJSON uses the `UnmarshalArrowFrame` function to unmarshal this type from JSON.
func (f *Frame) UnmarshalJSON(b []byte) error {
	arrow := []byte{}

	if err := json.Unmarshal(b, &arrow); err != nil {
		return err
	}

	frame, err := UnmarshalArrowFrame(arrow)
	if err != nil {
		return err
	}

	*f = *frame

	return nil
}

// MarshalJSON uses the `MarshalArrow` function to marshal this type to JSON.
func (f *Frame) MarshalJSON() ([]byte, error) {
	arrow, err := f.MarshalArrow()
	if err != nil {
		return nil, err
	}

	return json.Marshal(arrow)
}

// Frames is a slice of Frame pointers.
// It is the main data container within a backend.DataResponse.
type Frames []*Frame

// AppendRow adds a new row to the Frame by appending to each element of vals to
// the corresponding Field in the data.
// The Frame's Fields must be initialized or AppendRow will panic.
// The number of arguments must match the number of Fields in the Frame and each type must coorespond
// to the Field type or AppendRow will panic.
func (f *Frame) AppendRow(vals ...interface{}) {
	for i, v := range vals {
		f.Fields[i].vector.Append(v)
	}
}

// InsertRow adds a row at index rowIdx of the Frame.
// InsertRow calls each field's Insert which extends the Field length by 1,
// shifts any existing field values at indices equal or greater to rowIdx by one place
// and inserts the corresponding val at index rowIdx of the Field.
// If rowIdx is equal to the Frame RowLen, then val will be appended.
// If rowIdx exceeds the Field length, this method will panic.
func (f *Frame) InsertRow(rowIdx int, vals ...interface{}) {
	for i, v := range vals {
		f.Fields[i].vector.Insert(rowIdx, v)
	}
}

// DeleteRow deletes row at index rowIdx of the Frame.
// DeleteRow calls each field's Delete
// If idx is out of range, this method will panic.
func (f *Frame) DeleteRow(rowIdx int) {
	for _, field := range f.Fields {
		field.vector.Delete(rowIdx)
	}
}

// SetRow sets vals at the index rowIdx of the Frame.
// SetRow calls each field's Set which sets the Field's value at index idx to val.
func (f *Frame) SetRow(rowIdx int, vals ...interface{}) {
	for i, v := range vals {
		f.Fields[i].vector.Set(rowIdx, v)
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

// NewFrameOfFieldTypes returns a Frame where the Fields are initialized to the
// corresponding field type in fTypes. Each Field will be of length FieldLen.
func NewFrameOfFieldTypes(name string, fieldLen int, fTypes ...FieldType) *Frame {
	f := &Frame{
		Name:   name,
		Fields: make(Fields, len(fTypes)),
	}
	for i, fT := range fTypes {
		f.Fields[i] = NewFieldFromFieldType(fT, fieldLen)
	}
	return f
}

// TypeIndices returns a slice of Field index positions for the given fTypes.
func (f *Frame) TypeIndices(fTypes ...FieldType) []int {
	indices := []int{}
	if f.Fields == nil {
		return indices
	}
	for fieldIdx, f := range f.Fields {
		vecType := f.Type()
		for _, fType := range fTypes {
			if fType == vecType {
				indices = append(indices, fieldIdx)
				break
			}
		}
	}
	return indices
}

// SetConfig modifies the Field's Config property to
// be set to conf and returns the Field.
func (f *Field) SetConfig(conf *FieldConfig) *Field {
	f.Config = conf
	return f
}

// NewFrame returns a new Frame.
func NewFrame(name string, fields ...*Field) *Frame {
	return &Frame{
		Name:   name,
		Fields: fields,
	}
}

// SetMeta sets the Frame's Meta attribute to m and returns the Frame.
func (f *Frame) SetMeta(m *FrameMeta) *Frame {
	f.Meta = m
	return f
}

// Rows returns the number of rows in the frame.
func (f *Frame) Rows() int {
	if len(f.Fields) > 0 {
		return f.Fields[0].Len()
	}
	return 0
}

// At returns the value of the specified fieldIdx and rowIdx.
// It will panic if either fieldIdx or rowIdx are out of range.
func (f *Frame) At(fieldIdx int, rowIdx int) interface{} {
	return f.Fields[fieldIdx].vector.At(rowIdx)
}

// CopyAt returns a copy of the value of the specified fieldIdx and rowIdx.
// It will panic if either fieldIdx or rowIdx are out of range.
func (f *Frame) CopyAt(fieldIdx int, rowIdx int) interface{} {
	return f.Fields[fieldIdx].vector.CopyAt(rowIdx)
}

// Set sets the val at the specified fieldIdx and rowIdx.
// It will panic if either fieldIdx or rowIdx are out of range or
// if the underlying type of val does not match the element type of the Field.
func (f *Frame) Set(fieldIdx int, rowIdx int, val interface{}) {
	f.Fields[fieldIdx].vector.Set(rowIdx, val)
}

// SetConcrete sets the val at the specified fieldIdx and rowIdx.
// val must be a non-pointer type or a panic will occur.
// If the underlying FieldType is nullable it will set val as a pointer to val. If the FieldType
// is not nullable this method behaves the same as the Set method.
// It will panic if the underlying type of val does not match the element concrete type of the Field.
func (f *Frame) SetConcrete(fieldIdx int, rowIdx int, val interface{}) {
	f.Fields[fieldIdx].vector.SetConcrete(rowIdx, val)
}

// Extend extends all the Fields by length by i.
func (f *Frame) Extend(i int) {
	for _, f := range f.Fields {
		f.vector.Extend(i)
	}
}

// ConcreteAt returns the concrete value at the specified fieldIdx and rowIdx.
// A non-pointer type is returned regardless if the underlying type is a pointer
// type or not. If the value is a nil pointer, the the zero value
// is returned and ok will be false.
func (f *Frame) ConcreteAt(fieldIdx int, rowIdx int) (val interface{}, ok bool) {
	return f.Fields[fieldIdx].vector.ConcreteAt(rowIdx)
}

// RowLen returns the the length of the Frame Fields.
// If the lengths of all the Fields are not the same an error is returned.
func (f *Frame) RowLen() (int, error) {
	if len(f.Fields) == 0 {
		return 0, nil
	}
	var l int
	for i := 0; i < len(f.Fields); i++ {
		if f.Fields[i] == nil || f.Fields[i].vector == nil {
			return 0, fmt.Errorf("frame's field at index %v is nil", i)
		}
		if i == 0 {
			l = f.Fields[i].Len()
			continue
		}
		if l != f.Fields[i].Len() {
			return 0, fmt.Errorf("frame has different field lengths, field 0 is len %v but field %v is len %v", l, i,
				f.Fields[i].vector.Len())
		}
	}
	return l, nil
}

// FloatAt returns a float64 representation of the value at the specified fieldIdx and rowIdx, as per Field.FloatAt().
// It will panic if either the fieldIdx or rowIdx are out of range.
func (f *Frame) FloatAt(fieldIdx int, rowIdx int) (float64, error) {
	return f.Fields[fieldIdx].FloatAt(rowIdx)
}

// SetFieldNames sets each Field Name in the frame to the corresponding frame.
// If the number of provided names does not match the number of Fields in the frame an error is returned.
func (f *Frame) SetFieldNames(names ...string) error {
	fieldLen := 0
	if f.Fields != nil {
		fieldLen = len(f.Fields)
	}
	if fieldLen != len(names) {
		return fmt.Errorf("can not set field names, number of names %v does not match frame field length %v", len(names), fieldLen)
	}
	for i, name := range names {
		f.Fields[i].Name = name
	}
	return nil
}

// FrameTestCompareOptions returns go-cmp testing options to allow testing of Frame equivalence.
// Since the data within a Frame's Fields is not exported, this function allows the unexported
// values to be tested.
// The intent is to only use this for testing.
// nolint:gocyclo
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
	f64Ptrs := cmp.Comparer(func(x, y *float64) bool {
		if x == nil && y == nil {
			return true
		}
		if y == nil && x != nil || y != nil && x == nil {
			return false
		}
		return (math.IsNaN(*x) && math.IsNaN(*y)) ||
			(math.IsInf(*x, 1) && math.IsInf(*y, 1)) ||
			(math.IsInf(*x, -1) && math.IsInf(*y, -1)) ||
			*x == *y
	})
	f64s := cmp.Comparer(func(x, y float64) bool {
		return (math.IsNaN(x) && math.IsNaN(y)) ||
			(math.IsInf(x, 1) && math.IsInf(y, 1)) ||
			(math.IsInf(x, -1) && math.IsInf(y, -1)) ||
			x == y
	})
	f32Ptrs := cmp.Comparer(func(x, y *float32) bool {
		if x == nil && y == nil {
			return true
		}
		if y == nil && x != nil || y != nil && x == nil {
			return false
		}
		return (math.IsNaN(float64(*x)) && math.IsNaN(float64(*y))) ||
			(math.IsInf(float64(*x), 1) && math.IsInf(float64(*y), 1)) ||
			(math.IsInf(float64(*x), -1) && math.IsInf(float64(*y), -1)) ||
			*x == *y
	})
	f32s := cmp.Comparer(func(x, y float32) bool {
		return (math.IsNaN(float64(x)) && math.IsNaN(float64(y))) ||
			(math.IsInf(float64(x), 1) && math.IsInf(float64(y), 1)) ||
			(math.IsInf(float64(x), -1) && math.IsInf(float64(y), -1)) ||
			x == y
	})

	unexportedField := cmp.AllowUnexported(Field{})
	return []cmp.Option{f32s, f32Ptrs, f64s, f64Ptrs, confFloats, unexportedField, cmpopts.EquateEmpty()}
}

const maxLengthExceededStr = "..."

// StringTable prints a human readable table of the Frame. The output should not be used for programmatic consumption
// or testing.
// The table's width is limited to maxFields and the length is limited to maxRows (a value of -1 is unlimited).
// If the width or length is exceeded, the last column or row displays "..." as the contents.
func (f *Frame) StringTable(maxFields, maxRows int) (string, error) {
	if maxFields > 0 && maxFields < 2 {
		return "", fmt.Errorf("maxFields must be less than 0 (unlimited) or greather than 2, got %v", maxFields)
	}

	rowLen, err := f.RowLen()
	if err != nil {
		return "", err
	}

	// calculate output column width (fields)
	width := len(f.Fields)
	exceedsWidth := maxFields > 0 && width > maxFields
	if exceedsWidth {
		width = maxFields
	}

	// calculate output length (rows)
	length := rowLen
	exceedsLength := maxRows >= 0 && rowLen > maxRows
	if exceedsLength {
		length = maxRows + 1
	}

	sb := &strings.Builder{}
	sb.WriteString(fmt.Sprintf("Name: %v\n", f.Name))
	sb.WriteString(fmt.Sprintf("Dimensions: %v Fields by %v Rows\n", len(f.Fields), rowLen))

	table := tablewriter.NewWriter(sb)

	// table formatting options
	table.SetAutoFormatHeaders(false)
	table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
	table.SetAutoWrapText(false)
	table.SetAlignment(tablewriter.ALIGN_LEFT)

	// set table headers
	headers := make([]string, width)
	for colIdx, field := range f.Fields {
		if exceedsWidth && colIdx == maxFields-1 { // if Frame has more Fields than output table width and last Field
			headers[colIdx] = fmt.Sprintf("...+%v field...", len(f.Fields)-colIdx)
			break
		}
		headers[colIdx] = fmt.Sprintf("Name: %v\nLabels: %s\nType: %s", field.Name, field.Labels, field.Type())
	}
	table.SetHeader(headers)

	if maxRows == 0 {
		table.Render()
		return sb.String(), nil
	}

	for rowIdx := 0; rowIdx < length; rowIdx++ {
		iRow := f.RowCopy(rowIdx)     // interface row (source)
		sRow := make([]string, width) // string row (destination)

		if exceedsLength && rowIdx == maxRows-1 { // if Frame has more rows than output table and last row
			for i := range sRow {
				sRow[i] = maxLengthExceededStr
			}
			table.Append(sRow)
			break
		}

		for colIdx, v := range iRow {
			if exceedsWidth && colIdx == maxFields-1 { // if Frame has more Fields than output table width and last Field
				sRow[colIdx] = maxLengthExceededStr
				break
			}

			val := reflect.Indirect(reflect.ValueOf(v))
			if val.IsValid() {
				sRow[colIdx] = fmt.Sprintf("%v", val)
			} else {
				sRow[colIdx] = "null"
			}
		}
		table.Append(sRow)
	}

	table.Render()
	return sb.String(), nil
}
