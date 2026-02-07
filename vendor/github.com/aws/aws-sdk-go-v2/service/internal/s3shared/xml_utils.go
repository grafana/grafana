package s3shared

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// ErrorComponents represents the error response fields
// that will be deserialized from an xml error response body
type ErrorComponents struct {
	Code      string `xml:"Code"`
	Message   string `xml:"Message"`
	RequestID string `xml:"RequestId"`
	HostID    string `xml:"HostId"`
}

// GetUnwrappedErrorResponseComponents returns the error fields from an xml error response body
func GetUnwrappedErrorResponseComponents(r io.Reader) (ErrorComponents, error) {
	var errComponents ErrorComponents
	if err := xml.NewDecoder(r).Decode(&errComponents); err != nil && err != io.EOF {
		return ErrorComponents{}, fmt.Errorf("error while deserializing xml error response : %w", err)
	}
	return errComponents, nil
}

// GetWrappedErrorResponseComponents returns the error fields from an xml error response body
// in which error code, and message are wrapped by a <Error> tag
func GetWrappedErrorResponseComponents(r io.Reader) (ErrorComponents, error) {
	var errComponents struct {
		Code      string `xml:"Error>Code"`
		Message   string `xml:"Error>Message"`
		RequestID string `xml:"RequestId"`
		HostID    string `xml:"HostId"`
	}

	if err := xml.NewDecoder(r).Decode(&errComponents); err != nil && err != io.EOF {
		return ErrorComponents{}, fmt.Errorf("error while deserializing xml error response : %w", err)
	}

	return ErrorComponents{
		Code:      errComponents.Code,
		Message:   errComponents.Message,
		RequestID: errComponents.RequestID,
		HostID:    errComponents.HostID,
	}, nil
}

// GetErrorResponseComponents retrieves error components according to passed in options
func GetErrorResponseComponents(r io.Reader, options ErrorResponseDeserializerOptions) (ErrorComponents, error) {
	var errComponents ErrorComponents
	var err error

	if options.IsWrappedWithErrorTag {
		errComponents, err = GetWrappedErrorResponseComponents(r)
	} else {
		errComponents, err = GetUnwrappedErrorResponseComponents(r)
	}

	if err != nil {
		return ErrorComponents{}, err
	}

	// If an error code or message is not retrieved, it is derived from the http status code
	// eg, for S3 service, we derive err code and message, if none is found
	if options.UseStatusCode && len(errComponents.Code) == 0 &&
		len(errComponents.Message) == 0 {
		// derive code and message from status code
		statusText := http.StatusText(options.StatusCode)
		errComponents.Code = strings.Replace(statusText, " ", "", -1)
		errComponents.Message = statusText
	}
	return errComponents, nil
}

// ErrorResponseDeserializerOptions represents error response deserializer options for s3 and s3-control service
type ErrorResponseDeserializerOptions struct {
	// UseStatusCode denotes if status code should be used to retrieve error code, msg
	UseStatusCode bool

	// StatusCode is status code of error response
	StatusCode int

	//IsWrappedWithErrorTag represents if error response's code, msg is wrapped within an
	// additional <Error> tag
	IsWrappedWithErrorTag bool
}
