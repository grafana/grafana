// Copyright 2015 Prometheus Team
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

package notify

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/cespare/xxhash/v2"
	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/prometheus/alertmanager/featurecontrol"
	"github.com/prometheus/alertmanager/inhibit"
	"github.com/prometheus/alertmanager/nflog"
	"github.com/prometheus/alertmanager/nflog/nflogpb"
	"github.com/prometheus/alertmanager/silence"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/prometheus/alertmanager/types"
)

var tracer = otel.Tracer("github.com/prometheus/alertmanager/notify")

// ResolvedSender returns true if resolved notifications should be sent.
type ResolvedSender interface {
	SendResolved() bool
}

// Peer represents the cluster node from where we are the sending the notification.
type Peer interface {
	// WaitReady waits until the node silences and notifications have settled before attempting to send a notification.
	WaitReady(context.Context) error
}

// MinTimeout is the minimum timeout that is set for the context of a call
// to a notification pipeline.
const MinTimeout = 10 * time.Second

// Notifier notifies about alerts under constraints of the given context. It
// returns an error if unsuccessful and a flag whether the error is
// recoverable. This information is useful for a retry logic.
type Notifier interface {
	Notify(context.Context, ...*types.Alert) (bool, error)
}

// Integration wraps a notifier and its configuration to be uniquely identified
// by name and index from its origin in the configuration.
type Integration struct {
	notifier     Notifier
	rs           ResolvedSender
	name         string
	idx          int
	receiverName string
}

// NewIntegration returns a new integration.
func NewIntegration(notifier Notifier, rs ResolvedSender, name string, idx int, receiverName string) *Integration {
	return &Integration{
		notifier:     notifier,
		rs:           rs,
		name:         name,
		idx:          idx,
		receiverName: receiverName,
	}
}

// Notify implements the Notifier interface.
func (i *Integration) Notify(ctx context.Context, alerts ...*types.Alert) (bool, error) {
	ctx, span := tracer.Start(ctx, "notify.Integration.Notify",
		trace.WithAttributes(
			attribute.String("integration", i.name),
			attribute.Int("alerts", len(alerts)),
		),
	)
	defer span.End()

	return i.notifier.Notify(ctx, alerts...)
}

// SendResolved implements the ResolvedSender interface.
func (i *Integration) SendResolved() bool {
	return i.rs.SendResolved()
}

// Name returns the name of the integration.
func (i *Integration) Name() string {
	return i.name
}

// Index returns the index of the integration.
func (i *Integration) Index() int {
	return i.idx
}

// String implements the Stringer interface.
func (i *Integration) String() string {
	return fmt.Sprintf("%s[%d]", i.name, i.idx)
}

// notifyKey defines a custom type with which a context is populated to
// avoid accidental collisions.
type notifyKey int

const (
	keyReceiverName notifyKey = iota
	keyRepeatInterval
	keyGroupLabels
	keyGroupKey
	keyFiringAlerts
	keyResolvedAlerts
	keyNow
	keyMuteTimeIntervals
	keyActiveTimeIntervals
)

// WithReceiverName populates a context with a receiver name.
func WithReceiverName(ctx context.Context, rcv string) context.Context {
	return context.WithValue(ctx, keyReceiverName, rcv)
}

// WithGroupKey populates a context with a group key.
func WithGroupKey(ctx context.Context, s string) context.Context {
	return context.WithValue(ctx, keyGroupKey, s)
}

// WithFiringAlerts populates a context with a slice of firing alerts.
func WithFiringAlerts(ctx context.Context, alerts []uint64) context.Context {
	return context.WithValue(ctx, keyFiringAlerts, alerts)
}

// WithResolvedAlerts populates a context with a slice of resolved alerts.
func WithResolvedAlerts(ctx context.Context, alerts []uint64) context.Context {
	return context.WithValue(ctx, keyResolvedAlerts, alerts)
}

// WithGroupLabels populates a context with grouping labels.
func WithGroupLabels(ctx context.Context, lset model.LabelSet) context.Context {
	return context.WithValue(ctx, keyGroupLabels, lset)
}

