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

	// Notices is TODO
	Notices interface{} `json:"notices,omitempty"`
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
