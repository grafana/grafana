package threshold

import (
	"context"

	"github.com/openfga/openfga/internal/throttler"
	"github.com/openfga/openfga/pkg/dispatch"
)

type Config struct {
	Enabled      bool
	Throttler    throttler.Throttler
	Threshold    uint32
	MaxThreshold uint32
}

func ShouldThrottle(ctx context.Context, currentCount uint32, defaultThreshold uint32, maxThreshold uint32) bool {
	threshold := defaultThreshold

	if maxThreshold == 0 {
		maxThreshold = defaultThreshold
	}

	thresholdInCtx := dispatch.ThrottlingThresholdFromContext(ctx)

	if thresholdInCtx > 0 {
		threshold = min(thresholdInCtx, maxThreshold)
	}

	return currentCount > threshold
}