// WithNow populates a context with a now timestamp.
func WithNow(ctx context.Context, t time.Time) context.Context {
	return context.WithValue(ctx, keyNow, t)
}

// WithRepeatInterval populates a context with a repeat interval.
func WithRepeatInterval(ctx context.Context, t time.Duration) context.Context {
	return context.WithValue(ctx, keyRepeatInterval, t)
}

// WithMuteTimeIntervals populates a context with a slice of mute time names.
func WithMuteTimeIntervals(ctx context.Context, mt []string) context.Context {
	return context.WithValue(ctx, keyMuteTimeIntervals, mt)
}

func WithActiveTimeIntervals(ctx context.Context, at []string) context.Context {
	return context.WithValue(ctx, keyActiveTimeIntervals, at)
}

// RepeatInterval extracts a repeat interval from the context. Iff none exists, the
// second argument is false.
func RepeatInterval(ctx context.Context) (time.Duration, bool) {
	v, ok := ctx.Value(keyRepeatInterval).(time.Duration)
	return v, ok
}

// ReceiverName extracts a receiver name from the context. Iff none exists, the
// second argument is false.
func ReceiverName(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(keyReceiverName).(string)
	return v, ok
}

// GroupKey extracts a group key from the context. Iff none exists, the
// second argument is false.
func GroupKey(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(keyGroupKey).(string)
	return v, ok
}

// GroupLabels extracts grouping label set from the context. Iff none exists, the
// second argument is false.
func GroupLabels(ctx context.Context) (model.LabelSet, bool) {
	v, ok := ctx.Value(keyGroupLabels).(model.LabelSet)
	return v, ok
}

// Now extracts a now timestamp from the context. Iff none exists, the
// second argument is false.
func Now(ctx context.Context) (time.Time, bool) {
	v, ok := ctx.Value(keyNow).(time.Time)
	return v, ok
}

// FiringAlerts extracts a slice of firing alerts from the context.
// Iff none exists, the second argument is false.
func FiringAlerts(ctx context.Context) ([]uint64, bool) {
	v, ok := ctx.Value(keyFiringAlerts).([]uint64)
	return v, ok
}

// ResolvedAlerts extracts a slice of firing alerts from the context.
// Iff none exists, the second argument is false.
func ResolvedAlerts(ctx context.Context) ([]uint64, bool) {
	v, ok := ctx.Value(keyResolvedAlerts).([]uint64)
	return v, ok
}

// MuteTimeIntervalNames extracts a slice of mute time names from the context. If and only if none exists, the
// second argument is false.
func MuteTimeIntervalNames(ctx context.Context) ([]string, bool) {
	v, ok := ctx.Value(keyMuteTimeIntervals).([]string)
	return v, ok
}

// ActiveTimeIntervalNames extracts a slice of active time names from the context. If none exists, the
// second argument is false.
func ActiveTimeIntervalNames(ctx context.Context) ([]string, bool) {
	v, ok := ctx.Value(keyActiveTimeIntervals).([]string)
	return v, ok
}

// A Stage processes alerts under the constraints of the given context.
type Stage interface {
	Exec(ctx context.Context, l log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error)
}

// StageFunc wraps a function to represent a Stage.
type StageFunc func(ctx context.Context, l log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error)

// Exec implements Stage interface.
func (f StageFunc) Exec(ctx context.Context, l log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error) {
	return f(ctx, l, alerts...)
}

type NotificationLog interface {
	Log(r *nflogpb.Receiver, gkey string, firingAlerts, resolvedAlerts []uint64, expiry time.Duration) error
	Query(params ...nflog.QueryParam) ([]*nflogpb.Entry, error)
}

type Metrics struct {
	numNotifications                   *prometheus.CounterVec
	numTotalFailedNotifications        *prometheus.CounterVec
	numNotificationRequestsTotal       *prometheus.CounterVec
	numNotificationRequestsFailedTotal *prometheus.CounterVec
	numNotificationSuppressedTotal     *prometheus.CounterVec
	notificationLatencySeconds         *prometheus.HistogramVec

	ff featurecontrol.Flagger
}

