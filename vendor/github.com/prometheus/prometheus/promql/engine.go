// Copyright 2013 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package promql

import (
	"bytes"
	"container/heap"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"reflect"
	"runtime"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/prometheus/common/promslog"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/timestamp"
	"github.com/prometheus/prometheus/model/value"
	"github.com/prometheus/prometheus/promql/parser"
	"github.com/prometheus/prometheus/promql/parser/posrange"
	"github.com/prometheus/prometheus/storage"
	"github.com/prometheus/prometheus/tsdb/chunkenc"
	"github.com/prometheus/prometheus/util/annotations"
	"github.com/prometheus/prometheus/util/logging"
	"github.com/prometheus/prometheus/util/stats"
	"github.com/prometheus/prometheus/util/zeropool"
)

const (
	namespace            = "prometheus"
	subsystem            = "engine"
	queryTag             = "query"
	env                  = "query execution"
	defaultLookbackDelta = 5 * time.Minute

	// The largest SampleValue that can be converted to an int64 without overflow.
	maxInt64 = 9223372036854774784
	// The smallest SampleValue that can be converted to an int64 without underflow.
	minInt64 = -9223372036854775808

	// Max initial size for the pooled points slices.
	// The getHPointSlice and getFPointSlice functions are called with an estimated size which often can be
	// over-estimated.
	maxPointsSliceSize = 5000

	// The default buffer size for points used by the matrix selector.
	matrixSelectorSliceSize = 16
)

type engineMetrics struct {
	currentQueries       prometheus.Gauge
	maxConcurrentQueries prometheus.Gauge
	queryLogEnabled      prometheus.Gauge
	queryLogFailures     prometheus.Counter
	queryQueueTime       prometheus.Observer
	queryPrepareTime     prometheus.Observer
	queryInnerEval       prometheus.Observer
	queryResultSort      prometheus.Observer
	querySamples         prometheus.Counter
}

// convertibleToInt64 returns true if v does not over-/underflow an int64.
func convertibleToInt64(v float64) bool {
	return v <= maxInt64 && v >= minInt64
}

type (
	// ErrQueryTimeout is returned if a query timed out during processing.
	ErrQueryTimeout string
	// ErrQueryCanceled is returned if a query was canceled during processing.
	ErrQueryCanceled string
	// ErrTooManySamples is returned if a query would load more than the maximum allowed samples into memory.
	ErrTooManySamples string
	// ErrStorage is returned if an error was encountered in the storage layer
	// during query handling.
	ErrStorage struct{ Err error }
)

func (e ErrQueryTimeout) Error() string {
	return fmt.Sprintf("query timed out in %s", string(e))
}

func (e ErrQueryCanceled) Error() string {
	return fmt.Sprintf("query was canceled in %s", string(e))
}

func (e ErrTooManySamples) Error() string {
	return fmt.Sprintf("query processing would load too many samples into memory in %s", string(e))
}

func (e ErrStorage) Error() string {
	return e.Err.Error()
}

// QueryEngine defines the interface for the *promql.Engine, so it can be replaced, wrapped or mocked.
type QueryEngine interface {
	NewInstantQuery(ctx context.Context, q storage.Queryable, opts QueryOpts, qs string, ts time.Time) (Query, error)
	NewRangeQuery(ctx context.Context, q storage.Queryable, opts QueryOpts, qs string, start, end time.Time, interval time.Duration) (Query, error)
}

var _ QueryLogger = (*logging.JSONFileLogger)(nil)

// QueryLogger is an interface that can be used to log all the queries logged
// by the engine.
type QueryLogger interface {
	slog.Handler
	io.Closer
}

// A Query is derived from an a raw query string and can be run against an engine
// it is associated with.
type Query interface {
	// Exec processes the query. Can only be called once.
	Exec(ctx context.Context) *Result
	// Close recovers memory used by the query result.
	Close()
	// Statement returns the parsed statement of the query.
	Statement() parser.Statement
	// Stats returns statistics about the lifetime of the query.
	Stats() *stats.Statistics
	// Cancel signals that a running query execution should be aborted.
	Cancel()
	// String returns the original query string.
	String() string
}

type PrometheusQueryOpts struct {
	// Enables recording per-step statistics if the engine has it enabled as well. Disabled by default.
	enablePerStepStats bool
	// Lookback delta duration for this query.
	lookbackDelta time.Duration
}

var _ QueryOpts = &PrometheusQueryOpts{}

func NewPrometheusQueryOpts(enablePerStepStats bool, lookbackDelta time.Duration) QueryOpts {
	return &PrometheusQueryOpts{
		enablePerStepStats: enablePerStepStats,
		lookbackDelta:      lookbackDelta,
	}
}

func (p *PrometheusQueryOpts) EnablePerStepStats() bool {
	return p.enablePerStepStats
}

func (p *PrometheusQueryOpts) LookbackDelta() time.Duration {
	return p.lookbackDelta
}

type QueryOpts interface {
	// Enables recording per-step statistics if the engine has it enabled as well. Disabled by default.
	EnablePerStepStats() bool
	// Lookback delta duration for this query.
	LookbackDelta() time.Duration
}

// query implements the Query interface.
type query struct {
	// Underlying data provider.
	queryable storage.Queryable
	// The original query string.
	q string
	// Statement of the parsed query.
	stmt parser.Statement
	// Timer stats for the query execution.
	stats *stats.QueryTimers
	// Sample stats for the query execution.
	sampleStats *stats.QuerySamples
	// Result matrix for reuse.
	matrix Matrix
	// Cancellation function for the query.
	cancel func()

	// The engine against which the query is executed.
	ng *Engine
}

type QueryOrigin struct{}

// Statement implements the Query interface.
// Calling this after Exec may result in panic,
// see https://github.com/prometheus/prometheus/issues/8949.
func (q *query) Statement() parser.Statement {
	return q.stmt
}

// String implements the Query interface.
func (q *query) String() string {
	return q.q
}

// Stats implements the Query interface.
func (q *query) Stats() *stats.Statistics {
	return &stats.Statistics{
		Timers:  q.stats,
		Samples: q.sampleStats,
	}
}

// Cancel implements the Query interface.
func (q *query) Cancel() {
	if q.cancel != nil {
		q.cancel()
	}
}

// Close implements the Query interface.
func (q *query) Close() {
	for _, s := range q.matrix {
		putFPointSlice(s.Floats)
		putHPointSlice(s.Histograms)
	}
}

// Exec implements the Query interface.
func (q *query) Exec(ctx context.Context) *Result {
	if span := trace.SpanFromContext(ctx); span != nil {
		span.SetAttributes(attribute.String(queryTag, q.stmt.String()))
	}

	// Exec query.
	res, warnings, err := q.ng.exec(ctx, q)
	return &Result{Err: err, Value: res, Warnings: warnings}
}

// contextDone returns an error if the context was canceled or timed out.
func contextDone(ctx context.Context, env string) error {
	if err := ctx.Err(); err != nil {
		return contextErr(err, env)
	}
	return nil
}

func contextErr(err error, env string) error {
	switch {
	case errors.Is(err, context.Canceled):
		return ErrQueryCanceled(env)
	case errors.Is(err, context.DeadlineExceeded):
		return ErrQueryTimeout(env)
	default:
		return err
	}
}

// QueryTracker provides access to two features:
//
// 1) Tracking of active query. If PromQL engine crashes while executing any query, such query should be present
// in the tracker on restart, hence logged. After the logging on restart, the tracker gets emptied.
//
// 2) Enforcement of the maximum number of concurrent queries.
type QueryTracker interface {
	io.Closer

	// GetMaxConcurrent returns maximum number of concurrent queries that are allowed by this tracker.
	GetMaxConcurrent() int

	// Insert inserts query into query tracker. This call must block if maximum number of queries is already running.
	// If Insert doesn't return error then returned integer value should be used in subsequent Delete call.
	// Insert should return error if context is finished before query can proceed, and integer value returned in this case should be ignored by caller.
	Insert(ctx context.Context, query string) (int, error)

	// Delete removes query from activity tracker. InsertIndex is value returned by Insert call.
	Delete(insertIndex int)
}

// EngineOpts contains configuration options used when creating a new Engine.
type EngineOpts struct {
	Logger             *slog.Logger
	Reg                prometheus.Registerer
	MaxSamples         int
	Timeout            time.Duration
	ActiveQueryTracker QueryTracker
	// LookbackDelta determines the time since the last sample after which a time
	// series is considered stale.
	LookbackDelta time.Duration

	// NoStepSubqueryIntervalFn is the default evaluation interval of
	// a subquery in milliseconds if no step in range vector was specified `[30m:<step>]`.
	NoStepSubqueryIntervalFn func(rangeMillis int64) int64

	// EnableAtModifier if true enables @ modifier. Disabled otherwise. This
	// is supposed to be enabled for regular PromQL (as of Prometheus v2.33)
	// but the option to disable it is still provided here for those using
	// the Engine outside of Prometheus.
	EnableAtModifier bool

	// EnableNegativeOffset if true enables negative (-) offset
	// values. Disabled otherwise. This is supposed to be enabled for
	// regular PromQL (as of Prometheus v2.33) but the option to disable it
	// is still provided here for those using the Engine outside of
	// Prometheus.
	EnableNegativeOffset bool

	// EnablePerStepStats if true allows for per-step stats to be computed on request. Disabled otherwise.
	EnablePerStepStats bool

	// EnableDelayedNameRemoval delays the removal of the __name__ label to the last step of the query evaluation.
	// This is useful in certain scenarios where the __name__ label must be preserved or where applying a
	// regex-matcher to the __name__ label may otherwise lead to duplicate labelset errors.
	EnableDelayedNameRemoval bool
}

// Engine handles the lifetime of queries from beginning to end.
// It is connected to a querier.
type Engine struct {
	logger                   *slog.Logger
	metrics                  *engineMetrics
	timeout                  time.Duration
	maxSamplesPerQuery       int
	activeQueryTracker       QueryTracker
	queryLogger              QueryLogger
	queryLoggerLock          sync.RWMutex
	lookbackDelta            time.Duration
	noStepSubqueryIntervalFn func(rangeMillis int64) int64
	enableAtModifier         bool
	enableNegativeOffset     bool
	enablePerStepStats       bool
	enableDelayedNameRemoval bool
}

// NewEngine returns a new engine.
func NewEngine(opts EngineOpts) *Engine {
	if opts.Logger == nil {
		opts.Logger = promslog.NewNopLogger()
	}

	queryResultSummary := prometheus.NewSummaryVec(prometheus.SummaryOpts{
		Namespace:  namespace,
		Subsystem:  subsystem,
		Name:       "query_duration_seconds",
		Help:       "Query timings",
		Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
	},
		[]string{"slice"},
	)

	metrics := &engineMetrics{
		currentQueries: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "queries",
			Help:      "The current number of queries being executed or waiting.",
		}),
		queryLogEnabled: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "query_log_enabled",
			Help:      "State of the query log.",
		}),
		queryLogFailures: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "query_log_failures_total",
			Help:      "The number of query log failures.",
		}),
		maxConcurrentQueries: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "queries_concurrent_max",
			Help:      "The max number of concurrent queries.",
		}),
		querySamples: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "query_samples_total",
			Help:      "The total number of samples loaded by all queries.",
		}),
		queryQueueTime:   queryResultSummary.WithLabelValues("queue_time"),
		queryPrepareTime: queryResultSummary.WithLabelValues("prepare_time"),
		queryInnerEval:   queryResultSummary.WithLabelValues("inner_eval"),
		queryResultSort:  queryResultSummary.WithLabelValues("result_sort"),
	}

	if t := opts.ActiveQueryTracker; t != nil {
		metrics.maxConcurrentQueries.Set(float64(t.GetMaxConcurrent()))
	} else {
		metrics.maxConcurrentQueries.Set(-1)
	}

	if opts.LookbackDelta == 0 {
		opts.LookbackDelta = defaultLookbackDelta
		if l := opts.Logger; l != nil {
			l.Debug("Lookback delta is zero, setting to default value", "value", defaultLookbackDelta)
		}
	}

	if opts.Reg != nil {
		opts.Reg.MustRegister(
			metrics.currentQueries,
			metrics.maxConcurrentQueries,
			metrics.queryLogEnabled,
			metrics.queryLogFailures,
			metrics.querySamples,
			queryResultSummary,
		)
	}

	return &Engine{
		timeout:                  opts.Timeout,
		logger:                   opts.Logger,
		metrics:                  metrics,
		maxSamplesPerQuery:       opts.MaxSamples,
		activeQueryTracker:       opts.ActiveQueryTracker,
		lookbackDelta:            opts.LookbackDelta,
		noStepSubqueryIntervalFn: opts.NoStepSubqueryIntervalFn,
		enableAtModifier:         opts.EnableAtModifier,
		enableNegativeOffset:     opts.EnableNegativeOffset,
		enablePerStepStats:       opts.EnablePerStepStats,
		enableDelayedNameRemoval: opts.EnableDelayedNameRemoval,
	}
}

// Close closes ng.
// Callers must ensure the engine is really no longer in use before calling this to avoid
// issues failures like in https://github.com/prometheus/prometheus/issues/15232
func (ng *Engine) Close() error {
	if ng == nil {
		return nil
	}

	if ng.activeQueryTracker != nil {
		return ng.activeQueryTracker.Close()
	}
	return nil
}

// SetQueryLogger sets the query logger.
func (ng *Engine) SetQueryLogger(l QueryLogger) {
	ng.queryLoggerLock.Lock()
	defer ng.queryLoggerLock.Unlock()

	if ng.queryLogger != nil {
		// An error closing the old file descriptor should
		// not make reload fail; only log a warning.
		err := ng.queryLogger.Close()
		if err != nil {
			ng.logger.Warn("Error while closing the previous query log file", "err", err)
		}
	}

	ng.queryLogger = l

	if l != nil {
		ng.metrics.queryLogEnabled.Set(1)
	} else {
		ng.metrics.queryLogEnabled.Set(0)
	}
}

// NewInstantQuery returns an evaluation query for the given expression at the given time.
func (ng *Engine) NewInstantQuery(ctx context.Context, q storage.Queryable, opts QueryOpts, qs string, ts time.Time) (Query, error) {
	pExpr, qry := ng.newQuery(q, qs, opts, ts, ts, 0)
	finishQueue, err := ng.queueActive(ctx, qry)
	if err != nil {
		return nil, err
	}
	defer finishQueue()
	expr, err := parser.ParseExpr(qs)
	if err != nil {
		return nil, err
	}
	if err := ng.validateOpts(expr); err != nil {
		return nil, err
	}
	*pExpr = PreprocessExpr(expr, ts, ts)

	return qry, nil
}

// NewRangeQuery returns an evaluation query for the given time range and with
// the resolution set by the interval.
func (ng *Engine) NewRangeQuery(ctx context.Context, q storage.Queryable, opts QueryOpts, qs string, start, end time.Time, interval time.Duration) (Query, error) {
	pExpr, qry := ng.newQuery(q, qs, opts, start, end, interval)
	finishQueue, err := ng.queueActive(ctx, qry)
	if err != nil {
		return nil, err
	}
	defer finishQueue()
	expr, err := parser.ParseExpr(qs)
	if err != nil {
		return nil, err
	}
	if err := ng.validateOpts(expr); err != nil {
		return nil, err
	}
	if expr.Type() != parser.ValueTypeVector && expr.Type() != parser.ValueTypeScalar {
		return nil, fmt.Errorf("invalid expression type %q for range query, must be Scalar or instant Vector", parser.DocumentedType(expr.Type()))
	}
	*pExpr = PreprocessExpr(expr, start, end)

	return qry, nil
}

func (ng *Engine) newQuery(q storage.Queryable, qs string, opts QueryOpts, start, end time.Time, interval time.Duration) (*parser.Expr, *query) {
	if opts == nil {
		opts = NewPrometheusQueryOpts(false, 0)
	}

	lookbackDelta := opts.LookbackDelta()
	if lookbackDelta <= 0 {
		lookbackDelta = ng.lookbackDelta
	}

	es := &parser.EvalStmt{
		Start:         start,
		End:           end,
		Interval:      interval,
		LookbackDelta: lookbackDelta,
	}
	qry := &query{
		q:           qs,
		stmt:        es,
		ng:          ng,
		stats:       stats.NewQueryTimers(),
		sampleStats: stats.NewQuerySamples(ng.enablePerStepStats && opts.EnablePerStepStats()),
		queryable:   q,
	}
	return &es.Expr, qry
}

var (
	ErrValidationAtModifierDisabled     = errors.New("@ modifier is disabled")
	ErrValidationNegativeOffsetDisabled = errors.New("negative offset is disabled")
)

func (ng *Engine) validateOpts(expr parser.Expr) error {
	if ng.enableAtModifier && ng.enableNegativeOffset {
		return nil
	}

	var atModifierUsed, negativeOffsetUsed bool

	var validationErr error
	parser.Inspect(expr, func(node parser.Node, _ []parser.Node) error {
		switch n := node.(type) {
		case *parser.VectorSelector:
			if n.Timestamp != nil || n.StartOrEnd == parser.START || n.StartOrEnd == parser.END {
				atModifierUsed = true
			}
			if n.OriginalOffset < 0 {
				negativeOffsetUsed = true
			}

		case *parser.MatrixSelector:
			vs := n.VectorSelector.(*parser.VectorSelector)
			if vs.Timestamp != nil || vs.StartOrEnd == parser.START || vs.StartOrEnd == parser.END {
				atModifierUsed = true
			}
			if vs.OriginalOffset < 0 {
				negativeOffsetUsed = true
			}

		case *parser.SubqueryExpr:
			if n.Timestamp != nil || n.StartOrEnd == parser.START || n.StartOrEnd == parser.END {
				atModifierUsed = true
			}
			if n.OriginalOffset < 0 {
				negativeOffsetUsed = true
			}
		}

		if atModifierUsed && !ng.enableAtModifier {
			validationErr = ErrValidationAtModifierDisabled
			return validationErr
		}
		if negativeOffsetUsed && !ng.enableNegativeOffset {
			validationErr = ErrValidationNegativeOffsetDisabled
			return validationErr
		}

		return nil
	})

	return validationErr
}

