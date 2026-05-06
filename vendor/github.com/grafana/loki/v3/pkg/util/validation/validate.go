package validation

const (
	// ErrQueryTooLong is used in chunk store, querier and query frontend.
	ErrQueryTooLong = "the query time range exceeds the limit (query length: %s, limit: %s)"

	ErrQueryTooOld = "this data is no longer available, it is past now - max_query_lookback (%s)"

	// RateLimited is one of the values for the reason to discard samples.
	// Declared here to avoid duplication in ingester and distributor.
	RateLimited = "rate_limited"

	// Too many HA clusters is one of the reasons for discarding samples.
	TooManyHAClusters = "too_many_ha_clusters"

	// DroppedByRelabelConfiguration Samples can also be discarded because of relabeling configuration
	DroppedByRelabelConfiguration = "relabel_configuration"
	// DroppedByUserConfigurationOverride Samples discarded due to user configuration removing label __name__
	DroppedByUserConfigurationOverride = "user_label_removal_configuration"

	// The combined length of the label names and values of an Exemplar's LabelSet MUST NOT exceed 128 UTF-8 characters
	// https://github.com/OpenObservability/OpenMetrics/blob/main/specification/OpenMetrics.md#exemplars
	ExemplarMaxLabelSetLength = 128
)