func NewMetrics(r prometheus.Registerer, ff featurecontrol.Flagger) *Metrics {
	labels := []string{"integration"}

	if ff.EnableReceiverNamesInMetrics() {
		labels = append(labels, "receiver_name")
	}

	m := &Metrics{
		numNotifications: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "alertmanager",
			Name:      "notifications_total",
			Help:      "The total number of attempted notifications.",
		}, labels),
		numTotalFailedNotifications: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "alertmanager",
			Name:      "notifications_failed_total",
			Help:      "The total number of failed notifications.",
		}, append(labels, "reason")),
		numNotificationRequestsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "alertmanager",
			Name:      "notification_requests_total",
			Help:      "The total number of attempted notification requests.",
		}, labels),
		numNotificationRequestsFailedTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "alertmanager",
			Name:      "notification_requests_failed_total",
			Help:      "The total number of failed notification requests.",
		}, labels),
		numNotificationSuppressedTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "alertmanager",
			Name:      "notifications_suppressed_total",
			Help:      "The total number of notifications suppressed for being silenced, inhibited, outside of active time intervals or within muted time intervals.",
		}, []string{"reason"}),
		notificationLatencySeconds: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "alertmanager",
			Name:                            "notification_latency_seconds",
			Help:                            "The latency of notifications in seconds.",
			Buckets:                         []float64{1, 5, 10, 15, 20},
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  100,
			NativeHistogramMinResetDuration: 1 * time.Hour,
		}, labels),
		ff: ff,
	}

	r.MustRegister(
		m.numNotifications, m.numTotalFailedNotifications,
		m.numNotificationRequestsTotal, m.numNotificationRequestsFailedTotal,
		m.numNotificationSuppressedTotal, m.notificationLatencySeconds,
	)

	return m
}

func (m *Metrics) InitializeFor(receivers map[string][]*Integration) {
	if m.ff.EnableReceiverNamesInMetrics() {

		// Reset the vectors to take into account receiver names changing after hot reloads.
		m.numNotifications.Reset()
		m.numNotificationRequestsTotal.Reset()
		m.numNotificationRequestsFailedTotal.Reset()
		m.notificationLatencySeconds.Reset()
		m.numTotalFailedNotifications.Reset()

		for name, integrations := range receivers {
			for _, integration := range integrations {
				m.numNotifications.WithLabelValues(integration.Name(), name)
				m.numNotificationRequestsTotal.WithLabelValues(integration.Name(), name)
				m.numNotificationRequestsFailedTotal.WithLabelValues(integration.Name(), name)
				m.notificationLatencySeconds.WithLabelValues(integration.Name(), name)

				for _, reason := range possibleFailureReasonCategory {
					m.numTotalFailedNotifications.WithLabelValues(integration.Name(), name, reason)
				}
			}
		}

		return
	}

	// When the feature flag is not enabled, we just carry on registering _all_ the integrations.
	for _, integration := range []string{
		"email",
		"pagerduty",
		"wechat",
		"pushover",
		"slack",
		"opsgenie",
		"webhook",
		"victorops",
		"sns",
		"telegram",
		"discord",
		"webex",
		"msteams",
		"msteamsv2",
		"jira",
	} {
		m.numNotifications.WithLabelValues(integration)
		m.numNotificationRequestsTotal.WithLabelValues(integration)
		m.numNotificationRequestsFailedTotal.WithLabelValues(integration)
		m.notificationLatencySeconds.WithLabelValues(integration)

		for _, reason := range possibleFailureReasonCategory {
			m.numTotalFailedNotifications.WithLabelValues(integration, reason)
		}
	}
}

type PipelineBuilder struct {
	metrics *Metrics
	ff      featurecontrol.Flagger
}

func NewPipelineBuilder(r prometheus.Registerer, ff featurecontrol.Flagger) *PipelineBuilder {
	return &PipelineBuilder{
		metrics: NewMetrics(r, ff),
		ff:      ff,
	}
}

