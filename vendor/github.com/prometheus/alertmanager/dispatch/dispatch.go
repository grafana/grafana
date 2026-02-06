// Copyright 2018 Prometheus Team
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

package dispatch

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/provider"
	"github.com/prometheus/alertmanager/store"
	"github.com/prometheus/alertmanager/types"
)

var tracer = otel.Tracer("github.com/prometheus/alertmanager/dispatch")

// DispatcherMetrics represents metrics associated to a dispatcher.
type DispatcherMetrics struct {
	aggrGroups            prometheus.Gauge
	processingDuration    prometheus.Summary
	aggrGroupLimitReached prometheus.Counter
}

// NewDispatcherMetrics returns a new registered DispatchMetrics.
func NewDispatcherMetrics(registerLimitMetrics bool, r prometheus.Registerer) *DispatcherMetrics {
	m := DispatcherMetrics{
		aggrGroups: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "alertmanager_dispatcher_aggregation_groups",
				Help: "Number of active aggregation groups",
			},
		),
		processingDuration: prometheus.NewSummary(
			prometheus.SummaryOpts{
				Name: "alertmanager_dispatcher_alert_processing_duration_seconds",
				Help: "Summary of latencies for the processing of alerts.",
			},
		),
		aggrGroupLimitReached: prometheus.NewCounter(
			prometheus.CounterOpts{
				Name: "alertmanager_dispatcher_aggregation_group_limit_reached_total",
				Help: "Number of times when dispatcher failed to create new aggregation group due to limit.",
			},
		),
	}

	if r != nil {
		r.MustRegister(m.aggrGroups, m.processingDuration)
		if registerLimitMetrics {
			r.MustRegister(m.aggrGroupLimitReached)
		}
	}

	return &m
}

// Dispatcher sorts incoming alerts into aggregation groups and
// assigns the correct notifiers to each.
type Dispatcher struct {
	route   *Route
	alerts  provider.Alerts
	stage   notify.Stage
	metrics *DispatcherMetrics
	limits  Limits

	timeout func(time.Duration) time.Duration

	mtx                sync.RWMutex
	aggrGroupsPerRoute map[*Route]map[model.Fingerprint]*aggrGroup
	aggrGroupsNum      int

	done   chan struct{}
	ctx    context.Context
	cancel func()

	logger log.Logger

	timerFactory TimerFactory
}

// Limits describes limits used by Dispatcher.
type Limits interface {
	// MaxNumberOfAggregationGroups returns max number of aggregation groups that dispatcher can have.
	// 0 or negative value = unlimited.
	// If dispatcher hits this limit, it will not create additional groups, but will log an error instead.
	MaxNumberOfAggregationGroups() int
}

// NewDispatcher returns a new Dispatcher.
func NewDispatcher(
	ap provider.Alerts,
	r *Route,
	s notify.Stage,
	mk types.Marker,
	to func(time.Duration) time.Duration,
	lim Limits,
	l log.Logger,
	m *DispatcherMetrics,
	timerFactory TimerFactory,
) *Dispatcher {
	if lim == nil {
		lim = nilLimits{}
	}

	if timerFactory == nil {
		timerFactory = standardTimerFactory
	}

	disp := &Dispatcher{
		alerts:       ap,
		stage:        s,
		route:        r,
		timeout:      to,
		logger:       log.With(l, "component", "dispatcher"),
		metrics:      m,
		limits:       lim,
		timerFactory: timerFactory,
	}
	return disp
}

// Run starts dispatching alerts incoming via the updates channel.
func (d *Dispatcher) Run() {
	d.done = make(chan struct{})

	d.mtx.Lock()
	d.aggrGroupsPerRoute = map[*Route]map[model.Fingerprint]*aggrGroup{}
	d.aggrGroupsNum = 0
	d.metrics.aggrGroups.Set(0)
	d.ctx, d.cancel = context.WithCancel(context.Background())
	d.mtx.Unlock()

	d.run(d.alerts.Subscribe())
	close(d.done)
}