// NewTestQuery injects special behaviour into Query for testing.
func (ng *Engine) NewTestQuery(f func(context.Context) error) Query {
	qry := &query{
		q:           "test statement",
		stmt:        parser.TestStmt(f),
		ng:          ng,
		stats:       stats.NewQueryTimers(),
		sampleStats: stats.NewQuerySamples(ng.enablePerStepStats),
	}
	return qry
}

// exec executes the query.
//
// At this point per query only one EvalStmt is evaluated. Alert and record
// statements are not handled by the Engine.
func (ng *Engine) exec(ctx context.Context, q *query) (v parser.Value, ws annotations.Annotations, err error) {
	ng.metrics.currentQueries.Inc()
	defer func() {
		ng.metrics.currentQueries.Dec()
		ng.metrics.querySamples.Add(float64(q.sampleStats.TotalSamples))
	}()

	ctx, cancel := context.WithTimeout(ctx, ng.timeout)
	q.cancel = cancel

	defer func() {
		ng.queryLoggerLock.RLock()
		if l := ng.queryLogger; l != nil {
			logger := slog.New(l)
			f := make([]slog.Attr, 0, 16) // Probably enough up front to not need to reallocate on append.

			params := make(map[string]interface{}, 4)
			params["query"] = q.q
			if eq, ok := q.Statement().(*parser.EvalStmt); ok {
				params["start"] = formatDate(eq.Start)
				params["end"] = formatDate(eq.End)
				// The step provided by the user is in seconds.
				params["step"] = int64(eq.Interval / (time.Second / time.Nanosecond))
			}
			f = append(f, slog.Any("params", params))
			if err != nil {
				f = append(f, slog.Any("error", err))
			}
			f = append(f, slog.Any("stats", stats.NewQueryStats(q.Stats())))
			if span := trace.SpanFromContext(ctx); span != nil {
				f = append(f, slog.Any("spanID", span.SpanContext().SpanID()))
			}
			if origin := ctx.Value(QueryOrigin{}); origin != nil {
				for k, v := range origin.(map[string]interface{}) {
					f = append(f, slog.Any(k, v))
				}
			}
			logger.LogAttrs(context.Background(), slog.LevelInfo, "promql query logged", f...)
			// TODO: @tjhop -- do we still need this metric/error log if logger doesn't return errors?
			// ng.metrics.queryLogFailures.Inc()
			// ng.logger.Error("can't log query", "err", err)
		}
		ng.queryLoggerLock.RUnlock()
	}()

	execSpanTimer, ctx := q.stats.GetSpanTimer(ctx, stats.ExecTotalTime)
	defer execSpanTimer.Finish()

	finishQueue, err := ng.queueActive(ctx, q)
	if err != nil {
		return nil, nil, err
	}
	defer finishQueue()

	// Cancel when execution is done or an error was raised.
	defer q.cancel()

	evalSpanTimer, ctx := q.stats.GetSpanTimer(ctx, stats.EvalTotalTime)
	defer evalSpanTimer.Finish()

	// The base context might already be canceled on the first iteration (e.g. during shutdown).
	if err := contextDone(ctx, env); err != nil {
		return nil, nil, err
	}

	switch s := q.Statement().(type) {
	case *parser.EvalStmt:
		return ng.execEvalStmt(ctx, q, s)
	case parser.TestStmt:
		return nil, nil, s(ctx)
	}

	panic(fmt.Errorf("promql.Engine.exec: unhandled statement of type %T", q.Statement()))
}

// Log query in active log. The active log guarantees that we don't run over
// MaxConcurrent queries.
func (ng *Engine) queueActive(ctx context.Context, q *query) (func(), error) {
	if ng.activeQueryTracker == nil {
		return func() {}, nil
	}
	queueSpanTimer, _ := q.stats.GetSpanTimer(ctx, stats.ExecQueueTime, ng.metrics.queryQueueTime)
	queryIndex, err := ng.activeQueryTracker.Insert(ctx, q.q)
	queueSpanTimer.Finish()
	return func() { ng.activeQueryTracker.Delete(queryIndex) }, err
}

func timeMilliseconds(t time.Time) int64 {
	return t.UnixNano() / int64(time.Millisecond/time.Nanosecond)
}

func durationMilliseconds(d time.Duration) int64 {
	return int64(d / (time.Millisecond / time.Nanosecond))
}

// execEvalStmt evaluates the expression of an evaluation statement for the given time range.
func (ng *Engine) execEvalStmt(ctx context.Context, query *query, s *parser.EvalStmt) (parser.Value, annotations.Annotations, error) {
	prepareSpanTimer, ctxPrepare := query.stats.GetSpanTimer(ctx, stats.QueryPreparationTime, ng.metrics.queryPrepareTime)
	mint, maxt := FindMinMaxTime(s)
	querier, err := query.queryable.Querier(mint, maxt)
	if err != nil {
		prepareSpanTimer.Finish()
		return nil, nil, err
	}
	defer querier.Close()

	ng.populateSeries(ctxPrepare, querier, s)
	prepareSpanTimer.Finish()

	// Modify the offset of vector and matrix selectors for the @ modifier
	// w.r.t. the start time since only 1 evaluation will be done on them.
	setOffsetForAtModifier(timeMilliseconds(s.Start), s.Expr)
	evalSpanTimer, ctxInnerEval := query.stats.GetSpanTimer(ctx, stats.InnerEvalTime, ng.metrics.queryInnerEval)
	// Instant evaluation. This is executed as a range evaluation with one step.
	if s.Start == s.End && s.Interval == 0 {
		start := timeMilliseconds(s.Start)
		evaluator := &evaluator{
			startTimestamp:           start,
			endTimestamp:             start,
			interval:                 1,
			maxSamples:               ng.maxSamplesPerQuery,
			logger:                   ng.logger,
			lookbackDelta:            s.LookbackDelta,
			samplesStats:             query.sampleStats,
			noStepSubqueryIntervalFn: ng.noStepSubqueryIntervalFn,
			enableDelayedNameRemoval: ng.enableDelayedNameRemoval,
			querier:                  querier,
		}
		query.sampleStats.InitStepTracking(start, start, 1)

		val, warnings, err := evaluator.Eval(ctxInnerEval, s.Expr)

		evalSpanTimer.Finish()

		if err != nil {
			return nil, warnings, err
		}

		var mat Matrix

		switch result := val.(type) {
		case Matrix:
			mat = result
		case String:
			return result, warnings, nil
		default:
			panic(fmt.Errorf("promql.Engine.exec: invalid expression type %q", val.Type()))
		}

		query.matrix = mat
		switch s.Expr.Type() {
		case parser.ValueTypeVector:
			// Convert matrix with one value per series into vector.
			vector := make(Vector, len(mat))
			for i, s := range mat {
				// Point might have a different timestamp, force it to the evaluation
				// timestamp as that is when we ran the evaluation.
				if len(s.Histograms) > 0 {
					vector[i] = Sample{Metric: s.Metric, H: s.Histograms[0].H, T: start, DropName: s.DropName}
				} else {
					vector[i] = Sample{Metric: s.Metric, F: s.Floats[0].F, T: start, DropName: s.DropName}
				}
			}
			return vector, warnings, nil
		case parser.ValueTypeScalar:
			return Scalar{V: mat[0].Floats[0].F, T: start}, warnings, nil
		case parser.ValueTypeMatrix:
			ng.sortMatrixResult(ctx, query, mat)
			return mat, warnings, nil
		default:
			panic(fmt.Errorf("promql.Engine.exec: unexpected expression type %q", s.Expr.Type()))
		}
	}

	// Range evaluation.
	evaluator := &evaluator{
		startTimestamp:           timeMilliseconds(s.Start),
		endTimestamp:             timeMilliseconds(s.End),
		interval:                 durationMilliseconds(s.Interval),
		maxSamples:               ng.maxSamplesPerQuery,
		logger:                   ng.logger,
		lookbackDelta:            s.LookbackDelta,
		samplesStats:             query.sampleStats,
		noStepSubqueryIntervalFn: ng.noStepSubqueryIntervalFn,
		enableDelayedNameRemoval: ng.enableDelayedNameRemoval,
		querier:                  querier,
	}
	query.sampleStats.InitStepTracking(evaluator.startTimestamp, evaluator.endTimestamp, evaluator.interval)
	val, warnings, err := evaluator.Eval(ctxInnerEval, s.Expr)

	evalSpanTimer.Finish()

	if err != nil {
		return nil, warnings, err
	}

	mat, ok := val.(Matrix)
	if !ok {
		panic(fmt.Errorf("promql.Engine.exec: invalid expression type %q", val.Type()))
	}
	query.matrix = mat

	if err := contextDone(ctx, "expression evaluation"); err != nil {
		return nil, warnings, err
	}

	// TODO(fabxc): where to ensure metric labels are a copy from the storage internals.
	ng.sortMatrixResult(ctx, query, mat)

	return mat, warnings, nil
}

func (ng *Engine) sortMatrixResult(ctx context.Context, query *query, mat Matrix) {
	sortSpanTimer, _ := query.stats.GetSpanTimer(ctx, stats.ResultSortTime, ng.metrics.queryResultSort)
	sort.Sort(mat)
	sortSpanTimer.Finish()
}

// subqueryTimes returns the sum of offsets and ranges of all subqueries in the path.
// If the @ modifier is used, then the offset and range is w.r.t. that timestamp
// (i.e. the sum is reset when we have @ modifier).
// The returned *int64 is the closest timestamp that was seen. nil for no @ modifier.
func subqueryTimes(path []parser.Node) (time.Duration, time.Duration, *int64) {
	var (
		subqOffset, subqRange time.Duration
		ts                    int64 = math.MaxInt64
	)
	for _, node := range path {
		if n, ok := node.(*parser.SubqueryExpr); ok {
			subqOffset += n.OriginalOffset
			subqRange += n.Range
			if n.Timestamp != nil {
				// The @ modifier on subquery invalidates all the offset and
				// range till now. Hence resetting it here.
				subqOffset = n.OriginalOffset
				subqRange = n.Range
				ts = *n.Timestamp
			}
		}
	}
	var tsp *int64
	if ts != math.MaxInt64 {
		tsp = &ts
	}
	return subqOffset, subqRange, tsp
}

// FindMinMaxTime returns the time in milliseconds of the earliest and latest point in time the statement will try to process.
// This takes into account offsets, @ modifiers, and range selectors.
// If the statement does not select series, then FindMinMaxTime returns (0, 0).
func FindMinMaxTime(s *parser.EvalStmt) (int64, int64) {
	var minTimestamp, maxTimestamp int64 = math.MaxInt64, math.MinInt64
	// Whenever a MatrixSelector is evaluated, evalRange is set to the corresponding range.
	// The evaluation of the VectorSelector inside then evaluates the given range and unsets
	// the variable.
	var evalRange time.Duration
	parser.Inspect(s.Expr, func(node parser.Node, path []parser.Node) error {
		switch n := node.(type) {
		case *parser.VectorSelector:
			start, end := getTimeRangesForSelector(s, n, path, evalRange)
			if start < minTimestamp {
				minTimestamp = start
			}
			if end > maxTimestamp {
				maxTimestamp = end
			}
			evalRange = 0
		case *parser.MatrixSelector:
			evalRange = n.Range
		}
		return nil
	})

	if maxTimestamp == math.MinInt64 {
		// This happens when there was no selector. Hence no time range to select.
		minTimestamp = 0
		maxTimestamp = 0
	}

	return minTimestamp, maxTimestamp
}

func getTimeRangesForSelector(s *parser.EvalStmt, n *parser.VectorSelector, path []parser.Node, evalRange time.Duration) (int64, int64) {
	start, end := timestamp.FromTime(s.Start), timestamp.FromTime(s.End)
	subqOffset, subqRange, subqTs := subqueryTimes(path)

	if subqTs != nil {
		// The timestamp on the subquery overrides the eval statement time ranges.
		start = *subqTs
		end = *subqTs
	}

	if n.Timestamp != nil {
		// The timestamp on the selector overrides everything.
		start = *n.Timestamp
		end = *n.Timestamp
	} else {
		offsetMilliseconds := durationMilliseconds(subqOffset)
		start = start - offsetMilliseconds - durationMilliseconds(subqRange)
		end -= offsetMilliseconds
	}

	if evalRange == 0 {
		// Reduce the start by one fewer ms than the lookback delta
		// because wo want to exclude samples that are precisely the
		// lookback delta before the eval time.
		start -= durationMilliseconds(s.LookbackDelta) - 1
	} else {
		// For all matrix queries we want to ensure that we have
		// (end-start) + range selected this way we have `range` data
		// before the start time. We subtract one from the range to
		// exclude samples positioned directly at the lower boundary of
		// the range.
		start -= durationMilliseconds(evalRange) - 1
	}

	offsetMilliseconds := durationMilliseconds(n.OriginalOffset)
	start -= offsetMilliseconds
	end -= offsetMilliseconds

	return start, end
}

func (ng *Engine) getLastSubqueryInterval(path []parser.Node) time.Duration {
	var interval time.Duration
	for _, node := range path {
		if n, ok := node.(*parser.SubqueryExpr); ok {
			interval = n.Step
			if n.Step == 0 {
				interval = time.Duration(ng.noStepSubqueryIntervalFn(durationMilliseconds(n.Range))) * time.Millisecond
			}
		}
	}
	return interval
}

func (ng *Engine) populateSeries(ctx context.Context, querier storage.Querier, s *parser.EvalStmt) {
	// Whenever a MatrixSelector is evaluated, evalRange is set to the corresponding range.
	// The evaluation of the VectorSelector inside then evaluates the given range and unsets
	// the variable.
	var evalRange time.Duration

	parser.Inspect(s.Expr, func(node parser.Node, path []parser.Node) error {
		switch n := node.(type) {
		case *parser.VectorSelector:
			start, end := getTimeRangesForSelector(s, n, path, evalRange)
			interval := ng.getLastSubqueryInterval(path)
			if interval == 0 {
				interval = s.Interval
			}
			hints := &storage.SelectHints{
				Start: start,
				End:   end,
				Step:  durationMilliseconds(interval),
				Range: durationMilliseconds(evalRange),
				Func:  extractFuncFromPath(path),
			}
			evalRange = 0
			hints.By, hints.Grouping = extractGroupsFromPath(path)
			n.UnexpandedSeriesSet = querier.Select(ctx, false, hints, n.LabelMatchers...)

		case *parser.MatrixSelector:
			evalRange = n.Range
		}
		return nil
	})
}

// extractFuncFromPath walks up the path and searches for the first instance of
// a function or aggregation.
func extractFuncFromPath(p []parser.Node) string {
	if len(p) == 0 {
		return ""
	}
	switch n := p[len(p)-1].(type) {
	case *parser.AggregateExpr:
		return n.Op.String()
	case *parser.Call:
		return n.Func.Name
	case *parser.BinaryExpr:
		// If we hit a binary expression we terminate since we only care about functions
		// or aggregations over a single metric.
		return ""
	}
	return extractFuncFromPath(p[:len(p)-1])
}

// extractGroupsFromPath parses vector outer function and extracts grouping information if by or without was used.
func extractGroupsFromPath(p []parser.Node) (bool, []string) {
	if len(p) == 0 {
		return false, nil
	}
	if n, ok := p[len(p)-1].(*parser.AggregateExpr); ok {
		return !n.Without, n.Grouping
	}
	return false, nil
}

// checkAndExpandSeriesSet expands expr's UnexpandedSeriesSet into expr's Series.
// If the Series field is already non-nil, it's a no-op.
func checkAndExpandSeriesSet(ctx context.Context, expr parser.Expr) (annotations.Annotations, error) {
	switch e := expr.(type) {
	case *parser.MatrixSelector:
		return checkAndExpandSeriesSet(ctx, e.VectorSelector)
	case *parser.VectorSelector:
		if e.Series != nil {
			return nil, nil
		}
		span := trace.SpanFromContext(ctx)
		span.AddEvent("expand start", trace.WithAttributes(attribute.String("selector", e.String())))
		series, ws, err := expandSeriesSet(ctx, e.UnexpandedSeriesSet)
		if e.SkipHistogramBuckets {
			for i := range series {
				series[i] = newHistogramStatsSeries(series[i])
			}
		}
		e.Series = series
		span.AddEvent("expand end", trace.WithAttributes(attribute.Int("num_series", len(series))))
		return ws, err
	}
	return nil, nil
}

func expandSeriesSet(ctx context.Context, it storage.SeriesSet) (res []storage.Series, ws annotations.Annotations, err error) {
	for it.Next() {
		select {
		case <-ctx.Done():
			return nil, nil, ctx.Err()
		default:
		}
		res = append(res, it.At())
	}
	return res, it.Warnings(), it.Err()
}

type errWithWarnings struct {
	err      error
	warnings annotations.Annotations
}

func (e errWithWarnings) Error() string { return e.err.Error() }