// New returns a map of receivers to Stages.
func (pb *PipelineBuilder) New(
	receivers map[string][]*Integration,
	wait func() time.Duration,
	inhibitor *inhibit.Inhibitor,
	silencer *silence.Silencer,
	intervener *timeinterval.Intervener,
	notificationLog NotificationLog,
	peer Peer,
) RoutingStage {
	rs := make(RoutingStage, len(receivers))

	ms := NewGossipSettleStage(peer)
	is := NewMuteStage(inhibitor, pb.metrics)
	tas := NewTimeActiveStage(intervener, pb.metrics)
	tms := NewTimeMuteStage(intervener, pb.metrics)
	ss := NewMuteStage(silencer, pb.metrics)

	for name := range receivers {
		st := createReceiverStage(name, receivers[name], wait, notificationLog, pb.metrics)
		rs[name] = MultiStage{ms, is, tas, tms, ss, st}
	}

	pb.metrics.InitializeFor(receivers)

	return rs
}

// createReceiverStage creates a pipeline of stages for a receiver.
func createReceiverStage(
	name string,
	integrations []*Integration,
	wait func() time.Duration,
	notificationLog NotificationLog,
	metrics *Metrics,
) Stage {
	var fs FanoutStage
	for i := range integrations {
		recv := &nflogpb.Receiver{
			GroupName:   name,
			Integration: integrations[i].Name(),
			Idx:         uint32(integrations[i].Index()),
		}
		var s MultiStage
		s = append(s, NewWaitStage(wait))
		s = append(s, NewDedupStage(integrations[i], notificationLog, recv))
		s = append(s, NewRetryStage(integrations[i], name, metrics))
		s = append(s, NewSetNotifiesStage(notificationLog, recv))

		fs = append(fs, s)
	}
	return fs
}

// RoutingStage executes the inner stages based on the receiver specified in
// the context.
type RoutingStage map[string]Stage

// Exec implements the Stage interface.
func (rs RoutingStage) Exec(ctx context.Context, l log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error) {
	receiver, ok := ReceiverName(ctx)
	if !ok {
		return ctx, nil, errors.New("receiver missing")
	}

	s, ok := rs[receiver]
	if !ok {
		return ctx, nil, errors.New("stage for receiver missing")
	}

	return s.Exec(ctx, l, alerts...)
}

// A MultiStage executes a series of stages sequentially.
type MultiStage []Stage

// Exec implements the Stage interface.
func (ms MultiStage) Exec(ctx context.Context, l log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error) {
	var err error
	for _, s := range ms {
		if len(alerts) == 0 {
			return ctx, nil, nil
		}

		ctx, alerts, err = s.Exec(ctx, l, alerts...)
		if err != nil {
			return ctx, nil, err
		}
	}
	return ctx, alerts, nil
}

// FanoutStage executes its stages concurrently.
type FanoutStage []Stage

// Exec attempts to execute all stages concurrently and discards the results.
// It returns its input alerts and a types.MultiError if one or more stages fail.
func (fs FanoutStage) Exec(ctx context.Context, l log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error) {
	var (
		wg sync.WaitGroup
		me types.MultiError
	)
	wg.Add(len(fs))

	for _, s := range fs {
		go func(s Stage) {
			if _, _, err := s.Exec(ctx, l, alerts...); err != nil {
				me.Add(err)
			}
			wg.Done()
		}(s)
	}
	wg.Wait()

	if me.Len() > 0 {
		return ctx, alerts, &me
	}
	return ctx, alerts, nil
}

// GossipSettleStage waits until the Gossip has settled to forward alerts.
type GossipSettleStage struct {
	peer Peer
}

// NewGossipSettleStage returns a new GossipSettleStage.
func NewGossipSettleStage(p Peer) *GossipSettleStage {
	return &GossipSettleStage{peer: p}
}

func (n *GossipSettleStage) Exec(ctx context.Context, _ log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error) {
	if n.peer != nil {
		if err := n.peer.WaitReady(ctx); err != nil {
			return ctx, nil, err
		}
	}
	return ctx, alerts, nil
}

const (
	SuppressedReasonSilence            = "silence"
	SuppressedReasonInhibition         = "inhibition"
	SuppressedReasonMuteTimeInterval   = "mute_time_interval"
	SuppressedReasonActiveTimeInterval = "active_time_interval"
)

// MuteStage filters alerts through a Muter.
type MuteStage struct {
	muter   types.Muter
	metrics *Metrics
}

