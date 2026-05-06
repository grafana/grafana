package timeseries

import (
	"fmt"
	"time"

	"github.com/grafana/dataplane/sdata"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func emptyFrameWithTypeMD(refID string, t data.FrameType, v data.FrameTypeVersion) *data.Frame {
	f := data.NewFrame("").SetMeta(&data.FrameMeta{Type: t, TypeVersion: v})
	f.RefID = refID
	return f
}

func frameHasType(f *data.Frame, t data.FrameType) bool {
	return f != nil && f.Meta != nil && f.Meta.Type == t
}

func timeIsSorted(field *data.Field) (bool, error) {
	switch {
	case field == nil:
		return false, fmt.Errorf("field is nil")
	case field.Type() != data.FieldTypeTime:
		return false, fmt.Errorf("field is not a time field")
	case field.Len() == 0:
		return true, nil
	}

	for tIdx := 1; tIdx < field.Len(); tIdx++ {
		prevTime := field.At(tIdx - 1).(time.Time)
		curTime := field.At(tIdx).(time.Time)
		if curTime.Before(prevTime) {
			return false, nil
		}
	}
	return true, nil
}

// seriesTimeCheck checks that there is []time.Time field.
// returns additional []time.Time fields.
func seriesCheckSelectTime(
	frameIdx int,
	frame *data.Frame,
) (*data.Field, []sdata.FrameFieldIndex, error) {
	var ignoredFields []sdata.FrameFieldIndex

	timeFields := frame.TypeIndices(data.FieldTypeTime)

	// Must have []time.Time field (no nullable time)
	if len(timeFields) == 0 {
		return nil, nil, fmt.Errorf("frame %v is missing a []time.Time field", frameIdx)
	}

	if len(timeFields) > 1 {
		for _, fieldIdx := range timeFields[1:] {
			ignoredFields = append(ignoredFields, sdata.FrameFieldIndex{
				FrameIdx: frameIdx, FieldIdx: fieldIdx,
				Reason: "additional time field"})
		}
	}

	// Validate time Field is sorted in ascending (oldest to newest) order
	timeField := frame.Fields[timeFields[0]]

	return timeField, ignoredFields, nil
}

// malformedFrameCheck checks if there is a nil field in the slice frames or
// if the fields are of unequal length
func malformedFrameCheck(frameIdx int, frame *data.Frame) error {
	for fieldIdx, field := range frame.Fields { // TODO: frame.TypeIndices should do this
		if field == nil {
			return fmt.Errorf("frame %v has a nil field at %v", frameIdx, fieldIdx)
		}
	}
	if _, err := frame.RowLen(); err != nil {
		return fmt.Errorf("frame %v has mismatched field lengths: %w", frameIdx, err)
	}
	return nil
}

func ignoreAdditionalFrames(reason string, frames []*data.Frame, ignored *[]sdata.FrameFieldIndex) (err error) {
	if len(frames) < 1 {
		return nil
	}
	for frameIdx, f := range (frames)[1:] {
		if f == nil {
			return fmt.Errorf("nil frame at %v which is invalid", frameIdx)
		}
		if len(f.Fields) == 0 {
			if ignored == nil {
				ignored = &([]sdata.FrameFieldIndex{})
			}
			*ignored = append(*ignored, sdata.FrameFieldIndex{
				FrameIdx: frameIdx + 1, FieldIdx: -1, Reason: reason},
			)
		}
		for fieldIdx := range frames {
			if ignored == nil {
				ignored = &([]sdata.FrameFieldIndex{})
			}
			*ignored = append(*ignored, sdata.FrameFieldIndex{
				FrameIdx: frameIdx + 1, FieldIdx: fieldIdx, Reason: reason},
			)
		}
	}
	return nil
}
