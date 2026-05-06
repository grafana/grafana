package testing

import (
	"encoding/json"
	"net/url"

	"github.com/grafana/alerting/receivers"
)

func ParseURLUnsafe(s string) *url.URL {
	u, err := url.Parse(s)
	if err != nil {
		panic(err)
	}
	return u
}

func DecryptForTesting(sjd map[string][]byte) receivers.DecryptFunc {
	return func(key string, fallback string) string {
		v, ok := sjd[key]
		if !ok {
			return fallback
		}
		return string(v)
	}
}

// ReadSecretsJSONForTesting reads a JSON object where all fields are strings and converts it to map[string][]byte that is accepted in tests.
func ReadSecretsJSONForTesting(raw string) map[string][]byte {
	r := map[string]string{}
	err := json.Unmarshal([]byte(raw), &r)
	if err != nil {
		panic(err)
	}
	result := make(map[string][]byte, len(r))
	for key, value := range r {
		result[key] = []byte(value)
	}
	return result
}
