package reader

import (
	"fmt"

	"github.com/grafana/dataplane/sdata"
	"github.com/grafana/dataplane/sdata/numeric"
	"github.com/grafana/dataplane/sdata/timeseries"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func supportedTypes() map[data.FrameType]map[data.FrameTypeVersion]struct{} {
	// Perhaps in JSON
	m := make(map[data.FrameType]map[data.FrameTypeVersion]struct{}, 6)

	add := func(t data.FrameType, versions []data.FrameTypeVersion) {
		m[t] = make(map[data.FrameTypeVersion]struct{}, len(versions))
		for _, v := range versions {
			m[t][v] = struct{}{}
		}
	}

	add(data.FrameTypeTimeSeriesLong, timeseries.LongFrameVersions())
	add(data.FrameTypeTimeSeriesWide, timeseries.WideFrameVersions())
	add(data.FrameTypeTimeSeriesMulti, timeseries.MultiFrameVersions())

	add(data.FrameTypeNumericLong, numeric.LongFrameVersions())
	add(data.FrameTypeNumericWide, numeric.WideFrameVersions())
	add(data.FrameTypeNumericMulti, numeric.MultiFrameVersions())

	return m
}

func latestVersions() map[data.FrameType]data.FrameTypeVersion {
	return map[data.FrameType]data.FrameTypeVersion{
		data.FrameTypeTimeSeriesLong:  timeseries.LongFrameVersionLatest,
		data.FrameTypeTimeSeriesWide:  timeseries.WideFrameVersionLatest,
		data.FrameTypeTimeSeriesMulti: timeseries.MultiFrameVersionLatest,

		data.FrameTypeNumericLong:  numeric.LongFrameVersionLatest,
		data.FrameTypeNumericWide:  numeric.WideFrameVersionLatest,
		data.FrameTypeNumericMulti: numeric.MultiFrameVersionLatest,
	}
}

// CanReadBasedOnMeta checks the first frame in Frames to see if it has a FrameType and TypeVersion supported
// by the sdata libraries.
func CanReadBasedOnMeta(f data.Frames) (data.FrameType, error) {
	if len(f) == 0 {
		return data.FrameTypeUnknown, fmt.Errorf("untyped no data response") // This needs some thought (Valid -- Need signal for it in sdata)
	}

	if f[0].Meta == nil {
		return data.FrameType(data.FrameTypeUnknown.Kind()), fmt.Errorf("missing metadata")
	}

	md := f[0].Meta

	fType := md.Type
	fTypeVersion := md.TypeVersion
	st := supportedTypes()

	typeToV, ok := st[fType]
	if !ok {
		return data.FrameTypeUnknown, fmt.Errorf("unsupported frame type %s", fType)
	}

	if _, ok := typeToV[fTypeVersion]; !ok {
		// This needs more attention, in particular to 0.x vs 1.x<->1.x
		return fType, &sdata.VersionWarning{DataVersion: fTypeVersion,
			LibraryVersion: latestVersions()[fType],
			DataType:       fType}
	}

	return fType, nil
}
