package featuretoggles

import (
	"os"
	"strings"
)

const (
	EnabledFeatures = "GF_INSTANCE_FEATURE_TOGGLES_ENABLE"

	// TTLInstanceManager is a feature toggle for enabling the TTL-based instance manager.
	// When enabled, instances will be automatically evicted from the cache after a certain TTL.
	TTLInstanceManager = "ttlPluginInstanceManager"
)

// FeatureToggles can check if feature toggles are enabled on the Grafana instance.
type FeatureToggles interface {
	// IsEnabled returns true if the provided feature flag is set.
	IsEnabled(flag string) bool
}

// featureToggles implements a FeatureToggles that returns true if a flag is present in the flags map.
type featureToggles struct {
	// flags is a set-like map of feature flags that are enabled.
	flags map[string]struct{}
}

// IsEnabled returns true if flag is contained in f.flags.
func (f featureToggles) IsEnabled(flag string) bool {
	_, ok := f.flags[flag]
	return ok
}

// newFeatureTogglesFromEnv returns a new featureToggles instance with its flags set from environment variables.
func newFeatureTogglesFromEnv() featureToggles {
	return featureToggles{flags: flagsMapFromEnv()}
}

// flagsMapFromEnv returns a new set-like map[string]struct{}, where the keys are the comma-separated names in
// the `envFeatureTogglesEnable` env var.
func flagsMapFromEnv() map[string]struct{} {
	flags := strings.Split(os.Getenv(EnabledFeatures), ",")
	r := make(map[string]struct{}, len(flags))
	for _, flag := range flags {
		r[flag] = struct{}{}
	}
	return r
}

// DefaultFeatureToggles is the default feature toggles implementation.
// It contains the same feature toggles as the Grafana instance where the plugin is running.
var DefaultFeatureToggles FeatureToggles = newFeatureTogglesFromEnv()
