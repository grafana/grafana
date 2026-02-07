package xml

import (
	"encoding/xml"
	"fmt"
	"io"
)

// ErrorComponents represents the error response fields
// that will be deserialized from an xml error response body
type ErrorComponents struct {
	Code      string
	Message   string
	RequestID string
}

// GetErrorResponseComponents returns the error fields from an xml error response body
func GetErrorResponseComponents(r io.Reader, noErrorWrapping bool) (ErrorComponents, error) {
	if noErrorWrapping {
		var errResponse noWrappedErrorResponse
		if err := xml.NewDecoder(r).Decode(&errResponse); err != nil && err != io.EOF {
			return ErrorComponents{}, fmt.Errorf("error while deserializing xml error response: %w", err)
		}
		return ErrorComponents(errResponse), nil
	}

	var errResponse wrappedErrorResponse
	if err := xml.NewDecoder(r).Decode(&errResponse); err != nil && err != io.EOF {
		return ErrorComponents{}, fmt.Errorf("error while deserializing xml error response: %w", err)
	}
	return ErrorComponents(errResponse), nil
}

// noWrappedErrorResponse represents the error response body with
// no internal Error wrapping
type noWrappedErrorResponse struct {
	Code      string `xml:"Code"`
	Message   string `xml:"Message"`
	RequestID string `xml:"RequestId"`
}

// wrappedErrorResponse represents the error response body
// wrapped within Error
type wrappedErrorResponse struct {
	Code      string `xml:"Error>Code"`
	Message   string `xml:"Error>Message"`
	RequestID string `xml:"RequestId"`
}
