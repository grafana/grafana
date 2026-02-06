package data

import (
	"fmt"
	"strconv"
	"strings"
)

// A FrameType string, when present in a frame's metadata, asserts that the
// frame's structure conforms to the FrameType's specification.
// This property is currently optional, so FrameType may be FrameTypeUnknown even if the properties of
// the Frame correspond to a defined FrameType.
// +enum
type FrameType string

// ---
// Docs Note: Constants need to be on their own line for links to work with the pkgsite docs.
// ---

// FrameTypeUnknown indicates that we do not know the frame type
const FrameTypeUnknown FrameType = ""

// FrameTypeTimeSeriesWide uses labels on fields to define dimensions and is documented in [Time Series Wide Format in the Data Plane Contract]. There is additional documentation in the [Developer Data Frame Documentation on the Wide Format].
//
// [Time Series Wide Format in the Data Plane Contract]: https://grafana.github.io/dataplane/contract/timeseries#time-series-wide-format-timeserieswide
// [Developer Data Frame Documentation on the Wide Format]: https://grafana.com/docs/grafana/latest/developers/plugins/data-frames/#wide-format
const FrameTypeTimeSeriesWide FrameType = "timeseries-wide"

// FrameTypeTimeSeriesLong uses string fields to define dimensions and is documented in [Time Series Long Format in the Data Plane Contract]. There is additional documentation in the [Developer Data Frame Documentation on Long Format].
//
// [Time Series Long Format in the Data Plane Contract]: https://grafana.github.io/dataplane/contract/timeseries#time-series-long-format-timeserieslong-sql-like
// [Developer Data Frame Documentation on Long Format]: https://grafana.com/docs/grafana/latest/developers/plugins/data-frames/#long-format
const FrameTypeTimeSeriesLong FrameType = "timeseries-long"

// FrameTypeTimeSeriesMany is the same as "Wide" with exactly one numeric value field.
//
// Deprecated: use FrameTypeTimeSeriesMulti instead.
const FrameTypeTimeSeriesMany FrameType = "timeseries-many"

// FrameTypeTimeSeriesMulti is documented in the [Time Series Multi Format in the Data Plane Contract].
// This replaces FrameTypeTimeSeriesMany.
//
// [Time Series Multi Format in the Data Plane Contract]: https://grafana.github.io/dataplane/contract/timeseries#time-series-multi-format-timeseriesmulti
const FrameTypeTimeSeriesMulti FrameType = "timeseries-multi"

// FrameTypeDirectoryListing represents the items in a directory
// field[0]:
//   - name
//   - new paths can be constructed from the parent path + separator + name
//
// field[1]:
//   - media-type
//   - when "directory" it can be nested
const FrameTypeDirectoryListing FrameType = "directory-listing"

// FrameTypeTable represents an arbitrary table structure with no constraints.
const FrameTypeTable FrameType = "table"

// FrameTypeNumericWide is documented in the [Numeric Wide Format in the Data Plane Contract].
//
// [Numeric Wide Format in the Data Plane Contract]: https://grafana.github.io/dataplane/contract/numeric#numeric-wide-format-numericwide
const FrameTypeNumericWide FrameType = "numeric-wide"

// FrameTypeNumericMulti is documented in the [Numeric Multi Format in the Data Plane Contract].
//
// [Numeric Multi Format in the Data Plane Contract]: https://grafana.github.io/dataplane/contract/numeric#numeric-multi-format-numericmulti
const FrameTypeNumericMulti FrameType = "numeric-multi"

// FrameTypeNumericLong is documented in the [Numeric Long Format in the Data Plane Contract].
//
// [Numeric Long Format in the Data Plane Contract]: https://grafana.github.io/dataplane/contract/numeric#numeric-long-format-numericlong-sql-table-like
const FrameTypeNumericLong FrameType = "numeric-long"

// FrameTypeLogLines is documented in the Logs Format in the Data Plane Contract.
//
// [Log Lines Format in the Data Plane Contract]: https://grafana.github.io/dataplane/contract/logs#loglines
const FrameTypeLogLines FrameType = "log-lines"

// Soon?
// "timeseries-wide-ohlc" -- known fields for open/high/low/close
// "histogram" -- BucketMin, BucketMax, values...
// "trace" -- ??
// "node-graph-nodes"
// "node-graph-edges"

