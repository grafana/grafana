/*
Package stats provides primitives for recording metrics across the query path.
Statistics are passed through the query context.
To start a new query statistics context use:

	statsCtx, ctx := stats.NewContext(ctx)

Then you can update statistics by mutating data by using:

	statsCtx.Add...(1)

To get the  statistic from the current context you can use:

	statsCtx := stats.FromContext(ctx)

Finally to get a snapshot of the current query statistic use

	statsCtx.Result(time.Since(start), queueTime, totalEntriesReturned)
*/
package stats

import (
	"context"
	"sync"
	"sync/atomic" //lint:ignore faillint we can't use go.uber.org/atomic with a protobuf struct without wrapping it.
	"time"

	"github.com/dustin/go-humanize"

	"github.com/go-kit/log"
)

type (
	ctxKeyType string
	Component  int64
)

const (
	statsKey ctxKeyType = "stats"
)

// Context is the statistics context. It is passed through the query path and accumulates statistics.
type Context struct {
	querier  Querier
	ingester Ingester
	caches   Caches
	index    Index

	// store is the store statistics collected across the query path
	store Store
	// result accumulates results for JoinResult.
	result Result

	mtx sync.Mutex
}

type CacheType string

const (
	ChunkCache                CacheType = "chunk"                 //nolint:staticcheck
	IndexCache                CacheType = "index"                 //nolint:staticcheck
	ResultCache               CacheType = "result"                //nolint:staticcheck
	StatsResultCache          CacheType = "stats-result"          //nolint:staticcheck
	VolumeResultCache         CacheType = "volume-result"         //nolint:staticcheck
	InstantMetricResultsCache CacheType = "instant-metric-result" // nolint:staticcheck
	WriteDedupeCache          CacheType = "write-dedupe"          //nolint:staticcheck
	SeriesResultCache         CacheType = "series-result"         //nolint:staticcheck
	LabelResultCache          CacheType = "label-result"          //nolint:staticcheck
	BloomFilterCache          CacheType = "bloom-filter"          //nolint:staticcheck
	BloomBlocksCache          CacheType = "bloom-blocks"          //nolint:staticcheck
	BloomMetasCache           CacheType = "bloom-metas"           //nolint:staticcheck
)

// NewContext creates a new statistics context
func NewContext(ctx context.Context) (*Context, context.Context) {
	contextData := &Context{}
	ctx = context.WithValue(ctx, statsKey, contextData)
	return contextData, ctx
}

// FromContext returns the statistics context.
func FromContext(ctx context.Context) *Context {
	v, ok := ctx.Value(statsKey).(*Context)
	if !ok {
		return &Context{}
	}
	return v
}

// Ingester returns the ingester statistics accumulated so far.
func (c *Context) Ingester() Ingester {
	return Ingester{
		TotalReached:       c.ingester.TotalReached,
		TotalChunksMatched: c.ingester.TotalChunksMatched,
		TotalBatches:       c.ingester.TotalBatches,
		TotalLinesSent:     c.ingester.TotalLinesSent,
		Store:              c.store,
	}
}

// Store returns the store statistics accumulated so far.
func (c *Context) Store() Store {
	return c.store
}

// Caches returns the cache statistics accumulated so far.
func (c *Context) Caches() Caches {
	return Caches{
		Chunk:               c.caches.Chunk,
		Index:               c.caches.Index,
		Result:              c.caches.Result,
		StatsResult:         c.caches.StatsResult,
		VolumeResult:        c.caches.VolumeResult,
		SeriesResult:        c.caches.SeriesResult,
		LabelResult:         c.caches.LabelResult,
		InstantMetricResult: c.caches.InstantMetricResult,
	}
}

// Reset clears the statistics.
func (c *Context) Reset() {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	c.store.Reset()
	c.querier.Reset()
	c.ingester.Reset()
	c.result.Reset()
	c.caches.Reset()
	c.index.Reset()
}

