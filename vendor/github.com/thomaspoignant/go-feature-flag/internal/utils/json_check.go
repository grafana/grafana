package utils

import "encoding/json"

// IsJSONObject checks if a string is a valid JSON
func IsJSONObject(s string) bool {
	var js map[string]interface{}
	return json.Unmarshal([]byte(s), &js) == nil
}