// IsKnownType checks if the value is a known structure
func (p FrameType) IsKnownType() bool {
	switch p {
	case
		FrameTypeTimeSeriesWide,
		FrameTypeTimeSeriesLong,
		FrameTypeTimeSeriesMulti,
		FrameTypeTimeSeriesMany,

		FrameTypeLogLines,

		FrameTypeNumericWide,
		FrameTypeNumericLong,
		FrameTypeNumericMulti:
		return true
	}
	return false
}

// FrameTypes returns a slice of all known frame types
func FrameTypes() []FrameType {
	return []FrameType{
		FrameTypeTimeSeriesWide,
		FrameTypeTimeSeriesLong,
		FrameTypeTimeSeriesMulti,
		FrameTypeTimeSeriesMany,

		FrameTypeLogLines,

		FrameTypeNumericWide,
		FrameTypeNumericLong,
		FrameTypeNumericMulti,
	}
}

// IsTimeSeries checks if the FrameType is KindTimeSeries
func (p FrameType) IsTimeSeries() bool {
	switch p {
	case
		FrameTypeTimeSeriesWide,
		FrameTypeTimeSeriesLong,
		FrameTypeTimeSeriesMulti,
		FrameTypeTimeSeriesMany:
		return true
	}
	return false
}

// IsNumeric checks if the FrameType is KindNumeric.
func (p FrameType) IsNumeric() bool {
	switch p {
	case
		FrameTypeNumericWide,
		FrameTypeNumericLong,
		FrameTypeNumericMulti:
		return true
	}
	return false
}

func (p FrameType) IsLogs() bool {
	return p == FrameTypeLogLines
}

// Kind returns the FrameTypeKind from the FrameType.
func (p FrameType) Kind() FrameTypeKind {
	switch {
	case p.IsTimeSeries():
		return KindTimeSeries
	case p.IsNumeric():
		return KindNumeric
	default:
		return KindUnknown
	}
}

// FrameTypeKind represents the Kind a particular FrameType falls into. See [Kinds and Formats] in
// the data plane documentation.
//
// [Kinds and Formats]: https://grafana.github.io/dataplane/contract/#kinds-and-formats
type FrameTypeKind string

const KindUnknown FrameTypeKind = ""

// KindTimeSeries means the FrameType's Kind is time series. See [Data Plane Time Series Kind].
//
// [Data Plane Time Series Kind]: https://grafana.github.io/dataplane/contract/timeseries
const KindTimeSeries FrameTypeKind = "timeseries"

// KindNumeric means the FrameType's Kind is numeric. See [Data Plane Numeric Kind].
//
// [Data Plane Numeric Kind]: https://grafana.github.io/dataplane/contract/numeric
const KindNumeric FrameTypeKind = "numeric"

// KindLogs means the FrameType's Kind is logs. See [Data Plane Logs Kind].
const KindLogs FrameTypeKind = "logs"

// FrameType is a 2 number version (Major / Minor).
type FrameTypeVersion [2]uint

func (sv FrameTypeVersion) Less(osv FrameTypeVersion) bool {
	return sv[0] < osv[0] || sv[1] < osv[1]
}

func (sv FrameTypeVersion) Greater(osv FrameTypeVersion) bool {
	return sv[0] > osv[0] || sv[1] > osv[1]
}

func (sv FrameTypeVersion) String() string {
	return fmt.Sprintf("%v.%v", sv[0], sv[1])
}

func (sv FrameTypeVersion) IsZero() bool {
	return sv == FrameTypeVersion{0, 0}
}

// ParseFrameTypeVersion parses a canonical representation of a
// [FrameTypeVersion] (e.g. "0.0") from a string.
// Taken from github.com/grafana/thema
func ParseFrameTypeVersion(s string) (FrameTypeVersion, error) {
	parts := strings.Split(s, ".")
	if len(parts) != 2 {
		return FrameTypeVersion{0, 0}, fmt.Errorf("invalid version %s", s)
	}

	// i mean 4 billion is probably enough version numbers
	a, err := strconv.ParseUint(parts[0], 10, 32)
	if err != nil {
		return FrameTypeVersion{0, 0}, fmt.Errorf("%w: first part %q has invalid version number", err, parts[0])
	}

	// especially when squared
	b, err := strconv.ParseUint(parts[1], 10, 32)
	if err != nil {
		return FrameTypeVersion{0, 0}, fmt.Errorf("%w: second part %q has invalid version number", err, parts[1])
	}
	return FrameTypeVersion{uint(a), uint(b)}, nil
}