// Result calculates the summary based on store and ingester data.
func (c *Context) Result(execTime time.Duration, queueTime time.Duration, totalEntriesReturned int) Result {
	r := c.result

	r.Merge(Result{
		Querier: Querier{
			Store: c.store,
		},
		Ingester: c.ingester,
		Caches:   c.caches,
		Index:    c.index,
	})

	r.ComputeSummary(execTime, queueTime, totalEntriesReturned)

	return r
}

// JoinResults merges a Result with the embedded Result in a context in a concurrency-safe manner.
func JoinResults(ctx context.Context, res Result) {
	stats := FromContext(ctx)
	stats.mtx.Lock()
	defer stats.mtx.Unlock()

	stats.result.Merge(res)
}

// JoinIngesters joins the ingester result statistics in a concurrency-safe manner.
func JoinIngesters(ctx context.Context, inc Ingester) {
	stats := FromContext(ctx)
	stats.mtx.Lock()
	defer stats.mtx.Unlock()

	stats.ingester.Merge(inc)
}

// ComputeSummary compute the summary of the statistics.
func (r *Result) ComputeSummary(execTime time.Duration, queueTime time.Duration, totalEntriesReturned int) {
	r.Summary.TotalBytesProcessed = r.Querier.Store.Chunk.DecompressedBytes + r.Querier.Store.Chunk.HeadChunkBytes +
		r.Ingester.Store.Chunk.DecompressedBytes + r.Ingester.Store.Chunk.HeadChunkBytes
	r.Summary.TotalStructuredMetadataBytesProcessed = r.Querier.Store.Chunk.DecompressedStructuredMetadataBytes + r.Querier.Store.Chunk.HeadChunkStructuredMetadataBytes +
		r.Ingester.Store.Chunk.DecompressedStructuredMetadataBytes + r.Ingester.Store.Chunk.HeadChunkStructuredMetadataBytes
	r.Summary.TotalLinesProcessed = r.Querier.Store.Chunk.DecompressedLines + r.Querier.Store.Chunk.HeadChunkLines +
		r.Ingester.Store.Chunk.DecompressedLines + r.Ingester.Store.Chunk.HeadChunkLines
	r.Summary.TotalPostFilterLines = r.Querier.Store.Chunk.PostFilterLines + r.Ingester.Store.Chunk.PostFilterLines
	r.Summary.ExecTime = execTime.Seconds()
	if execTime != 0 {
		r.Summary.BytesProcessedPerSecond = int64(float64(r.Summary.TotalBytesProcessed) /
			execTime.Seconds())
		r.Summary.LinesProcessedPerSecond = int64(float64(r.Summary.TotalLinesProcessed) /
			execTime.Seconds())
	}
	if queueTime != 0 {
		r.Summary.QueueTime = queueTime.Seconds()
	}

	r.Summary.TotalEntriesReturned = int64(totalEntriesReturned)
}

func (s *Store) Merge(m Store) {
	s.TotalChunksRef += m.TotalChunksRef
	s.TotalChunksDownloaded += m.TotalChunksDownloaded
	s.CongestionControlLatency += m.CongestionControlLatency
	s.PipelineWrapperFilteredLines += m.PipelineWrapperFilteredLines
	s.ChunksDownloadTime += m.ChunksDownloadTime
	s.ChunkRefsFetchTime += m.ChunkRefsFetchTime
	s.Chunk.HeadChunkBytes += m.Chunk.HeadChunkBytes
	s.Chunk.HeadChunkStructuredMetadataBytes += m.Chunk.HeadChunkStructuredMetadataBytes
	s.Chunk.HeadChunkLines += m.Chunk.HeadChunkLines
	s.Chunk.DecompressedBytes += m.Chunk.DecompressedBytes
	s.Chunk.DecompressedStructuredMetadataBytes += m.Chunk.DecompressedStructuredMetadataBytes
	s.Chunk.DecompressedLines += m.Chunk.DecompressedLines
	s.Chunk.CompressedBytes += m.Chunk.CompressedBytes
	s.Chunk.TotalDuplicates += m.Chunk.TotalDuplicates
	s.Chunk.PostFilterLines += m.Chunk.PostFilterLines
	if m.QueryReferencedStructured {
		s.QueryReferencedStructured = true
	}
}

