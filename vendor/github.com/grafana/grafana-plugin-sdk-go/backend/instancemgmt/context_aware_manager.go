package instancemgmt

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
)

// NewInstanceManagerWrapper creates a new instance manager that dynamically selects
// between standard and TTL instance managers based on feature toggles from the Grafana config.
func NewInstanceManagerWrapper(provider InstanceProvider) InstanceManager {
	return &instanceManagerWrapper{
		provider:        provider,
		standardManager: New(provider),
		ttlManager:      NewTTLInstanceManager(provider),
	}
}

// instanceManagerWrapper is a wrapper that dynamically selects the appropriate
// instance manager implementation based on feature toggles in the context.
type instanceManagerWrapper struct {
	provider        InstanceProvider
	standardManager InstanceManager
	ttlManager      InstanceManager
}

// selectManager returns the appropriate instance manager based on the feature toggle
// from the Grafana config in the plugin context.
func (c *instanceManagerWrapper) selectManager(_ context.Context, pluginContext backend.PluginContext) InstanceManager {
	// Check if TTL instance manager feature toggle is enabled
	if pluginContext.GrafanaConfig != nil {
		featureToggles := pluginContext.GrafanaConfig.FeatureToggles()
		if featureToggles.IsEnabled(featuretoggles.TTLInstanceManager) {
			return c.ttlManager
		}
	}

	// Default to standard instance manager
	return c.standardManager
}

// Get returns an Instance using the appropriate manager based on feature toggles.
func (c *instanceManagerWrapper) Get(ctx context.Context, pluginContext backend.PluginContext) (Instance, error) {
	manager := c.selectManager(ctx, pluginContext)
	return manager.Get(ctx, pluginContext)
}

// Do provides an Instance as argument to fn using the appropriate manager based on feature toggles.
func (c *instanceManagerWrapper) Do(ctx context.Context, pluginContext backend.PluginContext, fn InstanceCallbackFunc) error {
	manager := c.selectManager(ctx, pluginContext)
	return manager.Do(ctx, pluginContext, fn)
}
