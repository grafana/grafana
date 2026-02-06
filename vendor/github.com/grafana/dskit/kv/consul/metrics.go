package consul

import (
	"context"

	consul "github.com/hashicorp/consul/api"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/dskit/instrument"
)

type consulInstrumentation struct {
	kv            kv
	consulMetrics *consulMetrics
}

type consulMetrics struct {
	consulRequestDuration *instrument.HistogramCollector
}

func newConsulMetrics(registerer prometheus.Registerer) *consulMetrics {
	consulRequestDurationCollector := instrument.NewHistogramCollector(promauto.With(registerer).NewHistogramVec(prometheus.HistogramOpts{
		Name:    "consul_request_duration_seconds",
		Help:    "Time spent on consul requests.",
		Buckets: prometheus.DefBuckets,
	}, []string{"operation", "status_code"}))
	consulMetrics := consulMetrics{consulRequestDurationCollector}
	return &consulMetrics
}

func (c consulInstrumentation) CAS(p *consul.KVPair, options *consul.WriteOptions) (bool, *consul.WriteMeta, error) {
	var ok bool
	var result *consul.WriteMeta
	err := instrument.CollectedRequest(options.Context(), "CAS", c.consulMetrics.consulRequestDuration, instrument.ErrorCode, func(ctx context.Context) error {
		options = options.WithContext(ctx)
		var err error
		ok, result, err = c.kv.CAS(p, options)
		return err
	})
	return ok, result, err
}

func (c consulInstrumentation) Get(key string, options *consul.QueryOptions) (*consul.KVPair, *consul.QueryMeta, error) {
	var kvp *consul.KVPair
	var meta *consul.QueryMeta
	err := instrument.CollectedRequest(options.Context(), "Get", c.consulMetrics.consulRequestDuration, instrument.ErrorCode, func(ctx context.Context) error {
		options = options.WithContext(ctx)
		var err error
		kvp, meta, err = c.kv.Get(key, options)
		return err
	})
	return kvp, meta, err
}

func (c consulInstrumentation) List(path string, options *consul.QueryOptions) (consul.KVPairs, *consul.QueryMeta, error) {
	var kvps consul.KVPairs
	var meta *consul.QueryMeta
	err := instrument.CollectedRequest(options.Context(), "List", c.consulMetrics.consulRequestDuration, instrument.ErrorCode, func(ctx context.Context) error {
		options = options.WithContext(ctx)
		var err error
		kvps, meta, err = c.kv.List(path, options)
		return err
	})
	return kvps, meta, err
}

func (c consulInstrumentation) Delete(key string, options *consul.WriteOptions) (*consul.WriteMeta, error) {
	var meta *consul.WriteMeta
	err := instrument.CollectedRequest(options.Context(), "Delete", c.consulMetrics.consulRequestDuration, instrument.ErrorCode, func(ctx context.Context) error {
		options = options.WithContext(ctx)
		var err error
		meta, err = c.kv.Delete(key, options)
		return err
	})
	return meta, err
}

func (c consulInstrumentation) Put(p *consul.KVPair, options *consul.WriteOptions) (*consul.WriteMeta, error) {
	var result *consul.WriteMeta
	err := instrument.CollectedRequest(options.Context(), "Put", c.consulMetrics.consulRequestDuration, instrument.ErrorCode, func(ctx context.Context) error {
		options = options.WithContext(ctx)
		var err error
		result, err = c.kv.Put(p, options)
		return err
	})
	return result, err
}