func (s *Store) ChunksDownloadDuration() time.Duration {
	return time.Duration(s.GetChunksDownloadTime())
}

func (s *Summary) Merge(m Summary) {
	s.Splits += m.Splits
	s.Shards += m.Shards
}

func (q *Querier) Merge(m Querier) {
	q.Store.Merge(m.Store)
}

func (i *Ingester) Merge(m Ingester) {
	i.Store.Merge(m.Store)
	i.TotalBatches += m.TotalBatches
	i.TotalLinesSent += m.TotalLinesSent
	i.TotalChunksMatched += m.TotalChunksMatched
	i.TotalReached += m.TotalReached
}

func (i *Index) Merge(m Index) {
	i.TotalChunks += m.TotalChunks
	i.PostFilterChunks += m.PostFilterChunks
	i.ShardsDuration += m.ShardsDuration
}

func (c *Caches) Merge(m Caches) {
	c.Chunk.Merge(m.Chunk)
	c.Index.Merge(m.Index)
	c.Result.Merge(m.Result)
	c.StatsResult.Merge(m.StatsResult)
	c.VolumeResult.Merge(m.VolumeResult)
	c.SeriesResult.Merge(m.SeriesResult)
	c.LabelResult.Merge(m.LabelResult)
	c.InstantMetricResult.Merge(m.InstantMetricResult)
}

func (c *Cache) Merge(m Cache) {
	c.EntriesFound += m.EntriesFound
	c.EntriesRequested += m.EntriesRequested
	c.EntriesStored += m.EntriesStored
	c.Requests += m.Requests
	c.BytesSent += m.BytesSent
	c.BytesReceived += m.BytesReceived
	c.DownloadTime += m.DownloadTime
	c.QueryLengthServed += m.QueryLengthServed
}

func (c *Cache) CacheDownloadTime() time.Duration {
	return time.Duration(c.DownloadTime)
}

func (c *Cache) CacheQueryLengthServed() time.Duration {
	return time.Duration(c.QueryLengthServed)
}

func (r *Result) MergeSplit(m Result) {
	m.Summary.Splits = 1
	r.Merge(m)
}

// Merge merges two results of statistics.
func (r *Result) Merge(m Result) {
	r.Querier.Merge(m.Querier)
	r.Ingester.Merge(m.Ingester)
	r.Caches.Merge(m.Caches)
	r.Summary.Merge(m.Summary)
	r.Index.Merge(m.Index)
	r.ComputeSummary(ConvertSecondsToNanoseconds(r.Summary.ExecTime+m.Summary.ExecTime),
		ConvertSecondsToNanoseconds(r.Summary.QueueTime+m.Summary.QueueTime), int(r.Summary.TotalEntriesReturned))
}

// ConvertSecondsToNanoseconds converts time.Duration representation of seconds (float64)
// into time.Duration representation of nanoseconds (int64)
func ConvertSecondsToNanoseconds(seconds float64) time.Duration {
	return time.Duration(int64(seconds * float64(time.Second)))
}

func (r Result) ChunksDownloadTime() time.Duration {
	return time.Duration(r.Querier.Store.ChunksDownloadTime + r.Ingester.Store.ChunksDownloadTime)
}

func (r Result) ChunkRefsFetchTime() time.Duration {
	return time.Duration(r.Querier.Store.ChunkRefsFetchTime + r.Ingester.Store.ChunkRefsFetchTime)
}

func (r Result) CongestionControlLatency() time.Duration {
	return time.Duration(r.Querier.Store.CongestionControlLatency)
}

func (r Result) PipelineWrapperFilteredLines() int64 {
	return r.Querier.Store.PipelineWrapperFilteredLines + r.Ingester.Store.PipelineWrapperFilteredLines
}

func (r Result) TotalDuplicates() int64 {
	return r.Querier.Store.Chunk.TotalDuplicates + r.Ingester.Store.Chunk.TotalDuplicates
}

func (r Result) TotalChunksDownloaded() int64 {
	return r.Querier.Store.TotalChunksDownloaded + r.Ingester.Store.TotalChunksDownloaded
}

