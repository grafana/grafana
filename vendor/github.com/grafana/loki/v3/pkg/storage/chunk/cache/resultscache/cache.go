package resultscache

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/gogo/protobuf/proto"
	"github.com/gogo/protobuf/types"
	"github.com/grafana/dskit/httpgrpc"
	"github.com/opentracing/opentracing-go"
	otlog "github.com/opentracing/opentracing-go/log"
	"github.com/prometheus/common/model"
	"github.com/uber/jaeger-client-go"

	"github.com/grafana/dskit/tenant"

	"github.com/grafana/loki/v3/pkg/logqlmodel/stats"
	"github.com/grafana/loki/v3/pkg/storage/chunk/cache"
	util_log "github.com/grafana/loki/v3/pkg/util/log"
	"github.com/grafana/loki/v3/pkg/util/math"
	"github.com/grafana/loki/v3/pkg/util/validation"
)

// ConstSplitter is a utility for using a constant split interval when determining cache keys
type ConstSplitter time.Duration

// GenerateCacheKey generates a cache key based on the userID, Request and interval.
func (t ConstSplitter) GenerateCacheKey(_ context.Context, userID string, r Request) string {
	currentInterval := r.GetStart().UnixMilli() / int64(time.Duration(t)/time.Millisecond)
	return fmt.Sprintf("%s:%s:%d:%d", userID, r.GetQuery(), r.GetStep(), currentInterval)
}

// ShouldCacheReqFn checks whether the current request should go to cache or not.
// If not, just send the request to next handler.
type ShouldCacheReqFn func(ctx context.Context, r Request) bool

// ShouldCacheResFn checks whether the current response should go to cache or not.
type ShouldCacheResFn func(ctx context.Context, r Request, res Response, maxCacheTime int64) bool

// ParallelismForReqFn returns the parallelism for a given request.
type ParallelismForReqFn func(ctx context.Context, tenantIDs []string, r Request) int

type ResultsCache struct {
	logger               log.Logger
	next                 Handler
	cache                cache.Cache
	limits               Limits
	keyGen               KeyGenerator
	cacheGenNumberLoader CacheGenNumberLoader
	retentionEnabled     bool
	extractor            Extractor
	minCacheExtent       int64 // discard any cache extent smaller than this
	merger               ResponseMerger
	shouldCacheReq       ShouldCacheReqFn
	shouldCacheRes       ShouldCacheResFn
	onlyUseEntireExtent  bool
	parallelismForReq    func(ctx context.Context, tenantIDs []string, r Request) int
}

// NewResultsCache creates results cache from config.
// The middleware cache result using a unique cache key for a given request (step,query,user) and interval.
// The cache assumes that each request length (end-start) is below or equal the interval.
// Each request starting from within the same interval will hit the same cache entry.
// If the cache doesn't have the entire duration of the request cached, it will query the uncached parts and append them to the cache entries.
// see `generateKey`.
func NewResultsCache(
	logger log.Logger,
	c cache.Cache,
	next Handler,
	keyGen KeyGenerator,
	limits Limits,
	merger ResponseMerger,
	extractor Extractor,
	shouldCacheReq ShouldCacheReqFn,
	shouldCacheRes ShouldCacheResFn,
	parallelismForReq func(ctx context.Context, tenantIDs []string, r Request) int,
	cacheGenNumberLoader CacheGenNumberLoader,
	retentionEnabled, onlyUseEntireExtent bool,
) *ResultsCache {
	return &ResultsCache{
		logger:               logger,
		next:                 next,
		cache:                c,
		limits:               limits,
		keyGen:               NewPipelineWrapperKeygen(keyGen),
		cacheGenNumberLoader: cacheGenNumberLoader,
		retentionEnabled:     retentionEnabled,
		extractor:            extractor,
		minCacheExtent:       (5 * time.Minute).Milliseconds(),
		merger:               merger,
		shouldCacheReq:       shouldCacheReq,
		shouldCacheRes:       shouldCacheRes,
		parallelismForReq:    parallelismForReq,
		onlyUseEntireExtent:  onlyUseEntireExtent,
	}
}

