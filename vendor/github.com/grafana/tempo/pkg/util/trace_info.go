package util

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/grafana/dskit/user"
	jaeger "github.com/jaegertracing/jaeger-idl/thrift-gen/jaeger"
	thrift "github.com/jaegertracing/jaeger/thrift-gen/jaeger"
	zipkincore "github.com/jaegertracing/jaeger/thrift-gen/zipkincore"
	jaegerTrans "github.com/open-telemetry/opentelemetry-collector-contrib/pkg/translator/jaeger"
	"go.opentelemetry.io/collector/pdata/ptrace"

	"github.com/grafana/tempo/pkg/tempopb"
	v1common "github.com/grafana/tempo/pkg/tempopb/common/v1"
)

var (
	// maxBatchesPerWrite is used when writing and reading, and needs to match so
	// that we get the expected number of batches on a trace.  A value larger
	// than 10 here results in vulture writing traces that exceed the maximum
	// trace size.
	maxBatchesPerWrite int64 = 10

	// maxBatchesPerWrite is the maximum number of time-delayed writes for a trace.
	maxLongWritesPerTrace int64 = 3
)

// TraceInfo is used to construct synthetic traces and manage the expectations.
type TraceInfo struct {
	timestamp           time.Time
	r                   *rand.Rand
	traceIDHigh         int64
	traceIDLow          int64
	longWritesRemaining int64
	tempoOrgID          string
}

// JaegerClient is an interface used to mock the underlying client in tests.
type JaegerClient interface {
	EmitBatch(ctx context.Context, b *thrift.Batch) error
	EmitZipkinBatch(ctx context.Context, zSpans []*zipkincore.Span) error
}

// NewTraceInfo is used to produce a new TraceInfo.
func NewTraceInfo(timestamp time.Time, tempoOrgID string) *TraceInfo {
	r := newRand(timestamp)

	return &TraceInfo{
		timestamp:           timestamp,
		r:                   r,
		traceIDHigh:         r.Int63(),
		traceIDLow:          r.Int63(),
		longWritesRemaining: r.Int63n(maxLongWritesPerTrace),
		tempoOrgID:          tempoOrgID,
	}
}

func NewTraceInfoWithMaxLongWrites(timestamp time.Time, maxLongWrites int64, tempoOrgID string) *TraceInfo {
	r := newRand(timestamp)

	return &TraceInfo{
		timestamp:           timestamp,
		r:                   r,
		traceIDHigh:         r.Int63(),
		traceIDLow:          r.Int63(),
		longWritesRemaining: maxLongWrites,
		tempoOrgID:          tempoOrgID,
	}
}

func (t *TraceInfo) Ready(now time.Time, writeBackoff, longWriteBackoff time.Duration) bool {
	// Don't use the last time interval to allow the write loop to finish before
	// we try to read it.
	if t.timestamp.After(now.Add(-writeBackoff)) {
		return false
	}

	// Compare a new instance with the same timestamp to know how many longWritesRemaining.
	totalWrites := NewTraceInfo(t.timestamp, t.tempoOrgID).longWritesRemaining
	// We are not ready if not all writes have had a chance to send.
	lastWrite := t.timestamp.Add(time.Duration(totalWrites) * longWriteBackoff)
	return !now.Before(lastWrite.Add(longWriteBackoff))
}

func (t *TraceInfo) Timestamp() time.Time {
	return t.timestamp
}

func (t *TraceInfo) TraceID() ([]byte, error) {
	return HexStringToTraceID(t.HexID())
}

func (t *TraceInfo) HexID() string {
	return fmt.Sprintf("%016x%016x", t.traceIDHigh, t.traceIDLow)
}

func (t *TraceInfo) LongWritesRemaining() int64 {
	return t.longWritesRemaining
}

func (t *TraceInfo) Done() {
	t.longWritesRemaining--
}

func (t *TraceInfo) EmitBatches(c JaegerClient) error {
	for i := int64(0); i < t.generateRandomInt(1, maxBatchesPerWrite); i++ {
		ctx := user.InjectOrgID(context.Background(), t.tempoOrgID)
		ctx, err := user.InjectIntoGRPCRequest(ctx)
		if err != nil {
			return fmt.Errorf("error injecting org id: %w", err)
		}

		err = c.EmitBatch(ctx, t.makeThriftBatch(t.traceIDHigh, t.traceIDLow))
		if err != nil {
			return fmt.Errorf("error pushing batch to Tempo: %w", err)
		}
	}

	return nil
}

