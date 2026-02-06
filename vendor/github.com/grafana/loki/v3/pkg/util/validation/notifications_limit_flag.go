package validation

import (
	"encoding/json"
	"fmt"

	"github.com/pkg/errors"

	"github.com/grafana/loki/v3/pkg/util"
)

var allowedIntegrationNames = []string{
	"webhook", "email", "pagerduty", "opsgenie", "wechat", "slack", "victorops", "pushover", "sns",
}

type NotificationRateLimitMap map[string]float64

// String implements flag.Value
func (m NotificationRateLimitMap) String() string {
	out, err := json.Marshal(map[string]float64(m))
	if err != nil {
		return fmt.Sprintf("failed to marshal: %v", err)
	}
	return string(out)
}

// Set implements flag.Value
func (m NotificationRateLimitMap) Set(s string) error {
	newMap := map[string]float64{}
	return m.updateMap(json.Unmarshal([]byte(s), &newMap), newMap)
}

// UnmarshalYAML implements yaml.Unmarshaler.
func (m NotificationRateLimitMap) UnmarshalYAML(unmarshal func(interface{}) error) error {
	newMap := map[string]float64{}
	return m.updateMap(unmarshal(newMap), newMap)
}

func (m NotificationRateLimitMap) updateMap(unmarshalErr error, newMap map[string]float64) error {
	if unmarshalErr != nil {
		return unmarshalErr
	}

	for k, v := range newMap {
		if !util.StringsContain(allowedIntegrationNames, k) {
			return errors.Errorf("unknown integration name: %s", k)
		}
		m[k] = v
	}
	return nil
}

// MarshalYAML implements yaml.Marshaler.
func (m NotificationRateLimitMap) MarshalYAML() (interface{}, error) {
	return map[string]float64(m), nil
}
