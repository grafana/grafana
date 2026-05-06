package model

type OFREPEvaluateSuccessResponse struct {
	Key      string         `json:"key"`
	Value    any            `json:"value"`
	Reason   string         `json:"reason"`
	Variant  string         `json:"variant"`
	Metadata map[string]any `json:"metadata,omitempty"`
}
