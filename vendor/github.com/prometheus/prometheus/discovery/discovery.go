// Copyright 2020 The Prometheus Authors
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

package discovery

import (
	"context"
	"log/slog"
	"reflect"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/config"

	"github.com/prometheus/prometheus/discovery/targetgroup"
)

// Discoverer provides information about target groups. It maintains a set
// of sources from which TargetGroups can originate. Whenever a discovery provider
// detects a potential change, it sends the TargetGroup through its channel.
//
// Discoverer does not know if an actual change happened.
// It does guarantee that it sends the new TargetGroup whenever a change happens.
//
// Discoverers should initially send a full set of all discoverable TargetGroups.
type Discoverer interface {
	// Run hands a channel to the discovery provider (Consul, DNS, etc.) through which
	// it can send updated target groups. It must return when the context is canceled.
	// It should not close the update channel on returning.
	Run(ctx context.Context, up chan<- []*targetgroup.Group)
}

// DiscovererMetrics are internal metrics of service discovery mechanisms.
type DiscovererMetrics interface {
	Register() error
	Unregister()
}

// DiscovererOptions provides options for a Discoverer.
type DiscovererOptions struct {
	Logger *slog.Logger

	Metrics DiscovererMetrics

	// Extra HTTP client options to expose to Discoverers. This field may be
	// ignored; Discoverer implementations must opt-in to reading it.
	HTTPClientOptions []config.HTTPClientOption
}

// RefreshMetrics are used by the "refresh" package.
// We define them here in the "discovery" package in order to avoid a cyclic dependency between
// "discovery" and "refresh".
type RefreshMetrics struct {
	Failures prometheus.Counter
	Duration prometheus.Observer
}

// RefreshMetricsInstantiator instantiates the metrics used by the "refresh" package.
type RefreshMetricsInstantiator interface {
	Instantiate(mech string) *RefreshMetrics
}

// RefreshMetricsManager is an interface for registering, unregistering, and
// instantiating metrics for the "refresh" package. Refresh metrics are
// registered and unregistered outside of the service discovery mechanism. This
// is so that the same metrics can be reused across different service discovery
// mechanisms. To manage refresh metrics inside the SD mechanism, we'd need to
// use const labels which are specific to that SD. However, doing so would also
// expose too many unused metrics on the Prometheus /metrics endpoint.
type RefreshMetricsManager interface {
	DiscovererMetrics
	RefreshMetricsInstantiator
}

// A Config provides the configuration and constructor for a Discoverer.
type Config interface {
	// Name returns the name of the discovery mechanism.
	Name() string

	// NewDiscoverer returns a Discoverer for the Config
	// with the given DiscovererOptions.
	NewDiscoverer(DiscovererOptions) (Discoverer, error)

	// NewDiscovererMetrics returns the metrics used by the service discovery.
	NewDiscovererMetrics(prometheus.Registerer, RefreshMetricsInstantiator) DiscovererMetrics
}

// Configs is a slice of Config values that uses custom YAML marshaling and unmarshaling
// to represent itself as a mapping of the Config values grouped by their types.
type Configs []Config

// SetDirectory joins any relative file paths with dir.
func (c *Configs) SetDirectory(dir string) {
	for _, c := range *c {
		if v, ok := c.(config.DirectorySetter); ok {
			v.SetDirectory(dir)
		}
	}
}

// UnmarshalYAML implements yaml.Unmarshaler.
func (c *Configs) UnmarshalYAML(unmarshal func(interface{}) error) error {
	cfgTyp := reflect.StructOf(configFields)
	cfgPtr := reflect.New(cfgTyp)
	cfgVal := cfgPtr.Elem()

	if err := unmarshal(cfgPtr.Interface()); err != nil {
		return replaceYAMLTypeError(err, cfgTyp, configsType)
	}

	var err error
	*c, err = readConfigs(cfgVal, 0)
	return err
}

// MarshalYAML implements yaml.Marshaler.
func (c Configs) MarshalYAML() (interface{}, error) {
	cfgTyp := reflect.StructOf(configFields)
	cfgPtr := reflect.New(cfgTyp)
	cfgVal := cfgPtr.Elem()

	if err := writeConfigs(cfgVal, c); err != nil {
		return nil, err
	}

	return cfgPtr.Interface(), nil
}

// A StaticConfig is a Config that provides a static list of targets.
type StaticConfig []*targetgroup.Group

// Name returns the name of the service discovery mechanism.
func (StaticConfig) Name() string { return "static" }

// NewDiscoverer returns a Discoverer for the Config.
func (c StaticConfig) NewDiscoverer(DiscovererOptions) (Discoverer, error) {
	return staticDiscoverer(c), nil
}

// NewDiscovererMetrics returns NoopDiscovererMetrics because no metrics are
// needed for this service discovery mechanism.
func (c StaticConfig) NewDiscovererMetrics(prometheus.Registerer, RefreshMetricsInstantiator) DiscovererMetrics {
	return &NoopDiscovererMetrics{}
}

type staticDiscoverer []*targetgroup.Group

func (c staticDiscoverer) Run(ctx context.Context, up chan<- []*targetgroup.Group) {
	// TODO: existing implementation closes up chan, but documentation explicitly forbids it...?
	defer close(up)
	select {
	case <-ctx.Done():
	case up <- c:
	}
}