func (r Result) TotalChunksRef() int64 {
	return r.Querier.Store.TotalChunksRef + r.Ingester.Store.TotalChunksRef
}

func (r Result) TotalDecompressedBytes() int64 {
	return r.Querier.Store.Chunk.DecompressedBytes + r.Ingester.Store.Chunk.DecompressedBytes
}

func (r Result) TotalDecompressedLines() int64 {
	return r.Querier.Store.Chunk.DecompressedLines + r.Ingester.Store.Chunk.DecompressedLines
}

func (r Result) QueryReferencedStructuredMetadata() bool {
	return r.Querier.Store.QueryReferencedStructured || r.Ingester.Store.QueryReferencedStructured
}

func (c *Context) AddIngesterBatch(size int64) {
	atomic.AddInt64(&c.ingester.TotalBatches, 1)
	atomic.AddInt64(&c.ingester.TotalLinesSent, size)
}

func (c *Context) AddIngesterTotalChunkMatched(i int64) {
	atomic.AddInt64(&c.ingester.TotalChunksMatched, i)
}

func (c *Context) AddIngesterReached(i int32) {
	atomic.AddInt32(&c.ingester.TotalReached, i)
}

func (c *Context) AddHeadChunkLines(i int64) {
	atomic.AddInt64(&c.store.Chunk.HeadChunkLines, i)
}

func (c *Context) AddHeadChunkBytes(i int64) {
	atomic.AddInt64(&c.store.Chunk.HeadChunkBytes, i)
}

func (c *Context) AddHeadChunkStructuredMetadataBytes(i int64) {
	atomic.AddInt64(&c.store.Chunk.HeadChunkStructuredMetadataBytes, i)
}

func (c *Context) AddCompressedBytes(i int64) {
	atomic.AddInt64(&c.store.Chunk.CompressedBytes, i)
}

func (c *Context) AddDecompressedBytes(i int64) {
	atomic.AddInt64(&c.store.Chunk.DecompressedBytes, i)
}

func (c *Context) AddDecompressedStructuredMetadataBytes(i int64) {
	atomic.AddInt64(&c.store.Chunk.DecompressedStructuredMetadataBytes, i)
}

func (c *Context) AddDecompressedLines(i int64) {
	atomic.AddInt64(&c.store.Chunk.DecompressedLines, i)
}

func (c *Context) AddPostFilterLines(i int64) {
	atomic.AddInt64(&c.store.Chunk.PostFilterLines, i)
}

func (c *Context) AddDuplicates(i int64) {
	atomic.AddInt64(&c.store.Chunk.TotalDuplicates, i)
}

func (c *Context) AddChunksDownloadTime(i time.Duration) {
	atomic.AddInt64(&c.store.ChunksDownloadTime, int64(i))
}

func (c *Context) AddChunkRefsFetchTime(i time.Duration) {
	atomic.AddInt64(&c.store.ChunkRefsFetchTime, int64(i))
}

func (c *Context) AddCongestionControlLatency(i time.Duration) {
	atomic.AddInt64(&c.store.CongestionControlLatency, int64(i))
}

func (c *Context) AddPipelineWrapperFilterdLines(i int64) {
	atomic.AddInt64(&c.store.PipelineWrapperFilteredLines, i)
}

func (c *Context) AddChunksDownloaded(i int64) {
	atomic.AddInt64(&c.store.TotalChunksDownloaded, i)
}

func (c *Context) AddChunksRef(i int64) {
	atomic.AddInt64(&c.store.TotalChunksRef, i)
}

// AddCacheEntriesFound counts the number of cache entries requested and found
func (c *Context) AddCacheEntriesFound(t CacheType, i int) {
	stats := c.getCacheStatsByType(t)
	if stats == nil {
		return
	}

	atomic.AddInt32(&stats.EntriesFound, int32(i))
}

// AddCacheEntriesRequested counts the number of keys requested from the cache
func (c *Context) AddCacheEntriesRequested(t CacheType, i int) {
	stats := c.getCacheStatsByType(t)
	if stats == nil {
		return
	}

	atomic.AddInt32(&stats.EntriesRequested, int32(i))
}

