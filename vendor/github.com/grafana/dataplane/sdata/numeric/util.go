package numeric

import (
	"fmt"

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
