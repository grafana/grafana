// Provenance-includes-location: https://github.com/thanos-io/thanos/blob/main/pkg/discovery/provider.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Thanos Authors.

package dns

import (
	"context"
	"fmt"
	"net"
	"strings"
	"sync"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/dskit/dns/godns"
	"github.com/grafana/dskit/dns/miekgdns"
	"github.com/grafana/dskit/dns/miekgdns2"
	"github.com/grafana/dskit/multierror"
)

// Provider is a stateful cache for asynchronous DNS resolutions. It provides a way to resolve addresses and obtain them.
type Provider struct {
	sync.RWMutex
	resolver Resolver
	// A map from domain name to a slice of resolved targets.
	resolved map[string][]string
	logger   log.Logger

	resolverAddrsDesc     *prometheus.Desc
	resolverLookupsCount  prometheus.Counter
	resolverFailuresCount prometheus.Counter
}

type ResolverType string

const (
	GolangResolverType    ResolverType = "golang"
	MiekgdnsResolverType  ResolverType = "miekgdns"
	MiekgdnsResolverType2 ResolverType = "miekgdns2"
)

func (t ResolverType) String() string {
	return string(t)
}

func (t *ResolverType) Set(v string) error {
	switch ResolverType(v) {
	case GolangResolverType, MiekgdnsResolverType, MiekgdnsResolverType2:
		*t = ResolverType(v)
		return nil
	default:
		return fmt.Errorf("unsupported resolver type %s", v)
	}
}

func (t ResolverType) toResolver(logger log.Logger) ipLookupResolver {
	var r ipLookupResolver
	switch t {
	case GolangResolverType:
		r = &godns.Resolver{Resolver: net.DefaultResolver}
	case MiekgdnsResolverType:
		r = &miekgdns.Resolver{ResolvConf: miekgdns.DefaultResolvConfPath}
	case MiekgdnsResolverType2:
		level.Info(logger).Log("msg", "using experimental DNS resolver type", "type", t)
		r = miekgdns2.NewResolver(miekgdns2.DefaultResolvConfPath, logger)
	default:
		level.Warn(logger).Log("msg", "no such resolver type, defaulting to golang", "type", t)
		r = &godns.Resolver{Resolver: net.DefaultResolver}
	}
	return r
}

// NewProvider returns a new empty provider with a given resolver type.
// If empty resolver type is net.DefaultResolver.
func NewProvider(logger log.Logger, reg prometheus.Registerer, resolverType ResolverType) *Provider {
	p := &Provider{
		resolver: NewResolver(resolverType.toResolver(logger), logger),
		resolved: make(map[string][]string),
		logger:   logger,
		resolverAddrsDesc: prometheus.NewDesc(
			"dns_provider_results",
			"The number of resolved endpoints for each configured address",
			[]string{"addr"},
			nil),
		resolverLookupsCount: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "dns_lookups_total",
			Help: "The number of DNS lookups resolutions attempts",
		}),
		resolverFailuresCount: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "dns_failures_total",
			Help: "The number of DNS lookup failures",
		}),
	}
	if reg != nil {
		reg.MustRegister(p)
	}

	return p
}

// Clone returns a new provider from an existing one.
func (p *Provider) Clone() *Provider {
	return &Provider{
		resolver:              p.resolver,
		resolved:              make(map[string][]string),
		logger:                p.logger,
		resolverAddrsDesc:     p.resolverAddrsDesc,
		resolverLookupsCount:  p.resolverLookupsCount,
		resolverFailuresCount: p.resolverFailuresCount,
	}
}

// IsDynamicNode returns if the specified StoreAPI addr uses
// any kind of SD mechanism.
func IsDynamicNode(addr string) bool {
	qtype, _ := GetQTypeName(addr)
	return qtype != ""
}

// GetQTypeName splits the provided addr into two parts: the QType (if any)
// and the name.
func GetQTypeName(addr string) (qtype, name string) {
	qtypeAndName := strings.SplitN(addr, "+", 2)
	if len(qtypeAndName) != 2 {
		return "", addr
	}
	return qtypeAndName[0], qtypeAndName[1]
}

// Resolve stores a list of provided addresses or their DNS records if requested.
// Addresses prefixed with `dns+` or `dnssrv+` will be resolved through respective DNS lookup (A/AAAA or SRV).
// For non-SRV records, it will return an error if a port is not supplied.
func (p *Provider) Resolve(ctx context.Context, addrs []string) error {
	resolvedAddrs := map[string][]string{}
	errs := multierror.MultiError{}

	for _, addr := range addrs {
		var resolved []string
		qtype, name := GetQTypeName(addr)
		if qtype == "" {
			resolvedAddrs[name] = []string{name}
			continue
		}

		resolved, err := p.resolver.Resolve(ctx, name, QType(qtype))
		p.resolverLookupsCount.Inc()
		if err != nil {
			// Append all the failed dns resolution in the error list.
			errs.Add(err)
			// The DNS resolution failed. Continue without modifying the old records.
			p.resolverFailuresCount.Inc()
			// Use cached values.
			p.RLock()
			resolved = p.resolved[addr]
			p.RUnlock()
		}
		resolvedAddrs[addr] = resolved
	}

	// All addresses have been resolved. We can now take an exclusive lock to
	// update the local state.
	p.Lock()
	defer p.Unlock()

	p.resolved = resolvedAddrs

	return errs.Err()
}

// Addresses returns the latest addresses present in the Provider.
func (p *Provider) Addresses() []string {
	p.RLock()
	defer p.RUnlock()

	var result []string
	for _, addrs := range p.resolved {
		result = append(result, addrs...)
	}
	return result
}

// Describe implements prometheus.Collector
func (p *Provider) Describe(ch chan<- *prometheus.Desc) {
	ch <- p.resolverAddrsDesc
}

// Describe implements prometheus.Collector
func (p *Provider) Collect(ch chan<- prometheus.Metric) {
	p.RLock()
	defer p.RUnlock()

	for name, addrs := range p.resolved {
		metric, err := prometheus.NewConstMetric(p.resolverAddrsDesc, prometheus.GaugeValue, float64(len(addrs)), name)
		if err == nil {
			ch <- metric
		}
	}
}