func (d *Dispatcher) run(it provider.AlertIterator) {
	cleanup := time.NewTicker(30 * time.Second)
	defer cleanup.Stop()

	defer it.Close()

	for {
		select {
		case alert, ok := <-it.Next():
			if !ok {
				// Iterator exhausted for some reason.
				if err := it.Err(); err != nil {
					level.Error(d.logger).Log("msg", "Error on alert update", "err", err)
				}
				return
			}

			// this block is wrapped in a function to make sure that the span
			// is ended before the next alert is processed
			func() {
				traceCtx, span := tracer.Start(d.ctx, "dispatch.Dispatcher.handleAlert",
					trace.WithAttributes(
						attribute.String("alert.name", alert.Name()),
						attribute.String("alert.fingerprint", alert.Fingerprint().String()),
						attribute.String("alert.status", string(alert.Status())),
						attribute.String("receiver", d.route.RouteOpts.Receiver),
					),
					// we'll use producer here since the alert is not processed
					// synchronously
					trace.WithSpanKind(trace.SpanKindProducer),
				)
				defer span.End()

				// make a link to this span - we can't make the processAlert
				// span a child of this, because it would make it long-lived
				dispatchLink := trace.LinkFromContext(traceCtx)

				level.Debug(d.logger).Log("msg", "Received alert", "alert", alert)

				// Log errors but keep trying.
				if err := it.Err(); err != nil {
					level.Error(d.logger).Log("msg", "Error on alert update", "err", err)

					span.RecordError(fmt.Errorf("error on alert update: %w", err))
					span.SetStatus(codes.Error, err.Error())

					return
				}

				now := time.Now()
				for _, r := range d.route.Match(alert.Labels) {
					d.processAlert(dispatchLink, alert, r)
				}
				d.metrics.processingDuration.Observe(time.Since(now).Seconds())
			}()
		case <-cleanup.C:
			d.mtx.Lock()

			for _, groups := range d.aggrGroupsPerRoute {
				for _, ag := range groups {
					if ag.empty() {
						ag.stop()
						delete(groups, ag.fingerprint())
						d.aggrGroupsNum--
						d.metrics.aggrGroups.Dec()
					}
				}
			}

			d.mtx.Unlock()

		case <-d.ctx.Done():
			return
		}
	}
}

// AlertGroup represents how alerts exist within an aggrGroup.
type AlertGroup struct {
	Alerts   types.AlertSlice
	Labels   model.LabelSet
	Receiver string
}

type AlertGroups []*AlertGroup

func (ag AlertGroups) Swap(i, j int) { ag[i], ag[j] = ag[j], ag[i] }
func (ag AlertGroups) Less(i, j int) bool {
	if ag[i].Labels.Equal(ag[j].Labels) {
		return ag[i].Receiver < ag[j].Receiver
	}
	return ag[i].Labels.Before(ag[j].Labels)
}
func (ag AlertGroups) Len() int { return len(ag) }

// Groups returns a slice of AlertGroups from the dispatcher's internal state.
func (d *Dispatcher) Groups(routeFilter func(*Route) bool, alertFilter func(*types.Alert, time.Time) bool) (AlertGroups, map[model.Fingerprint][]string) {
	groups := AlertGroups{}

	d.mtx.RLock()
	defer d.mtx.RUnlock()

	// Keep a list of receivers for an alert to prevent checking each alert
	// again against all routes. The alert has already matched against this
	// route on ingestion.
	receivers := map[model.Fingerprint][]string{}

	now := time.Now()
	for route, ags := range d.aggrGroupsPerRoute {
		if !routeFilter(route) {
			continue
		}

		for _, ag := range ags {
			receiver := route.RouteOpts.Receiver
			alertGroup := &AlertGroup{
				Labels:   ag.labels,
				Receiver: receiver,
			}

			alerts := ag.alerts.List()
			filteredAlerts := make([]*types.Alert, 0, len(alerts))
			for _, a := range alerts {
				if !alertFilter(a, now) {
					continue
				}

				fp := a.Fingerprint()
				if r, ok := receivers[fp]; ok {
					// Receivers slice already exists. Add
					// the current receiver to the slice.
					receivers[fp] = append(r, receiver)
				} else {
					// First time we've seen this alert fingerprint.
					// Initialize a new receivers slice.
					receivers[fp] = []string{receiver}
				}

				filteredAlerts = append(filteredAlerts, a)
			}
			if len(filteredAlerts) == 0 {
				continue
			}
			alertGroup.Alerts = filteredAlerts

			groups = append(groups, alertGroup)
		}
	}
	sort.Sort(groups)
	for i := range groups {
		sort.Sort(groups[i].Alerts)
	}
	for i := range receivers {
		sort.Strings(receivers[i])
	}

	return groups, receivers
}

// Stop the dispatcher.
func (d *Dispatcher) Stop() {
	if d == nil {
		return
	}
	d.mtx.Lock()
	if d.cancel == nil {
		d.mtx.Unlock()
		return
	}
	d.cancel()
	d.cancel = nil
	d.mtx.Unlock()

	<-d.done
}

// notifyFunc is a function that performs notification for the alert
// with the given fingerprint. It aborts on context cancelation.
// Returns false iff notifying failed.
type notifyFunc func(context.Context, ...*types.Alert) bool

