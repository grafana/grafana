package sdata

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func ValidValueFields() []data.FieldType {
	// TODO: not sure about bool (factor or value)
	return append(data.NumericFieldTypes(), []data.FieldType{data.FieldTypeBool, data.FieldTypeNullableBool}...)
}

// FrameFieldIndex is for referencing data that is not considered part of the metric data
// when the data is valid. Reason states why the field was not part of the metric data.
type FrameFieldIndex struct {
	FrameIdx int
	FieldIdx int    // -1 means no fields
	Reason   string // only meant for human consumption
}

type FrameFieldIndices []FrameFieldIndex

func (f FrameFieldIndices) Len() int {
	return len(f)
}

func (f FrameFieldIndices) Less(i, j int) bool {
	return f[i].FrameIdx < f[j].FrameIdx
}

func (f FrameFieldIndices) Swap(i, j int) {
	f[i], f[j] = f[j], f[i]
}

type VersionWarning struct {
	DataVersion    data.FrameTypeVersion
	LibraryVersion data.FrameTypeVersion
	DataType       data.FrameType
}

func (vw *VersionWarning) Error() string {
	var newOld string
	switch {
	case vw.DataVersion.Greater(vw.LibraryVersion):
		newOld = "newer"
	case vw.DataVersion.Less(vw.LibraryVersion):
		newOld = "older"
	default:
		panic(fmt.Sprintf("VersionWarning created with equal versions data version %s and library version %s", vw.DataVersion, vw.LibraryVersion))
	}
	return fmt.Sprintf("datatype %s version %s is %s than library version %s", vw.DataType, vw.DataVersion, newOld, vw.LibraryVersion)
}

func (vw *VersionWarning) DataNewer() bool {
	return vw.DataVersion.Greater(vw.LibraryVersion)
}
