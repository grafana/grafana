package notify

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/types"

	receiversTesting "github.com/grafana/alerting/receivers/testing"
	"github.com/grafana/alerting/templates"
)

func ptr[T any](v T) *T {
	return &v
}

func newFakeMaintanenceOptions(t *testing.T) *fakeMaintenanceOptions {
	t.Helper()

	return &fakeMaintenanceOptions{}
}

type fakeMaintenanceOptions struct {
}

func (f *fakeMaintenanceOptions) InitialState() string {
	return ""
}

func (f *fakeMaintenanceOptions) Retention() time.Duration {
	return 30 * time.Millisecond
}

func (f *fakeMaintenanceOptions) MaintenanceFrequency() time.Duration {
	return 15 * time.Millisecond
}

func (f *fakeMaintenanceOptions) MaintenanceFunc(_ State) (int64, error) {
	return 0, nil
}

type FakeConfig struct {
}

func (f *FakeConfig) DispatcherLimits() DispatcherLimits {
	panic("implement me")
}

func (f *FakeConfig) InhibitRules() []*InhibitRule {
	// TODO implement me
	panic("implement me")
}

func (f *FakeConfig) MuteTimeIntervals() []MuteTimeInterval {
	// TODO implement me
	panic("implement me")
}

func (f *FakeConfig) ReceiverIntegrations() (map[string][]Integration, error) {
	// TODO implement me
	panic("implement me")
}

func (f *FakeConfig) RoutingTree() *Route {
	// TODO implement me
	panic("implement me")
}

func (f *FakeConfig) Templates() *templates.Template {
	// TODO implement me
	panic("implement me")
}

func (f *FakeConfig) Hash() [16]byte {
	// TODO implement me
	panic("implement me")
}

func (f *FakeConfig) Raw() []byte {
	// TODO implement me
	panic("implement me")
}

type fakeNotifier struct{}

func (f *fakeNotifier) Notify(_ context.Context, _ ...*types.Alert) (bool, error) {
	return true, nil
}

func (f *fakeNotifier) SendResolved() bool {
	return true
}

func GetDecryptedValueFnForTesting(_ context.Context, sjd map[string][]byte, key string, fallback string) string {
	return receiversTesting.DecryptForTesting(sjd)(key, fallback)
}

func MergeSettings(a []byte, b []byte) ([]byte, error) {
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

	return json.Marshal(origSettings)
}
