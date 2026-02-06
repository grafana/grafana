package traceql

import (
	"math"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/grafana/tempo/pkg/tempopb"
	"github.com/grafana/tempo/pkg/util"
)

type MetadataCombiner interface {
	AddMetadata(new *tempopb.TraceSearchMetadata) bool
	IsCompleteFor(ts uint32) bool

	Metadata() []*tempopb.TraceSearchMetadata
	MetadataAfter(ts uint32) []*tempopb.TraceSearchMetadata

	addSpanset(new *Spanset)
}

const TimestampNever = uint32(math.MaxUint32)

func NewMetadataCombiner(limit int, keepMostRecent bool) MetadataCombiner {
	if keepMostRecent {
		return newMostRecentCombiner(limit)
	}

	return newAnyCombiner(limit)
}

type anyCombiner struct {
	trs   map[string]*tempopb.TraceSearchMetadata
	limit int
}

func newAnyCombiner(limit int) *anyCombiner {
	return &anyCombiner{
		trs:   make(map[string]*tempopb.TraceSearchMetadata, limit),
		limit: limit,
	}
}

// addSpanset adds a new spanset to the combiner. It only performs the asTraceSearchMetadata
// conversion if the spanset will be added
func (c *anyCombiner) addSpanset(new *Spanset) {
	// if it's already in the list, then we should add it
	if _, ok := c.trs[util.TraceIDToHexString(new.TraceID)]; ok {
		c.AddMetadata(asTraceSearchMetadata(new))
		return
	}

	// if we don't have too many
	if c.IsCompleteFor(0) {
		return
	}

	c.AddMetadata(asTraceSearchMetadata(new))
}

// AddMetadata adds the new metadata to the map. if it already exists
// use CombineSearchResults to combine the two
func (c *anyCombiner) AddMetadata(new *tempopb.TraceSearchMetadata) bool {
	if existing, ok := c.trs[new.TraceID]; ok {
		combineSearchResults(existing, new)
		return true
	}

	// if we don't have too many
	if c.IsCompleteFor(0) {
		return false
	}

	c.trs[new.TraceID] = new
	return true
}

func (c *anyCombiner) Count() int {
	return len(c.trs)
}

func (c *anyCombiner) Exists(id string) bool {
	_, ok := c.trs[id]
	return ok
}

func (c *anyCombiner) IsCompleteFor(_ uint32) bool {
	return c.Count() >= c.limit && c.limit > 0
}

func (c *anyCombiner) Metadata() []*tempopb.TraceSearchMetadata {
	m := make([]*tempopb.TraceSearchMetadata, 0, len(c.trs))
	for _, tr := range c.trs {
		m = append(m, tr)
	}
	sort.Slice(m, func(i, j int) bool {
		return m[i].StartTimeUnixNano > m[j].StartTimeUnixNano
	})
	return m
}

// MetadataAfter returns all traces that started after the given time. anyCombiner has no concept of time so it just returns all traces
func (c *anyCombiner) MetadataAfter(_ uint32) []*tempopb.TraceSearchMetadata {
	return c.Metadata()
}

type mostRecentCombiner struct {
	trs            map[string]*tempopb.TraceSearchMetadata
	trsSorted      []*tempopb.TraceSearchMetadata
	keepMostRecent int
}

func newMostRecentCombiner(limit int) *mostRecentCombiner {
	return &mostRecentCombiner{
		trs:            make(map[string]*tempopb.TraceSearchMetadata, limit),
		trsSorted:      make([]*tempopb.TraceSearchMetadata, 0, limit),
		keepMostRecent: limit,
	}
}

// addSpanset adds a new spanset to the combiner. It only performs the asTraceSearchMetadata
// conversion if the spanset will be added
func (c *mostRecentCombiner) addSpanset(new *Spanset) {
	// if we're not configured to keep most recent then just add it
	if c.keepMostRecent == 0 || c.Count() < c.keepMostRecent {
		c.AddMetadata(asTraceSearchMetadata(new))
		return
	}

	// else let's see if it's worth converting this to a metadata and adding it
	// if it's already in the list, then we should add it
	if _, ok := c.trs[util.TraceIDToHexString(new.TraceID)]; ok {
		c.AddMetadata(asTraceSearchMetadata(new))
		return
	}

	// if it's within range
	if c.OldestTimestampNanos() <= new.StartTimeUnixNanos {
		c.AddMetadata(asTraceSearchMetadata(new))
		return
	}

	// this spanset is too old to bother converting and adding it
}