// An evaluator evaluates the given expressions over the given fixed
// timestamps. It is attached to an engine through which it connects to a
// querier and reports errors. On timeout or cancellation of its context it
// terminates.
type evaluator struct {
	startTimestamp int64 // Start time in milliseconds.
	endTimestamp   int64 // End time in milliseconds.
	interval       int64 // Interval in milliseconds.

	maxSamples               int
	currentSamples           int
	logger                   *slog.Logger
	lookbackDelta            time.Duration
	samplesStats             *stats.QuerySamples
	noStepSubqueryIntervalFn func(rangeMillis int64) int64
	enableDelayedNameRemoval bool
	querier                  storage.Querier
}

// errorf causes a panic with the input formatted into an error.
func (ev *evaluator) errorf(format string, args ...interface{}) {
	ev.error(fmt.Errorf(format, args...))
}

// error causes a panic with the given error.
func (ev *evaluator) error(err error) {
	panic(err)
}

// recover is the handler that turns panics into returns from the top level of evaluation.
func (ev *evaluator) recover(expr parser.Expr, ws *annotations.Annotations, errp *error) {
	e := recover()
	if e == nil {
		return
	}

	switch err := e.(type) {
	case runtime.Error:
		// Print the stack trace but do not inhibit the running application.
		buf := make([]byte, 64<<10)
		buf = buf[:runtime.Stack(buf, false)]

		ev.logger.Error("runtime panic during query evaluation", "expr", expr.String(), "err", e, "stacktrace", string(buf))
		*errp = fmt.Errorf("unexpected error: %w", err)
	case errWithWarnings:
		*errp = err.err
		ws.Merge(err.warnings)
	case error:
		*errp = err
	default:
		*errp = fmt.Errorf("%v", err)
	}
}

func (ev *evaluator) Eval(ctx context.Context, expr parser.Expr) (v parser.Value, ws annotations.Annotations, err error) {
	defer ev.recover(expr, &ws, &err)

	v, ws = ev.eval(ctx, expr)
	if ev.enableDelayedNameRemoval {
		ev.cleanupMetricLabels(v)
	}
	return v, ws, nil
}

// EvalSeriesHelper stores extra information about a series.
type EvalSeriesHelper struct {
	// Used to map left-hand to right-hand in binary operations.
	signature string
}

// EvalNodeHelper stores extra information and caches for evaluating a single node across steps.
type EvalNodeHelper struct {
	// Evaluation timestamp.
	Ts int64
	// Vector that can be used for output.
	Out Vector

	// Caches.
	// funcHistogramQuantile for classic histograms.
	signatureToMetricWithBuckets map[string]*metricWithBuckets

	lb           *labels.Builder
	lblBuf       []byte
	lblResultBuf []byte

	// For binary vector matching.
	rightSigs    map[string]Sample
	matchedSigs  map[string]map[uint64]struct{}
	resultMetric map[string]labels.Labels

	// Additional options for the evaluation.
	enableDelayedNameRemoval bool
}

func (enh *EvalNodeHelper) resetBuilder(lbls labels.Labels) {
	if enh.lb == nil {
		enh.lb = labels.NewBuilder(lbls)
	} else {
		enh.lb.Reset(lbls)
	}
}

// rangeEval evaluates the given expressions, and then for each step calls
// the given funcCall with the values computed for each expression at that
// step. The return value is the combination into time series of all the
// function call results.
// The prepSeries function (if provided) can be used to prepare the helper
// for each series, then passed to each call funcCall.
func (ev *evaluator) rangeEval(ctx context.Context, prepSeries func(labels.Labels, *EvalSeriesHelper), funcCall func([]parser.Value, [][]EvalSeriesHelper, *EvalNodeHelper) (Vector, annotations.Annotations), exprs ...parser.Expr) (Matrix, annotations.Annotations) {
	numSteps := int((ev.endTimestamp-ev.startTimestamp)/ev.interval) + 1
	matrixes := make([]Matrix, len(exprs))
	origMatrixes := make([]Matrix, len(exprs))
	originalNumSamples := ev.currentSamples

	var warnings annotations.Annotations
	for i, e := range exprs {
		// Functions will take string arguments from the expressions, not the values.
		if e != nil && e.Type() != parser.ValueTypeString {
			// ev.currentSamples will be updated to the correct value within the ev.eval call.
			val, ws := ev.eval(ctx, e)
			warnings.Merge(ws)
			matrixes[i] = val.(Matrix)

			// Keep a copy of the original point slices so that they
			// can be returned to the pool.
			origMatrixes[i] = make(Matrix, len(matrixes[i]))
			copy(origMatrixes[i], matrixes[i])
		}
	}

	vectors := make([]Vector, len(exprs))    // Input vectors for the function.
	args := make([]parser.Value, len(exprs)) // Argument to function.
	// Create an output vector that is as big as the input matrix with
	// the most time series.
	biggestLen := 1
	for i := range exprs {
		vectors[i] = make(Vector, 0, len(matrixes[i]))
		if len(matrixes[i]) > biggestLen {
			biggestLen = len(matrixes[i])
		}
	}
	enh := &EvalNodeHelper{Out: make(Vector, 0, biggestLen), enableDelayedNameRemoval: ev.enableDelayedNameRemoval}
	type seriesAndTimestamp struct {
		Series
		ts int64
	}
	seriess := make(map[uint64]seriesAndTimestamp, biggestLen) // Output series by series hash.
	tempNumSamples := ev.currentSamples

	var (
		seriesHelpers [][]EvalSeriesHelper
		bufHelpers    [][]EvalSeriesHelper // Buffer updated on each step
	)

	// If the series preparation function is provided, we should run it for
	// every single series in the matrix.
	if prepSeries != nil {
		seriesHelpers = make([][]EvalSeriesHelper, len(exprs))
		bufHelpers = make([][]EvalSeriesHelper, len(exprs))

		for i := range exprs {
			seriesHelpers[i] = make([]EvalSeriesHelper, len(matrixes[i]))
			bufHelpers[i] = make([]EvalSeriesHelper, len(matrixes[i]))

			for si, series := range matrixes[i] {
				prepSeries(series.Metric, &seriesHelpers[i][si])
			}
		}
	}

	for ts := ev.startTimestamp; ts <= ev.endTimestamp; ts += ev.interval {
		if err := contextDone(ctx, "expression evaluation"); err != nil {
			ev.error(err)
		}
		// Reset number of samples in memory after each timestamp.
		ev.currentSamples = tempNumSamples
		// Gather input vectors for this timestamp.
		for i := range exprs {
			var bh []EvalSeriesHelper
			var sh []EvalSeriesHelper
			if prepSeries != nil {
				bh = bufHelpers[i][:0]
				sh = seriesHelpers[i]
			}
			vectors[i], bh = ev.gatherVector(ts, matrixes[i], vectors[i], bh, sh)
			args[i] = vectors[i]
			if prepSeries != nil {
				bufHelpers[i] = bh
			}
		}

		// Make the function call.
		enh.Ts = ts
		result, ws := funcCall(args, bufHelpers, enh)
		enh.Out = result[:0] // Reuse result vector.
		warnings.Merge(ws)

		vecNumSamples := result.TotalSamples()
		ev.currentSamples += vecNumSamples
		// When we reset currentSamples to tempNumSamples during the next iteration of the loop it also
		// needs to include the samples from the result here, as they're still in memory.
		tempNumSamples += vecNumSamples
		ev.samplesStats.UpdatePeak(ev.currentSamples)

		if ev.currentSamples > ev.maxSamples {
			ev.error(ErrTooManySamples(env))
		}

		// If this could be an instant query, shortcut so as not to change sort order.
		if ev.endTimestamp == ev.startTimestamp {
			if !ev.enableDelayedNameRemoval && result.ContainsSameLabelset() {
				ev.errorf("vector cannot contain metrics with the same labelset")
			}
			mat := make(Matrix, len(result))
			for i, s := range result {
				if s.H == nil {
					mat[i] = Series{Metric: s.Metric, Floats: []FPoint{{T: ts, F: s.F}}, DropName: s.DropName}
				} else {
					mat[i] = Series{Metric: s.Metric, Histograms: []HPoint{{T: ts, H: s.H}}, DropName: s.DropName}
				}
			}
			ev.currentSamples = originalNumSamples + mat.TotalSamples()
			ev.samplesStats.UpdatePeak(ev.currentSamples)
			return mat, warnings
		}

		// Add samples in output vector to output series.
		for _, sample := range result {
			h := sample.Metric.Hash()
			ss, ok := seriess[h]
			if ok {
				if ss.ts == ts { // If we've seen this output series before at this timestamp, it's a duplicate.
					ev.errorf("vector cannot contain metrics with the same labelset")
				}
				ss.ts = ts
			} else {
				ss = seriesAndTimestamp{Series{Metric: sample.Metric, DropName: sample.DropName}, ts}
			}
			addToSeries(&ss.Series, enh.Ts, sample.F, sample.H, numSteps)
			seriess[h] = ss
		}
	}

	// Reuse the original point slices.
	for _, m := range origMatrixes {
		for _, s := range m {
			putFPointSlice(s.Floats)
			putHPointSlice(s.Histograms)
		}
	}
	// Assemble the output matrix. By the time we get here we know we don't have too many samples.
	mat := make(Matrix, 0, len(seriess))
	for _, ss := range seriess {
		mat = append(mat, ss.Series)
	}
	ev.currentSamples = originalNumSamples + mat.TotalSamples()
	ev.samplesStats.UpdatePeak(ev.currentSamples)
	return mat, warnings
}

func (ev *evaluator) rangeEvalAgg(ctx context.Context, aggExpr *parser.AggregateExpr, sortedGrouping []string, inputMatrix Matrix, param float64) (Matrix, annotations.Annotations) {
	// Keep a copy of the original point slice so that it can be returned to the pool.
	origMatrix := slices.Clone(inputMatrix)
	defer func() {
		for _, s := range origMatrix {
			putFPointSlice(s.Floats)
			putHPointSlice(s.Histograms)
		}
	}()

	var warnings annotations.Annotations

	enh := &EvalNodeHelper{enableDelayedNameRemoval: ev.enableDelayedNameRemoval}
	tempNumSamples := ev.currentSamples

	// Create a mapping from input series to output groups.
	buf := make([]byte, 0, 1024)
	groupToResultIndex := make(map[uint64]int)
	seriesToResult := make([]int, len(inputMatrix))
	var result Matrix

	groupCount := 0
	for si, series := range inputMatrix {
		var groupingKey uint64
		groupingKey, buf = generateGroupingKey(series.Metric, sortedGrouping, aggExpr.Without, buf)
		index, ok := groupToResultIndex[groupingKey]
		// Add a new group if it doesn't exist.
		if !ok {
			if aggExpr.Op != parser.TOPK && aggExpr.Op != parser.BOTTOMK && aggExpr.Op != parser.LIMITK && aggExpr.Op != parser.LIMIT_RATIO {
				m := generateGroupingLabels(enh, series.Metric, aggExpr.Without, sortedGrouping)
				result = append(result, Series{Metric: m})
			}
			index = groupCount
			groupToResultIndex[groupingKey] = index
			groupCount++
		}
		seriesToResult[si] = index
	}
	groups := make([]groupedAggregation, groupCount)

	var k int64
	var ratio float64
	var seriess map[uint64]Series
	switch aggExpr.Op {
	case parser.TOPK, parser.BOTTOMK, parser.LIMITK:
		if !convertibleToInt64(param) {
			ev.errorf("Scalar value %v overflows int64", param)
		}
		k = int64(param)
		if k > int64(len(inputMatrix)) {
			k = int64(len(inputMatrix))
		}
		if k < 1 {
			return nil, warnings
		}
		seriess = make(map[uint64]Series, len(inputMatrix)) // Output series by series hash.
	case parser.LIMIT_RATIO:
		if math.IsNaN(param) {
			ev.errorf("Ratio value %v is NaN", param)
		}
		switch {
		case param == 0:
			return nil, warnings
		case param < -1.0:
			ratio = -1.0
			warnings.Add(annotations.NewInvalidRatioWarning(param, ratio, aggExpr.Param.PositionRange()))
		case param > 1.0:
			ratio = 1.0
			warnings.Add(annotations.NewInvalidRatioWarning(param, ratio, aggExpr.Param.PositionRange()))
		default:
			ratio = param
		}
		seriess = make(map[uint64]Series, len(inputMatrix)) // Output series by series hash.
	case parser.QUANTILE:
		if math.IsNaN(param) || param < 0 || param > 1 {
			warnings.Add(annotations.NewInvalidQuantileWarning(param, aggExpr.Param.PositionRange()))
		}
	}

	for ts := ev.startTimestamp; ts <= ev.endTimestamp; ts += ev.interval {
		if err := contextDone(ctx, "expression evaluation"); err != nil {
			ev.error(err)
		}
		// Reset number of samples in memory after each timestamp.
		ev.currentSamples = tempNumSamples

		// Make the function call.
		enh.Ts = ts
		var ws annotations.Annotations
		switch aggExpr.Op {
		case parser.TOPK, parser.BOTTOMK, parser.LIMITK, parser.LIMIT_RATIO:
			result, ws = ev.aggregationK(aggExpr, k, ratio, inputMatrix, seriesToResult, groups, enh, seriess)
			// If this could be an instant query, shortcut so as not to change sort order.
			if ev.endTimestamp == ev.startTimestamp {
				warnings.Merge(ws)
				return result, warnings
			}
		default:
			ws = ev.aggregation(aggExpr, param, inputMatrix, result, seriesToResult, groups, enh)
		}

		warnings.Merge(ws)

		if ev.currentSamples > ev.maxSamples {
			ev.error(ErrTooManySamples(env))
		}
	}

	// Assemble the output matrix. By the time we get here we know we don't have too many samples.
	switch aggExpr.Op {
	case parser.TOPK, parser.BOTTOMK, parser.LIMITK, parser.LIMIT_RATIO:
		result = make(Matrix, 0, len(seriess))
		for _, ss := range seriess {
			result = append(result, ss)
		}
	default:
		// Remove empty result rows.
		dst := 0
		for _, series := range result {
			if len(series.Floats) > 0 || len(series.Histograms) > 0 {
				result[dst] = series
				dst++
			}
		}
		result = result[:dst]
	}
	return result, warnings
}

// evalSeries generates a Matrix between ev.startTimestamp and ev.endTimestamp (inclusive), each point spaced ev.interval apart, from series given offset.
// For every storage.Series iterator in series, the method iterates in ev.interval sized steps from ev.startTimestamp until and including ev.endTimestamp,
// collecting every corresponding sample (obtained via ev.vectorSelectorSingle) into a Series.
// All of the generated Series are collected into a Matrix, that gets returned.
func (ev *evaluator) evalSeries(ctx context.Context, series []storage.Series, offset time.Duration, recordOrigT bool) Matrix {
	numSteps := int((ev.endTimestamp-ev.startTimestamp)/ev.interval) + 1

	mat := make(Matrix, 0, len(series))
	var prevSS *Series
	it := storage.NewMemoizedEmptyIterator(durationMilliseconds(ev.lookbackDelta))
	var chkIter chunkenc.Iterator
	for _, s := range series {
		if err := contextDone(ctx, "expression evaluation"); err != nil {
			ev.error(err)
		}

		chkIter = s.Iterator(chkIter)
		it.Reset(chkIter)
		ss := Series{
			Metric: s.Labels(),
		}

		for ts, step := ev.startTimestamp, -1; ts <= ev.endTimestamp; ts += ev.interval {
			step++
			origT, f, h, ok := ev.vectorSelectorSingle(it, offset, ts)
			if !ok {
				continue
			}

			if h == nil {
				ev.currentSamples++
				ev.samplesStats.IncrementSamplesAtStep(step, 1)
				if ev.currentSamples > ev.maxSamples {
					ev.error(ErrTooManySamples(env))
				}
				if ss.Floats == nil {
					ss.Floats = reuseOrGetFPointSlices(prevSS, numSteps)
				}
				if recordOrigT {
					// This is an info metric, where we want to track the original sample timestamp.
					// Info metric values should be 1 by convention, therefore we can re-use this
					// space in the sample.
					f = float64(origT)
				}
				ss.Floats = append(ss.Floats, FPoint{F: f, T: ts})
			} else {
				if recordOrigT {
					ev.error(fmt.Errorf("this should be an info metric, with float samples: %s", ss.Metric))
				}

				point := HPoint{H: h, T: ts}
				histSize := point.size()
				ev.currentSamples += histSize
				ev.samplesStats.IncrementSamplesAtStep(step, int64(histSize))
				if ev.currentSamples > ev.maxSamples {
					ev.error(ErrTooManySamples(env))
				}
				if ss.Histograms == nil {
					ss.Histograms = reuseOrGetHPointSlices(prevSS, numSteps)
				}
				ss.Histograms = append(ss.Histograms, point)
			}
		}

		if len(ss.Floats)+len(ss.Histograms) > 0 {
			mat = append(mat, ss)
			prevSS = &mat[len(mat)-1]
		}
	}
	ev.samplesStats.UpdatePeak(ev.currentSamples)
	return mat
}

