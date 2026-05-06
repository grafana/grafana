package experimental

import "github.com/grafana/grafana-plugin-sdk-go/data"

// NewFrameSorter returns a new frameSorter.
func NewFrameSorter(frame *data.Frame, sortField *data.Field) FrameSorter {
	return FrameSorter{frame, sortField}
}

// FrameSorter sorts a DataFrame by field.
type FrameSorter struct {
	frame     *data.Frame
	sortField *data.Field
}

func (fs FrameSorter) Len() int { return fs.frame.Rows() }

func (fs FrameSorter) Swap(i, j int) {
	for _, field := range fs.frame.Fields {
		valA := field.At(i)
		valB := field.At(j)
		field.Set(j, valA)
		field.Set(i, valB)
	}
}

func (fs FrameSorter) Less(i, j int) bool {
	switch kind := fs.sortField.Type(); kind {
	case data.FieldTypeString:
		valA := fs.sortField.At(i).(string)
		valB := fs.sortField.At(j).(string)
		return valA < valB
	case data.FieldTypeNullableString:
		valA := fs.sortField.At(i).(*string)
		valB := fs.sortField.At(j).(*string)
		if valA == nil {
			return false
		}
		if valB == nil {
			return true
		}
		return *valA < *valB
	default:
		valA, err := fs.sortField.FloatAt(i)
		if err != nil {
			return false
		}
		valB, err := fs.sortField.FloatAt(j)
		if err != nil {
			return true
		}
		return valA < valB
	}
}