func (s ResultsCache) Do(ctx context.Context, r Request) (Response, error) {
	sp, ctx := opentracing.StartSpanFromContext(ctx, "resultsCache.Do")
	defer sp.Finish()
	tenantIDs, err := tenant.TenantIDs(ctx)
	if err != nil {
		return nil, httpgrpc.Errorf(http.StatusBadRequest, err.Error())
	}

	if s.shouldCacheReq != nil && !s.shouldCacheReq(ctx, r) {
		return s.next.Do(ctx, r)
	}

	if s.cacheGenNumberLoader != nil && s.retentionEnabled {
		ctx = cache.InjectCacheGenNumber(ctx, s.cacheGenNumberLoader.GetResultsCacheGenNumber(tenantIDs))
	}

	var (
		key      = s.keyGen.GenerateCacheKey(ctx, tenant.JoinTenantIDs(tenantIDs), r)
		extents  []Extent
		response Response
	)

	sp.LogKV(
		"query", r.GetQuery(),
		"step", time.UnixMilli(r.GetStep()),
		"start", r.GetStart(),
		"end", r.GetEnd(),
		"key", key,
	)

	cacheFreshnessCapture := func(id string) time.Duration { return s.limits.MaxCacheFreshness(ctx, id) }
	maxCacheFreshness := validation.MaxDurationPerTenant(tenantIDs, cacheFreshnessCapture)
	maxCacheTime := int64(model.Now().Add(-maxCacheFreshness))
	if r.GetStart().UnixMilli() > maxCacheTime {
		return s.next.Do(ctx, r)
	}

	cached, ok := s.get(ctx, key)
	if ok {
		response, extents, err = s.handleHit(ctx, r, cached, maxCacheTime)
	} else {
		response, extents, err = s.handleMiss(ctx, r, maxCacheTime)
	}

	if err == nil && len(extents) > 0 {
		extents, err := s.filterRecentExtents(r, maxCacheFreshness, extents)
		if err != nil {
			return nil, err
		}
		s.put(ctx, key, extents)
	}

	return response, err
}

func (s ResultsCache) handleMiss(ctx context.Context, r Request, maxCacheTime int64) (Response, []Extent, error) {
	response, err := s.next.Do(ctx, r)
	if err != nil {
		return nil, nil, err
	}

	if s.shouldCacheRes != nil && !s.shouldCacheRes(ctx, r, response, maxCacheTime) {
		return response, []Extent{}, nil
	}

	extent, err := toExtent(ctx, r, response)
	if err != nil {
		return nil, nil, err
	}

	extents := []Extent{
		extent,
	}
	return response, extents, nil
}

func (s ResultsCache) handleHit(ctx context.Context, r Request, extents []Extent, maxCacheTime int64) (Response, []Extent, error) {
	var (
		reqResps []RequestResponse
		err      error
	)
	sp, ctx := opentracing.StartSpanFromContext(ctx, "handleHit")
	defer sp.Finish()

	requests, responses, err := s.partition(r, extents)
	if err != nil {
		return nil, nil, err
	}

	queryLenFromCache := r.GetEnd().Sub(r.GetStart())
	st := stats.FromContext(ctx)
	if len(requests) == 0 {
		st.AddCacheQueryLengthServed(s.cache.GetCacheType(), queryLenFromCache)
		response, err := s.merger.MergeResponse(responses...)
		// No downstream requests so no need to write back to the cache.
		return response, nil, err
	}

	tenantIDs, err := tenant.TenantIDs(ctx)
	if err != nil {
		return nil, nil, httpgrpc.Errorf(http.StatusBadRequest, err.Error())
	}
	reqResps, err = DoRequests(ctx, s.next, requests, s.parallelismForReq(ctx, tenantIDs, r))

	if err != nil {
		return nil, nil, err
	}

	for _, reqResp := range reqResps {
		queryLenFromCache -= reqResp.Request.GetEnd().Sub(reqResp.Request.GetStart())
		responses = append(responses, reqResp.Response)
		if s.shouldCacheRes != nil && !s.shouldCacheRes(ctx, r, reqResp.Response, maxCacheTime) {
			continue
		}
		extent, err := toExtent(ctx, reqResp.Request, reqResp.Response)
		if err != nil {
			return nil, nil, err
		}
		extents = append(extents, extent)
	}
	sort.Slice(extents, func(i, j int) bool {
		if extents[i].Start == extents[j].Start {
			// as an optimization, for two extents starts at the same time, we
			// put bigger extent at the front of the slice, which helps
			// to reduce the amount of merge we have to do later.
			return extents[i].End > extents[j].End
		}

		return extents[i].Start < extents[j].Start
	})

	// Merge any extents - potentially overlapping
	accumulator, err := newAccumulator(extents[0])
	if err != nil {
		return nil, nil, err
	}
	mergedExtents := make([]Extent, 0, len(extents))

	for i := 1; i < len(extents); i++ {
		if accumulator.End+r.GetStep() < extents[i].Start {
			mergedExtents, err = merge(mergedExtents, accumulator)
			if err != nil {
				return nil, nil, err
			}
			accumulator, err = newAccumulator(extents[i])
			if err != nil {
				return nil, nil, err
			}
			continue
		}

		if accumulator.End >= extents[i].End {
			continue
		}

		accumulator.TraceId = jaegerTraceID(ctx)
		accumulator.End = extents[i].End
		currentRes, err := extents[i].toResponse()
		if err != nil {
			return nil, nil, err
		}
		merged, err := s.merger.MergeResponse(accumulator.Response, currentRes)
		if err != nil {
			return nil, nil, err
		}
		accumulator.Response = merged
	}

	mergedExtents, err = merge(mergedExtents, accumulator)
	if err != nil {
		return nil, nil, err
	}

	st.AddCacheQueryLengthServed(s.cache.GetCacheType(), queryLenFromCache)
	response, err := s.merger.MergeResponse(responses...)
	return response, mergedExtents, err
}