// evalSubquery evaluates given SubqueryExpr and returns an equivalent
// evaluated MatrixSelector in its place. Note that the Name and LabelMatchers are not set.
func (ev *evaluator) evalSubquery(ctx context.Context, subq *parser.SubqueryExpr) (*parser.MatrixSelector, int, annotations.Annotations) {
	samplesStats := ev.samplesStats
	// Avoid double counting samples when running a subquery, those samples will be counted in later stage.
	ev.samplesStats = ev.samplesStats.NewChild()
	val, ws := ev.eval(ctx, subq)
	// But do incorporate the peak from the subquery.
	samplesStats.UpdatePeakFromSubquery(ev.samplesStats)
	ev.samplesStats = samplesStats
	mat := val.(Matrix)
	vs := &parser.VectorSelector{
		OriginalOffset: subq.OriginalOffset,
		Offset:         subq.Offset,
		Series:         make([]storage.Series, 0, len(mat)),
		Timestamp:      subq.Timestamp,
	}
	if subq.Timestamp != nil {
		// The offset of subquery is not modified in case of @ modifier.
		// Hence we take care of that here for the result.
		vs.Offset = subq.OriginalOffset + time.Duration(ev.startTimestamp-*subq.Timestamp)*time.Millisecond
	}
	ms := &parser.MatrixSelector{
		Range:          subq.Range,
		VectorSelector: vs,
	}
	for _, s := range mat {
		// Set any "NotCounterReset" and "CounterReset" hints in native
		// histograms to "UnknownCounterReset" because we might
		// otherwise miss a counter reset happening in samples not
		// returned by the subquery, or we might over-detect counter
		// resets if the sample with a counter reset is returned
		// multiple times by a high-res subquery. This intentionally
		// does not attempt to be clever (like detecting if we are
		// really missing underlying samples or returning underlying
		// samples multiple times) because subqueries on counters are
		// inherently problematic WRT counter reset handling, so we
		// cannot really solve the problem for good. We only want to
		// avoid problems that happen due to the explicitly set counter
		// reset hints and go back to the behavior we already know from
		// float samples.
		for i, hp := range s.Histograms {
			switch hp.H.CounterResetHint {
			case histogram.NotCounterReset, histogram.CounterReset:
				h := *hp.H // Shallow copy is sufficient, we only change CounterResetHint.
				h.CounterResetHint = histogram.UnknownCounterReset
				s.Histograms[i].H = &h
			}
		}
		vs.Series = append(vs.Series, NewStorageSeries(s))
	}
	return ms, mat.TotalSamples(), ws
}

// eval evaluates the given expression as the given AST expression node requires.
func (ev *evaluator) eval(ctx context.Context, expr parser.Expr) (parser.Value, annotations.Annotations) {
	// This is the top-level evaluation method.
	// Thus, we check for timeout/cancellation here.
	if err := contextDone(ctx, "expression evaluation"); err != nil {
		ev.error(err)
	}
	numSteps := int((ev.endTimestamp-ev.startTimestamp)/ev.interval) + 1

	// Create a new span to help investigate inner evaluation performances.
	ctx, span := otel.Tracer("").Start(ctx, stats.InnerEvalTime.SpanOperation()+" eval "+reflect.TypeOf(expr).String())
	defer span.End()
	if ss, ok := expr.(interface{ ShortString() string }); ok {
		span.SetAttributes(attribute.String("operation", ss.ShortString()))
	}

	switch e := expr.(type) {
	case *parser.AggregateExpr:
		// Grouping labels must be sorted (expected both by generateGroupingKey() and aggregation()).
		sortedGrouping := e.Grouping
		slices.Sort(sortedGrouping)

		unwrapParenExpr(&e.Param)
		param := unwrapStepInvariantExpr(e.Param)
		unwrapParenExpr(&param)

		if e.Op == parser.COUNT_VALUES {
			valueLabel := param.(*parser.StringLiteral)
			if !model.LabelName(valueLabel.Val).IsValid() {
				ev.errorf("invalid label name %s", valueLabel)
			}
			if !e.Without {
				sortedGrouping = append(sortedGrouping, valueLabel.Val)
				slices.Sort(sortedGrouping)
			}
			return ev.rangeEval(ctx, nil, func(v []parser.Value, _ [][]EvalSeriesHelper, enh *EvalNodeHelper) (Vector, annotations.Annotations) {
				return ev.aggregationCountValues(e, sortedGrouping, valueLabel.Val, v[0].(Vector), enh)
			}, e.Expr)
		}

		var warnings annotations.Annotations
		originalNumSamples := ev.currentSamples
		// param is the number k for topk/bottomk, or q for quantile.
		var fParam float64
		if param != nil {
			val, ws := ev.eval(ctx, param)
			warnings.Merge(ws)
			fParam = val.(Matrix)[0].Floats[0].F
		}
		// Now fetch the data to be aggregated.
		val, ws := ev.eval(ctx, e.Expr)
		warnings.Merge(ws)
		inputMatrix := val.(Matrix)

		result, ws := ev.rangeEvalAgg(ctx, e, sortedGrouping, inputMatrix, fParam)
		warnings.Merge(ws)
		ev.currentSamples = originalNumSamples + result.TotalSamples()
		ev.samplesStats.UpdatePeak(ev.currentSamples)

		return result, warnings

	case *parser.Call:
		call := FunctionCalls[e.Func.Name]
		if e.Func.Name == "timestamp" {
			// Matrix evaluation always returns the evaluation time,
			// so this function needs special handling when given
			// a vector selector.
			unwrapParenExpr(&e.Args[0])
			arg := unwrapStepInvariantExpr(e.Args[0])
			unwrapParenExpr(&arg)
			vs, ok := arg.(*parser.VectorSelector)
			if ok {
				return ev.rangeEvalTimestampFunctionOverVectorSelector(ctx, vs, call, e)
			}
		}

		// Check if the function has a matrix argument.
		var (
			matrixArgIndex int
			matrixArg      bool
			warnings       annotations.Annotations
		)
		for i := range e.Args {
			unwrapParenExpr(&e.Args[i])
			a := unwrapStepInvariantExpr(e.Args[i])
			unwrapParenExpr(&a)
			if _, ok := a.(*parser.MatrixSelector); ok {
				matrixArgIndex = i
				matrixArg = true
				break
			}
			// parser.SubqueryExpr can be used in place of parser.MatrixSelector.
			if subq, ok := a.(*parser.SubqueryExpr); ok {
				matrixArgIndex = i
				matrixArg = true
				// Replacing parser.SubqueryExpr with parser.MatrixSelector.
				val, totalSamples, ws := ev.evalSubquery(ctx, subq)
				e.Args[i] = val
				warnings.Merge(ws)
				defer func() {
					// subquery result takes space in the memory. Get rid of that at the end.
					val.VectorSelector.(*parser.VectorSelector).Series = nil
					ev.currentSamples -= totalSamples
				}()
				break
			}
		}

		// Special handling for functions that work on series not samples.
		switch e.Func.Name {
		case "label_replace":
			return ev.evalLabelReplace(ctx, e.Args)
		case "label_join":
			return ev.evalLabelJoin(ctx, e.Args)
		case "info":
			return ev.evalInfo(ctx, e.Args)
		}

		if !matrixArg {
			// Does not have a matrix argument.
			return ev.rangeEval(ctx, nil, func(v []parser.Value, _ [][]EvalSeriesHelper, enh *EvalNodeHelper) (Vector, annotations.Annotations) {
				vec, annos := call(v, e.Args, enh)
				return vec, warnings.Merge(annos)
			}, e.Args...)
		}

		inArgs := make([]parser.Value, len(e.Args))
		// Evaluate any non-matrix arguments.
		otherArgs := make([]Matrix, len(e.Args))
		otherInArgs := make([]Vector, len(e.Args))
		for i, e := range e.Args {
			if i != matrixArgIndex {
				val, ws := ev.eval(ctx, e)
				otherArgs[i] = val.(Matrix)
				otherInArgs[i] = Vector{Sample{}}
				inArgs[i] = otherInArgs[i]
				warnings.Merge(ws)
			}
		}

		unwrapParenExpr(&e.Args[matrixArgIndex])
		arg := unwrapStepInvariantExpr(e.Args[matrixArgIndex])
		unwrapParenExpr(&arg)
		sel := arg.(*parser.MatrixSelector)
		selVS := sel.VectorSelector.(*parser.VectorSelector)

		ws, err := checkAndExpandSeriesSet(ctx, sel)
		warnings.Merge(ws)
		if err != nil {
			ev.error(errWithWarnings{fmt.Errorf("expanding series: %w", err), warnings})
		}
		mat := make(Matrix, 0, len(selVS.Series)) // Output matrix.
		offset := durationMilliseconds(selVS.Offset)
		selRange := durationMilliseconds(sel.Range)
		stepRange := selRange
		if stepRange > ev.interval {
			stepRange = ev.interval
		}
		// Reuse objects across steps to save memory allocations.
		var floats []FPoint
		var histograms []HPoint
		var prevSS *Series
		inMatrix := make(Matrix, 1)
		inArgs[matrixArgIndex] = inMatrix
		enh := &EvalNodeHelper{Out: make(Vector, 0, 1), enableDelayedNameRemoval: ev.enableDelayedNameRemoval}
		// Process all the calls for one time series at a time.
		it := storage.NewBuffer(selRange)
		var chkIter chunkenc.Iterator

		// The last_over_time function acts like offset; thus, it
		// should keep the metric name.  For all the other range
		// vector functions, the only change needed is to drop the
		// metric name in the output.
		dropName := e.Func.Name != "last_over_time"

		for i, s := range selVS.Series {
			if err := contextDone(ctx, "expression evaluation"); err != nil {
				ev.error(err)
			}
			ev.currentSamples -= len(floats) + totalHPointSize(histograms)
			if floats != nil {
				floats = floats[:0]
			}
			if histograms != nil {
				histograms = histograms[:0]
			}
			chkIter = s.Iterator(chkIter)
			it.Reset(chkIter)
			metric := selVS.Series[i].Labels()
			if !ev.enableDelayedNameRemoval && dropName {
				metric = metric.DropMetricName()
			}
			ss := Series{
				Metric:   metric,
				DropName: dropName,
			}
			inMatrix[0].Metric = selVS.Series[i].Labels()
			for ts, step := ev.startTimestamp, -1; ts <= ev.endTimestamp; ts += ev.interval {
				step++
				// Set the non-matrix arguments.
				// They are scalar, so it is safe to use the step number
				// when looking up the argument, as there will be no gaps.
				for j := range e.Args {
					if j != matrixArgIndex {
						otherInArgs[j][0].F = otherArgs[j][0].Floats[step].F
					}
				}
				// Evaluate the matrix selector for this series
				// for this step, but only if this is the 1st
				// iteration or no @ modifier has been used.
				if ts == ev.startTimestamp || selVS.Timestamp == nil {
					maxt := ts - offset
					mint := maxt - selRange
					floats, histograms = ev.matrixIterSlice(it, mint, maxt, floats, histograms)
				}
				if len(floats)+len(histograms) == 0 {
					continue
				}
				inMatrix[0].Floats = floats
				inMatrix[0].Histograms = histograms
				enh.Ts = ts
				// Make the function call.
				outVec, annos := call(inArgs, e.Args, enh)
				warnings.Merge(annos)
				ev.samplesStats.IncrementSamplesAtStep(step, int64(len(floats)+totalHPointSize(histograms)))

				enh.Out = outVec[:0]
				if len(outVec) > 0 {
					if outVec[0].H == nil {
						if ss.Floats == nil {
							ss.Floats = reuseOrGetFPointSlices(prevSS, numSteps)
						}

						ss.Floats = append(ss.Floats, FPoint{F: outVec[0].F, T: ts})
					} else {
						if ss.Histograms == nil {
							ss.Histograms = reuseOrGetHPointSlices(prevSS, numSteps)
						}
						ss.Histograms = append(ss.Histograms, HPoint{H: outVec[0].H, T: ts})
					}
				}
				// Only buffer stepRange milliseconds from the second step on.
				it.ReduceDelta(stepRange)
			}
			histSamples := totalHPointSize(ss.Histograms)

			if len(ss.Floats)+histSamples > 0 {
				if ev.currentSamples+len(ss.Floats)+histSamples > ev.maxSamples {
					ev.error(ErrTooManySamples(env))
				}
				mat = append(mat, ss)
				prevSS = &mat[len(mat)-1]
				ev.currentSamples += len(ss.Floats) + histSamples
			}
			ev.samplesStats.UpdatePeak(ev.currentSamples)

			if e.Func.Name == "rate" || e.Func.Name == "increase" {
				metricName := inMatrix[0].Metric.Get(labels.MetricName)
				if metricName != "" && len(ss.Floats) > 0 &&
					!strings.HasSuffix(metricName, "_total") &&
					!strings.HasSuffix(metricName, "_sum") &&
					!strings.HasSuffix(metricName, "_count") &&
					!strings.HasSuffix(metricName, "_bucket") {
					warnings.Add(annotations.NewPossibleNonCounterInfo(metricName, e.Args[0].PositionRange()))
				}
			}
		}
		ev.samplesStats.UpdatePeak(ev.currentSamples)

		ev.currentSamples -= len(floats) + totalHPointSize(histograms)
		putFPointSlice(floats)
		putMatrixSelectorHPointSlice(histograms)

		// The absent_over_time function returns 0 or 1 series. So far, the matrix
		// contains multiple series. The following code will create a new series
		// with values of 1 for the timestamps where no series has value.
		if e.Func.Name == "absent_over_time" {
			steps := int(1 + (ev.endTimestamp-ev.startTimestamp)/ev.interval)
			// Iterate once to look for a complete series.
			for _, s := range mat {
				if len(s.Floats)+len(s.Histograms) == steps {
					return Matrix{}, warnings
				}
			}

			found := map[int64]struct{}{}

			for i, s := range mat {
				for _, p := range s.Floats {
					found[p.T] = struct{}{}
				}
				for _, p := range s.Histograms {
					found[p.T] = struct{}{}
				}
				if i > 0 && len(found) == steps {
					return Matrix{}, warnings
				}
			}

			newp := make([]FPoint, 0, steps-len(found))
			for ts := ev.startTimestamp; ts <= ev.endTimestamp; ts += ev.interval {
				if _, ok := found[ts]; !ok {
					newp = append(newp, FPoint{T: ts, F: 1})
				}
			}

			return Matrix{
				Series{
					Metric:   createLabelsForAbsentFunction(e.Args[0]),
					Floats:   newp,
					DropName: dropName,
				},
			}, warnings
		}

		if !ev.enableDelayedNameRemoval && mat.ContainsSameLabelset() {
			ev.errorf("vector cannot contain metrics with the same labelset")
		}
		return mat, warnings

	case *parser.ParenExpr:
		return ev.eval(ctx, e.Expr)

	case *parser.UnaryExpr:
		val, ws := ev.eval(ctx, e.Expr)
		mat := val.(Matrix)
		if e.Op == parser.SUB {
			for i := range mat {
				if !ev.enableDelayedNameRemoval {
					mat[i].Metric = mat[i].Metric.DropMetricName()
				}
				mat[i].DropName = true
				for j := range mat[i].Floats {
					mat[i].Floats[j].F = -mat[i].Floats[j].F
				}
				for j := range mat[i].Histograms {
					mat[i].Histograms[j].H = mat[i].Histograms[j].H.Copy().Mul(-1)
				}
			}
			if !ev.enableDelayedNameRemoval && mat.ContainsSameLabelset() {
				ev.errorf("vector cannot contain metrics with the same labelset")
			}
		}
		return mat, ws

	case *parser.BinaryExpr:
		switch lt, rt := e.LHS.Type(), e.RHS.Type(); {
		case lt == parser.ValueTypeScalar && rt == parser.ValueTypeScalar:
			return ev.rangeEval(ctx, nil, func(v []parser.Value, _ [][]EvalSeriesHelper, enh *EvalNodeHelper) (Vector, annotations.Annotations) {
				val := scalarBinop(e.Op, v[0].(Vector)[0].F, v[1].(Vector)[0].F)
				return append(enh.Out, Sample{F: val}), nil
			}, e.LHS, e.RHS)
		case lt == parser.ValueTypeVector && rt == parser.ValueTypeVector:
			// Function to compute the join signature for each series.
			buf := make([]byte, 0, 1024)
			sigf := signatureFunc(e.VectorMatching.On, buf, e.VectorMatching.MatchingLabels...)
			initSignatures := func(series labels.Labels, h *EvalSeriesHelper) {
				h.signature = sigf(series)
			}
			switch e.Op {
			case parser.LAND:
				return ev.rangeEval(ctx, initSignatures, func(v []parser.Value, sh [][]EvalSeriesHelper, enh *EvalNodeHelper) (Vector, annotations.Annotations) {
					return ev.VectorAnd(v[0].(Vector), v[1].(Vector), e.VectorMatching, sh[0], sh[1], enh), nil
				}, e.LHS, e.RHS)
			case parser.LOR:
				return ev.rangeEval(ctx, initSignatures, func(v []parser.Value, sh [][]EvalSeriesHelper, enh *EvalNodeHelper) (Vector, annotations.Annotations) {
					return ev.VectorOr(v[0].(Vector), v[1].(Vector), e.VectorMatching, sh[0], sh[1], enh), nil
				}, e.LHS, e.RHS)
			case parser.LUNLESS:
				return ev.rangeEval(ctx, initSignatures, func(v []parser.Value, sh [][]EvalSeriesHelper, enh *EvalNodeHelper) (Vector, annotations.Annotations) {
					return ev.VectorUnless(v[0].(Vector), v[1].(Vector), e.VectorMatching, sh[0], sh[1], enh), nil
				}, e.LHS, e.RHS)
			default:
				return ev.rangeEval(ctx, initSignatures, func(v []parser.Value, sh [][]EvalSeriesHelper, enh *EvalNodeHelper) (Vector, annotations.Annotations) {
					vec, err := ev.VectorBinop(e.Op, v[0].(Vector), v[1].(Vector), e.VectorMatching, e.ReturnBool, sh[0], sh[1], enh, e.PositionRange())
					return vec, handleVectorBinopError(err, e)
				}, e.LHS, e.RHS)
			}

		case lt == parser.ValueTypeVector && rt == parser.ValueTypeScalar:
			return ev.rangeEval(ctx, nil, func(v []parser.Value, _ [][]EvalSeriesHelper, enh *EvalNodeHelper) (Vector, annotations.Annotations) {
				vec, err := ev.VectorscalarBinop(e.Op, v[0].(Vector), Scalar{V: v[1].(Vector)[0].F}, false, e.ReturnBool, enh, e.PositionRange())
				return vec, handleVectorBinopError(err, e)
			}, e.LHS, e.RHS)

		case lt == parser.ValueTypeScalar && rt == parser.ValueTypeVector:
			return ev.rangeEval(ctx, nil, func(v []parser.Value, _ [][]EvalSeriesHelper, enh *EvalNodeHelper) (Vector, annotations.Annotations) {
				vec, err := ev.VectorscalarBinop(e.Op, v[1].(Vector), Scalar{V: v[0].(Vector)[0].F}, true, e.ReturnBool, enh, e.PositionRange())
				return vec, handleVectorBinopError(err, e)
			}, e.LHS, e.RHS)
		}

	case *parser.NumberLiteral:
		span.SetAttributes(attribute.Float64("value", e.Val))
		return ev.rangeEval(ctx, nil, func(_ []parser.Value, _ [][]EvalSeriesHelper, enh *EvalNodeHelper) (Vector, annotations.Annotations) {
			return append(enh.Out, Sample{F: e.Val, Metric: labels.EmptyLabels()}), nil
		})

	case *parser.StringLiteral:
		span.SetAttributes(attribute.String("value", e.Val))
		return String{V: e.Val, T: ev.startTimestamp}, nil

	case *parser.VectorSelector:
		ws, err := checkAndExpandSeriesSet(ctx, e)
		if err != nil {
			ev.error(errWithWarnings{fmt.Errorf("expanding series: %w", err), ws})
		}
		mat := ev.evalSeries(ctx, e.Series, e.Offset, false)
		return mat, ws

	case *parser.MatrixSelector:
		if ev.startTimestamp != ev.endTimestamp {
			panic(errors.New("cannot do range evaluation of matrix selector"))
		}
		return ev.matrixSelector(ctx, e)

	case *parser.SubqueryExpr:
		offsetMillis := durationMilliseconds(e.Offset)
		rangeMillis := durationMilliseconds(e.Range)
		newEv := &evaluator{
			endTimestamp:             ev.endTimestamp - offsetMillis,
			currentSamples:           ev.currentSamples,
			maxSamples:               ev.maxSamples,
			logger:                   ev.logger,
			lookbackDelta:            ev.lookbackDelta,
			samplesStats:             ev.samplesStats.NewChild(),
			noStepSubqueryIntervalFn: ev.noStepSubqueryIntervalFn,
			enableDelayedNameRemoval: ev.enableDelayedNameRemoval,
			querier:                  ev.querier,
		}

		if e.Step != 0 {
			newEv.interval = durationMilliseconds(e.Step)
		} else {
			newEv.interval = ev.noStepSubqueryIntervalFn(rangeMillis)
		}

		// Start with the first timestamp after (ev.startTimestamp - offset - range)
		// that is aligned with the step (multiple of 'newEv.interval').
		newEv.startTimestamp = newEv.interval * ((ev.startTimestamp - offsetMillis - rangeMillis) / newEv.interval)
		if newEv.startTimestamp <= (ev.startTimestamp - offsetMillis - rangeMillis) {
			newEv.startTimestamp += newEv.interval
		}

		if newEv.startTimestamp != ev.startTimestamp {
			// Adjust the offset of selectors based on the new
			// start time of the evaluator since the calculation
			// of the offset with @ happens w.r.t. the start time.
			setOffsetForAtModifier(newEv.startTimestamp, e.Expr)
		}

		res, ws := newEv.eval(ctx, e.Expr)
		ev.currentSamples = newEv.currentSamples
		ev.samplesStats.UpdatePeakFromSubquery(newEv.samplesStats)
		ev.samplesStats.IncrementSamplesAtTimestamp(ev.endTimestamp, newEv.samplesStats.TotalSamples)
		return res, ws
	case *parser.StepInvariantExpr:
		switch ce := e.Expr.(type) {
		case *parser.StringLiteral, *parser.NumberLiteral:
			return ev.eval(ctx, ce)
		}

		newEv := &evaluator{
			startTimestamp:           ev.startTimestamp,
			endTimestamp:             ev.startTimestamp, // Always a single evaluation.
			interval:                 ev.interval,
			currentSamples:           ev.currentSamples,
			maxSamples:               ev.maxSamples,
			logger:                   ev.logger,
			lookbackDelta:            ev.lookbackDelta,
			samplesStats:             ev.samplesStats.NewChild(),
			noStepSubqueryIntervalFn: ev.noStepSubqueryIntervalFn,
			enableDelayedNameRemoval: ev.enableDelayedNameRemoval,
			querier:                  ev.querier,
		}
		res, ws := newEv.eval(ctx, e.Expr)
		ev.currentSamples = newEv.currentSamples
		ev.samplesStats.UpdatePeakFromSubquery(newEv.samplesStats)
		for ts, step := ev.startTimestamp, -1; ts <= ev.endTimestamp; ts += ev.interval {
			step++
			ev.samplesStats.IncrementSamplesAtStep(step, newEv.samplesStats.TotalSamples)
		}
		switch e.Expr.(type) {
		case *parser.MatrixSelector, *parser.SubqueryExpr:
			// We do not duplicate results for range selectors since result is a matrix
			// with their unique timestamps which does not depend on the step.
			return res, ws
		}

		// For every evaluation while the value remains same, the timestamp for that
		// value would change for different eval times. Hence we duplicate the result
		// with changed timestamps.
		mat, ok := res.(Matrix)
		if !ok {
			panic(fmt.Errorf("unexpected result in StepInvariantExpr evaluation: %T", expr))
		}
		for i := range mat {
			if len(mat[i].Floats)+len(mat[i].Histograms) != 1 {
				panic(errors.New("unexpected number of samples"))
			}
			for ts := ev.startTimestamp + ev.interval; ts <= ev.endTimestamp; ts += ev.interval {
				if len(mat[i].Floats) > 0 {
					mat[i].Floats = append(mat[i].Floats, FPoint{
						T: ts,
						F: mat[i].Floats[0].F,
					})
					ev.currentSamples++
				} else {
					point := HPoint{
						T: ts,
						H: mat[i].Histograms[0].H,
					}
					mat[i].Histograms = append(mat[i].Histograms, point)
					ev.currentSamples += point.size()
				}
				if ev.currentSamples > ev.maxSamples {
					ev.error(ErrTooManySamples(env))
				}
			}
		}
		ev.samplesStats.UpdatePeak(ev.currentSamples)
		return res, ws
	}

	panic(fmt.Errorf("unhandled expression of type: %T", expr))
}

