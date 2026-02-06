package timeseries

import (
	"fmt"
	"sort"
	"time"

	"github.com/grafana/dataplane/sdata"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type CollectionReader interface {
	// GetCollection runs validate without validateData. If the data is valid, then
	// []TimeSeriesMetricRef is returned from reading as well as any ignored data. If invalid,
	// then an error is returned, and no refs or ignoredFieldIndices are returned.
	GetCollection(validateData bool) (Collection, error)

	Frames() data.Frames // returns underlying frames
}

// MetricRef is for reading and contains the data for an individual
// time series. In the cases of the Multi and Wide formats, the Fields are pointers
// to the data in the original frame. In the case of Long new fields are constructed.
type MetricRef struct {
	TimeField  *data.Field
	ValueField *data.Field
	// TODO: RefID string
	// TODO: Pointer to frame meta?
}

type Collection struct {
	RefID            string
	Refs             []MetricRef
	RemainderIndices []sdata.FrameFieldIndex
	Warning          error
}

func (c Collection) NoData() bool {
	return c.Refs != nil && len(c.Refs) == 0
}

func CollectionReaderFromFrames(frames []*data.Frame) (CollectionReader, error) {
	if len(frames) == 0 {
		return nil, fmt.Errorf("must be at least one frame")
	}

	firstFrame := frames[0]
	if firstFrame == nil {
		return nil, fmt.Errorf("nil frames are invalid")
	}
	if firstFrame.Meta == nil {
		return nil, fmt.Errorf("metadata missing from first frame, can not determine type")
	}

	mt := firstFrame.Meta.Type
	var tcr CollectionReader

	switch {
	case mt == data.FrameTypeTimeSeriesMulti:
		mfs := MultiFrame(frames)
		tcr = &mfs
	case mt == data.FrameTypeTimeSeriesLong:
		ls := LongFrame(frames)
		tcr = &ls // TODO change to Frames for extra/ignored data?
	case mt == data.FrameTypeTimeSeriesWide:
		wfs := WideFrame(frames)
		tcr = &wfs
	default:
		return nil, fmt.Errorf("unsupported time series type %q", mt)
	}
	return tcr, nil
}

func (m MetricRef) GetMetricName() string {
	if m.ValueField != nil {
		return m.ValueField.Name
	}
	return ""
}

// TODO GetFQMetric (or something, Names + Labels)

func (m MetricRef) GetLabels() data.Labels {
	if m.ValueField != nil {
		return m.ValueField.Labels
	}
	return nil
}

// NullableFloat64Point returns the time and *float64 value at the specified index.
// It will error if the index is out of bounds, or if the value can not be converted
// to a *float64.
func (m MetricRef) NullableFloat64Point(pointIdx int) (time.Time, *float64, error) {
	f, err := m.NullableFloat64Value(pointIdx)
	if err != nil {
		return time.Time{}, nil, err
	}
	t, err := m.Time(pointIdx)
	if err != nil {
		return time.Time{}, nil, err
	}
	return t, f, nil
}

func (m MetricRef) NullableFloat64Value(pointIdx int) (*float64, error) {
	if m.ValueField.Len() < pointIdx {
		return nil, fmt.Errorf("pointIdx %v is out of bounds for series", pointIdx)
	}
	f, err := m.ValueField.NullableFloatAt(pointIdx)
	if err != nil {
		return nil, err
	}
	return f, nil
}

func (m MetricRef) Time(pointIdx int) (time.Time, error) {
	if m.TimeField.Len() < pointIdx {
		return time.Time{}, fmt.Errorf("pointIdx %v is out of bounds for series", pointIdx)
	}
	ti := m.TimeField.At(pointIdx)
	t, ok := ti.(time.Time)
	if !ok {
		return time.Time{}, fmt.Errorf("series field is not of expected type time.Time, got %T", ti)
	}
	return t, nil
}

func (m MetricRef) Len() (int, error) {
	if m.ValueField.Len() != m.TimeField.Len() {
		return 0, fmt.Errorf("series has mismatched value and time field lengths")
	}
	return m.ValueField.Len(), nil
}

func sortTimeSeriesMetricRef(refs []MetricRef) {
	sort.SliceStable(refs, func(i, j int) bool {
		iRef := refs[i]
		jRef := refs[j]

		if iRef.GetMetricName() < jRef.GetMetricName() {
			return true
		}
		if iRef.GetMetricName() > jRef.GetMetricName() {
			return false
		}

		// If here Names are equal, next sort based on if there are labels.
		if iRef.GetLabels() == nil && jRef.GetLabels() == nil {
			return true // no labels first
		}
		if iRef.GetLabels() == nil && jRef.GetLabels() != nil {
			return true
		}
		if iRef.GetLabels() != nil && jRef.GetLabels() == nil {
			return false
		}

		return iRef.GetLabels().String() < jRef.GetLabels().String()
	})
}
