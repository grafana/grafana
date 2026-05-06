package schemabuilder

import sdkapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"

// This is only used to write out a sample panel query
// It is not public and not intended to represent a real panel
type pseudoPanel struct {
	// Numeric panel id
	ID int `json:"id,omitempty"`

	// The panel plugin type
	Type string `json:"type"`

	// The panel title
	Title string `json:"title,omitempty"`

	// This should no longer be necessary since each target has the datasource reference
	Datasource *sdkapi.DataSourceRef `json:"datasource,omitempty"`

	// The query targets
	Targets []sdkapi.DataQuery `json:"targets"`
}
