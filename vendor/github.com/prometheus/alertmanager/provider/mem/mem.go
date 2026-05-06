// Copyright 2016 Prometheus Team
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

package mem

import (
	"context"
	"sync"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"

	"github.com/prometheus/alertmanager/provider"
	"github.com/prometheus/alertmanager/store"
	"github.com/prometheus/alertmanager/types"
)

const alertChannelLength = 200

// Alerts gives access to a set of alerts. All methods are goroutine-safe.
type Alerts struct {
	cancel context.CancelFunc

	alerts *store.Alerts
	marker types.Marker

	mtx       sync.Mutex
	listeners map[int]listeningAlerts
	next      int

	callback AlertStoreCallback

	logger log.Logger
}

type AlertStoreCallback interface {
	// PreStore is called before alert is stored into the store. If this method returns error,
	// alert is not stored.
	// Existing flag indicates whether alert has existed before (and is only updated) or not.
	// If alert has existed before, then alert passed to PreStore is result of merging existing alert with new alert.
	PreStore(alert *types.Alert, existing bool) error

	// PostStore is called after alert has been put into store.
	PostStore(alert *types.Alert, existing bool)

	// PostDelete is called after alert has been removed from the store due to alert garbage collection.
	PostDelete(alert *types.Alert)
}

type listeningAlerts struct {
	alerts chan *types.Alert
	done   chan struct{}
}

func (a *Alerts) registerMetrics(r prometheus.Registerer) {
	newMemAlertByStatus := func(s types.AlertState) prometheus.GaugeFunc {
		return prometheus.NewGaugeFunc(
			prometheus.GaugeOpts{
				Name:        "alertmanager_alerts",
				Help:        "How many alerts by state.",
				ConstLabels: prometheus.Labels{"state": string(s)},
			},
			func() float64 {
				return float64(a.count(s))
			},
		)
	}

	r.MustRegister(newMemAlertByStatus(types.AlertStateActive))
	r.MustRegister(newMemAlertByStatus(types.AlertStateSuppressed))
	r.MustRegister(newMemAlertByStatus(types.AlertStateUnprocessed))
}

// NewAlerts returns a new alert provider.
func NewAlerts(ctx context.Context, m types.Marker, intervalGC time.Duration, alertCallback AlertStoreCallback, l log.Logger, r prometheus.Registerer) (*Alerts, error) {
	if alertCallback == nil {
		alertCallback = noopCallback{}
	}

	ctx, cancel := context.WithCancel(ctx)
	a := &Alerts{
		marker:    m,
		alerts:    store.NewAlerts(),
		cancel:    cancel,
		listeners: map[int]listeningAlerts{},
		next:      0,
		logger:    log.With(l, "component", "provider"),
		callback:  alertCallback,
	}
	a.alerts.SetGCCallback(func(alerts []types.Alert) {
		for _, alert := range alerts {
			// As we don't persist alerts, we no longer consider them after
			// they are resolved. Alerts waiting for resolved notifications are
			// held in memory in aggregation groups redundantly.
			m.Delete(alert.Fingerprint())
			a.callback.PostDelete(&alert)
		}

		a.mtx.Lock()
		for i, l := range a.listeners {
			select {
			case <-l.done:
				delete(a.listeners, i)
				close(l.alerts)
			default:
				// listener is not closed yet, hence proceed.
			}
		}
		a.mtx.Unlock()
	})

	if r != nil {
		a.registerMetrics(r)
	}

	go a.alerts.Run(ctx, intervalGC)

	return a, nil
}

// Close the alert provider.
func (a *Alerts) Close() {
	if a.cancel != nil {
		a.cancel()
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// Subscribe returns an iterator over active alerts that have not been
// resolved and successfully notified about.
// They are not guaranteed to be in chronological order.
func (a *Alerts) Subscribe() provider.AlertIterator {
	a.mtx.Lock()
	defer a.mtx.Unlock()
	var (
		done   = make(chan struct{})
		alerts = a.alerts.List()
		ch     = make(chan *types.Alert, max(len(alerts), alertChannelLength))
	)

	for _, a := range alerts {
		ch <- a
	}

	a.listeners[a.next] = listeningAlerts{alerts: ch, done: done}
	a.next++

	return provider.NewAlertIterator(ch, done, nil)
}

// GetPending returns an iterator over all the alerts that have
// pending notifications.
func (a *Alerts) GetPending() provider.AlertIterator {
	var (
		ch   = make(chan *types.Alert, alertChannelLength)
		done = make(chan struct{})
	)

	go func() {
		defer close(ch)

		for _, a := range a.alerts.List() {
			select {
			case ch <- a:
			case <-done:
				return
			}
		}
	}()

	return provider.NewAlertIterator(ch, done, nil)
}

// Get returns the alert for a given fingerprint.
func (a *Alerts) Get(fp model.Fingerprint) (*types.Alert, error) {
	return a.alerts.Get(fp)
}

// Put adds the given alert to the set.
func (a *Alerts) Put(alerts ...*types.Alert) error {
	for _, alert := range alerts {
		fp := alert.Fingerprint()

		existing := false

		// Check that there's an alert existing within the store before
		// trying to merge.
		if old, err := a.alerts.Get(fp); err == nil {
			existing = true

			// Merge alerts if there is an overlap in activity range.
			if (alert.EndsAt.After(old.StartsAt) && alert.EndsAt.Before(old.EndsAt)) ||
				(alert.StartsAt.After(old.StartsAt) && alert.StartsAt.Before(old.EndsAt)) {
				alert = old.Merge(alert)
			}
		}

		if err := a.callback.PreStore(alert, existing); err != nil {
			level.Error(a.logger).Log("msg", "pre-store callback returned error on set alert", "err", err)
			continue
		}

		if err := a.alerts.Set(alert); err != nil {
			level.Error(a.logger).Log("msg", "error on set alert", "err", err)
			continue
		}

		a.callback.PostStore(alert, existing)

		a.mtx.Lock()
		for _, l := range a.listeners {
			select {
			case l.alerts <- alert:
			case <-l.done:
			}
		}
		a.mtx.Unlock()
	}

	return nil
}

// count returns the number of non-resolved alerts we currently have stored filtered by the provided state.
func (a *Alerts) count(state types.AlertState) int {
	var count int
	for _, alert := range a.alerts.List() {
		if alert.Resolved() {
			continue
		}

		status := a.marker.Status(alert.Fingerprint())
		if status.State != state {
			continue
		}

		count++
	}

	return count
}

type noopCallback struct{}

func (n noopCallback) PreStore(_ *types.Alert, _ bool) error { return nil }
func (n noopCallback) PostStore(_ *types.Alert, _ bool)      {}
func (n noopCallback) PostDelete(_ *types.Alert)             {}
