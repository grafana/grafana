package plugin

import (
	"encoding/json"
	"time"
)

// logEntry is the JSON payload that gets sent to Stderr from the plugin to the host
type logEntry struct {
	Message   string        `json:"@message"`
	Level     string        `json:"@level"`
	Timestamp time.Time     `json:"timestamp"`
	KVPairs   []*logEntryKV `json:"kv_pairs"`
}

// logEntryKV is a key value pair within the Output payload
type logEntryKV struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
}

// flattenKVPairs is used to flatten KVPair slice into []interface{}
// for hclog consumption.
func flattenKVPairs(kvs []*logEntryKV) []interface{} {
	var result []interface{}
	for _, kv := range kvs {
		result = append(result, kv.Key)
		result = append(result, kv.Value)
	}

	return result
}

// parseJSON handles parsing JSON output
func parseJSON(input []byte) (*logEntry, error) {
	var raw map[string]interface{}
	entry := &logEntry{}

	err := json.Unmarshal(input, &raw)
	if err != nil {
		return nil, err
	}

	// Parse hclog-specific objects
	if v, ok := raw["@message"]; ok {
		entry.Message = v.(string)
		delete(raw, "@message")
	}

	if v, ok := raw["@level"]; ok {
		entry.Level = v.(string)
		delete(raw, "@level")
	}

	if v, ok := raw["@timestamp"]; ok {
		t, err := time.Parse("2006-01-02T15:04:05.000000Z07:00", v.(string))
		if err != nil {
			return nil, err
		}
		entry.Timestamp = t
		delete(raw, "@timestamp")
	}

	// Parse dynamic KV args from the hclog payload.
	for k, v := range raw {
		entry.KVPairs = append(entry.KVPairs, &logEntryKV{
			Key:   k,
			Value: v,
		})
	}

	return entry, nil
}