// reuseOrGetHPointSlices reuses the space from previous slice to create new slice if the former has lots of room.
// The previous slices capacity is adjusted so when it is re-used from the pool it doesn't overflow into the new one.
func reuseOrGetHPointSlices(prevSS *Series, numSteps int) (r []HPoint) {
	if prevSS != nil && cap(prevSS.Histograms)-2*len(prevSS.Histograms) > 0 {
		r = prevSS.Histograms[len(prevSS.Histograms):]
		prevSS.Histograms = prevSS.Histograms[0:len(prevSS.Histograms):len(prevSS.Histograms)]
		return
	}

	return getHPointSlice(numSteps)
}

// reuseOrGetFPointSlices reuses the space from previous slice to create new slice if the former has lots of room.
// The previous slices capacity is adjusted so when it is re-used from the pool it doesn't overflow into the new one.
func reuseOrGetFPointSlices(prevSS *Series, numSteps int) (r []FPoint) {
	if prevSS != nil && cap(prevSS.Floats)-2*len(prevSS.Floats) > 0 {
		r = prevSS.Floats[len(prevSS.Floats):]
		prevSS.Floats = prevSS.Floats[0:len(prevSS.Floats):len(prevSS.Floats)]
		return
	}

	return getFPointSlice(numSteps)
}

func (ev *evaluator) rangeEvalTimestampFunctionOverVectorSelector(ctx context.Context, vs *parser.VectorSelector, call FunctionCall, e *parser.Call) (parser.Value, annotations.Annotations) {
	ws, err := checkAndExpandSeriesSet(ctx, vs)
	if err != nil {
		ev.error(errWithWarnings{fmt.Errorf("expanding series: %w", err), ws})
	}

	seriesIterators := make([]*storage.MemoizedSeriesIterator, len(vs.Series))
	for i, s := range vs.Series {
		it := s.Iterator(nil)
		seriesIterators[i] = storage.NewMemoizedIterator(it, durationMilliseconds(ev.lookbackDelta)-1)
	}

	return ev.rangeEval(ctx, nil, func(_ []parser.Value, _ [][]EvalSeriesHelper, enh *EvalNodeHelper) (Vector, annotations.Annotations) {
		if vs.Timestamp != nil {
			// This is a special case for "timestamp()" when the @ modifier is used, to ensure that
			// we return a point for each time step in this case.
			// See https://github.com/prometheus/prometheus/issues/8433.
			vs.Offset = time.Duration(enh.Ts-*vs.Timestamp) * time.Millisecond
		}

		vec := make(Vector, 0, len(vs.Series))
		for i, s := range vs.Series {
			it := seriesIterators[i]
			t, _, _, ok := ev.vectorSelectorSingle(it, vs.Offset, enh.Ts)
			if !ok {
				continue
			}

			// Note that we ignore the sample values because call only cares about the timestamp.
			vec = append(vec, Sample{
				Metric: s.Labels(),
				T:      t,
			})

			ev.currentSamples++
			ev.samplesStats.IncrementSamplesAtTimestamp(enh.Ts, 1)
			if ev.currentSamples > ev.maxSamples {
				ev.error(ErrTooManySamples(env))
			}
		}
		ev.samplesStats.UpdatePeak(ev.currentSamples)
		vec, annos := call([]parser.Value{vec}, e.Args, enh)
		return vec, ws.Merge(annos)
	})
}

// vectorSelectorSingle evaluates an instant vector for the iterator of one time series.
func (ev *evaluator) vectorSelectorSingle(it *storage.MemoizedSeriesIterator, offset time.Duration, ts int64) (
	int64, float64, *histogram.FloatHistogram, bool,
) {
	refTime := ts - durationMilliseconds(offset)
	var t int64
	var v float64
	var h *histogram.FloatHistogram

	valueType := it.Seek(refTime)
	switch valueType {
	case chunkenc.ValNone:
		if it.Err() != nil {
			ev.error(it.Err())
		}
	case chunkenc.ValFloat:
		t, v = it.At()
	case chunkenc.ValFloatHistogram:
		t, h = it.AtFloatHistogram()
	default:
		panic(fmt.Errorf("unknown value type %v", valueType))
	}
	if valueType == chunkenc.ValNone || t > refTime {
		var ok bool
		t, v, h, ok = it.PeekPrev()
		if !ok || t <= refTime-durationMilliseconds(ev.lookbackDelta) {
			return 0, 0, nil, false
		}
	}
	if value.IsStaleNaN(v) || (h != nil && value.IsStaleNaN(h.Sum)) {
		return 0, 0, nil, false
	}
	return t, v, h, true
}

var (
	fPointPool zeropool.Pool[[]FPoint]
	hPointPool zeropool.Pool[[]HPoint]

	// matrixSelectorHPool holds reusable histogram slices used by the matrix
	// selector. The key difference between this pool and the hPointPool is that
	// slices returned by this pool should never hold multiple copies of the same
	// histogram pointer since histogram objects are reused across query evaluation
	// steps.
	matrixSelectorHPool zeropool.Pool[[]HPoint]
)

func getFPointSlice(sz int) []FPoint {
	if p := fPointPool.Get(); p != nil {
		return p
	}

	if sz > maxPointsSliceSize {
		sz = maxPointsSliceSize
	}

	return make([]FPoint, 0, sz)
}

// putFPointSlice will return a FPoint slice of size max(maxPointsSliceSize, sz).
// This function is called with an estimated size which often can be over-estimated.
func putFPointSlice(p []FPoint) {
	if p != nil {
		fPointPool.Put(p[:0])
	}
}

// getHPointSlice will return a HPoint slice of size max(maxPointsSliceSize, sz).
// This function is called with an estimated size which often can be over-estimated.
func getHPointSlice(sz int) []HPoint {
	if p := hPointPool.Get(); p != nil {
		return p
	}

	if sz > maxPointsSliceSize {
		sz = maxPointsSliceSize
	}

	return make([]HPoint, 0, sz)
}

func putHPointSlice(p []HPoint) {
	if p != nil {
		hPointPool.Put(p[:0])
	}
}

func getMatrixSelectorHPoints() []HPoint {
	if p := matrixSelectorHPool.Get(); p != nil {
		return p
	}

	return make([]HPoint, 0, matrixSelectorSliceSize)
}

func putMatrixSelectorHPointSlice(p []HPoint) {
	if p != nil {
		matrixSelectorHPool.Put(p[:0])
	}
}

// matrixSelector evaluates a *parser.MatrixSelector expression.
func (ev *evaluator) matrixSelector(ctx context.Context, node *parser.MatrixSelector) (Matrix, annotations.Annotations) {
	var (
		vs = node.VectorSelector.(*parser.VectorSelector)

		offset = durationMilliseconds(vs.Offset)
		maxt   = ev.startTimestamp - offset
		mint   = maxt - durationMilliseconds(node.Range)
		matrix = make(Matrix, 0, len(vs.Series))

		it = storage.NewBuffer(durationMilliseconds(node.Range))
	)
	ws, err := checkAndExpandSeriesSet(ctx, node)
	if err != nil {
		ev.error(errWithWarnings{fmt.Errorf("expanding series: %w", err), ws})
	}

	var chkIter chunkenc.Iterator
	series := vs.Series
	for i, s := range series {
		if err := contextDone(ctx, "expression evaluation"); err != nil {
			ev.error(err)
		}
		chkIter = s.Iterator(chkIter)
		it.Reset(chkIter)
		ss := Series{
			Metric: series[i].Labels(),
		}

		ss.Floats, ss.Histograms = ev.matrixIterSlice(it, mint, maxt, nil, nil)
		totalSize := int64(len(ss.Floats)) + int64(totalHPointSize(ss.Histograms))
		ev.samplesStats.IncrementSamplesAtTimestamp(ev.startTimestamp, totalSize)

		if totalSize > 0 {
			matrix = append(matrix, ss)
		} else {
			putFPointSlice(ss.Floats)
			putHPointSlice(ss.Histograms)
		}
	}
	return matrix, ws
}

