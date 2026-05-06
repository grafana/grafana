package dispatch

import "context"

type dispatchThrottlingThresholdType uint32

const (
	dispatchThrottlingThreshold dispatchThrottlingThresholdType = iota
)

// ContextWithThrottlingThreshold will save the dispatch throttling threshold in context.
// This can be used to set per request dispatch throttling when OpenFGA is used as library in another Go project.
func ContextWithThrottlingThreshold(ctx context.Context, threshold uint32) context.Context {
	return context.WithValue(ctx, dispatchThrottlingThreshold, threshold)
}

// ThrottlingThresholdFromContext returns the dispatch throttling threshold saved in context
// Return 0 if not found.
func ThrottlingThresholdFromContext(ctx context.Context) uint32 {
	thresholdInContext := ctx.Value(dispatchThrottlingThreshold)
	if thresholdInContext != nil {
		thresholdInInt, ok := thresholdInContext.(uint32)
		if ok {
			return thresholdInInt
		}
	}
	return 0
}