type accumulator struct {
	Response
	Extent
}

func merge(extents []Extent, acc *accumulator) ([]Extent, error) {
	anyResp, err := types.MarshalAny(acc.Response)
	if err != nil {
		return nil, err
	}
	return append(extents, Extent{
		Start:    acc.Extent.Start,
		End:      acc.Extent.End,
		Response: anyResp,
		TraceId:  acc.Extent.TraceId,
	}), nil
}

func newAccumulator(base Extent) (*accumulator, error) {
	res, err := base.toResponse()
	if err != nil {
		return nil, err
	}
	return &accumulator{
		Response: res,
		Extent:   base,
	}, nil
}

func toExtent(ctx context.Context, req Request, res Response) (Extent, error) {
	anyResp, err := types.MarshalAny(res)
	if err != nil {
		return Extent{}, err
	}
	return Extent{
		Start:    req.GetStart().UnixMilli(),
		End:      req.GetEnd().UnixMilli(),
		Response: anyResp,
		TraceId:  jaegerTraceID(ctx),
	}, nil
}

// partition calculates the required requests to satisfy req given the cached data.
// extents must be in order by start time.
func (s ResultsCache) partition(req Request, extents []Extent) ([]Request, []Response, error) {
	var requests []Request
	var cachedResponses []Response
	start := req.GetStart().UnixMilli()
	end := req.GetEnd().UnixMilli()

	for _, extent := range extents {
		// If there is no overlap, ignore this extent.
		if extent.GetEnd() < start || extent.GetStart() > end {
			continue
		}

		if s.onlyUseEntireExtent && (start > extent.GetStart() || end < extent.GetEnd()) {
			// It is not possible to extract the overlapping portion of an extent for all request types.
			// Metadata results for one cannot be extracted as the data portion is just a list of strings with no associated timestamp.
			// To avoid returning incorrect results, we only use extents that are entirely within the requested query range.
			//
			//	Start                  End
			//	┌────────────────────────┐
			//	│          Req           │
			//	└────────────────────────┘
			//
			//          ◄──────────────►               only this extent can be used. Remaining portion of the query will be added to requests.
			//
			//
			//   ◄──────X───────►                      cannot be partially extracted. will be discarded if onlyUseEntireExtent is set.
			//                       ◄───────X──────►
			//   ◄───────────────X──────────────────►
			continue
		}

		// If this extent is tiny and request is not tiny, discard it: more efficient to do a few larger queries.
		// Hopefully tiny request can make tiny extent into not-so-tiny extent.

		// However if the step is large enough, the split_query_by_interval middleware would generate a query with same start and end.
		// For example, if the step size is more than 12h and the interval is 24h.
		// This means the extent's start and end time would be same, even if the timerange covers several hours.
		if (req.GetStart() != req.GetEnd()) && ((end - start) > s.minCacheExtent) && (extent.End-extent.Start < s.minCacheExtent) {
			continue
		}

		// If there is a bit missing at the front, make a request for that.
		if start < extent.Start {
			r := req.WithStartEndForCache(time.UnixMilli(start), time.UnixMilli(extent.Start))
			requests = append(requests, r)
		}
		res, err := extent.toResponse()
		if err != nil {
			return nil, nil, err
		}

		// extract the overlap from the cached extent.
		cachedResponses = append(cachedResponses, s.extractor.Extract(start, end, res, extent.GetStart(), extent.GetEnd()))
		start = extent.End
	}

	// Lastly, make a request for any data missing at the end.
	if start < req.GetEnd().UnixMilli() {
		r := req.WithStartEndForCache(time.UnixMilli(start), time.UnixMilli(end))
		requests = append(requests, r)
	}

	// If start and end are the same (valid in promql), start == req.GetEnd() and we won't do the query.
	// But we should only do the request if we don't have a valid cached response for it.
	if req.GetStart() == req.GetEnd() && len(cachedResponses) == 0 {
		requests = append(requests, req)
	}

	return requests, cachedResponses, nil
}