// matrixIterSlice populates a matrix vector covering the requested range for a
// single time series, with points retrieved from an iterator.
//
// As an optimization, the matrix vector may already contain points of the same
// time series from the evaluation of an earlier step (with lower mint and maxt
// values). Any such points falling before mint are discarded; points that fall
// into the [mint, maxt] range are retained; only points with later timestamps
// are populated from the iterator.
func (ev *evaluator) matrixIterSlice(
	it *storage.BufferedSeriesIterator, mint, maxt int64,
	floats []FPoint, histograms []HPoint,
) ([]FPoint, []HPoint) {
	mintFloats, mintHistograms := mint, mint

	// First floats...
	if len(floats) > 0 && floats[len(floats)-1].T > mint {
		// There is an overlap between previous and current ranges, retain common
		// points. In most such cases:
		//   (a) the overlap is significantly larger than the eval step; and/or
		//   (b) the number of samples is relatively small.
		// so a linear search will be as fast as a binary search.
		var drop int
		for drop = 0; floats[drop].T <= mint; drop++ {
		}
		ev.currentSamples -= drop
		copy(floats, floats[drop:])
		floats = floats[:len(floats)-drop]
		// Only append points with timestamps after the last timestamp we have.
		mintFloats = floats[len(floats)-1].T
	} else {
		ev.currentSamples -= len(floats)
		if floats != nil {
			floats = floats[:0]
		}
	}

	// ...then the same for histograms. TODO(beorn7): Use generics?
	if len(histograms) > 0 && histograms[len(histograms)-1].T > mint {
		// There is an overlap between previous and current ranges, retain common
		// points. In most such cases:
		//   (a) the overlap is significantly larger than the eval step; and/or
		//   (b) the number of samples is relatively small.
		// so a linear search will be as fast as a binary search.
		var drop int
		for drop = 0; histograms[drop].T <= mint; drop++ {
		}
		// Rotate the buffer around the drop index so that points before mint can be
		// reused to store new histograms.
		tail := make([]HPoint, drop)
		copy(tail, histograms[:drop])
		copy(histograms, histograms[drop:])
		copy(histograms[len(histograms)-drop:], tail)
		histograms = histograms[:len(histograms)-drop]
		ev.currentSamples -= totalHPointSize(histograms)
		// Only append points with timestamps after the last timestamp we have.
		mintHistograms = histograms[len(histograms)-1].T
	} else {
		ev.currentSamples -= totalHPointSize(histograms)
		if histograms != nil {
			histograms = histograms[:0]
		}
	}

	if mint == maxt {
		// Empty range: return the empty slices.
		return floats, histograms
	}

	soughtValueType := it.Seek(maxt)
	if soughtValueType == chunkenc.ValNone {
		if it.Err() != nil {
			ev.error(it.Err())
		}
	}

	buf := it.Buffer()
loop:
	for {
		switch buf.Next() {
		case chunkenc.ValNone:
			break loop
		case chunkenc.ValFloatHistogram, chunkenc.ValHistogram:
			t := buf.AtT()
			// Values in the buffer are guaranteed to be smaller than maxt.
			if t > mintHistograms {
				if histograms == nil {
					histograms = getMatrixSelectorHPoints()
				}
				n := len(histograms)
				if n < cap(histograms) {
					histograms = histograms[:n+1]
				} else {
					histograms = append(histograms, HPoint{H: &histogram.FloatHistogram{}})
				}
				histograms[n].T, histograms[n].H = buf.AtFloatHistogram(histograms[n].H)
				if value.IsStaleNaN(histograms[n].H.Sum) {
					histograms = histograms[:n]
					continue loop
				}
				ev.currentSamples += histograms[n].size()
				if ev.currentSamples > ev.maxSamples {
					ev.error(ErrTooManySamples(env))
				}
			}
		case chunkenc.ValFloat:
			t, f := buf.At()
			if value.IsStaleNaN(f) {
				continue loop
			}
			// Values in the buffer are guaranteed to be smaller than maxt.
			if t > mintFloats {
				ev.currentSamples++
				if ev.currentSamples > ev.maxSamples {
					ev.error(ErrTooManySamples(env))
				}
				if floats == nil {
					floats = getFPointSlice(16)
				}
				floats = append(floats, FPoint{T: t, F: f})
			}
		}
	}
	// The sought sample might also be in the range.
	switch soughtValueType {
	case chunkenc.ValFloatHistogram, chunkenc.ValHistogram:
		if it.AtT() != maxt {
			break
		}
		if histograms == nil {
			histograms = getMatrixSelectorHPoints()
		}
		n := len(histograms)
		if n < cap(histograms) {
			histograms = histograms[:n+1]
		} else {
			histograms = append(histograms, HPoint{H: &histogram.FloatHistogram{}})
		}
		if histograms[n].H == nil {
			// Make sure to pass non-nil H to AtFloatHistogram so that it does a deep-copy.
			// Not an issue in the loop above since that uses an intermediate buffer.
			histograms[n].H = &histogram.FloatHistogram{}
		}
		histograms[n].T, histograms[n].H = it.AtFloatHistogram(histograms[n].H)
		if value.IsStaleNaN(histograms[n].H.Sum) {
			histograms = histograms[:n]
			break
		}
		ev.currentSamples += histograms[n].size()
		if ev.currentSamples > ev.maxSamples {
			ev.error(ErrTooManySamples(env))
		}

	case chunkenc.ValFloat:
		t, f := it.At()
		if t == maxt && !value.IsStaleNaN(f) {
			ev.currentSamples++
			if ev.currentSamples > ev.maxSamples {
				ev.error(ErrTooManySamples(env))
			}
			if floats == nil {
				floats = getFPointSlice(16)
			}
			floats = append(floats, FPoint{T: t, F: f})
		}
	}
	ev.samplesStats.UpdatePeak(ev.currentSamples)
	return floats, histograms
}

func (ev *evaluator) VectorAnd(lhs, rhs Vector, matching *parser.VectorMatching, lhsh, rhsh []EvalSeriesHelper, enh *EvalNodeHelper) Vector {
	if matching.Card != parser.CardManyToMany {
		panic("set operations must only use many-to-many matching")
	}
	if len(lhs) == 0 || len(rhs) == 0 {
		return nil // Short-circuit: AND with nothing is nothing.
	}

	// The set of signatures for the right-hand side Vector.
	rightSigs := map[string]struct{}{}
	// Add all rhs samples to a map so we can easily find matches later.
	for _, sh := range rhsh {
		rightSigs[sh.signature] = struct{}{}
	}

	for i, ls := range lhs {
		// If there's a matching entry in the right-hand side Vector, add the sample.
		if _, ok := rightSigs[lhsh[i].signature]; ok {
			enh.Out = append(enh.Out, ls)
		}
	}
	return enh.Out
}

func (ev *evaluator) VectorOr(lhs, rhs Vector, matching *parser.VectorMatching, lhsh, rhsh []EvalSeriesHelper, enh *EvalNodeHelper) Vector {
	switch {
	case matching.Card != parser.CardManyToMany:
		panic("set operations must only use many-to-many matching")
	case len(lhs) == 0: // Short-circuit.
		enh.Out = append(enh.Out, rhs...)
		return enh.Out
	case len(rhs) == 0:
		enh.Out = append(enh.Out, lhs...)
		return enh.Out
	}

	leftSigs := map[string]struct{}{}
	// Add everything from the left-hand-side Vector.
	for i, ls := range lhs {
		leftSigs[lhsh[i].signature] = struct{}{}
		enh.Out = append(enh.Out, ls)
	}
	// Add all right-hand side elements which have not been added from the left-hand side.
	for j, rs := range rhs {
		if _, ok := leftSigs[rhsh[j].signature]; !ok {
			enh.Out = append(enh.Out, rs)
		}
	}
	return enh.Out
}

func (ev *evaluator) VectorUnless(lhs, rhs Vector, matching *parser.VectorMatching, lhsh, rhsh []EvalSeriesHelper, enh *EvalNodeHelper) Vector {
	if matching.Card != parser.CardManyToMany {
		panic("set operations must only use many-to-many matching")
	}
	// Short-circuit: empty rhs means we will return everything in lhs;
	// empty lhs means we will return empty - don't need to build a map.
	if len(lhs) == 0 || len(rhs) == 0 {
		enh.Out = append(enh.Out, lhs...)
		return enh.Out
	}

	rightSigs := map[string]struct{}{}
	for _, sh := range rhsh {
		rightSigs[sh.signature] = struct{}{}
	}

	for i, ls := range lhs {
		if _, ok := rightSigs[lhsh[i].signature]; !ok {
			enh.Out = append(enh.Out, ls)
		}
	}
	return enh.Out
}

// VectorBinop evaluates a binary operation between two Vectors, excluding set operators.
func (ev *evaluator) VectorBinop(op parser.ItemType, lhs, rhs Vector, matching *parser.VectorMatching, returnBool bool, lhsh, rhsh []EvalSeriesHelper, enh *EvalNodeHelper, pos posrange.PositionRange) (Vector, error) {
	if matching.Card == parser.CardManyToMany {
		panic("many-to-many only allowed for set operators")
	}
	if len(lhs) == 0 || len(rhs) == 0 {
		return nil, nil // Short-circuit: nothing is going to match.
	}

	// The control flow below handles one-to-one or many-to-one matching.
	// For one-to-many, swap sidedness and account for the swap when calculating
	// values.
	if matching.Card == parser.CardOneToMany {
		lhs, rhs = rhs, lhs
		lhsh, rhsh = rhsh, lhsh
	}

	// All samples from the rhs hashed by the matching label/values.
	if enh.rightSigs == nil {
		enh.rightSigs = make(map[string]Sample, len(enh.Out))
	} else {
		for k := range enh.rightSigs {
			delete(enh.rightSigs, k)
		}
	}
	rightSigs := enh.rightSigs

	// Add all rhs samples to a map so we can easily find matches later.
	for i, rs := range rhs {
		sig := rhsh[i].signature
		// The rhs is guaranteed to be the 'one' side. Having multiple samples
		// with the same signature means that the matching is many-to-many.
		if duplSample, found := rightSigs[sig]; found {
			// oneSide represents which side of the vector represents the 'one' in the many-to-one relationship.
			oneSide := "right"
			if matching.Card == parser.CardOneToMany {
				oneSide = "left"
			}
			matchedLabels := rs.Metric.MatchLabels(matching.On, matching.MatchingLabels...)
			// Many-to-many matching not allowed.
			ev.errorf("found duplicate series for the match group %s on the %s hand-side of the operation: [%s, %s]"+
				";many-to-many matching not allowed: matching labels must be unique on one side", matchedLabels.String(), oneSide, rs.Metric.String(), duplSample.Metric.String())
		}
		rightSigs[sig] = rs
	}

	// Tracks the match-signature. For one-to-one operations the value is nil. For many-to-one
	// the value is a set of signatures to detect duplicated result elements.
	if enh.matchedSigs == nil {
		enh.matchedSigs = make(map[string]map[uint64]struct{}, len(rightSigs))
	} else {
		for k := range enh.matchedSigs {
			delete(enh.matchedSigs, k)
		}
	}
	matchedSigs := enh.matchedSigs

	// For all lhs samples find a respective rhs sample and perform
	// the binary operation.
	var lastErr error
	for i, ls := range lhs {
		sig := lhsh[i].signature

		rs, found := rightSigs[sig] // Look for a match in the rhs Vector.
		if !found {
			continue
		}

		// Account for potentially swapped sidedness.
		fl, fr := ls.F, rs.F
		hl, hr := ls.H, rs.H
		if matching.Card == parser.CardOneToMany {
			fl, fr = fr, fl
			hl, hr = hr, hl
		}
		floatValue, histogramValue, keep, err := vectorElemBinop(op, fl, fr, hl, hr, pos)
		if err != nil {
			lastErr = err
			continue
		}
		switch {
		case returnBool:
			histogramValue = nil
			if keep {
				floatValue = 1.0
			} else {
				floatValue = 0.0
			}
		case !keep:
			continue
		}
		metric := resultMetric(ls.Metric, rs.Metric, op, matching, enh)
		if !ev.enableDelayedNameRemoval && returnBool {
			metric = metric.DropMetricName()
		}
		insertedSigs, exists := matchedSigs[sig]
		if matching.Card == parser.CardOneToOne {
			if exists {
				ev.errorf("multiple matches for labels: many-to-one matching must be explicit (group_left/group_right)")
			}
			matchedSigs[sig] = nil // Set existence to true.
		} else {
			// In many-to-one matching the grouping labels have to ensure a unique metric
			// for the result Vector. Check whether those labels have already been added for
			// the same matching labels.
			insertSig := metric.Hash()

			if !exists {
				insertedSigs = map[uint64]struct{}{}
				matchedSigs[sig] = insertedSigs
			} else if _, duplicate := insertedSigs[insertSig]; duplicate {
				ev.errorf("multiple matches for labels: grouping labels must ensure unique matches")
			}
			insertedSigs[insertSig] = struct{}{}
		}

		enh.Out = append(enh.Out, Sample{
			Metric:   metric,
			F:        floatValue,
			H:        histogramValue,
			DropName: returnBool,
		})
	}
	return enh.Out, lastErr
}

func signatureFunc(on bool, b []byte, names ...string) func(labels.Labels) string {
	if on {
		slices.Sort(names)
		return func(lset labels.Labels) string {
			return string(lset.BytesWithLabels(b, names...))
		}
	}
	names = append([]string{labels.MetricName}, names...)
	slices.Sort(names)
	return func(lset labels.Labels) string {
		return string(lset.BytesWithoutLabels(b, names...))
	}
}

// resultMetric returns the metric for the given sample(s) based on the Vector
// binary operation and the matching options.
func resultMetric(lhs, rhs labels.Labels, op parser.ItemType, matching *parser.VectorMatching, enh *EvalNodeHelper) labels.Labels {
	if enh.resultMetric == nil {
		enh.resultMetric = make(map[string]labels.Labels, len(enh.Out))
	}

	enh.resetBuilder(lhs)
	buf := bytes.NewBuffer(enh.lblResultBuf[:0])
	enh.lblBuf = lhs.Bytes(enh.lblBuf)
	buf.Write(enh.lblBuf)
	enh.lblBuf = rhs.Bytes(enh.lblBuf)
	buf.Write(enh.lblBuf)
	enh.lblResultBuf = buf.Bytes()

	if ret, ok := enh.resultMetric[string(enh.lblResultBuf)]; ok {
		return ret
	}
	str := string(enh.lblResultBuf)

	if shouldDropMetricName(op) {
		enh.lb.Del(labels.MetricName)
	}

	if matching.Card == parser.CardOneToOne {
		if matching.On {
			enh.lb.Keep(matching.MatchingLabels...)
		} else {
			enh.lb.Del(matching.MatchingLabels...)
		}
	}
	for _, ln := range matching.Include {
		// Included labels from the `group_x` modifier are taken from the "one"-side.
		if v := rhs.Get(ln); v != "" {
			enh.lb.Set(ln, v)
		} else {
			enh.lb.Del(ln)
		}
	}

	ret := enh.lb.Labels()
	enh.resultMetric[str] = ret
	return ret
}

// VectorscalarBinop evaluates a binary operation between a Vector and a Scalar.
func (ev *evaluator) VectorscalarBinop(op parser.ItemType, lhs Vector, rhs Scalar, swap, returnBool bool, enh *EvalNodeHelper, pos posrange.PositionRange) (Vector, error) {
	var lastErr error
	for _, lhsSample := range lhs {
		lf, rf := lhsSample.F, rhs.V
		var rh *histogram.FloatHistogram
		lh := lhsSample.H
		// lhs always contains the Vector. If the original position was different
		// swap for calculating the value.
		if swap {
			lf, rf = rf, lf
			lh, rh = rh, lh
		}
		float, histogram, keep, err := vectorElemBinop(op, lf, rf, lh, rh, pos)
		if err != nil {
			lastErr = err
			continue
		}
		// Catch cases where the scalar is the LHS in a scalar-vector comparison operation.
		// We want to always keep the vector element value as the output value, even if it's on the RHS.
		if op.IsComparisonOperator() && swap {
			float = rf
			histogram = rh
		}
		if returnBool {
			if keep {
				float = 1.0
			} else {
				float = 0.0
			}
			keep = true
		}
		if keep {
			lhsSample.F = float
			lhsSample.H = histogram
			if shouldDropMetricName(op) || returnBool {
				if !ev.enableDelayedNameRemoval {
					lhsSample.Metric = lhsSample.Metric.DropMetricName()
				}
				lhsSample.DropName = true
			}
			enh.Out = append(enh.Out, lhsSample)
		}
	}
	return enh.Out, lastErr
}

// scalarBinop evaluates a binary operation between two Scalars.
func scalarBinop(op parser.ItemType, lhs, rhs float64) float64 {
	switch op {
	case parser.ADD:
		return lhs + rhs
	case parser.SUB:
		return lhs - rhs
	case parser.MUL:
		return lhs * rhs
	case parser.DIV:
		return lhs / rhs
	case parser.POW:
		return math.Pow(lhs, rhs)
	case parser.MOD:
		return math.Mod(lhs, rhs)
	case parser.EQLC:
		return btos(lhs == rhs)
	case parser.NEQ:
		return btos(lhs != rhs)
	case parser.GTR:
		return btos(lhs > rhs)
	case parser.LSS:
		return btos(lhs < rhs)
	case parser.GTE:
		return btos(lhs >= rhs)
	case parser.LTE:
		return btos(lhs <= rhs)
	case parser.ATAN2:
		return math.Atan2(lhs, rhs)
	}
	panic(fmt.Errorf("operator %q not allowed for Scalar operations", op))
}

// vectorElemBinop evaluates a binary operation between two Vector elements.
func vectorElemBinop(op parser.ItemType, lhs, rhs float64, hlhs, hrhs *histogram.FloatHistogram, pos posrange.PositionRange) (float64, *histogram.FloatHistogram, bool, error) {
	opName := parser.ItemTypeStr[op]
	switch {
	case hlhs == nil && hrhs == nil:
		{
			switch op {
			case parser.ADD:
				return lhs + rhs, nil, true, nil
			case parser.SUB:
				return lhs - rhs, nil, true, nil
			case parser.MUL:
				return lhs * rhs, nil, true, nil
			case parser.DIV:
				return lhs / rhs, nil, true, nil
			case parser.POW:
				return math.Pow(lhs, rhs), nil, true, nil
			case parser.MOD:
				return math.Mod(lhs, rhs), nil, true, nil
			case parser.EQLC:
				return lhs, nil, lhs == rhs, nil
			case parser.NEQ:
				return lhs, nil, lhs != rhs, nil
			case parser.GTR:
				return lhs, nil, lhs > rhs, nil
			case parser.LSS:
				return lhs, nil, lhs < rhs, nil
			case parser.GTE:
				return lhs, nil, lhs >= rhs, nil
			case parser.LTE:
				return lhs, nil, lhs <= rhs, nil
			case parser.ATAN2:
				return math.Atan2(lhs, rhs), nil, true, nil
			}
		}
	case hlhs == nil && hrhs != nil:
		{
			switch op {
			case parser.MUL:
				return 0, hrhs.Copy().Mul(lhs).Compact(0), true, nil
			case parser.ADD, parser.SUB, parser.DIV, parser.POW, parser.MOD, parser.EQLC, parser.NEQ, parser.GTR, parser.LSS, parser.GTE, parser.LTE, parser.ATAN2:
				return 0, nil, false, annotations.NewIncompatibleTypesInBinOpInfo("float", opName, "histogram", pos)
			}
		}
	case hlhs != nil && hrhs == nil:
		{
			switch op {
			case parser.MUL:
				return 0, hlhs.Copy().Mul(rhs).Compact(0), true, nil
			case parser.DIV:
				return 0, hlhs.Copy().Div(rhs).Compact(0), true, nil
			case parser.ADD, parser.SUB, parser.POW, parser.MOD, parser.EQLC, parser.NEQ, parser.GTR, parser.LSS, parser.GTE, parser.LTE, parser.ATAN2:
				return 0, nil, false, annotations.NewIncompatibleTypesInBinOpInfo("histogram", opName, "float", pos)
			}
		}
	case hlhs != nil && hrhs != nil:
		{
			switch op {
			case parser.ADD:
				res, err := hlhs.Copy().Add(hrhs)
				if err != nil {
					return 0, nil, false, err
				}
				return 0, res.Compact(0), true, nil
			case parser.SUB:
				res, err := hlhs.Copy().Sub(hrhs)
				if err != nil {
					return 0, nil, false, err
				}
				return 0, res.Compact(0), true, nil
			case parser.EQLC:
				// This operation expects that both histograms are compacted.
				return 0, hlhs, hlhs.Equals(hrhs), nil
			case parser.NEQ:
				// This operation expects that both histograms are compacted.
				return 0, hlhs, !hlhs.Equals(hrhs), nil
			case parser.MUL, parser.DIV, parser.POW, parser.MOD, parser.GTR, parser.LSS, parser.GTE, parser.LTE, parser.ATAN2:
				return 0, nil, false, annotations.NewIncompatibleTypesInBinOpInfo("histogram", opName, "histogram", pos)
			}
		}
	}
	panic(fmt.Errorf("operator %q not allowed for operations between Vectors", op))
}