// EmitAllBatches sends all the batches that would normally be sent at some
// interval when using EmitBatches.
func (t *TraceInfo) EmitAllBatches(c JaegerClient) error {
	err := t.EmitBatches(c)
	if err != nil {
		return err
	}

	for t.LongWritesRemaining() > 0 {
		t.Done()

		err := t.EmitBatches(c)
		if err != nil {
			return err
		}
	}

	return nil
}

func (t *TraceInfo) generateRandomInt(min, max int64) int64 {
	min++
	number := min + t.r.Int63n(max-min)
	return number
}

func (t *TraceInfo) makeThriftBatch(TraceIDHigh, TraceIDLow int64) *thrift.Batch {
	var spans []*thrift.Span
	count := t.generateRandomInt(1, 5)
	lastSpanID, nextSpanID := int64(0), int64(0)
	// Each span has the previous span as parent, creating a tree with a single branch per batch.
	for i := int64(0); i < count; i++ {
		nextSpanID = t.r.Int63()

		spans = append(spans, &thrift.Span{
			TraceIdLow:    TraceIDLow,
			TraceIdHigh:   TraceIDHigh,
			SpanId:        nextSpanID,
			ParentSpanId:  lastSpanID,
			OperationName: fmt.Sprintf("vulture-%d", t.generateRandomInt(0, 100)),
			References:    nil,
			Flags:         0,
			StartTime:     t.timestamp.UnixMicro(),
			Duration:      t.generateRandomInt(0, 100),
			Tags:          t.generateRandomTags(),
			Logs:          t.generateRandomLogs(),
		})

		lastSpanID = nextSpanID
	}

	process := &thrift.Process{
		ServiceName: "tempo-vulture",
		Tags:        t.generateRandomTagsWithPrefix("vulture-process"),
	}

	return &thrift.Batch{Process: process, Spans: spans}
}

func (t *TraceInfo) makeJaegerBatch(TraceIDHigh, TraceIDLow int64) *jaeger.Batch {
	var spans []*jaeger.Span
	count := t.generateRandomInt(1, 5)
	lastSpanID, nextSpanID := int64(0), int64(0)
	// Each span has the previous span as parent, creating a tree with a single branch per batch.
	for i := int64(0); i < count; i++ {
		nextSpanID = t.r.Int63()

		spans = append(spans, &jaeger.Span{
			TraceIdLow:    TraceIDLow,
			TraceIdHigh:   TraceIDHigh,
			SpanId:        nextSpanID,
			ParentSpanId:  lastSpanID,
			OperationName: fmt.Sprintf("vulture-%d", t.generateRandomInt(0, 100)),
			References:    nil,
			Flags:         0,
			StartTime:     t.timestamp.UnixMicro(),
			Duration:      t.generateRandomInt(0, 100),
			Tags:          t.generateRandomJaegerTags(),
			Logs:          t.generateRandomJaegerLogs(),
		})

		lastSpanID = nextSpanID
	}

	process := &jaeger.Process{
		ServiceName: "tempo-vulture",
		Tags:        t.generateRandomJaegerTagsWithPrefix("vulture-process"),
	}

	return &jaeger.Batch{Process: process, Spans: spans}
}

func (t *TraceInfo) generateRandomString() string {
	letters := []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

	s := make([]rune, t.generateRandomInt(5, 20))
	for i := range s {
		s[i] = letters[t.r.Intn(len(letters))]
	}
	return string(s)
}

func (t *TraceInfo) generateRandomTags() []*thrift.Tag {
	return t.generateRandomTagsWithPrefix("vulture")
}

func (t *TraceInfo) generateRandomJaegerTags() []*jaeger.Tag {
	return t.generateRandomJaegerTagsWithPrefix("vulture")
}

func (t *TraceInfo) generateRandomTagsWithPrefix(prefix string) []*thrift.Tag {
	var tags []*thrift.Tag
	count := t.generateRandomInt(1, 5)
	for i := int64(0); i < count; i++ {
		value := t.generateRandomString()
		tags = append(tags, &thrift.Tag{
			Key:  fmt.Sprintf("%s-%d", prefix, i),
			VStr: &value,
		})
	}
	return tags
}