// AddMetadata adds the new metadata to the map. if it already exists
// use CombineSearchResults to combine the two
func (c *mostRecentCombiner) AddMetadata(new *tempopb.TraceSearchMetadata) bool {
	if existing, ok := c.trs[new.TraceID]; ok {
		combineSearchResults(existing, new)
		return true
	}

	if c.Count() == c.keepMostRecent && c.keepMostRecent > 0 {
		// if this is older than the oldest element, bail
		if c.OldestTimestampNanos() > new.StartTimeUnixNano {
			return false
		}

		// otherwise remove the oldest element and we'll add the new one below
		oldest := c.trsSorted[c.Count()-1]
		delete(c.trs, oldest.TraceID)
		c.trsSorted = c.trsSorted[:len(c.trsSorted)-1]
	}

	// insert new in the right spot
	c.trs[new.TraceID] = new
	idx, _ := slices.BinarySearchFunc(c.trsSorted, new, func(a, b *tempopb.TraceSearchMetadata) int {
		if a.StartTimeUnixNano > b.StartTimeUnixNano {
			return -1
		}
		return 1
	})
	c.trsSorted = slices.Insert(c.trsSorted, idx, new)
	return true
}

func (c *mostRecentCombiner) Count() int {
	return len(c.trs)
}

func (c *mostRecentCombiner) Exists(id string) bool {
	_, ok := c.trs[id]
	return ok
}

// IsCompleteFor returns true if the combiner has reached the limit and all traces are after the given time
func (c *mostRecentCombiner) IsCompleteFor(ts uint32) bool {
	if ts == TimestampNever {
		return false
	}

	if c.Count() < c.keepMostRecent {
		return false
	}

	return c.OldestTimestampNanos() > uint64(ts)*uint64(time.Second)
}

func (c *mostRecentCombiner) Metadata() []*tempopb.TraceSearchMetadata {
	return c.trsSorted
}

// MetadataAfter returns all traces that started after the given time
func (c *mostRecentCombiner) MetadataAfter(afterSeconds uint32) []*tempopb.TraceSearchMetadata {
	afterNanos := uint64(afterSeconds) * uint64(time.Second)
	afterTraces := make([]*tempopb.TraceSearchMetadata, 0, len(c.trsSorted))

	for _, tr := range c.trsSorted {
		if tr.StartTimeUnixNano > afterNanos {
			afterTraces = append(afterTraces, tr)
		}
	}

	return afterTraces
}

func (c *mostRecentCombiner) OldestTimestampNanos() uint64 {
	if len(c.trsSorted) == 0 {
		return 0
	}

	return c.trsSorted[len(c.trsSorted)-1].StartTimeUnixNano
}

// combineSearchResults overlays the incoming search result with the existing result. This is required
// for the following reason:  a trace may be present in multiple blocks, or in partial segments
// in live traces.  The results should reflect elements of all segments.
func combineSearchResults(existing *tempopb.TraceSearchMetadata, incoming *tempopb.TraceSearchMetadata) {
	if existing.TraceID == "" {
		existing.TraceID = incoming.TraceID
	}

	if existing.RootServiceName == "" {
		existing.RootServiceName = incoming.RootServiceName
	}

	if existing.RootTraceName == "" {
		existing.RootTraceName = incoming.RootTraceName
	}

	// Earliest start time.
	if existing.StartTimeUnixNano > incoming.StartTimeUnixNano || existing.StartTimeUnixNano == 0 {
		existing.StartTimeUnixNano = incoming.StartTimeUnixNano
	}

	// Longest duration
	if existing.DurationMs < incoming.DurationMs || existing.DurationMs == 0 {
		existing.DurationMs = incoming.DurationMs
	}

	// Combine service stats
	// It's possible to find multiple trace fragments that satisfy a TraceQL result,
	// therefore we use max() to merge the ServiceStats.
	for service, incomingStats := range incoming.ServiceStats {
		existingStats, ok := existing.ServiceStats[service]
		if !ok {
			existingStats = &tempopb.ServiceStats{}
			if existing.ServiceStats == nil {
				existing.ServiceStats = make(map[string]*tempopb.ServiceStats)
			}
			existing.ServiceStats[service] = existingStats
		}
		existingStats.SpanCount = max(existingStats.SpanCount, incomingStats.SpanCount)
		existingStats.ErrorCount = max(existingStats.ErrorCount, incomingStats.ErrorCount)
	}

	// make a map of existing Spansets
	existingSS := make(map[string]*tempopb.SpanSet)
	for _, ss := range existing.SpanSets {
		existingSS[spansetID(ss)] = ss
	}

	// add any new spansets
	for _, ss := range incoming.SpanSets {
		id := spansetID(ss)
		// if not found just add directly
		if _, ok := existingSS[id]; !ok {
			existing.SpanSets = append(existing.SpanSets, ss)
			continue
		}

		// otherwise combine with existing
		combineSpansets(existingSS[id], ss)
	}

	// choose an arbitrary spanset to be the "main" one. this field is deprecated
	if len(existing.SpanSets) > 0 {
		existing.SpanSet = existing.SpanSets[0]
	}
}