// AddCacheEntriesStored counts the number of keys *attempted* to be stored in the cache
// It should be noted that if a background writeback (https://grafana.com/docs/loki/latest/configuration/#cache_config)
// is configured we cannot know if these store attempts succeeded or not as this happens asynchronously
func (c *Context) AddCacheEntriesStored(t CacheType, i int) {
	stats := c.getCacheStatsByType(t)
	if stats == nil {
		return
	}

	atomic.AddInt32(&stats.EntriesStored, int32(i))
}

// AddCacheBytesRetrieved counts the amount of bytes retrieved from the cache
func (c *Context) AddCacheBytesRetrieved(t CacheType, i int) {
	stats := c.getCacheStatsByType(t)
	if stats == nil {
		return
	}

	atomic.AddInt64(&stats.BytesReceived, int64(i))
}

// AddCacheBytesSent counts the amount of bytes sent to the cache
// It should be noted that if a background writeback (https://grafana.com/docs/loki/latest/configuration/#cache_config)
// is configured we cannot know if these bytes actually got stored or not as this happens asynchronously
func (c *Context) AddCacheBytesSent(t CacheType, i int) {
	stats := c.getCacheStatsByType(t)
	if stats == nil {
		return
	}

	atomic.AddInt64(&stats.BytesSent, int64(i))
}

// AddCacheDownloadTime measures the time to download the data from cache
func (c *Context) AddCacheDownloadTime(t CacheType, i time.Duration) {
	stats := c.getCacheStatsByType(t)
	if stats == nil {
		return
	}

	atomic.AddInt64(&stats.DownloadTime, int64(i))
}

// AddCacheRequest counts the number of fetch/store requests to the cache
func (c *Context) AddCacheRequest(t CacheType, i int) {
	stats := c.getCacheStatsByType(t)
	if stats == nil {
		return
	}

	atomic.AddInt32(&stats.Requests, int32(i))
}

// AddCacheQueryLengthServed measures the length of the query served from cache
func (c *Context) AddCacheQueryLengthServed(t CacheType, i time.Duration) {
	stats := c.getCacheStatsByType(t)
	if stats == nil {
		return
	}

	atomic.AddInt64(&stats.QueryLengthServed, int64(i))
}

func (c *Context) AddSplitQueries(num int64) {
	atomic.AddInt64(&c.result.Summary.Splits, num)
}

func (c *Context) SetQueryReferencedStructuredMetadata() {
	c.store.QueryReferencedStructured = true
}

func (c *Context) getCacheStatsByType(t CacheType) *Cache {
	var stats *Cache
	switch t {
	case ChunkCache:
		stats = &c.caches.Chunk
	case IndexCache:
		stats = &c.caches.Index
	case ResultCache:
		stats = &c.caches.Result
	case StatsResultCache:
		stats = &c.caches.StatsResult
	case VolumeResultCache:
		stats = &c.caches.VolumeResult
	case SeriesResultCache:
		stats = &c.caches.SeriesResult
	case LabelResultCache:
		stats = &c.caches.LabelResult
	case InstantMetricResultsCache:
		stats = &c.caches.InstantMetricResult
	default:
		return nil
	}
	return stats
}

func (r Result) Log(logger log.Logger) {
	logger.Log(r.KVList()...)
}

