package model

// CollectEvalDataResponse is the object returned by the health API
type CollectEvalDataResponse struct {
	// IngestedContentCount number of model.FeatureEvents that have been sent to the data exporter
	IngestedContentCount int `json:"ingestedContentCount" xml:"ingestedContentCount" form:"ingestedContentCount" query:"ingestedContentCount"` // nolint: lll
}
