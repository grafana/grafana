package datasource

import (
	"context"
	"errors"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/internal/tenant"
)

var (
	datasourceInstancesCreated = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "plugins",
		Name:      "datasource_instances_total",
		Help:      "The total number of data source instances created",
	})
)

// InstanceFactoryFunc factory method for creating data source instances.
type InstanceFactoryFunc func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error)

// NewInstanceManager creates a new data source instance manager,
//
// This is a helper method for calling NewInstanceProvider and creating a new instancemgmt.InstanceProvider,
// and providing that to instancemgmt.New.
func NewInstanceManager(fn InstanceFactoryFunc) instancemgmt.InstanceManager {
	ip := NewInstanceProvider(fn)
	return instancemgmt.NewInstanceManagerWrapper(ip)
}

// NewInstanceProvider create a new data source instance provider,
//
// The instance provider is responsible for providing cache keys for data source instances,
// creating new instances when needed and invalidating cached instances when they have been
// updated in Grafana.
// Cache key is based on the numerical data source identifier.
// If fn is nil, NewInstanceProvider panics.
func NewInstanceProvider(fn InstanceFactoryFunc) instancemgmt.InstanceProvider {
	if fn == nil {
		panic("fn cannot be nil")
	}

	return &instanceProvider{
		factory: fn,
	}
}

type instanceProvider struct {
	factory InstanceFactoryFunc
}

func (ip *instanceProvider) GetKey(ctx context.Context, pluginContext backend.PluginContext) (interface{}, error) {
	if pluginContext.DataSourceInstanceSettings == nil {
		return nil, errors.New("data source instance settings cannot be nil")
	}

	return instanceKey(ctx, pluginContext), nil
}

func (ip *instanceProvider) NeedsUpdate(ctx context.Context, pluginContext backend.PluginContext, cachedInstance instancemgmt.CachedInstance) bool {
	curConfig := pluginContext.GrafanaConfig
	cachedConfig := cachedInstance.PluginContext.GrafanaConfig
	configUpdated := !cachedConfig.Equal(curConfig)

	curDataSourceSettings := pluginContext.DataSourceInstanceSettings
	cachedDataSourceSettings := cachedInstance.PluginContext.DataSourceInstanceSettings
	dsUpdated := !curDataSourceSettings.Updated.Equal(cachedDataSourceSettings.Updated)

	if dsUpdated || configUpdated {
		logger := backend.Logger.FromContext(ctx)

		ik := instanceKey(ctx, pluginContext)
		if dsUpdated {
			logger.Debug("Datasource instance needs update: datasource settings changed", "key", ik)
		}
		if configUpdated {
			logger.Debug("Datasource instance needs update: config changed", "key", ik, "diff", curConfig.Diff(cachedConfig))
		}
	}

	return dsUpdated || configUpdated
}

func (ip *instanceProvider) NewInstance(ctx context.Context, pluginContext backend.PluginContext) (instancemgmt.Instance, error) {
	datasourceInstancesCreated.Inc()
	backend.Logger.FromContext(ctx).Debug("Datasource instance created", "key", instanceKey(ctx, pluginContext))
	return ip.factory(ctx, *pluginContext.DataSourceInstanceSettings)
}

func instanceKey(ctx context.Context, pluginContext backend.PluginContext) string {
	dsID := pluginContext.DataSourceInstanceSettings.ID
	tenantID := tenant.IDFromContext(ctx)
	proxyHash := pluginContext.GrafanaConfig.ProxyHash()

	return fmt.Sprintf("%d#%s#%s", dsID, tenantID, proxyHash)
}