type groupedAggregation struct {
	floatValue     float64
	histogramValue *histogram.FloatHistogram
	floatMean      float64
	floatKahanC    float64 // "Compensating value" for Kahan summation.
	groupCount     float64
	heap           vectorByValueHeap

	// All bools together for better packing within the struct.
	seen                   bool // Was this output groups seen in the input at this timestamp.
	hasFloat               bool // Has at least 1 float64 sample aggregated.
	hasHistogram           bool // Has at least 1 histogram sample aggregated.
	incompatibleHistograms bool // If true, group has seen mixed exponential and custom buckets, or incompatible custom buckets.
	groupAggrComplete      bool // Used by LIMITK to short-cut series loop when we've reached K elem on every group.
	incrementalMean        bool // True after reverting to incremental calculation of the mean value.
}

// aggregation evaluates sum, avg, count, stdvar, stddev or quantile at one timestep on inputMatrix.
// These functions produce one output series for each group specified in the expression, with just the labels from `by(...)`.
// outputMatrix should be already populated with grouping labels; groups is one-to-one with outputMatrix.
// seriesToResult maps inputMatrix indexes to outputMatrix indexes.
func (ev *evaluator) aggregation(e *parser.AggregateExpr, q float64, inputMatrix, outputMatrix Matrix, seriesToResult []int, groups []groupedAggregation, enh *EvalNodeHelper) annotations.Annotations {
	op := e.Op
	var annos annotations.Annotations
	for i := range groups {
		groups[i].seen = false
	}

	for si := range inputMatrix {
		f, h, ok := ev.nextValues(enh.Ts, &inputMatrix[si])
		if !ok {
			continue
		}

		group := &groups[seriesToResult[si]]
		// Initialize this group if it's the first time we've seen it.
		if !group.seen {
			*group = groupedAggregation{
				seen:                   true,
				floatValue:             f,
				floatMean:              f,
				incompatibleHistograms: false,
				groupCount:             1,
			}
			switch op {
			case parser.AVG, parser.SUM:
				if h == nil {
					group.hasFloat = true
				} else {
					group.histogramValue = h.Copy()
					group.hasHistogram = true
				}
			case parser.STDVAR, parser.STDDEV:
				switch {
				case h != nil:
					// Ignore histograms for STDVAR and STDDEV.
					group.seen = false
					if op == parser.STDVAR {
						annos.Add(annotations.NewHistogramIgnoredInAggregationInfo("stdvar", e.Expr.PositionRange()))
					} else {
						annos.Add(annotations.NewHistogramIgnoredInAggregationInfo("stddev", e.Expr.PositionRange()))
					}
				case math.IsNaN(f), math.IsInf(f, 0):
					group.floatValue = math.NaN()
				default:
					group.floatValue = 0
				}
			case parser.QUANTILE:
				if h != nil {
					group.seen = false
					annos.Add(annotations.NewHistogramIgnoredInAggregationInfo("quantile", e.Expr.PositionRange()))
				}
				group.heap = make(vectorByValueHeap, 1)
				group.heap[0] = Sample{F: f}
			case parser.GROUP:
				group.floatValue = 1
			case parser.MIN, parser.MAX:
				if h != nil {
					group.seen = false
					if op == parser.MIN {
						annos.Add(annotations.NewHistogramIgnoredInAggregationInfo("min", e.Expr.PositionRange()))
					} else {
						annos.Add(annotations.NewHistogramIgnoredInAggregationInfo("max", e.Expr.PositionRange()))
					}
				}
			}
			continue
		}

		if group.incompatibleHistograms {
			continue
		}

		switch op {
		case parser.SUM:
			if h != nil {
				group.hasHistogram = true
				if group.histogramValue != nil {
					_, err := group.histogramValue.Add(h)
					if err != nil {
						handleAggregationError(err, e, inputMatrix[si].Metric.Get(model.MetricNameLabel), &annos)
						group.incompatibleHistograms = true
					}
				}
				// Otherwise the aggregation contained floats
				// previously and will be invalid anyway. No
				// point in copying the histogram in that case.
			} else {
				group.hasFloat = true
				group.floatValue, group.floatKahanC = kahanSumInc(f, group.floatValue, group.floatKahanC)
			}

		case parser.AVG:
			group.groupCount++
			if h != nil {
				group.hasHistogram = true
				if group.histogramValue != nil {
					left := h.Copy().Div(group.groupCount)
					right := group.histogramValue.Copy().Div(group.groupCount)
					toAdd, err := left.Sub(right)
					if err != nil {
						handleAggregationError(err, e, inputMatrix[si].Metric.Get(model.MetricNameLabel), &annos)
						group.incompatibleHistograms = true
						continue
					}
					_, err = group.histogramValue.Add(toAdd)
					if err != nil {
						handleAggregationError(err, e, inputMatrix[si].Metric.Get(model.MetricNameLabel), &annos)
						group.incompatibleHistograms = true
						continue
					}
				}
				// Otherwise the aggregation contained floats
				// previously and will be invalid anyway. No
				// point in copying the histogram in that case.
			} else {
				group.hasFloat = true
				if !group.incrementalMean {
					newV, newC := kahanSumInc(f, group.floatValue, group.floatKahanC)
					if !math.IsInf(newV, 0) {
						// The sum doesn't overflow, so we propagate it to the
						// group struct and continue with the regular
						// calculation of the mean value.
						group.floatValue, group.floatKahanC = newV, newC
						break
					}
					// If we are here, we know that the sum _would_ overflow. So
					// instead of continue to sum up, we revert to incremental
					// calculation of the mean value from here on.
					group.incrementalMean = true
					group.floatMean = group.floatValue / (group.groupCount - 1)
					group.floatKahanC /= group.groupCount - 1
				}
				if math.IsInf(group.floatMean, 0) {
					if math.IsInf(f, 0) && (group.floatMean > 0) == (f > 0) {
						// The `floatMean` and `s.F` values are `Inf` of the same sign.  They
						// can't be subtracted, but the value of `floatMean` is correct
						// already.
						break
					}
					if !math.IsInf(f, 0) && !math.IsNaN(f) {
						// At this stage, the mean is an infinite. If the added
						// value is neither an Inf or a Nan, we can keep that mean
						// value.
						// This is required because our calculation below removes
						// the mean value, which would look like Inf += x - Inf and
						// end up as a NaN.
						break
					}
				}
				currentMean := group.floatMean + group.floatKahanC
				group.floatMean, group.floatKahanC = kahanSumInc(
					// Divide each side of the `-` by `group.groupCount` to avoid float64 overflows.
					f/group.groupCount-currentMean/group.groupCount,
					group.floatMean,
					group.floatKahanC,
				)
			}

		case parser.GROUP:
			// Do nothing. Required to avoid the panic in `default:` below.

		case parser.MAX:
			if h != nil {
				annos.Add(annotations.NewHistogramIgnoredInAggregationInfo("max", e.Expr.PositionRange()))
				continue
			}
			if group.floatValue < f || math.IsNaN(group.floatValue) {
				group.floatValue = f
			}

		case parser.MIN:
			if h != nil {
				annos.Add(annotations.NewHistogramIgnoredInAggregationInfo("min", e.Expr.PositionRange()))
				continue
			}
			if group.floatValue > f || math.IsNaN(group.floatValue) {
				group.floatValue = f
			}

		case parser.COUNT:
			group.groupCount++

		case parser.STDVAR, parser.STDDEV:
			if h == nil { // Ignore native histograms.
				group.groupCount++
				delta := f - group.floatMean
				group.floatMean += delta / group.groupCount
				group.floatValue += delta * (f - group.floatMean)
			} else {
				if op == parser.STDVAR {
					annos.Add(annotations.NewHistogramIgnoredInAggregationInfo("stdvar", e.Expr.PositionRange()))
				} else {
					annos.Add(annotations.NewHistogramIgnoredInAggregationInfo("stddev", e.Expr.PositionRange()))
				}
			}

		case parser.QUANTILE:
			if h != nil {
				annos.Add(annotations.NewHistogramIgnoredInAggregationInfo("quantile", e.Expr.PositionRange()))
				continue
			}
			group.heap = append(group.heap, Sample{F: f})

		default:
			panic(fmt.Errorf("expected aggregation operator but got %q", op))
		}
	}

	// Construct the output matrix from the aggregated groups.
	numSteps := int((ev.endTimestamp-ev.startTimestamp)/ev.interval) + 1

	for ri, aggr := range groups {
		if !aggr.seen {
			continue
		}
		switch op {
		case parser.AVG:
			if aggr.hasFloat && aggr.hasHistogram {
				// We cannot aggregate histogram sample with a float64 sample.
				annos.Add(annotations.NewMixedFloatsHistogramsAggWarning(e.Expr.PositionRange()))
				continue
			}
			switch {
			case aggr.incompatibleHistograms:
				continue
			case aggr.hasHistogram:
				aggr.histogramValue = aggr.histogramValue.Compact(0)
			case aggr.incrementalMean:
				aggr.floatValue = aggr.floatMean + aggr.floatKahanC
			default:
				aggr.floatValue = (aggr.floatValue + aggr.floatKahanC) / aggr.groupCount
			}

		case parser.COUNT:
			aggr.floatValue = aggr.groupCount

		case parser.STDVAR:
			aggr.floatValue /= aggr.groupCount

		case parser.STDDEV:
			aggr.floatValue = math.Sqrt(aggr.floatValue / aggr.groupCount)

		case parser.QUANTILE:
			aggr.floatValue = quantile(q, aggr.heap)

		case parser.SUM:
			if aggr.hasFloat && aggr.hasHistogram {
				// We cannot aggregate histogram sample with a float64 sample.
				annos.Add(annotations.NewMixedFloatsHistogramsAggWarning(e.Expr.PositionRange()))
				continue
			}
			switch {
			case aggr.incompatibleHistograms:
				continue
			case aggr.hasHistogram:
				aggr.histogramValue.Compact(0)
			default:
				aggr.floatValue += aggr.floatKahanC
			}
		default:
			// For other aggregations, we already have the right value.
		}

		ss := &outputMatrix[ri]
		addToSeries(ss, enh.Ts, aggr.floatValue, aggr.histogramValue, numSteps)
		ss.DropName = inputMatrix[ri].DropName
	}

	return annos
}

// aggregationK evaluates topk, bottomk, limitk, or limit_ratio at one timestep on inputMatrix.
// Output that has the same labels as the input, but just k of them per group.
// seriesToResult maps inputMatrix indexes to groups indexes.
// For an instant query, returns a Matrix in descending order for topk or ascending for bottomk, or without any order for limitk / limit_ratio.
// For a range query, aggregates output in the seriess map.
func (ev *evaluator) aggregationK(e *parser.AggregateExpr, k int64, r float64, inputMatrix Matrix, seriesToResult []int, groups []groupedAggregation, enh *EvalNodeHelper, seriess map[uint64]Series) (Matrix, annotations.Annotations) {
	op := e.Op
	var s Sample
	var annos annotations.Annotations
	// Used to short-cut the loop for LIMITK if we already collected k elements for every group
	groupsRemaining := len(groups)
	for i := range groups {
		groups[i].seen = false
	}

seriesLoop:
	for si := range inputMatrix {
		f, h, ok := ev.nextValues(enh.Ts, &inputMatrix[si])
		if !ok {
			continue
		}
		s = Sample{Metric: inputMatrix[si].Metric, F: f, H: h, DropName: inputMatrix[si].DropName}

		group := &groups[seriesToResult[si]]
		// Initialize this group if it's the first time we've seen it.
		if !group.seen {
			// LIMIT_RATIO is a special case, as we may not add this very sample to the heap,
			// while we also don't know the final size of it.
			switch op {
			case parser.LIMIT_RATIO:
				*group = groupedAggregation{
					seen: true,
					heap: make(vectorByValueHeap, 0),
				}
				if ratiosampler.AddRatioSample(r, &s) {
					heap.Push(&group.heap, &s)
				}
			case parser.LIMITK:
				*group = groupedAggregation{
					seen: true,
					heap: make(vectorByValueHeap, 1, k),
				}
				group.heap[0] = s
			case parser.TOPK:
				*group = groupedAggregation{
					seen: true,
					heap: make(vectorByValueHeap, 0, k),
				}
				if s.H != nil {
					group.seen = false
					annos.Add(annotations.NewHistogramIgnoredInAggregationInfo("topk", e.PosRange))
				} else {
					heap.Push(&group.heap, &s)
				}
			case parser.BOTTOMK:
				*group = groupedAggregation{
					seen: true,
					heap: make(vectorByValueHeap, 0, k),
				}
				if s.H != nil {
					group.seen = false
					annos.Add(annotations.NewHistogramIgnoredInAggregationInfo("bottomk", e.PosRange))
				} else {
					heap.Push(&group.heap, &s)
				}
			}
			continue
		}

		switch op {
		case parser.TOPK:
			// We build a heap of up to k elements, with the smallest element at heap[0].
			switch {
			case s.H != nil:
				// Ignore histogram sample and add info annotation.
				annos.Add(annotations.NewHistogramIgnoredInAggregationInfo("topk", e.PosRange))
			case int64(len(group.heap)) < k:
				heap.Push(&group.heap, &s)
			case group.heap[0].F < s.F || (math.IsNaN(group.heap[0].F) && !math.IsNaN(s.F)):
				// This new element is bigger than the previous smallest element - overwrite that.
				group.heap[0] = s
				if k > 1 {
					heap.Fix(&group.heap, 0) // Maintain the heap invariant.
				}
			}

		case parser.BOTTOMK:
			// We build a heap of up to k elements, with the biggest element at heap[0].
			switch {
			case s.H != nil:
				// Ignore histogram sample and add info annotation.
				annos.Add(annotations.NewHistogramIgnoredInAggregationInfo("bottomk", e.PosRange))
			case int64(len(group.heap)) < k:
				heap.Push((*vectorByReverseValueHeap)(&group.heap), &s)
			case group.heap[0].F > s.F || (math.IsNaN(group.heap[0].F) && !math.IsNaN(s.F)):
				// This new element is smaller than the previous biggest element - overwrite that.
				group.heap[0] = s
				if k > 1 {
					heap.Fix((*vectorByReverseValueHeap)(&group.heap), 0) // Maintain the heap invariant.
				}
			}

		case parser.LIMITK:
			if int64(len(group.heap)) < k {
				heap.Push(&group.heap, &s)
			}
			// LIMITK optimization: early break if we've added K elem to _every_ group,
			// especially useful for large timeseries where the user is exploring labels via e.g.
			// limitk(10, my_metric)
			if !group.groupAggrComplete && int64(len(group.heap)) == k {
				group.groupAggrComplete = true
				groupsRemaining--
				if groupsRemaining == 0 {
					break seriesLoop
				}
			}

		case parser.LIMIT_RATIO:
			if ratiosampler.AddRatioSample(r, &s) {
				heap.Push(&group.heap, &s)
			}

		default:
			panic(fmt.Errorf("expected aggregation operator but got %q", op))
		}
	}

	// Construct the result from the aggregated groups.
	numSteps := int((ev.endTimestamp-ev.startTimestamp)/ev.interval) + 1
	var mat Matrix
	if ev.endTimestamp == ev.startTimestamp {
		mat = make(Matrix, 0, len(groups))
	}

	add := func(lbls labels.Labels, f float64, h *histogram.FloatHistogram, dropName bool) {
		// If this could be an instant query, add directly to the matrix so the result is in consistent order.
		if ev.endTimestamp == ev.startTimestamp {
			if h != nil {
				mat = append(mat, Series{Metric: lbls, Histograms: []HPoint{{T: enh.Ts, H: h}}, DropName: dropName})
			} else {
				mat = append(mat, Series{Metric: lbls, Floats: []FPoint{{T: enh.Ts, F: f}}, DropName: dropName})
			}
		} else {
			// Otherwise the results are added into seriess elements.
			hash := lbls.Hash()
			ss, ok := seriess[hash]
			if !ok {
				ss = Series{Metric: lbls, DropName: dropName}
			}
			addToSeries(&ss, enh.Ts, f, h, numSteps)
			seriess[hash] = ss
		}
	}
	for _, aggr := range groups {
		if !aggr.seen {
			continue
		}
		switch op {
		case parser.TOPK:
			// The heap keeps the lowest value on top, so reverse it.
			if len(aggr.heap) > 1 {
				sort.Sort(sort.Reverse(aggr.heap))
			}
			for _, v := range aggr.heap {
				add(v.Metric, v.F, v.H, v.DropName)
			}

		case parser.BOTTOMK:
			// The heap keeps the highest value on top, so reverse it.
			if len(aggr.heap) > 1 {
				sort.Sort(sort.Reverse((*vectorByReverseValueHeap)(&aggr.heap)))
			}
			for _, v := range aggr.heap {
				add(v.Metric, v.F, v.H, v.DropName)
			}

		case parser.LIMITK, parser.LIMIT_RATIO:
			for _, v := range aggr.heap {
				add(v.Metric, v.F, v.H, v.DropName)
			}
		}
	}

	return mat, annos
}