// NewMuteStage return a new MuteStage.
func NewMuteStage(m types.Muter, metrics *Metrics) *MuteStage {
	return &MuteStage{muter: m, metrics: metrics}
}

// Exec implements the Stage interface.
func (n *MuteStage) Exec(ctx context.Context, logger log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error) {
	var (
		filtered []*types.Alert
		muted    []*types.Alert
	)
	for _, a := range alerts {
		// TODO(fabxc): increment total alerts counter.
		// Do not send the alert if muted.
		if n.muter.Mutes(a.Labels) {
			muted = append(muted, a)
		} else {
			filtered = append(filtered, a)
		}
		// TODO(fabxc): increment muted alerts counter if muted.
	}
	if len(muted) > 0 {

		var reason string
		switch n.muter.(type) {
		case *silence.Silencer:
			reason = SuppressedReasonSilence
		case *inhibit.Inhibitor:
			reason = SuppressedReasonInhibition
		default:
		}
		n.metrics.numNotificationSuppressedTotal.WithLabelValues(reason).Add(float64(len(muted)))
		level.Debug(logger).Log("msg", "Notifications will not be sent for muted alerts", "alerts", fmt.Sprintf("%v", muted), "reason", reason)
	}

	return ctx, filtered, nil
}

// WaitStage waits for a certain amount of time before continuing or until the
// context is done.
type WaitStage struct {
	wait func() time.Duration
}

// NewWaitStage returns a new WaitStage.
func NewWaitStage(wait func() time.Duration) *WaitStage {
	return &WaitStage{
		wait: wait,
	}
}

// Exec implements the Stage interface.
func (ws *WaitStage) Exec(ctx context.Context, _ log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error) {
	select {
	case <-time.After(ws.wait()):
	case <-ctx.Done():
		return ctx, nil, ctx.Err()
	}
	return ctx, alerts, nil
}

// DedupStage filters alerts.
// Filtering happens based on a notification log.
type DedupStage struct {
	rs    ResolvedSender
	nflog NotificationLog
	recv  *nflogpb.Receiver

	now  func() time.Time
	hash func(*types.Alert) uint64
}

// NewDedupStage wraps a DedupStage that runs against the given notification log.
func NewDedupStage(rs ResolvedSender, l NotificationLog, recv *nflogpb.Receiver) *DedupStage {
	return &DedupStage{
		rs:    rs,
		nflog: l,
		recv:  recv,
		now:   utcNow,
		hash:  hashAlert,
	}
}

func utcNow() time.Time {
	return time.Now().UTC()
}

// Wrap a slice in a struct so we can store a pointer in sync.Pool.
type hashBuffer struct {
	buf []byte
}

var hashBuffers = sync.Pool{
	New: func() interface{} { return &hashBuffer{buf: make([]byte, 0, 1024)} },
}

func hashAlert(a *types.Alert) uint64 {
	const sep = '\xff'

	hb := hashBuffers.Get().(*hashBuffer)
	defer hashBuffers.Put(hb)
	b := hb.buf[:0]

	names := make(model.LabelNames, 0, len(a.Labels))

	for ln := range a.Labels {
		names = append(names, ln)
	}
	sort.Sort(names)

	for _, ln := range names {
		b = append(b, string(ln)...)
		b = append(b, sep)
		b = append(b, string(a.Labels[ln])...)
		b = append(b, sep)
	}

	hash := xxhash.Sum64(b)

	return hash
}

func (n *DedupStage) needsUpdate(entry *nflogpb.Entry, firing, resolved map[uint64]struct{}, repeat time.Duration) (bool, string) {
	// If we haven't notified about the alert group before, notify right away
	// unless we only have resolved alerts.
	if entry == nil {
		return len(firing) > 0, "fire"
	}

	if !entry.IsFiringSubset(firing) {
		return true, "fire subset"
	}

	// Notify about all alerts being resolved.
	// This is done irrespective of the send_resolved flag to make sure that
	// the firing alerts are cleared from the notification log.
	if len(firing) == 0 {
		// If the current alert group and last notification contain no firing
		// alert, it means that some alerts have been fired and resolved during the
		// last interval. In this case, there is no need to notify the receiver
		// since it doesn't know about them.
		return len(entry.FiringAlerts) > 0, "resolve"
	}

	if n.rs.SendResolved() && !entry.IsResolvedSubset(resolved) {
		return true, "resolve subset"
	}

	// Nothing changed, only notify if the repeat interval has passed.
	return entry.Timestamp.Before(n.now().Add(-repeat)), "repeat"
}

