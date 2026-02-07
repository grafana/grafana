package timeseries

import (
	"fmt"
	"time"

	"github.com/grafana/dataplane/sdata"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// WideFrame is a time series format where all the series live in one frame.
// This time series format should be use for data that natively uses Labels and
// when all of the series are guaranteed to have identical time values.
type WideFrame []*data.Frame

var WideFrameVersionLatest = WideFrameVersions()[len(WideFrameVersions())-1]

func WideFrameVersions() []data.FrameTypeVersion {
	return []data.FrameTypeVersion{{0, 1}}
}

func NewWideFrame(refID string, v data.FrameTypeVersion) (*WideFrame, error) {
	if v.Greater(WideFrameVersionLatest) {
		return nil, fmt.Errorf("can not create WideFrame of version %s because it is newer than library version %v", v, WideFrameVersionLatest)
	}
	f := data.NewFrame("")
	f.RefID = refID
	f.SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesWide, TypeVersion: v})
	return &WideFrame{f}, nil
}

func (wf *WideFrame) SetTime(timeName string, t []time.Time) error {
	switch {
	case wf == nil:
		return fmt.Errorf("wf is nil, NewWideFrame must be called first")
	case len(*wf) == 0:
		return fmt.Errorf("missing frame, NewWideFrame must be called first")
	case len(*wf) > 1:
		return fmt.Errorf("may not set time after adding extra frames")
	}

	frame := (*wf)[0]

	switch {
	case t == nil:
		return fmt.Errorf("t may not be nil")
	case frame.Fields != nil:
		return fmt.Errorf("expected fields property to be nil (metrics added before calling SetTime?)")
	case frame == nil:
		return fmt.Errorf("missing is nil, NewWideFrame must be called first")
	}

	frame.Fields = append(frame.Fields, data.NewField(timeName, nil, t))
	return nil
}

func (wf *WideFrame) AddSeries(metricName string, values interface{}, l data.Labels, config *data.FieldConfig) error {
	if !data.ValidFieldType(values) {
		return fmt.Errorf("type %T is not a valid data frame field type", values)
	}

	switch {
	case wf == nil:
		return fmt.Errorf("wf is nil, NewWideFrame must be called first")
	case len(*wf) == 0:
		return fmt.Errorf("missing frame, NewWideFrame must be called first")
	case len(*wf) > 1:
		return fmt.Errorf("may not add metrics after adding extra frames")
	}

	frame := (*wf)[0]

	if frame == nil {
		return fmt.Errorf("missing is nil, NewWideFrame must be called first")
	}

	// Note: Readers are not required to make the Time field first, but using New/SetTime/AddSeries does.
	if len(frame.Fields) == 0 || frame.Fields[0].Type() != data.FieldTypeTime {
		return fmt.Errorf("frame is missing time field or time field is not first, SetTime must be called first")
	}

	valueField := data.NewField(metricName, l, values)

	if valueField.Len() != frame.Fields[0].Len() {
		return fmt.Errorf("value field length must match time field length, but got length %v for time and %v for values",
			frame.Fields[0].Len(), valueField.Len())
	}

	valueField.Config = config

	frame.Fields = append(frame.Fields, valueField)

	return nil
}

func (wf *WideFrame) GetCollection(validateData bool) (Collection, error) {
	return validateAndGetRefsWide(wf, validateData)
}

func (wf *WideFrame) SetMetricMD(metricName string, l data.Labels, fc data.FieldConfig) {
	panic("not implemented")
}

func validateAndGetRefsWide(wf *WideFrame, validateData bool) (Collection, error) {
	var c Collection
	metricIndex := make(map[[2]string]struct{})

	switch {
	case wf == nil:
		return c, fmt.Errorf("frames may not be nil")
	case len(*wf) == 0:
		return c, fmt.Errorf("missing frame, must be at least one frame")
	}

	frame := (*wf)[0]

	if frame == nil {
		return c, fmt.Errorf("frame is nil which is invalid")
	}

	c.RefID = frame.RefID

	if !frameHasType(frame, data.FrameTypeTimeSeriesWide) {
		return c, fmt.Errorf("frame has wrong type, expected TimeSeriesWide but got %q", frame.Meta.Type)
	}

	if frame.Meta.TypeVersion != WideFrameVersionLatest {
		c.Warning = &sdata.VersionWarning{DataVersion: frame.Meta.TypeVersion, LibraryVersion: WideFrameVersionLatest, DataType: data.FrameTypeTimeSeriesWide}
	}

	if len(frame.Fields) == 0 { // TODO: Error differently if nil and not zero length?
		if err := ignoreAdditionalFrames("additional frame on empty response", *wf, &c.RemainderIndices); err != nil {
			return c, err
		}
		c.Refs = []MetricRef{}
		return c, nil // empty response
	}

	if err := malformedFrameCheck(0, frame); err != nil {
		return c, err
	}

	timeField, ignoredTimedFields, err := seriesCheckSelectTime(0, frame)
	if err != nil {
		return c, err
	}
	if ignoredTimedFields != nil {
		c.RemainderIndices = append(c.RemainderIndices, ignoredTimedFields...)
	}

	valueFieldIndices := frame.TypeIndices(sdata.ValidValueFields()...)
	if len(valueFieldIndices) == 0 {
		return c, fmt.Errorf("frame is missing a numeric value field")
	}

	// TODO this is fragile if new types are added
	otherFields := frame.TypeIndices(data.FieldTypeNullableTime, data.FieldTypeString, data.FieldTypeNullableString)
	for _, fieldIdx := range otherFields {
		c.RemainderIndices = append(c.RemainderIndices, sdata.FrameFieldIndex{
			FrameIdx: 0, FieldIdx: fieldIdx,
			Reason: fmt.Sprintf("unsupported field type %v", frame.Fields[fieldIdx].Type())})
	}

	for _, vFieldIdx := range valueFieldIndices {
		vField := frame.Fields[vFieldIdx]
		if validateData {
			metricKey := [2]string{vField.Name, vField.Labels.String()}
			if _, ok := metricIndex[metricKey]; ok && validateData {
				return c, fmt.Errorf("duplicate metrics found for metric name %q and labels %q", vField.Name, vField.Labels)
			}
			metricIndex[metricKey] = struct{}{}
		}
		c.Refs = append(c.Refs, MetricRef{
			TimeField:  timeField,
			ValueField: vField,
		})
	}

	// Validate time Field is sorted in ascending (oldest to newest) order
	if validateData {
		sorted, err := timeIsSorted(timeField)
		if err != nil {
			return c, fmt.Errorf("frame has an malformed time field")
		}
		if !sorted {
			return c, fmt.Errorf("frame has an unsorted time field")
		}
	}

	if err := ignoreAdditionalFrames("additional frame", *wf, &c.RemainderIndices); err != nil {
		return c, err
	}

	sortTimeSeriesMetricRef(c.Refs)
	return c, nil
}

func (wf *WideFrame) Frames() data.Frames {
	if wf == nil {
		return nil
	}
	return data.Frames(*wf)
}