// aggregationCountValues evaluates count_values on vec.
// Outputs as many series per group as there are values in the input.
func (ev *evaluator) aggregationCountValues(e *parser.AggregateExpr, grouping []string, valueLabel string, vec Vector, enh *EvalNodeHelper) (Vector, annotations.Annotations) {
	type groupCount struct {
		labels labels.Labels
		count  int
	}
	result := map[uint64]*groupCount{}

	var buf []byte
	for _, s := range vec {
		enh.resetBuilder(s.Metric)
		if s.H == nil {
			enh.lb.Set(valueLabel, strconv.FormatFloat(s.F, 'f', -1, 64))
		} else {
			enh.lb.Set(valueLabel, s.H.String())
		}
		metric := enh.lb.Labels()

		// Considering the count_values()
		// operator is less frequently used than other aggregations, we're fine having to
		// re-compute the grouping key on each step for this case.
		var groupingKey uint64
		groupingKey, buf = generateGroupingKey(metric, grouping, e.Without, buf)

		group, ok := result[groupingKey]
		// Add a new group if it doesn't exist.
		if !ok {
			result[groupingKey] = &groupCount{
				labels: generateGroupingLabels(enh, metric, e.Without, grouping),
				count:  1,
			}
			continue
		}

		group.count++
	}

	// Construct the result Vector from the aggregated groups.
	for _, aggr := range result {
		enh.Out = append(enh.Out, Sample{
			Metric: aggr.labels,
			F:      float64(aggr.count),
		})
	}
	return enh.Out, nil
}

func (ev *evaluator) cleanupMetricLabels(v parser.Value) {
	if v.Type() == parser.ValueTypeMatrix {
		mat := v.(Matrix)
		for i := range mat {
			if mat[i].DropName {
				mat[i].Metric = mat[i].Metric.DropMetricName()
			}
		}
		if mat.ContainsSameLabelset() {
			ev.errorf("vector cannot contain metrics with the same labelset")
		}
	} else if v.Type() == parser.ValueTypeVector {
		vec := v.(Vector)
		for i := range vec {
			if vec[i].DropName {
				vec[i].Metric = vec[i].Metric.DropMetricName()
			}
		}
		if vec.ContainsSameLabelset() {
			ev.errorf("vector cannot contain metrics with the same labelset")
		}
	}
}

func addToSeries(ss *Series, ts int64, f float64, h *histogram.FloatHistogram, numSteps int) {
	if h == nil {
		if ss.Floats == nil {
			ss.Floats = getFPointSlice(numSteps)
		}
		ss.Floats = append(ss.Floats, FPoint{T: ts, F: f})
		return
	}
	if ss.Histograms == nil {
		ss.Histograms = getHPointSlice(numSteps)
	}
	ss.Histograms = append(ss.Histograms, HPoint{T: ts, H: h})
}

func (ev *evaluator) nextValues(ts int64, series *Series) (f float64, h *histogram.FloatHistogram, b bool) {
	switch {
	case len(series.Floats) > 0 && series.Floats[0].T == ts:
		f = series.Floats[0].F
		series.Floats = series.Floats[1:] // Move input vectors forward
	case len(series.Histograms) > 0 && series.Histograms[0].T == ts:
		h = series.Histograms[0].H
		series.Histograms = series.Histograms[1:]
	default:
		return f, h, false
	}
	return f, h, true
}

// handleAggregationError adds the appropriate annotation based on the aggregation error.
func handleAggregationError(err error, e *parser.AggregateExpr, metricName string, annos *annotations.Annotations) {
	pos := e.Expr.PositionRange()
	if errors.Is(err, histogram.ErrHistogramsIncompatibleSchema) {
		annos.Add(annotations.NewMixedExponentialCustomHistogramsWarning(metricName, pos))
	} else if errors.Is(err, histogram.ErrHistogramsIncompatibleBounds) {
		annos.Add(annotations.NewIncompatibleCustomBucketsHistogramsWarning(metricName, pos))
	}
}

// handleVectorBinopError returns the appropriate annotation based on the vector binary operation error.
func handleVectorBinopError(err error, e *parser.BinaryExpr) annotations.Annotations {
	if err == nil {
		return nil
	}
	op := parser.ItemTypeStr[e.Op]
	pos := e.PositionRange()
	if errors.Is(err, annotations.PromQLInfo) || errors.Is(err, annotations.PromQLWarning) {
		return annotations.New().Add(err)
	}
	// TODO(NeerajGartia21): Test the exact annotation output once the testing framework can do so.
	if errors.Is(err, histogram.ErrHistogramsIncompatibleSchema) || errors.Is(err, histogram.ErrHistogramsIncompatibleBounds) {
		return annotations.New().Add(annotations.NewIncompatibleBucketLayoutInBinOpWarning(op, pos))
	}
	return nil
}

// generateGroupingKey builds and returns the grouping key for the given metric and
// grouping labels.
func generateGroupingKey(metric labels.Labels, grouping []string, without bool, buf []byte) (uint64, []byte) {
	if without {
		return metric.HashWithoutLabels(buf, grouping...)
	}

	if len(grouping) == 0 {
		// No need to generate any hash if there are no grouping labels.
		return 0, buf
	}

	return metric.HashForLabels(buf, grouping...)
}

func generateGroupingLabels(enh *EvalNodeHelper, metric labels.Labels, without bool, grouping []string) labels.Labels {
	enh.resetBuilder(metric)
	switch {
	case without:
		enh.lb.Del(grouping...)
		enh.lb.Del(labels.MetricName)
		return enh.lb.Labels()
	case len(grouping) > 0:
		enh.lb.Keep(grouping...)
		return enh.lb.Labels()
	default:
		return labels.EmptyLabels()
	}
}

// btos returns 1 if b is true, 0 otherwise.
func btos(b bool) float64 {
	if b {
		return 1
	}
	return 0
}

// shouldDropMetricName returns whether the metric name should be dropped in the
// result of the op operation.
func shouldDropMetricName(op parser.ItemType) bool {
	switch op {
	case parser.ADD, parser.SUB, parser.DIV, parser.MUL, parser.POW, parser.MOD, parser.ATAN2:
		return true
	default:
		return false
	}
}

// NewOriginContext returns a new context with data about the origin attached.
func NewOriginContext(ctx context.Context, data map[string]interface{}) context.Context {
	return context.WithValue(ctx, QueryOrigin{}, data)
}

func formatDate(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z07:00")
}

// unwrapParenExpr does the AST equivalent of removing parentheses around a expression.
func unwrapParenExpr(e *parser.Expr) {
	for {
		p, ok := (*e).(*parser.ParenExpr)
		if !ok {
			break
		}
		*e = p.Expr
	}
}

func unwrapStepInvariantExpr(e parser.Expr) parser.Expr {
	if p, ok := e.(*parser.StepInvariantExpr); ok {
		return p.Expr
	}
	return e
}

// PreprocessExpr wraps all possible step invariant parts of the given expression with
// StepInvariantExpr. It also resolves the preprocessors.
func PreprocessExpr(expr parser.Expr, start, end time.Time) parser.Expr {
	detectHistogramStatsDecoding(expr)

	isStepInvariant := preprocessExprHelper(expr, start, end)
	if isStepInvariant {
		return newStepInvariantExpr(expr)
	}
	return expr
}

// preprocessExprHelper wraps the child nodes of the expression
// with a StepInvariantExpr wherever it's step invariant. The returned boolean is true if the
// passed expression qualifies to be wrapped by StepInvariantExpr.
// It also resolves the preprocessors.
func preprocessExprHelper(expr parser.Expr, start, end time.Time) bool {
	switch n := expr.(type) {
	case *parser.VectorSelector:
		switch n.StartOrEnd {
		case parser.START:
			n.Timestamp = makeInt64Pointer(timestamp.FromTime(start))
		case parser.END:
			n.Timestamp = makeInt64Pointer(timestamp.FromTime(end))
		}
		return n.Timestamp != nil

	case *parser.AggregateExpr:
		return preprocessExprHelper(n.Expr, start, end)

	case *parser.BinaryExpr:
		isInvariant1, isInvariant2 := preprocessExprHelper(n.LHS, start, end), preprocessExprHelper(n.RHS, start, end)
		if isInvariant1 && isInvariant2 {
			return true
		}

		if isInvariant1 {
			n.LHS = newStepInvariantExpr(n.LHS)
		}
		if isInvariant2 {
			n.RHS = newStepInvariantExpr(n.RHS)
		}

		return false

	case *parser.Call:
		_, ok := AtModifierUnsafeFunctions[n.Func.Name]
		isStepInvariant := !ok
		isStepInvariantSlice := make([]bool, len(n.Args))
		for i := range n.Args {
			isStepInvariantSlice[i] = preprocessExprHelper(n.Args[i], start, end)
			isStepInvariant = isStepInvariant && isStepInvariantSlice[i]
		}

		if isStepInvariant {
			// The function and all arguments are step invariant.
			return true
		}

		for i, isi := range isStepInvariantSlice {
			if isi {
				n.Args[i] = newStepInvariantExpr(n.Args[i])
			}
		}
		return false

	case *parser.MatrixSelector:
		return preprocessExprHelper(n.VectorSelector, start, end)

	case *parser.SubqueryExpr:
		// Since we adjust offset for the @ modifier evaluation,
		// it gets tricky to adjust it for every subquery step.
		// Hence we wrap the inside of subquery irrespective of
		// @ on subquery (given it is also step invariant) so that
		// it is evaluated only once w.r.t. the start time of subquery.
		isInvariant := preprocessExprHelper(n.Expr, start, end)
		if isInvariant {
			n.Expr = newStepInvariantExpr(n.Expr)
		}
		switch n.StartOrEnd {
		case parser.START:
			n.Timestamp = makeInt64Pointer(timestamp.FromTime(start))
		case parser.END:
			n.Timestamp = makeInt64Pointer(timestamp.FromTime(end))
		}
		return n.Timestamp != nil

	case *parser.ParenExpr:
		return preprocessExprHelper(n.Expr, start, end)

	case *parser.UnaryExpr:
		return preprocessExprHelper(n.Expr, start, end)

	case *parser.StringLiteral, *parser.NumberLiteral:
		return true
	}

	panic(fmt.Sprintf("found unexpected node %#v", expr))
}

func newStepInvariantExpr(expr parser.Expr) parser.Expr {
	return &parser.StepInvariantExpr{Expr: expr}
}

// setOffsetForAtModifier modifies the offset of vector and matrix selector
// and subquery in the tree to accommodate the timestamp of @ modifier.
// The offset is adjusted w.r.t. the given evaluation time.
func setOffsetForAtModifier(evalTime int64, expr parser.Expr) {
	getOffset := func(ts *int64, originalOffset time.Duration, path []parser.Node) time.Duration {
		if ts == nil {
			return originalOffset
		}

		subqOffset, _, subqTs := subqueryTimes(path)
		if subqTs != nil {
			subqOffset += time.Duration(evalTime-*subqTs) * time.Millisecond
		}

		offsetForTs := time.Duration(evalTime-*ts) * time.Millisecond
		offsetDiff := offsetForTs - subqOffset
		return originalOffset + offsetDiff
	}

	parser.Inspect(expr, func(node parser.Node, path []parser.Node) error {
		switch n := node.(type) {
		case *parser.VectorSelector:
			n.Offset = getOffset(n.Timestamp, n.OriginalOffset, path)

		case *parser.MatrixSelector:
			vs := n.VectorSelector.(*parser.VectorSelector)
			vs.Offset = getOffset(vs.Timestamp, vs.OriginalOffset, path)

		case *parser.SubqueryExpr:
			n.Offset = getOffset(n.Timestamp, n.OriginalOffset, path)
		}
		return nil
	})
}

// detectHistogramStatsDecoding modifies the expression by setting the
// SkipHistogramBuckets field in those vector selectors for which it is safe to
// return only histogram statistics (sum and count), excluding histogram spans
// and buckets. The function can be treated as an optimization and is not
// required for correctness.
func detectHistogramStatsDecoding(expr parser.Expr) {
	parser.Inspect(expr, func(node parser.Node, path []parser.Node) error {
		if n, ok := node.(*parser.BinaryExpr); ok {
			detectHistogramStatsDecoding(n.LHS)
			detectHistogramStatsDecoding(n.RHS)
			return errors.New("stop")
		}

		n, ok := (node).(*parser.VectorSelector)
		if !ok {
			return nil
		}

		for _, p := range path {
			call, ok := p.(*parser.Call)
			if !ok {
				continue
			}
			switch call.Func.Name {
			case "histogram_count", "histogram_sum", "histogram_avg":
				n.SkipHistogramBuckets = true
			case "histogram_quantile", "histogram_fraction":
				n.SkipHistogramBuckets = false
			default:
				continue
			}
			break
		}
		return errors.New("stop")
	})
}

func makeInt64Pointer(val int64) *int64 {
	valp := new(int64)
	*valp = val
	return valp
}

// RatioSampler allows unit-testing (previously: Randomizer).
type RatioSampler interface {
	// Return this sample "offset" between [0.0, 1.0]
	sampleOffset(ts int64, sample *Sample) float64
	AddRatioSample(r float64, sample *Sample) bool
}

// HashRatioSampler uses Hash(labels.String()) / maxUint64 as a "deterministic"
// value in [0.0, 1.0].
type HashRatioSampler struct{}

var ratiosampler RatioSampler = NewHashRatioSampler()

func NewHashRatioSampler() *HashRatioSampler {
	return &HashRatioSampler{}
}

func (s *HashRatioSampler) sampleOffset(_ int64, sample *Sample) float64 {
	const (
		float64MaxUint64 = float64(math.MaxUint64)
	)
	return float64(sample.Metric.Hash()) / float64MaxUint64
}

func (s *HashRatioSampler) AddRatioSample(ratioLimit float64, sample *Sample) bool {
	// If ratioLimit >= 0: add sample if sampleOffset is lesser than ratioLimit
	//
	// 0.0        ratioLimit                1.0
	//  [---------|--------------------------]
	//  [#########...........................]
	//
	// e.g.:
	//   sampleOffset==0.3 && ratioLimit==0.4
	//     0.3 < 0.4 ? --> add sample
	//
	// Else if ratioLimit < 0: add sample if rand() return the "complement" of ratioLimit>=0 case
	// (loosely similar behavior to negative array index in other programming languages)
	//
	// 0.0       1+ratioLimit               1.0
	//  [---------|--------------------------]
	//  [.........###########################]
	//
	// e.g.:
	//   sampleOffset==0.3 && ratioLimit==-0.6
	//     0.3 >= 0.4 ? --> don't add sample
	sampleOffset := s.sampleOffset(sample.T, sample)
	return (ratioLimit >= 0 && sampleOffset < ratioLimit) ||
		(ratioLimit < 0 && sampleOffset >= (1.0+ratioLimit))
}

type histogramStatsSeries struct {
	storage.Series
}

func newHistogramStatsSeries(series storage.Series) *histogramStatsSeries {
	return &histogramStatsSeries{Series: series}
}

func (s histogramStatsSeries) Iterator(it chunkenc.Iterator) chunkenc.Iterator {
	return NewHistogramStatsIterator(s.Series.Iterator(it))
}

// gatherVector gathers a Vector for ts from the series in input.
// output is used as a buffer.
// If bufHelpers and seriesHelpers are provided, seriesHelpers[i] is appended to bufHelpers for every input index i.
// The gathered Vector and bufHelper are returned.
func (ev *evaluator) gatherVector(ts int64, input Matrix, output Vector, bufHelpers, seriesHelpers []EvalSeriesHelper) (Vector, []EvalSeriesHelper) {
	output = output[:0]
	for i, series := range input {
		switch {
		case len(series.Floats) > 0 && series.Floats[0].T == ts:
			s := series.Floats[0]
			output = append(output, Sample{Metric: series.Metric, F: s.F, T: ts, DropName: series.DropName})
			// Move input vectors forward so we don't have to re-scan the same
			// past points at the next step.
			input[i].Floats = series.Floats[1:]
		case len(series.Histograms) > 0 && series.Histograms[0].T == ts:
			s := series.Histograms[0]
			output = append(output, Sample{Metric: series.Metric, H: s.H, T: ts, DropName: series.DropName})
			input[i].Histograms = series.Histograms[1:]
		default:
			continue
		}
		if len(seriesHelpers) > 0 {
			bufHelpers = append(bufHelpers, seriesHelpers[i])
		}

		// Don't add histogram size here because we only
		// copy the pointer above, not the whole
		// histogram.
		ev.currentSamples++
		if ev.currentSamples > ev.maxSamples {
			ev.error(ErrTooManySamples(env))
		}
	}
	ev.samplesStats.UpdatePeak(ev.currentSamples)

	return output, bufHelpers
}