// Exec implements the Stage interface.
func (n *DedupStage) Exec(ctx context.Context, l log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error) {
	gkey, ok := GroupKey(ctx)
	if !ok {
		return ctx, nil, errors.New("group key missing")
	}

	repeatInterval, ok := RepeatInterval(ctx)
	if !ok {
		return ctx, nil, errors.New("repeat interval missing")
	}

	timeNow, ok := Now(ctx)
	if !ok {
		return ctx, alerts, errors.New("missing now timestamp")
	}

	firingSet := map[uint64]struct{}{}
	resolvedSet := map[uint64]struct{}{}
	firing := []uint64{}
	resolved := []uint64{}

	var hash uint64
	for _, a := range alerts {
		hash = n.hash(a)
		if a.Resolved() {
			resolved = append(resolved, hash)
			resolvedSet[hash] = struct{}{}
		} else {
			firing = append(firing, hash)
			firingSet[hash] = struct{}{}
		}
	}

	ctx = WithFiringAlerts(ctx, firing)
	ctx = WithResolvedAlerts(ctx, resolved)

	entries, err := n.nflog.Query(nflog.QGroupKey(gkey), nflog.QReceiver(n.recv))
	if err != nil && !errors.Is(err, nflog.ErrNotFound) {
		return ctx, nil, err
	}

	var entry *nflogpb.Entry
	switch len(entries) {
	case 0:
	case 1:
		entry = entries[0]
	default:
		return ctx, nil, fmt.Errorf("unexpected entry result size %d", len(entries))
	}

	needsUpdate, reason := n.needsUpdate(entry, firingSet, resolvedSet, repeatInterval)
	if !needsUpdate {
		return ctx, nil, nil
	}
	// now make sure that the current state is from past
	if entry != nil && entry.Timestamp.After(timeNow) {
		diff := entry.Timestamp.Sub(timeNow)
		// when entry's timestamp is greater than the flushing time, it means that the pipeline was already ran by other Alertmanager instance while this one was sleeping in WaitStage.
		// In this case, this instance cannot proceed with the pipeline anymore because there is a risk that the instance holds the obsolete alerts, and it could cause flapping or duplicated notifications.
		// This could happen only in high-availability mode.
		_ = level.Warn(l).Log("msg", "Timestamp of notification log entry is after the current pipeline timestamp.", "entry_time", entry.Timestamp, "pipeline_time", timeNow, "diff", diff, "aggrGroup", gkey, "alerts", fmt.Sprintf("%+v", alerts), "receiver", n.recv.GroupName, "integration", n.recv.Integration, "needsUpdateReason", reason)
		return ctx, nil, nil
	}
	_ = level.Debug(l).Log("msg", "Need to notify", "aggrGroup", gkey, "receiver", n.recv.GroupName, "integration", n.recv.Integration, "reason", reason)
	return ctx, alerts, nil
}

// RetryStage notifies via passed integration with exponential backoff until it
// succeeds. It aborts if the context is canceled or timed out.
type RetryStage struct {
	integration *Integration
	groupName   string
	metrics     *Metrics
	labelValues []string
}

// NewRetryStage returns a new instance of a RetryStage.
func NewRetryStage(i *Integration, groupName string, metrics *Metrics) *RetryStage {
	labelValues := []string{i.Name()}

	if metrics.ff.EnableReceiverNamesInMetrics() {
		labelValues = append(labelValues, i.receiverName)
	}

	return &RetryStage{
		integration: i,
		groupName:   groupName,
		metrics:     metrics,
		labelValues: labelValues,
	}
}

