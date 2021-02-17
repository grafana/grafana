package data

import (
	"encoding/json"
	"fmt"
)

// FrameMeta matches:
// https://github.com/grafana/grafana/blob/master/packages/grafana-data/src/types/data.ts#L11
// NOTE -- in javascript this can accept any `[key: string]: any;` however
// this interface only exposes the values we want to be exposed
type FrameMeta struct {
	// Path is a browsable path on the datasource
	Path string `json:"path,omitempty"`

	// PathSeparator defines the separator pattern to decode a hiearchy. The default separator is '/'
	PathSeparator string `json:"pathSeparator,omitempty"`

	// Datasource specific values
	Custom interface{} `json:"custom,omitempty"`

	// Stats is an array of query result statistics.
	Stats []QueryStat `json:"stats,omitempty"`

	// Notices provide additional information about the data in the Frame that
	// Grafana can display to the user in the user interface.
	Notices []Notice `json:"notices,omitempty"`

	// PreferredVisualisationType is currently used to show results in Explore only in preferred visualisation option.
	PreferredVisualization VisType `json:"preferredVisualisationType,omitempty"`

	// ExecutedQueryString is the raw query sent to the underlying system. All macros and templating
	// have been applied.  When metadata contains this value, it will be shown in the query inspector.
	ExecutedQueryString string `json:"executedQueryString,omitempty"`
}

const (
	// VisTypeGraph indicates the response should be visualized using a graph.
	VisTypeGraph VisType = "graph"

	// VisTypeTable indicates the response should be visualized using a table.
	VisTypeTable = "table"

	// VisTypeLogs indicates the response should be visualized using a logs visualization.
	VisTypeLogs = "logs"
)

// VisType is used to indicate how the data should be visualized in explore.
type VisType string

// FrameMetaFromJSON creates a QueryResultMeta from a json string
func FrameMetaFromJSON(jsonStr string) (*FrameMeta, error) {
	var m FrameMeta
	err := json.Unmarshal([]byte(jsonStr), &m)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// AppendNotices adds notices to Frame f's metadata (Frame.Meta.Notices).
// If f has no metadata, this method will initialize it before adding notices.
func (f *Frame) AppendNotices(notices ...Notice) {
	if f.Meta == nil {
		f.Meta = &FrameMeta{}
	}
	f.Meta.Notices = append(f.Meta.Notices, notices...)
}

// QueryStat is used for storing arbitrary statistics metadata related to a query and its result, e.g. total request time, data processing time.
// The embedded FieldConfig's display name must be set.
// It corresponds to the QueryResultMetaStat on the frontend (https://github.com/grafana/grafana/blob/master/packages/grafana-data/src/types/data.ts#L53).
type QueryStat struct {
	FieldConfig

	Value float64 `json:"value"`
}

// Notice provides a structure for presenting notifications in Grafana's user interface.
type Notice struct {
	// Severity is the severity level of the notice: info, warning, or error.
	Severity NoticeSeverity `json:"severity,omitempty"`

	// Text is freeform descriptive text for the notice.
	Text string `json:"text"`

	// Link is an optional link for display in the user interface and can be an
	// absolute URL or a path relative to Grafana's root url.
	Link string `json:"link,omitempty"`

	// Inspect is an optional suggestion for which tab to display in the panel inspector
	// in Grafana's User interface. Can be meta, error, data, or stats.
	Inspect InspectType `json:"inspect,omitempty"`
}

const (
	noticeSeverityInfoString    = "info"
	noticeSeverityWarningString = "warning"
	noticeSeverityErrorString   = "error"
)

// NoticeSeverity is a type for the Severity property of a Notice.
type NoticeSeverity int

const (
	// NoticeSeverityInfo is informational severity.
	NoticeSeverityInfo NoticeSeverity = iota

	// NoticeSeverityWarning is warning severity.
	NoticeSeverityWarning

	// NoticeSeverityError is error severity.
	NoticeSeverityError
)

func (n NoticeSeverity) String() string {
	switch n {
	case NoticeSeverityInfo:
		return noticeSeverityInfoString
	case NoticeSeverityWarning:
		return noticeSeverityWarningString
	case NoticeSeverityError:
		return noticeSeverityErrorString
	}
	return ""
}

// MarshalJSON implements the json.Marshaler interface.
func (n NoticeSeverity) MarshalJSON() ([]byte, error) {
	return json.Marshal(n.String())
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (n *NoticeSeverity) UnmarshalJSON(b []byte) error {
	var s string
	err := json.Unmarshal(b, &s)
	if err != nil {
		return err
	}
	switch s {
	case noticeSeverityInfoString:
		*n = NoticeSeverityInfo
	case noticeSeverityWarningString:
		*n = NoticeSeverityWarning
	case noticeSeverityErrorString:
		*n = NoticeSeverityError
	default:
		return fmt.Errorf("unrecognized notice severity %v", s)
	}
	return nil
}

// InspectType is a type for the Inspect property of a Notice.
type InspectType int

const (
	// InspectTypeNone is no suggestion for a tab of the panel editor in Grafana's user interface.
	InspectTypeNone InspectType = iota

	// InspectTypeMeta suggests the "meta" tab of the panel editor in Grafana's user interface.
	InspectTypeMeta

	// InspectTypeError suggests the "error" tab of the panel editor in Grafana's user interface.
	InspectTypeError

	// InspectTypeData suggests the "data" tab of the panel editor in Grafana's user interface.
	InspectTypeData

	// InspectTypeStats suggests the "stats" tab of the panel editor in Grafana's user interface.
	InspectTypeStats
)

func (n InspectType) String() string {
	switch n {
	case InspectTypeNone:
		return "" // default, omitempty when encoded to json.
	case InspectTypeMeta:
		return "meta"
	case InspectTypeError:
		return "error"
	case InspectTypeData:
		return "data"
	case InspectTypeStats:
		return "stats"
	}
	return ""
}