// combineSpansets "combines" spansets. This isn't actually possible so it just
// choose the spanset that has the highest "Matched" number as it is hopefully
// more representative of the spanset
func combineSpansets(existing *tempopb.SpanSet, new *tempopb.SpanSet) {
	if existing.Matched >= new.Matched {
		return
	}

	existing.Matched = new.Matched
	existing.Attributes = new.Attributes
	existing.Spans = new.Spans
}

func spansetID(ss *tempopb.SpanSet) string {
	id := ""

	for _, s := range ss.Attributes {
		// any attributes that start with "by" are considered to be part of the spanset identity
		if strings.HasPrefix(s.Key, "by") {
			id += s.Key + s.Value.String()
		}
	}

	return id
}

type tsRange struct {
	minTS, maxTS uint64
}

type QueryRangeCombiner struct {
	req     *tempopb.QueryRangeRequest
	eval    *MetricsFrontendEvaluator
	metrics *tempopb.SearchMetrics

	maxSeries        int
	maxSeriesReached bool
}

func QueryRangeCombinerFor(req *tempopb.QueryRangeRequest, mode AggregateMode, maxSeriesLimit int) (*QueryRangeCombiner, error) {
	eval, err := NewEngine().CompileMetricsQueryRangeNonRaw(req, mode)
	if err != nil {
		return nil, err
	}

	return &QueryRangeCombiner{
		req:       req,
		eval:      eval,
		maxSeries: maxSeriesLimit,
		metrics:   &tempopb.SearchMetrics{},
	}, nil
}

func (q *QueryRangeCombiner) Combine(resp *tempopb.QueryRangeResponse) {
	if resp == nil || q.maxSeriesReached {
		return
	}

	// Here is where the job results are reentered into the pipeline
	q.eval.ObserveSeries(resp.Series)
	seriesCount := q.eval.Length()

	if (q.maxSeries > 0 && seriesCount >= q.maxSeries) || resp.Status == tempopb.PartialStatus_PARTIAL {
		q.maxSeriesReached = true
	}

	if resp.Metrics != nil {
		q.metrics.TotalJobs += resp.Metrics.TotalJobs
		q.metrics.TotalBlocks += resp.Metrics.TotalBlocks
		q.metrics.TotalBlockBytes += resp.Metrics.TotalBlockBytes
		q.metrics.InspectedBytes += resp.Metrics.InspectedBytes
		q.metrics.InspectedTraces += resp.Metrics.InspectedTraces
		q.metrics.InspectedSpans += resp.Metrics.InspectedSpans
		q.metrics.CompletedJobs += resp.Metrics.CompletedJobs
	}
}

func (q *QueryRangeCombiner) Response() *tempopb.QueryRangeResponse {
	response := &tempopb.QueryRangeResponse{
		Series:  q.eval.Results().ToProto(q.req),
		Metrics: q.metrics,
	}
	if q.maxSeriesReached {
		response.Status = tempopb.PartialStatus_PARTIAL
	}
	return response
}

func (q *QueryRangeCombiner) MaxSeriesReached() bool {
	return q.maxSeriesReached
}