func (r RetryStage) Exec(ctx context.Context, l log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error) {
	r.metrics.numNotifications.WithLabelValues(r.labelValues...).Inc()
	ctx, alerts, err := r.exec(ctx, l, alerts...)

	failureReason := DefaultReason.String()
	if err != nil {
		var e *ErrorWithReason
		if errors.As(err, &e) {
			failureReason = e.Reason.String()
		}
		r.metrics.numTotalFailedNotifications.WithLabelValues(append(r.labelValues, failureReason)...).Inc()
	}
	return ctx, alerts, err
}

func (r RetryStage) exec(ctx context.Context, l log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error) {
	var sent []*types.Alert

	// If we shouldn't send notifications for resolved alerts, but there are only
	// resolved alerts, report them all as successfully notified (we still want the
	// notification log to log them for the next run of DedupStage).
	if !r.integration.SendResolved() {
		firing, ok := FiringAlerts(ctx)
		if !ok {
			return ctx, nil, errors.New("firing alerts missing")
		}
		if len(firing) == 0 {
			return ctx, alerts, nil
		}
		for _, a := range alerts {
			if a.Status() != model.AlertResolved {
				sent = append(sent, a)
			}
		}
	} else {
		sent = alerts
	}

	b := backoff.NewExponentialBackOff()
	b.MaxElapsedTime = 0 // Always retry.

	tick := backoff.NewTicker(b)
	defer tick.Stop()

	var (
		i    = 0
		iErr error
	)

	l = log.With(l, "receiver", r.groupName, "integration", r.integration.String())
	if groupKey, ok := GroupKey(ctx); ok {
		l = log.With(l, "aggrGroup", groupKey)
	}

	for {
		i++
		// Always check the context first to not notify again.
		select {
		case <-ctx.Done():
			if iErr == nil {
				iErr = ctx.Err()
				if errors.Is(iErr, context.Canceled) {
					iErr = NewErrorWithReason(ContextCanceledReason, iErr)
				} else if errors.Is(iErr, context.DeadlineExceeded) {
					iErr = NewErrorWithReason(ContextDeadlineExceededReason, iErr)
				}
			}

			if iErr != nil {
				return ctx, nil, fmt.Errorf("%s/%s: notify retry canceled after %d attempts: %w", r.groupName, r.integration.String(), i, iErr)
			}
			return ctx, nil, nil
		default:
		}

		select {
		case <-tick.C:
			now := time.Now()
			retry, err := r.integration.Notify(ctx, sent...)

			duration := time.Since(now)
			r.metrics.notificationLatencySeconds.WithLabelValues(r.labelValues...).Observe(duration.Seconds())
			r.metrics.numNotificationRequestsTotal.WithLabelValues(r.labelValues...).Inc()

			if err != nil {
				r.metrics.numNotificationRequestsFailedTotal.WithLabelValues(r.labelValues...).Inc()
				if !retry {
					return ctx, alerts, fmt.Errorf("%s/%s: notify retry canceled due to unrecoverable error after %d attempts: %w", r.groupName, r.integration.String(), i, err)
				}
				if ctx.Err() == nil {
					if iErr == nil || err.Error() != iErr.Error() {
						// Log the error if the context isn't done and the error isn't the same as before.
						level.Warn(l).Log("msg", "Notify attempt failed, will retry later", "attempts", i, "err", err)
					}
					// Save this error to be able to return the last seen error by an
					// integration upon context timeout.
					iErr = err
				}
			} else {
				lvl := level.Info(l)
				if i <= 1 {
					lvl = level.Debug(log.With(l, "alerts", fmt.Sprintf("%v", alerts)))
				}

				lvl.Log("msg", "Notify success", "attempts", i, "duration", duration)
				return ctx, alerts, nil
			}
		case <-ctx.Done():
			if iErr == nil {
				iErr = ctx.Err()
				if errors.Is(iErr, context.Canceled) {
					iErr = NewErrorWithReason(ContextCanceledReason, iErr)
				} else if errors.Is(iErr, context.DeadlineExceeded) {
					iErr = NewErrorWithReason(ContextDeadlineExceededReason, iErr)
				}
			}
			if iErr != nil {
				return ctx, nil, fmt.Errorf("%s/%s: notify retry canceled after %d attempts: %w", r.groupName, r.integration.String(), i, iErr)
			}
			return ctx, nil, nil
		}
	}
}