// processAlert determines in which aggregation group the alert falls
// and inserts it.
func (d *Dispatcher) processAlert(dispatchLink trace.Link, alert *types.Alert, route *Route) {
	groupLabels := getGroupLabels(alert, route)

	fp := groupLabels.Fingerprint()

	d.mtx.Lock()
	defer d.mtx.Unlock()

	routeGroups, ok := d.aggrGroupsPerRoute[route]
	if !ok {
		routeGroups = map[model.Fingerprint]*aggrGroup{}
		d.aggrGroupsPerRoute[route] = routeGroups
	}

	ag, ok := routeGroups[fp]
	if ok {
		ag.insert(alert)
		return
	}

	// If the group does not exist, create it. But check the limit first.
	if limit := d.limits.MaxNumberOfAggregationGroups(); limit > 0 && d.aggrGroupsNum >= limit {
		d.metrics.aggrGroupLimitReached.Inc()
		level.Error(d.logger).Log("msg", "Too many aggregation groups, cannot create new group for alert", "groups", d.aggrGroupsNum, "limit", limit, "alert", alert.Name())
		return
	}

	ag = newAggrGroup(d.ctx, groupLabels, route, d.timeout, d.logger, d.timerFactory)
	routeGroups[fp] = ag
	d.aggrGroupsNum++
	d.metrics.aggrGroups.Inc()

	// Insert the 1st alert in the group before starting the group's run()
	// function, to make sure that when the run() will be executed the 1st
	// alert is already there.
	ag.insert(alert)

	go ag.run(func(ctx context.Context, alerts ...*types.Alert) bool {
		ctx, span := tracer.Start(ctx, "dispatch.Dispatch.notify",
			trace.WithAttributes(attribute.Int("alerts.count", len(alerts))),
			trace.WithLinks(dispatchLink),
			trace.WithSpanKind(trace.SpanKindConsumer),
		)
		defer span.End()

		pipelineTime, _ := notify.Now(ctx)
		l := log.With(d.logger, "pipeline_time", pipelineTime)

		_, _, err := d.stage.Exec(ctx, l, alerts...)
		if err != nil {
			lvl := level.Error(l)
			if errors.Is(ctx.Err(), context.Canceled) {
				// It is expected for the context to be canceled on
				// configuration reload or shutdown. In this case, the
				// message should only be logged at the debug level.
				lvl = level.Debug(l)
			} else {
				lvl = log.With(lvl, "aggrGroup", ag, "alerts", fmt.Sprintf("%v", alerts))
			}
			lvl.Log("msg", "Notify for alerts failed", "num_alerts", len(alerts), "err", err)

			span.RecordError(fmt.Errorf("notify for alerts failed: %w", err))
			span.SetStatus(codes.Error, err.Error())
		}
		return err == nil
	})
}

func getGroupLabels(alert *types.Alert, route *Route) model.LabelSet {
	groupLabels := model.LabelSet{}
	for ln, lv := range alert.Labels {
		if _, ok := route.RouteOpts.GroupBy[ln]; ok || route.RouteOpts.GroupByAll {
			groupLabels[ln] = lv
		}
	}

	return groupLabels
}

// aggrGroup aggregates alert fingerprints into groups to which a
// common set of routing options applies.
// It emits notifications in the specified intervals.
type aggrGroup struct {
	labels   model.LabelSet
	opts     *RouteOpts
	logger   log.Logger
	routeKey string

	alerts  *store.Alerts
	ctx     context.Context
	cancel  func()
	done    chan struct{}
	timer   Timer
	timeout func(time.Duration) time.Duration

	mtx        sync.RWMutex
	hasFlushed bool
}

// newAggrGroup returns a new aggregation group.
func newAggrGroup(ctx context.Context, labels model.LabelSet, r *Route, to func(time.Duration) time.Duration, logger log.Logger, timerFactory TimerFactory) *aggrGroup {
	if to == nil {
		to = func(d time.Duration) time.Duration { return d }
	}
	ag := &aggrGroup{
		labels:   labels,
		routeKey: r.Key(),
		opts:     &r.RouteOpts,
		timeout:  to,
		alerts:   store.NewAlerts(),
		done:     make(chan struct{}),
	}
	ag.ctx, ag.cancel = context.WithCancel(ctx)

	ag.logger = log.With(logger, "aggrGroup", ag, "group_fingerprint", ag.fingerprint())

	// Set an initial one-time wait before flushing
	// the first batch of notifications.
	ag.timer = timerFactory(
		ag.ctx,
		ag.opts,
		ag.logger,
		uint64(ag.fingerprint()),
	)

	return ag
}

