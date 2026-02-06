package timeseries

import (
	"fmt"
	"time"

	"github.com/grafana/dataplane/sdata"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// LongFrame is a time series format where all series live in one frame.
// This time series format should be used with Table-like sources (e.g. SQL) that
// do not have a native concept of Labels.
type LongFrame []*data.Frame

var LongFrameVersionLatest = LongFrameVersions()[len(LongFrameVersions())-1]

func LongFrameVersions() []data.FrameTypeVersion {
	return []data.FrameTypeVersion{{0, 1}}
}

func NewLongFrame(refID string, v data.FrameTypeVersion) (*LongFrame, error) {
	if v.Greater(LongFrameVersionLatest) {
		return nil, fmt.Errorf("can not create LongFrame of version %s because it is newer than library version %v", v, LongFrameVersionLatest)
	}
	return &LongFrame{emptyFrameWithTypeMD(refID, data.FrameTypeTimeSeriesLong, v)}, nil
}

func (ls *LongFrame) GetCollection(validateData bool) (Collection, error) {
	return validateAndGetRefsLong(ls, validateData, true)
}

func validateAndGetRefsLong(ls *LongFrame, validateData, getRefs bool) (Collection, error) {
	var c Collection
	switch {
	case ls == nil:
		return c, fmt.Errorf("frames may not be nil")
	case len(*ls) == 0:
		return c, fmt.Errorf("missing frame, must be at least one frame")
	}

	frame := (*ls)[0]

	if frame == nil {
		return c, fmt.Errorf("frame 0 must not be nil")
	}

	c.RefID = frame.RefID

	if !frameHasType(frame, data.FrameTypeTimeSeriesLong) {
		return c, fmt.Errorf("frame 0 is missing long type indicator")
	}

	if frame.Meta.TypeVersion != LongFrameVersionLatest {
		c.Warning = &sdata.VersionWarning{DataVersion: frame.Meta.TypeVersion, LibraryVersion: LongFrameVersionLatest, DataType: data.FrameTypeTimeSeriesLong}
	}

	if len(frame.Fields) == 0 { // empty response
		if err := ignoreAdditionalFrames("additional frame on empty response", *ls, &c.RemainderIndices); err != nil {
			return c, err
		}
		// Empty Response
		c.Refs = []MetricRef{}
		return c, nil
	}

	if err := malformedFrameCheck(0, frame); err != nil {
		return c, err
	}

	// metricName/labels -> SeriesRef
	mm := make(map[string]map[string]MetricRef)

	timeField, remainderTimeFields, err := seriesCheckSelectTime(0, frame)
	if err != nil {
		return c, err
	}
	if remainderTimeFields != nil {
		c.RemainderIndices = append(c.RemainderIndices, remainderTimeFields...)
	}

	valueFieldIndices := frame.TypeIndices(sdata.ValidValueFields()...) // TODO switch on bool type option
	if len(valueFieldIndices) == 0 {
		return c, fmt.Errorf("frame is missing a numeric value field")
	}

	factorFieldIndices := frame.TypeIndices(data.FieldTypeString, data.FieldTypeNullableString)

	appendToMetric := func(metricName string, l data.Labels, t time.Time, value interface{}, valType data.FieldType) error {
		if mm[metricName] == nil {
			mm[metricName] = make(map[string]MetricRef)
		}

		lbStr := l.String()
		if ref, ok := mm[metricName][lbStr]; !ok {
			ref.TimeField = data.NewField(timeField.Name, nil, []time.Time{t})

			ref.ValueField = data.NewFieldFromFieldType(valType, 1)
			ref.ValueField.Set(0, value)
			ref.ValueField.Name = metricName
			ref.ValueField.Labels = l

			mm[metricName][lbStr] = ref
			c.Refs = append(c.Refs, ref)
		} else {
			if validateData && ref.TimeField.Len() > 1 {
				prevTime := ref.TimeField.At(ref.TimeField.Len() - 1).(time.Time)
				if prevTime.After(t) {
					return fmt.Errorf("unsorted time field")
				}
				if prevTime.Equal(t) {
					return fmt.Errorf("duplicate data points in metric %v %v", metricName, lbStr)
				}
			}
			ref.TimeField.Append(t)
			ref.ValueField.Append(value)
		}
		return nil
	}

	if getRefs {
		for rowIdx := 0; rowIdx < frame.Rows(); rowIdx++ {
			l := data.Labels{}
			for _, strFieldIdx := range factorFieldIndices {
				cv, _ := frame.ConcreteAt(strFieldIdx, rowIdx)
				l[frame.Fields[strFieldIdx].Name] = cv.(string)
			}
			for _, vFieldIdx := range valueFieldIndices {
				valueField := frame.Fields[vFieldIdx]
				if err := appendToMetric(valueField.Name, l, timeField.At(rowIdx).(time.Time), valueField.At(rowIdx), valueField.Type()); err != nil {
					return c, err
				}
			}
		}
		sortTimeSeriesMetricRef(c.Refs)
	}

	// TODO this is fragile if new types are added
	otherFields := frame.TypeIndices(data.FieldTypeNullableTime)
	for _, fieldIdx := range otherFields {
		c.RemainderIndices = append(c.RemainderIndices, sdata.FrameFieldIndex{
			FrameIdx: 0, FieldIdx: fieldIdx,
			Reason: fmt.Sprintf("unsupported field type %v", frame.Fields[fieldIdx].Type())},
		)
	}

	if err := ignoreAdditionalFrames("additional frame", *ls, &c.RemainderIndices); err != nil {
		return c, err
	}

	return c, nil
}

func (ls *LongFrame) Frames() data.Frames {
	if ls == nil {
		return nil
	}
	return data.Frames(*ls)
}
