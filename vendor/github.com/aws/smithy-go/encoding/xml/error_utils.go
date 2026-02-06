package xml

import (
	"encoding/xml"
	"fmt"
	"io"
)

// ErrorComponents represents the error response fields
// that will be deserialized from an xml error response body
type ErrorComponents struct {
	Code    string
	Message string
}

// GetErrorResponseComponents returns the error fields from an xml error response body
func GetErrorResponseComponents(r io.Reader, noErrorWrapping bool) (ErrorComponents, error) {
	if noErrorWrapping {
		var errResponse noWrappedErrorResponse
		if err := xml.NewDecoder(r).Decode(&errResponse); err != nil && err != io.EOF {
			return ErrorComponents{}, fmt.Errorf("error while deserializing xml error response: %w", err)
		}
		return ErrorComponents{
			Code:    errResponse.Code,
			Message: errResponse.Message,
		}, nil
	}

	var errResponse wrappedErrorResponse
	if err := xml.NewDecoder(r).Decode(&errResponse); err != nil && err != io.EOF {
		return ErrorComponents{}, fmt.Errorf("error while deserializing xml error response: %w", err)
	}
	return ErrorComponents{
		Code:    errResponse.Code,
		Message: errResponse.Message,
	}, nil
}

// noWrappedErrorResponse represents the error response body with
// no internal <Error></Error wrapping
type noWrappedErrorResponse struct {
	Code    string `xml:"Code"`
	Message string `xml:"Message"`
}

// wrappedErrorResponse represents the error response body
// wrapped within <Error>...</Error>
type wrappedErrorResponse struct {
	Code    string `xml:"Error>Code"`
	Message string `xml:"Error>Message"`
}