func (ag *aggrGroup) fingerprint() model.Fingerprint {
	return ag.labels.Fingerprint()
}

func (ag *aggrGroup) GroupKey() string {
	return fmt.Sprintf("%s:%s", ag.routeKey, ag.labels)
}

func (ag *aggrGroup) String() string {
	return ag.GroupKey()
}

func (ag *aggrGroup) run(nf notifyFunc) {
	// aggrGroup ctx can be canceled if the dispatcher ctx is canceled (on reboots / cfg change)
	// in this case we need to stop the timer but keep the state
	defer ag.timer.Stop(false)
	defer close(ag.done)

	for {
		select {
		case now := <-ag.timer.C():
			// Give the notifications time until the next flush to
			// finish before terminating them.
			ctx, cancel := context.WithTimeout(ag.ctx, ag.timeout(ag.opts.GroupInterval))

			// The now time we retrieve from the ticker is the only reliable
			// point of time reference for the subsequent notification pipeline.
			// Calculating the current time directly is prone to flaky behavior,
			// which usually only becomes apparent in tests.
			ctx = notify.WithNow(ctx, now)

			// Populate context with information needed along the pipeline.
			ctx = notify.WithGroupKey(ctx, ag.GroupKey())
			ctx = notify.WithGroupLabels(ctx, ag.labels)
			ctx = notify.WithReceiverName(ctx, ag.opts.Receiver)
			ctx = notify.WithRepeatInterval(ctx, ag.opts.RepeatInterval)
			ctx = notify.WithMuteTimeIntervals(ctx, ag.opts.MuteTimeIntervals)
			ctx = notify.WithActiveTimeIntervals(ctx, ag.opts.ActiveTimeIntervals)

			// Wait the configured interval before calling flush again.
			ag.mtx.Lock()
			ag.timer.Reset(now)
			ag.hasFlushed = true
			ag.mtx.Unlock()

			ag.flush(ctx, nf)

			cancel()

		case <-ag.ctx.Done():
			return
		}
	}
}

func (ag *aggrGroup) stop() {
	// Calling cancel will terminate all in-process notifications
	// and the run() loop.
	ag.cancel()
	<-ag.done

	// stop the timer once `run` has exited to make sure timer state cleanup is safe
	ag.timer.Stop(true)
}

// insert inserts the alert into the aggregation group.
func (ag *aggrGroup) insert(alert *types.Alert) {
	if err := ag.alerts.Set(alert); err != nil {
		level.Error(ag.logger).Log("msg", "error on set alert", "err", err)
	}

	// Immediately trigger a flush if the wait duration for this
	// alert is already over.
	ag.mtx.Lock()
	defer ag.mtx.Unlock()
	if !ag.hasFlushed && alert.StartsAt.Add(ag.opts.GroupWait).Before(time.Now()) {
		ag.timer.Flush()
	}
}

func (ag *aggrGroup) empty() bool {
	return ag.alerts.Empty()
}

// flush sends notifications for all new alerts.
func (ag *aggrGroup) flush(ctx context.Context, nf notifyFunc) {
	if ag.empty() {
		return
	}

	var (
		alerts        = ag.alerts.List()
		alertsSlice   = make(types.AlertSlice, 0, len(alerts))
		resolvedSlice = make(types.AlertSlice, 0, len(alerts))
		now           = time.Now()
	)
	for _, alert := range alerts {
		a := *alert
		// Ensure that alerts don't resolve as time move forwards.
		if a.ResolvedAt(now) {
			resolvedSlice = append(resolvedSlice, &a)
		} else {
			a.EndsAt = time.Time{}
		}
		alertsSlice = append(alertsSlice, &a)
	}
	sort.Stable(alertsSlice)

	pipelineTime, _ := notify.Now(ctx)
	l := log.With(ag.logger, "pipeline_time", pipelineTime)

	level.Debug(l).Log("msg", "flushing", "alerts", fmt.Sprintf("%v", alertsSlice))

	if nf(ctx, alertsSlice...) {
		// Delete all resolved alerts as we just sent a notification for them,
		// and we don't want to send another one. However, we need to make sure
		// that each resolved alert has not fired again during the flush as then
		// we would delete an active alert thinking it was resolved.
		if err := ag.alerts.DeleteIfNotModified(resolvedSlice); err != nil {
			level.Error(l).Log("msg", "error on delete alerts", "err", err)
		}
	}
}

type nilLimits struct{}

func (n nilLimits) MaxNumberOfAggregationGroups() int { return 0 }
