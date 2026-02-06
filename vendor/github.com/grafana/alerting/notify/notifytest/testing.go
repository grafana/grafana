package notifytest

import (
	"encoding/json"
	"maps"
	"reflect"
	"slices"
	"strings"
	"testing"

	promCfg "github.com/prometheus/alertmanager/config"
	"github.com/stretchr/testify/require"

	"github.com/grafana/alerting/definition"
)

// ForEachIntegrationTypeReceiver runs the given function for each integration type.
func ForEachIntegrationTypeReceiver(t *testing.T, f func(configType reflect.Type, receiver promCfg.Receiver, rawConfig string)) {
	t.Helper()
	keys := slices.SortedFunc(maps.Keys(AllValidMimirConfigs), func(r reflect.Type, r2 reflect.Type) int {
		return strings.Compare(r.Name(), r2.Name())
	})
	for _, iType := range keys {
		cfg, err := GetRawConfigForMimirIntegration(iType, WithDefault)
		require.NoError(t, err)
		r, err := GetMimirReceiverWithIntegrations([]reflect.Type{iType}, WithDefault)
		require.NoError(t, err)
		f(iType, r, cfg)
	}
}

// ForEachIntegrationTypeReceiver runs the given function for each integration type.
func ForEachIntegrationType(t *testing.T, f func(configType reflect.Type)) {
	t.Helper()
	keys := slices.SortedFunc(maps.Keys(AllValidMimirConfigs), func(r reflect.Type, r2 reflect.Type) int {
		return strings.Compare(r.Name(), r2.Name())
	})
	for _, iType := range keys {
		f(iType)
	}
}

func mergeSettings(a []byte, b []byte) ([]byte, error) {
	var origSettings map[string]any
	err := json.Unmarshal(a, &origSettings)
	if err != nil {
		return nil, err
	}
	var newSettings map[string]any
	err = json.Unmarshal(b, &newSettings)
	if err != nil {
		return nil, err
	}

	for key, value := range newSettings {
		origSettings[key] = value
	}

	return definition.MarshalJSONWithSecrets(origSettings)
}