func (r Result) KVList() []any {
	result := []any{
		"Ingester.TotalReached", r.Ingester.TotalReached,
		"Ingester.TotalChunksMatched", r.Ingester.TotalChunksMatched,
		"Ingester.TotalBatches", r.Ingester.TotalBatches,
		"Ingester.TotalLinesSent", r.Ingester.TotalLinesSent,
		"Ingester.TotalChunksRef", r.Ingester.Store.TotalChunksRef,
		"Ingester.TotalChunksDownloaded", r.Ingester.Store.TotalChunksDownloaded,
		"Ingester.ChunksDownloadTime", time.Duration(r.Ingester.Store.ChunksDownloadTime),
		"Ingester.ChunkRefsFetchTime", time.Duration(r.Ingester.Store.ChunkRefsFetchTime),
		"Ingester.HeadChunkBytes", humanize.Bytes(uint64(r.Ingester.Store.Chunk.HeadChunkBytes)),
		"Ingester.HeadChunkLines", r.Ingester.Store.Chunk.HeadChunkLines,
		"Ingester.DecompressedBytes", humanize.Bytes(uint64(r.Ingester.Store.Chunk.DecompressedBytes)),
		"Ingester.DecompressedLines", r.Ingester.Store.Chunk.DecompressedLines,
		"Ingester.PostFilterLInes", r.Ingester.Store.Chunk.PostFilterLines,
		"Ingester.CompressedBytes", humanize.Bytes(uint64(r.Ingester.Store.Chunk.CompressedBytes)),
		"Ingester.TotalDuplicates", r.Ingester.Store.Chunk.TotalDuplicates,

		"Querier.TotalChunksRef", r.Querier.Store.TotalChunksRef,
		"Querier.TotalChunksDownloaded", r.Querier.Store.TotalChunksDownloaded,
		"Querier.ChunksDownloadTime", time.Duration(r.Querier.Store.ChunksDownloadTime),
		"Querier.ChunkRefsFetchTime", time.Duration(r.Querier.Store.ChunkRefsFetchTime),
		"Querier.HeadChunkBytes", humanize.Bytes(uint64(r.Querier.Store.Chunk.HeadChunkBytes)),
		"Querier.HeadChunkLines", r.Querier.Store.Chunk.HeadChunkLines,
		"Querier.DecompressedBytes", humanize.Bytes(uint64(r.Querier.Store.Chunk.DecompressedBytes)),
		"Querier.DecompressedLines", r.Querier.Store.Chunk.DecompressedLines,
		"Querier.PostFilterLInes", r.Querier.Store.Chunk.PostFilterLines,
		"Querier.CompressedBytes", humanize.Bytes(uint64(r.Querier.Store.Chunk.CompressedBytes)),
		"Querier.TotalDuplicates", r.Querier.Store.Chunk.TotalDuplicates,
		"Querier.QueryReferencedStructuredMetadata", r.Querier.Store.QueryReferencedStructured,
	}

	result = append(result, r.Caches.kvList()...)
	return append(result, r.Summary.kvList()...)
}

func (s Summary) kvList() []any {
	return []any{
		"Summary.BytesProcessedPerSecond", humanize.Bytes(uint64(s.BytesProcessedPerSecond)),
		"Summary.LinesProcessedPerSecond", s.LinesProcessedPerSecond,
		"Summary.TotalBytesProcessed", humanize.Bytes(uint64(s.TotalBytesProcessed)),
		"Summary.TotalLinesProcessed", s.TotalLinesProcessed,
		"Summary.PostFilterLines", s.TotalPostFilterLines,
		"Summary.ExecTime", ConvertSecondsToNanoseconds(s.ExecTime),
		"Summary.QueueTime", ConvertSecondsToNanoseconds(s.QueueTime),
	}
}