func (t *TraceInfo) generateRandomJaegerTagsWithPrefix(prefix string) []*jaeger.Tag {
	var tags []*jaeger.Tag
	count := t.generateRandomInt(1, 5)
	for i := int64(0); i < count; i++ {
		value := t.generateRandomString()
		tags = append(tags, &jaeger.Tag{
			Key:  fmt.Sprintf("%s-%d", prefix, i),
			VStr: &value,
		})
	}
	return tags
}

func (t *TraceInfo) generateRandomLogs() []*thrift.Log {
	var logs []*thrift.Log
	count := t.generateRandomInt(1, 5)
	for i := int64(0); i < count; i++ {
		logs = append(logs, &thrift.Log{
			Timestamp: t.timestamp.UnixMicro(),
			Fields:    t.generateRandomTags(),
		})
	}

	return logs
}

func (t *TraceInfo) generateRandomJaegerLogs() []*jaeger.Log {
	var logs []*jaeger.Log
	count := t.generateRandomInt(1, 5)
	for i := int64(0); i < count; i++ {
		logs = append(logs, &jaeger.Log{
			Timestamp: t.timestamp.UnixMicro(),
			Fields:    t.generateRandomJaegerTags(),
		})
	}

	return logs
}

func (t *TraceInfo) ConstructTraceFromEpoch() (*tempopb.Trace, error) {
	trace := &tempopb.Trace{}

	// Create a new trace from our timestamp to ensure a fresh rand.Rand is used for consistency.
	info := NewTraceInfo(t.timestamp, t.tempoOrgID)

	addBatches := func(t *TraceInfo, trace *tempopb.Trace) error {
		for i := int64(0); i < t.generateRandomInt(1, maxBatchesPerWrite); i++ {
			batch := t.makeJaegerBatch(t.traceIDHigh, t.traceIDLow)
			internalTrace, err := jaegerTrans.ThriftToTraces(batch)
			if err != nil {
				return err
			}
			conv, err := (&ptrace.ProtoMarshaler{}).MarshalTraces(internalTrace)
			if err != nil {
				return err
			}

			t := tempopb.Trace{}
			err = t.Unmarshal(conv)
			if err != nil {
				return err
			}

			// Due to the several transforms above, some manual mangling is required to
			// get the parentSpanID to match.  In the case of an empty []byte in place
			// for the ParentSpanId, we set to nil here to ensure that the final result
			// matches the json.Unmarshal value when tempo is queried.
			for _, b := range t.ResourceSpans {
				for _, l := range b.ScopeSpans {
					for _, s := range l.Spans {
						if len(s.GetParentSpanId()) == 0 {
							s.ParentSpanId = nil
						}
					}
				}
			}

			trace.ResourceSpans = append(trace.ResourceSpans, t.ResourceSpans...)
		}

		return nil
	}

	err := addBatches(info, trace)
	if err != nil {
		return nil, err
	}

	for info.longWritesRemaining > 0 {
		info.Done()
		err := addBatches(info, trace)
		if err != nil {
			return nil, err
		}
	}

	return trace, nil
}

func RandomAttrFromTrace(t *tempopb.Trace) *v1common.KeyValue {
	r := newRand(time.Now())

	if len(t.ResourceSpans) == 0 {
		return nil
	}
	batch := randFrom(r, t.ResourceSpans)

	// maybe choose resource attribute
	res := batch.Resource
	if len(res.Attributes) > 0 && r.Int()%2 == 1 {
		attr := randFrom(r, res.Attributes)
		// skip service.name because service names have low cardinality and produce queries with
		// too many results in tempo-vulture
		if attr.Key != "service.name" {
			return attr
		}
	}

	if len(batch.ScopeSpans) == 0 {
		return nil
	}
	ss := randFrom(r, batch.ScopeSpans)

	if len(ss.Spans) == 0 {
		return nil
	}
	span := randFrom(r, ss.Spans)

	if len(span.Attributes) == 0 {
		return nil
	}

	return randFrom(r, span.Attributes)
}

func randFrom[T any](r *rand.Rand, s []T) T {
	return s[r.Intn(len(s))]
}

func newRand(t time.Time) *rand.Rand {
	return rand.New(rand.NewSource(t.Unix()))
}