// SetNotifiesStage sets the notification information about passed alerts. The
// passed alerts should have already been sent to the receivers.
type SetNotifiesStage struct {
	nflog NotificationLog
	recv  *nflogpb.Receiver
}

// NewSetNotifiesStage returns a new instance of a SetNotifiesStage.
func NewSetNotifiesStage(l NotificationLog, recv *nflogpb.Receiver) *SetNotifiesStage {
	return &SetNotifiesStage{
		nflog: l,
		recv:  recv,
	}
}

// Exec implements the Stage interface.
func (n SetNotifiesStage) Exec(ctx context.Context, l log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error) {
	gkey, ok := GroupKey(ctx)
	if !ok {
		return ctx, nil, errors.New("group key missing")
	}

	firing, ok := FiringAlerts(ctx)
	if !ok {
		return ctx, nil, errors.New("firing alerts missing")
	}

	resolved, ok := ResolvedAlerts(ctx)
	if !ok {
		return ctx, nil, errors.New("resolved alerts missing")
	}

	repeat, ok := RepeatInterval(ctx)
	if !ok {
		return ctx, nil, errors.New("repeat interval missing")
	}
	expiry := 2 * repeat

	return ctx, alerts, n.nflog.Log(n.recv, gkey, firing, resolved, expiry)
}

type timeStage struct {
	muter   types.TimeMuter
	metrics *Metrics
}

type TimeMuteStage timeStage

func NewTimeMuteStage(m types.TimeMuter, metrics *Metrics) *TimeMuteStage {
	return &TimeMuteStage{m, metrics}
}

// Exec implements the stage interface for TimeMuteStage.
// TimeMuteStage is responsible for muting alerts whose route is not in an active time.
func (tms TimeMuteStage) Exec(ctx context.Context, l log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error) {
	muteTimeIntervalNames, ok := MuteTimeIntervalNames(ctx)
	if !ok {
		return ctx, alerts, nil
	}
	now, ok := Now(ctx)
	if !ok {
		return ctx, alerts, errors.New("missing now timestamp")
	}

	// Skip this stage if there are no mute timings.
	if len(muteTimeIntervalNames) == 0 {
		return ctx, alerts, nil
	}

	muted, err := tms.muter.Mutes(muteTimeIntervalNames, now)
	if err != nil {
		return ctx, alerts, err
	}

	// If the current time is inside a mute time, all alerts are removed from the pipeline.
	if muted {
		tms.metrics.numNotificationSuppressedTotal.WithLabelValues(SuppressedReasonMuteTimeInterval).Add(float64(len(alerts)))
		level.Debug(l).Log("msg", "Notifications not sent, route is within mute time", "alerts", len(alerts))
		return ctx, nil, nil
	}
	return ctx, alerts, nil
}

type TimeActiveStage timeStage

func NewTimeActiveStage(m types.TimeMuter, metrics *Metrics) *TimeActiveStage {
	return &TimeActiveStage{m, metrics}
}

// Exec implements the stage interface for TimeActiveStage.
// TimeActiveStage is responsible for muting alerts whose route is not in an active time.
func (tas TimeActiveStage) Exec(ctx context.Context, l log.Logger, alerts ...*types.Alert) (context.Context, []*types.Alert, error) {
	activeTimeIntervalNames, ok := ActiveTimeIntervalNames(ctx)
	if !ok {
		return ctx, alerts, nil
	}

	// if we don't have active time intervals at all it is always active.
	if len(activeTimeIntervalNames) == 0 {
		return ctx, alerts, nil
	}

	now, ok := Now(ctx)
	if !ok {
		return ctx, alerts, errors.New("missing now timestamp")
	}

	muted, err := tas.muter.Mutes(activeTimeIntervalNames, now)
	if err != nil {
		return ctx, alerts, err
	}

	// If the current time is not inside an active time, all alerts are removed from the pipeline
	if !muted {
		tas.metrics.numNotificationSuppressedTotal.WithLabelValues(SuppressedReasonActiveTimeInterval).Add(float64(len(alerts)))
		level.Debug(l).Log("msg", "Notifications not sent, route is not within active time", "alerts", len(alerts))
		return ctx, nil, nil
	}

	return ctx, alerts, nil
}