func (c Caches) kvList() []any {
	return []any{
		"Cache.Chunk.Requests", c.Chunk.Requests,
		"Cache.Chunk.EntriesRequested", c.Chunk.EntriesRequested,
		"Cache.Chunk.EntriesFound", c.Chunk.EntriesFound,
		"Cache.Chunk.EntriesStored", c.Chunk.EntriesStored,
		"Cache.Chunk.BytesSent", humanize.Bytes(uint64(c.Chunk.BytesSent)),
		"Cache.Chunk.BytesReceived", humanize.Bytes(uint64(c.Chunk.BytesReceived)),
		"Cache.Chunk.DownloadTime", c.Chunk.CacheDownloadTime(),
		"Cache.Index.Requests", c.Index.Requests,
		"Cache.Index.EntriesRequested", c.Index.EntriesRequested,
		"Cache.Index.EntriesFound", c.Index.EntriesFound,
		"Cache.Index.EntriesStored", c.Index.EntriesStored,
		"Cache.Index.BytesSent", humanize.Bytes(uint64(c.Index.BytesSent)),
		"Cache.Index.BytesReceived", humanize.Bytes(uint64(c.Index.BytesReceived)),
		"Cache.Index.DownloadTime", c.Index.CacheDownloadTime(),
		"Cache.StatsResult.Requests", c.StatsResult.Requests,
		"Cache.StatsResult.EntriesRequested", c.StatsResult.EntriesRequested,
		"Cache.StatsResult.EntriesFound", c.StatsResult.EntriesFound,
		"Cache.StatsResult.EntriesStored", c.StatsResult.EntriesStored,
		"Cache.StatsResult.BytesSent", humanize.Bytes(uint64(c.StatsResult.BytesSent)),
		"Cache.StatsResult.BytesReceived", humanize.Bytes(uint64(c.StatsResult.BytesReceived)),
		"Cache.VolumeResult.Requests", c.VolumeResult.Requests,
		"Cache.VolumeResult.EntriesRequested", c.VolumeResult.EntriesRequested,
		"Cache.VolumeResult.EntriesFound", c.VolumeResult.EntriesFound,
		"Cache.VolumeResult.EntriesStored", c.VolumeResult.EntriesStored,
		"Cache.VolumeResult.BytesSent", humanize.Bytes(uint64(c.VolumeResult.BytesSent)),
		"Cache.VolumeResult.BytesReceived", humanize.Bytes(uint64(c.VolumeResult.BytesReceived)),
		"Cache.SeriesResult.Requests", c.SeriesResult.Requests,
		"Cache.SeriesResult.EntriesRequested", c.SeriesResult.EntriesRequested,
		"Cache.SeriesResult.EntriesFound", c.SeriesResult.EntriesFound,
		"Cache.SeriesResult.EntriesStored", c.SeriesResult.EntriesStored,
		"Cache.SeriesResult.BytesSent", humanize.Bytes(uint64(c.SeriesResult.BytesSent)),
		"Cache.SeriesResult.BytesReceived", humanize.Bytes(uint64(c.SeriesResult.BytesReceived)),
		"Cache.LabelResult.Requests", c.LabelResult.Requests,
		"Cache.LabelResult.EntriesRequested", c.LabelResult.EntriesRequested,
		"Cache.LabelResult.EntriesFound", c.LabelResult.EntriesFound,
		"Cache.LabelResult.EntriesStored", c.LabelResult.EntriesStored,
		"Cache.LabelResult.BytesSent", humanize.Bytes(uint64(c.LabelResult.BytesSent)),
		"Cache.LabelResult.BytesReceived", humanize.Bytes(uint64(c.LabelResult.BytesReceived)),
		"Cache.Result.DownloadTime", c.Result.CacheDownloadTime(),
		"Cache.Result.Requests", c.Result.Requests,
		"Cache.Result.EntriesRequested", c.Result.EntriesRequested,
		"Cache.Result.EntriesFound", c.Result.EntriesFound,
		"Cache.Result.EntriesStored", c.Result.EntriesStored,
		"Cache.Result.BytesSent", humanize.Bytes(uint64(c.Result.BytesSent)),
		"Cache.Result.BytesReceived", humanize.Bytes(uint64(c.Result.BytesReceived)),
		"Cache.InstantMetricResult.Requests", c.InstantMetricResult.Requests,
		"Cache.InstantMetricResult.EntriesRequested", c.InstantMetricResult.EntriesRequested,
		"Cache.InstantMetricResult.EntriesFound", c.InstantMetricResult.EntriesFound,
		"Cache.InstantMetricResult.EntriesStored", c.InstantMetricResult.EntriesStored,
		"Cache.InstantMetricResult.BytesSent", humanize.Bytes(uint64(c.InstantMetricResult.BytesSent)),
		"Cache.InstantMetricResult.BytesReceived", humanize.Bytes(uint64(c.InstantMetricResult.BytesReceived)),
		"Cache.InstantMetricResult.DownloadTime", c.InstantMetricResult.CacheDownloadTime(),
	}
}