func (s ResultsCache) filterRecentExtents(req Request, maxCacheFreshness time.Duration, extents []Extent) ([]Extent, error) {
	step := math.Max64(1, req.GetStep())
	maxCacheTime := (int64(model.Now().Add(-maxCacheFreshness)) / step) * step
	for i := range extents {
		// Never cache data for the latest freshness period.
		if extents[i].End > maxCacheTime {
			extents[i].End = maxCacheTime
			res, err := extents[i].toResponse()
			if err != nil {
				return nil, err
			}
			extracted := s.extractor.Extract(extents[i].GetStart(), maxCacheTime, res, extents[i].GetStart(), extents[i].GetEnd())
			anyResp, err := types.MarshalAny(extracted)
			if err != nil {
				return nil, err
			}
			extents[i].Response = anyResp
		}
	}
	return extents, nil
}

func (s ResultsCache) get(ctx context.Context, key string) ([]Extent, bool) {
	found, bufs, _, _ := s.cache.Fetch(ctx, []string{cache.HashKey(key)})
	if len(found) != 1 {
		return nil, false
	}

	var resp CachedResponse
	sp, ctx := opentracing.StartSpanFromContext(ctx, "unmarshal-extent") //nolint:ineffassign,staticcheck
	defer sp.Finish()

	sp.LogFields(otlog.Int("bytes", len(bufs[0])))

	if err := proto.Unmarshal(bufs[0], &resp); err != nil {
		level.Error(util_log.Logger).Log("msg", "error unmarshalling cached value", "err", err)
		return nil, false
	}

	if resp.Key != key {
		return nil, false
	}

	// Refreshes the cache if it contains an old proto schema.
	for _, e := range resp.Extents {
		if e.Response == nil {
			return nil, false
		}
	}

	return resp.Extents, true
}

func (s ResultsCache) put(ctx context.Context, key string, extents []Extent) {
	buf, err := proto.Marshal(&CachedResponse{
		Key:     key,
		Extents: extents,
	})
	if err != nil {
		level.Error(s.logger).Log("msg", "error marshalling cached value", "err", err)
		return
	}

	_ = s.cache.Store(ctx, []string{cache.HashKey(key)}, [][]byte{buf})
}

func jaegerTraceID(ctx context.Context) string {
	span := opentracing.SpanFromContext(ctx)
	if span == nil {
		return ""
	}

	spanContext, ok := span.Context().(jaeger.SpanContext)
	if !ok {
		return ""
	}

	return spanContext.TraceID().String()
}

func (e *Extent) toResponse() (Response, error) {
	msg, err := types.EmptyAny(e.Response)
	if err != nil {
		return nil, err
	}

	if err := types.UnmarshalAny(e.Response, msg); err != nil {
		return nil, err
	}

	resp, ok := msg.(Response)
	if !ok {
		return nil, fmt.Errorf("bad cached type")
	}
	return resp, nil
}
