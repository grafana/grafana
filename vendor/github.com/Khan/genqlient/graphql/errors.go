package graphql

import (
	"encoding/json"
	"fmt"
)

// HTTPError represents an HTTP error with status coqgqde and response body.
type HTTPError struct {
	Response   Response
	StatusCode int
}

// Error implements the error interface for HTTPError.
func (e *HTTPError) Error() string {
	jsonBody, err := json.Marshal(e.Response)
	if err != nil {
		return fmt.Sprintf("returned error %v: '%s'", e.StatusCode, e.Response)
	}

	return fmt.Sprintf("returned error %v: %s", e.StatusCode, jsonBody)
}
