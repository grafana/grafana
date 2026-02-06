package pgxpoolprometheus

/**
 * (C) Copyright IBM Corp. 2021.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import (
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	_ prometheus.Collector = (*Collector)(nil)
	_ pgxStat              = (*pgxpool.Stat)(nil)
)

// pgxStat is an interface implemented by pgxpool.Stat.
type pgxStat interface {
	AcquireCount() int64
	AcquireDuration() time.Duration
	AcquiredConns() int32
	CanceledAcquireCount() int64
	ConstructingConns() int32
	EmptyAcquireCount() int64
	IdleConns() int32
	MaxConns() int32
	TotalConns() int32
	NewConnsCount() int64
	MaxLifetimeDestroyCount() int64
	MaxIdleDestroyCount() int64
}

// staterFunc should return a struct that implements pgxStat.
type staterFunc func() pgxStat

// Collector is a prometheus.Collector that will collect the nine statistics produced by pgxpool.Stat.
type Collector struct {
	stat staterFunc

	acquireCountDesc         *prometheus.Desc
	acquireDurationDesc      *prometheus.Desc
	acquiredConnsDesc        *prometheus.Desc
	canceledAcquireCountDesc *prometheus.Desc
	constructingConnsDesc    *prometheus.Desc
	emptyAcquireCountDesc    *prometheus.Desc
	idleConnsDesc            *prometheus.Desc
	maxConnsDesc             *prometheus.Desc
	totalConnsDesc           *prometheus.Desc
	newConnsCount            *prometheus.Desc
	maxLifetimeDestroyCount  *prometheus.Desc
	maxIdleDestroyCount      *prometheus.Desc
}

// Stater is a provider of the Stat() function. Implemented by pgxpool.Pool.
type Stater interface {
	Stat() *pgxpool.Stat
}

// NewCollector creates a new Collector to collect stats from pgxpool.
func NewCollector(stater Stater, labels map[string]string) *Collector {
	fn := func() pgxStat { return stater.Stat() }
	return newCollector(fn, labels)
}

// newCollector is an internal only constructor for a Collecter. It accepts
// a staterFunc which provides a closure for requesting pgxpool.Stat metrics.
// Labels to each metric and may be nil. A label is recommended when an
// application uses more than one pgxpool.Pool to enable differentiation between them.
func newCollector(fn staterFunc, labels map[string]string) *Collector {
	return &Collector{
		stat: fn,
		acquireCountDesc: prometheus.NewDesc(
			"pgxpool_acquire_count",
			"Cumulative count of successful acquires from the pool.",
			nil, labels),
		acquireDurationDesc: prometheus.NewDesc(
			"pgxpool_acquire_duration_ns",
			"Total duration of all successful acquires from the pool in nanoseconds.",
			nil, labels),
		acquiredConnsDesc: prometheus.NewDesc(
			"pgxpool_acquired_conns",
			"Number of currently acquired connections in the pool.",
			nil, labels),
		canceledAcquireCountDesc: prometheus.NewDesc(
			"pgxpool_canceled_acquire_count",
			"Cumulative count of acquires from the pool that were canceled by a context.",
			nil, labels),
		constructingConnsDesc: prometheus.NewDesc(
			"pgxpool_constructing_conns",
			"Number of conns with construction in progress in the pool.",
			nil, labels),
		emptyAcquireCountDesc: prometheus.NewDesc(
			"pgxpool_empty_acquire",
			"Cumulative count of successful acquires from the pool that waited for a resource to be released or constructed because the pool was empty.",
			nil, labels),
		idleConnsDesc: prometheus.NewDesc(
			"pgxpool_idle_conns",
			"Number of currently idle conns in the pool.",
			nil, labels),
		maxConnsDesc: prometheus.NewDesc(
			"pgxpool_max_conns",
			"Maximum size of the pool.",
			nil, labels),
		totalConnsDesc: prometheus.NewDesc(
			"pgxpool_total_conns",
			"Total number of resources currently in the pool. The value is the sum of ConstructingConns, AcquiredConns, and IdleConns.",
			nil, labels),
		newConnsCount: prometheus.NewDesc(
			"pgxpool_new_conns_count",
			"Cumulative count of new connections opened.",
			nil, labels),
		maxLifetimeDestroyCount: prometheus.NewDesc(
			"pgxpool_max_lifetime_destroy_count",
			"Cumulative count of connections destroyed because they exceeded MaxConnLifetime. ",
			nil, labels),
		maxIdleDestroyCount: prometheus.NewDesc(
			"pgxpool_max_idle_destroy_count",
			"Cumulative count of connections destroyed because they exceeded MaxConnIdleTime.",
			nil, labels),
	}
}

// Describe implements the prometheus.Collector interface.
func (c *Collector) Describe(ch chan<- *prometheus.Desc) {
	prometheus.DescribeByCollect(c, ch)
}

// Collect implements the prometheus.Collector interface.
func (c *Collector) Collect(metrics chan<- prometheus.Metric) {
	stats := &statWrapper{c.stat()}
	metrics <- prometheus.MustNewConstMetric(
		c.acquireCountDesc,
		prometheus.CounterValue,
		stats.acquireCount(),
	)
	metrics <- prometheus.MustNewConstMetric(
		c.acquireDurationDesc,
		prometheus.CounterValue,
		stats.acquireDuration(),
	)
	metrics <- prometheus.MustNewConstMetric(
		c.acquiredConnsDesc,
		prometheus.GaugeValue,
		stats.acquiredConns(),
	)
	metrics <- prometheus.MustNewConstMetric(
		c.canceledAcquireCountDesc,
		prometheus.CounterValue,
		stats.canceledAcquireCount(),
	)
	metrics <- prometheus.MustNewConstMetric(
		c.constructingConnsDesc,
		prometheus.GaugeValue,
		stats.constructingConns(),
	)
	metrics <- prometheus.MustNewConstMetric(
		c.emptyAcquireCountDesc,
		prometheus.CounterValue,
		stats.emptyAcquireCount(),
	)
	metrics <- prometheus.MustNewConstMetric(
		c.idleConnsDesc,
		prometheus.GaugeValue,
		stats.idleConns(),
	)
	metrics <- prometheus.MustNewConstMetric(
		c.maxConnsDesc,
		prometheus.GaugeValue,
		stats.maxConns(),
	)
	metrics <- prometheus.MustNewConstMetric(
		c.totalConnsDesc,
		prometheus.GaugeValue,
		stats.totalConns(),
	)
	metrics <- prometheus.MustNewConstMetric(
		c.newConnsCount,
		prometheus.CounterValue,
		stats.newConnsCount(),
	)
	metrics <- prometheus.MustNewConstMetric(
		c.maxLifetimeDestroyCount,
		prometheus.CounterValue,
		stats.maxLifetimeDestroyCount(),
	)
	metrics <- prometheus.MustNewConstMetric(
		c.maxIdleDestroyCount,
		prometheus.CounterValue,
		stats.maxIdleDestroyCount(),
	)
}

// statWrapper is convenience struct that deals with converting
// pgxpool.Stat values to float64 for use by prometheus.
type statWrapper struct {
	stats pgxStat
}

func (w *statWrapper) acquireCount() float64 {
	return float64(w.stats.AcquireCount())
}
func (w *statWrapper) acquireDuration() float64 {
	return float64(w.stats.AcquireDuration())
}
func (w *statWrapper) acquiredConns() float64 {
	return float64(w.stats.AcquiredConns())
}
func (w *statWrapper) canceledAcquireCount() float64 {
	return float64(w.stats.CanceledAcquireCount())
}
func (w *statWrapper) constructingConns() float64 {
	return float64(w.stats.ConstructingConns())
}
func (w *statWrapper) emptyAcquireCount() float64 {
	return float64(w.stats.EmptyAcquireCount())
}
func (w *statWrapper) idleConns() float64 {
	return float64(w.stats.IdleConns())
}
func (w *statWrapper) maxConns() float64 {
	return float64(w.stats.MaxConns())
}
func (w *statWrapper) totalConns() float64 {
	return float64(w.stats.TotalConns())
}
func (w *statWrapper) newConnsCount() float64 {
	return float64(w.stats.NewConnsCount())
}
func (w *statWrapper) maxLifetimeDestroyCount() float64 {
	return float64(w.stats.MaxLifetimeDestroyCount())
}
func (w *statWrapper) maxIdleDestroyCount() float64 {
	return float64(w.stats.MaxIdleDestroyCount())
}
