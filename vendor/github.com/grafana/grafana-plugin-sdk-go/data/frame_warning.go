package data

import "encoding/json"

// Warning contains information about problems in a data.
type Warning struct {
	// Short message (typically shown in the header)
	Message string `json:"message,omitempty"`

	// longer error message, shown in the body
	Details string `json:"details,omitempty"`
}

// WarningsFromJSON creates a *Warning from a json string.
func WarningsFromJSON(jsonStr string) ([]Warning, error) {
	var m []Warning
	err := json.Unmarshal([]byte(jsonStr), &m)
	if err != nil {
		return nil, err
	}
	return m, nil
}
