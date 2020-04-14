package data

import "fmt"

// FrameInputConverter is a type to support building a Frame while also
// doing conversion as data is added to the Frame.
type FrameInputConverter struct {
	Frame           *Frame
	fieldConverters []FieldConverter
}

// A FieldConverter is a type to support building Frame fields of a different
// type than one's input data.
type FieldConverter struct {
	// OutputFieldType is the type of Field that will be created.
	OutputFieldType FieldType

	// Converter is a conversion function that is called when setting Field values with a FrameInputConverter.
	// Care must be taken that the type returned by the conversion function matches the member type of the FieldType,
	// and that the input type matches the expected input type for the Converter function, or panics can occur.
	// If the Converter is nil, no conversion is performed when calling methods to set values.
	Converter Converter
}

// Converter is a function type for converting values in a Frame. It is the consumers responsibility
// to the check the underlying interface types of the input and return types to avoid panics.
type Converter func(v interface{}) (interface{}, error)

// NewFrameInputConverter returns a FrameInputConverter which is used to create a Frame from data
// that needs value conversions. The FrameInputConverter will create a new Frame with fields
// based on the FieldConverters' OutputFieldTypes of length rowLen.
func NewFrameInputConverter(fieldConvs []FieldConverter, rowLen int) (*FrameInputConverter, error) {
	fTypes := make([]FieldType, len(fieldConvs))
	for i, fc := range fieldConvs {
		fTypes[i] = fc.OutputFieldType
	}

	f := NewFrameOfFieldTypes("", rowLen, fTypes...)
	return &FrameInputConverter{
		Frame:           f,
		fieldConverters: fieldConvs,
	}, nil
}

// Set sets val a FieldIdx and rowIdx of the frame. If the corresponding FieldConverter's
// Converter is not nil, then the Converter function is called before setting the value (otherwise Frame.Set is called directly).
// If an error is returned from the Converter function this function returns that error.
// Like Frame.Set and Field.Set, it will panic if fieldIdx or rowIdx are out of range.
func (fic *FrameInputConverter) Set(fieldIdx, rowIdx int, val interface{}) error {
	if fic.fieldConverters[fieldIdx].Converter == nil {
		fic.Frame.Set(fieldIdx, rowIdx, val)
		return nil
	}
	convertedVal, err := fic.fieldConverters[fieldIdx].Converter(val)
	if err != nil {
		return err
	}
	fic.Frame.Set(fieldIdx, rowIdx, convertedVal)
	return nil
}

var asStringConverter Converter = func(v interface{}) (interface{}, error) {
	return fmt.Sprintf("%v", v), nil
}

// AsStringFieldConverter will always return a string a regardless of the input.
// This is done with fmt.Sprintf which uses reflection.
var AsStringFieldConverter = FieldConverter{
	OutputFieldType: FieldTypeString,
	Converter:       asStringConverter,
}
