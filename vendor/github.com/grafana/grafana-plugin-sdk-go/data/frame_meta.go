package data

import "encoding/json"

// FrameMeta matches:
// https://github.com/grafana/grafana/blob/master/packages/grafana-data/src/types/data.ts#L11
// NOTE -- in javascript this can accept any `[key: string]: any;` however
// this interface only exposes the values we want to be exposed
type FrameMeta struct {
	// Datasource specific values
	Custom map[string]interface{} `json:"custom,omitempty"`

	// Stats is TODO
	Stats interface{} `json:"stats,omitempty"`

	// Notices provide additional information about the data in the Frame that
	// Grafana can display to the user in the user interface.
	Notices []Notice `json:"notices,omitempty"`
}

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
		return "info"
	case NoticeSeverityWarning:
		return "warning"
	case NoticeSeverityError:
		return "error"
	}
	return ""
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
