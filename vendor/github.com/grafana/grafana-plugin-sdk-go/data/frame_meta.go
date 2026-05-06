package data

import (
	"encoding/json"
	"fmt"
)

// FrameMeta matches:
// https://github.com/grafana/grafana/blob/master/packages/grafana-data/src/types/data.ts#L11
// NOTE -- in javascript this can accept any `[key: string]: any;` however
// this interface only exposes the values we want to be exposed
//
//swagger:model
type FrameMeta struct {
	// Type asserts that the frame matches a known type structure.
	Type FrameType `json:"type,omitempty"`

	// TypeVersion is the version of the Type property. Versions greater than 0.0 correspond to the dataplane
	// contract documentation https://grafana.github.io/dataplane/contract/.
	TypeVersion FrameTypeVersion `json:"typeVersion"`

	// Path is a browsable path on the datasource.
	Path string `json:"path,omitempty"`

	// PathSeparator defines the separator pattern to decode a hierarchy. The default separator is '/'.
	PathSeparator string `json:"pathSeparator,omitempty"`

	// Custom datasource specific values.
	Custom interface{} `json:"custom,omitempty"`

	// Stats is an array of query result statistics.
	Stats []QueryStat `json:"stats,omitempty"`

	// Notices provide additional information about the data in the Frame that
	// Grafana can display to the user in the user interface.
	Notices []Notice `json:"notices,omitempty"`

	// Channel is the path to a stream in grafana live that has real-time updates for this data.
	Channel string `json:"channel,omitempty"`

	// PreferredVisualization is currently used to show results in Explore only in preferred visualisation option.
	PreferredVisualization VisType `json:"preferredVisualisationType,omitempty"`

	// PreferredVisualizationPluginId sets the panel plugin id to use to render the data when using Explore. If
	// the plugin cannot be found will fall back to PreferredVisualization.
	PreferredVisualizationPluginID string `json:"preferredVisualisationPluginId,omitempty"`

	// ExecutedQueryString is the raw query sent to the underlying system. All macros and templating
	// have been applied.  When metadata contains this value, it will be shown in the query inspector.
	ExecutedQueryString string `json:"executedQueryString,omitempty"`

	// Optionally identify which topic the frame should be assigned to.
	// A value specified in the response will override what the request asked for.
	DataTopic DataTopic `json:"dataTopic,omitempty"`

	// Array of field indices which values create a unique id for each row. Ideally this should be globally unique ID
	// but that isn't guarantied. Should help with keeping track and deduplicating rows in visualizations, especially
	// with streaming data with frequent updates.
	// Example: TraceID in Tempo, table name + primary key in SQL
	UniqueRowIDFields []int `json:"uniqueRowIdFields,omitempty"`
}

// Should be kept in sync with grafana/packages/grafana-data/src/types/data.ts#PreferredVisualisationType
const (
	// VisTypeGraph indicates the response should be visualized using a graph.
	VisTypeGraph VisType = "graph"

	// VisTypeTable indicates the response should be visualized using a table.
	VisTypeTable = "table"

	// VisTypeLogs indicates the response should be visualized using a logs visualization.
	VisTypeLogs = "logs"

	// VisTypeTrace indicates the response should be visualized using a trace view visualization.
	VisTypeTrace = "trace"

	// VisTypeNodeGraph indicates the response should be visualized using a node graph visualization.
	VisTypeNodeGraph = "nodeGraph"

	// VisTypeFlameGraph indicates the response should be visualized using a flame graph visualization.
	VisTypeFlameGraph = "flamegraph"
)

// VisType is used to indicate how the data should be visualized in explore.
type VisType string

const (
	// DataTopicAnnotations is used to specify that the frame should be used as annotation of the actual data frame response.
	// Example: When DataTopic is set to DataTopicAnnotations, the frame will be used as exemplar data in timeseries panel
	DataTopicAnnotations DataTopic = "annotations"
)

// DataTopic is used to identify which topic the frame should be assigned to.
//
//nolint:revive
type DataTopic string

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
	Severity NoticeSeverity `json:"severity"`

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
	default:
		return ""
	}
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
