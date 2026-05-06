package resultscache

import (
	"context"
	"time"

	"github.com/gogo/protobuf/proto"
)

type Request interface {
	proto.Message
	// GetStart returns the start timestamp of the request in milliseconds.
	GetStart() time.Time
	// GetEnd returns the end timestamp of the request in milliseconds.
	GetEnd() time.Time
	// GetStep returns the step of the request in milliseconds.
	GetStep() int64
	// GetQuery returns the query of the request.
	GetQuery() string
	// GetCachingOptions returns the caching options.
	GetCachingOptions() CachingOptions
	// WithStartEndForCache clone the current request with different start and end timestamp.
	WithStartEndForCache(start time.Time, end time.Time) Request
}

type Response interface {
	proto.Message
}

// ResponseMerger is used by middlewares making multiple requests to merge back all responses into a single one.
type ResponseMerger interface {
	// MergeResponse merges responses from multiple requests into a single Response
	MergeResponse(...Response) (Response, error)
}

type Handler interface {
	Do(ctx context.Context, req Request) (Response, error)
}

// Extractor is used by the cache to extract a subset of a response from a cache entry.
type Extractor interface {
	// Extract extracts a subset of a response from the `start` and `end` timestamps in milliseconds
	// in the `res` response which spans from `resStart` to `resEnd`.
	Extract(start, end int64, res Response, resStart, resEnd int64) Response
}

// KeyGenerator generates cache keys. This is a useful interface for downstream
// consumers who wish to implement their own strategies.
type KeyGenerator interface {
	GenerateCacheKey(ctx context.Context, userID string, r Request) string
}

type CacheGenNumberLoader interface {
	GetResultsCacheGenNumber(tenantIDs []string) string
	Stop()
}
