package numeric

import (
	"fmt"

	"github.com/grafana/dataplane/sdata"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type MultiFrame []*data.Frame

func (mf *MultiFrame) Frames() data.Frames {
	return data.Frames(*mf)
}

var MultiFrameVersionLatest = MultiFrameVersions()[len(MultiFrameVersions())-1]

func MultiFrameVersions() []data.FrameTypeVersion {
	return []data.FrameTypeVersion{{0, 1}}
}

func NewMultiFrame(refID string, v data.FrameTypeVersion) (*MultiFrame, error) {
	if v.Greater(MultiFrameVersionLatest) {
		return nil, fmt.Errorf("can not create MultiFrame of version %s because it is newer than library version %v", v, MultiFrameVersionLatest)
	}
	return &MultiFrame{
		emptyFrameWithTypeMD(refID, data.FrameTypeNumericMulti, v),
	}, nil
}

func (mf *MultiFrame) AddMetric(metricName string, l data.Labels, value interface{}) error {
	fType := data.FieldTypeFor(value)
	if !fType.Numeric() {
		return fmt.Errorf("unsupported values type %T, must be numeric", value)
	}
	if mf == nil || len(*mf) == 0 {
		return fmt.Errorf("zero frames when calling AddMetric must call NewMultiFrame first")
	}

	field := data.NewFieldFromFieldType(fType, 1)
	field.Name = metricName
	field.Labels = l
	field.Set(0, value)

	if len(*mf) == 1 && len((*mf)[0].Fields) == 0 {
		(*mf)[0].Fields = append((*mf)[0].Fields, field)
		return nil
	}

	*mf = append(*mf, data.NewFrame("", field).SetMeta(&data.FrameMeta{
		Type:        data.FrameTypeNumericMulti,
		TypeVersion: (*mf)[0].Meta.TypeVersion,
	}))

	return nil
}

func (mf *MultiFrame) GetCollection(validateData bool) (Collection, error) {
	return validateAndGetRefsMulti(mf, validateData)
}

func (mf *MultiFrame) SetMetricMD(metricName string, l data.Labels, fc data.FieldConfig) {
	panic("not implemented")
}

/*
Rules:
  - Whenever an error is returned, there are no ignored fields returned
  - Must have at least one frame
  - The first frame must be valid or will error, additional invalid frames with the type indicator will error,
    frames without type indicator are ignored
  - A valid individual Frame (in the non empty case) has a numeric field and a type indicator
  - Any nil Frames or Fields will cause an error (e.g. [Frame, Frame, nil, Frame] or [nil])
  - If any frame has fields within the frame of different lengths, an error will be returned
  - If validateData is true, duplicate metricName+Labels will error
  - If all frames and their fields are ignored, and it is not the empty response case, an error is returned

Things to decide:
  - Seems like allowing (ignoring) more than 1 row is not a good idea (outside of Long)
  - Will allow for extra frames

TODO: Change this to follow the above
*/
func validateAndGetRefsMulti(mf *MultiFrame, validateData bool) (Collection, error) {
	if validateData {
		panic("validateData option is not implemented")
	}

	var c Collection
	if mf == nil {
		return c, fmt.Errorf("frame collection is nil")
	}

	if len(*mf) == 0 {
		return c, fmt.Errorf("must be at least one frame")
	}

	firstFrame := (*mf)[0]

	if firstFrame == nil {
		return c, fmt.Errorf("frame 0 is nil which is invalid")
	}

	if firstFrame.Meta == nil {
		return c, fmt.Errorf("frame 0 is missing a type indicator")
	}

	if len(firstFrame.Fields) == 0 {
		if len(*mf) > 1 {
			if err := ignoreAdditionalFrames("extra frame on empty response", *mf, &c.RemainderIndices); err != nil {
				return c, err
			}
		}
		// Empty Response
		c.Refs = []MetricRef{}
		return c, nil
	}

	c.RefID = (*mf)[0].RefID

	for _, frame := range *mf {
		if !frameHasType(frame, data.FrameTypeNumericMulti) {
			return c, fmt.Errorf("frame has wrong type, expected NumericMulti but got %q", frame.Meta.Type)
		}

		if frame.Meta.TypeVersion != MultiFrameVersionLatest {
			c.Warning = &sdata.VersionWarning{DataVersion: frame.Meta.TypeVersion, LibraryVersion: MultiFrameVersionLatest, DataType: data.FrameTypeNumericMulti}
		}

		valueFields := frame.TypeIndices(sdata.ValidValueFields()...)
		if len(valueFields) == 0 {
			continue
		}
		c.Refs = append(c.Refs, MetricRef{frame.Fields[valueFields[0]]})
	}
	return c, nil
}
