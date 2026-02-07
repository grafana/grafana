package numeric

import (
	"fmt"

	"github.com/grafana/dataplane/sdata"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type CollectionWriter interface {
	AddMetric(metricName string, l data.Labels, value interface{}) error
	SetMetricMD(metricName string, l data.Labels, fc data.FieldConfig)
}

type CollectionRW interface {
	CollectionWriter
	CollectionReader
}

type CollectionReader interface {
	GetCollection(validateData bool) (Collection, error)

	Frames() data.Frames
}

type MetricRef struct {
	ValueField *data.Field
}

func (n MetricRef) GetMetricName() string {
	if n.ValueField != nil {
		return n.ValueField.Name
	}
	return ""
}

func (n MetricRef) GetLabels() data.Labels {
	if n.ValueField != nil {
		return n.ValueField.Labels
	}
	return nil
}

// FloatValue returns the *float64 of the value, a bool that is
// true if the value is empty (no field, or zero length field)
// and an error if the field can not be converted to a *float64.
func (n MetricRef) NullableFloat64Value() (*float64, bool, error) {
	if n.ValueField.Len() != 1 {
		return nil, true, nil
	}
	f, err := n.ValueField.NullableFloatAt(0)
	if err != nil {
		return nil, false, err
	}
	return f, false, nil
}

type Collection struct {
	RefID            string
	Refs             []MetricRef
	RemainderIndices []sdata.FrameFieldIndex // TODO: Currently not populated
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
	case mt == data.FrameTypeNumericMulti:
		mfs := MultiFrame(frames)
		tcr = &mfs
	case mt == data.FrameTypeNumericLong:
		ls := LongFrame{firstFrame}
		tcr = &ls // TODO change to Frames for extra/ignored data?
	case mt == data.FrameTypeNumericWide:
		wfs := WideFrame{firstFrame}
		tcr = &wfs
	default:
		return nil, fmt.Errorf("unsupported time series type %q", mt)
	}
	return tcr, nil
}
