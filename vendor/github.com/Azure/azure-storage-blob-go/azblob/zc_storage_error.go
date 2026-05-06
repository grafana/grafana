package azblob

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"net/http"
	"sort"

	"github.com/Azure/azure-pipeline-go/pipeline"
)

func init() {
	// wire up our custom error handling constructor
	responseErrorFactory = newStorageError
}

// ServiceCodeType is a string identifying a storage service error.
// For more information, see https://docs.microsoft.com/en-us/rest/api/storageservices/status-and-error-codes2
type ServiceCodeType string

// StorageError identifies a responder-generated network or response parsing error.
type StorageError interface {
	// ResponseError implements error's Error(), net.Error's Temporary() and Timeout() methods & Response().
	ResponseError

	// ServiceCode returns a service error code. Your code can use this to make error recovery decisions.
	ServiceCode() ServiceCodeType
}

// storageError is the internal struct that implements the public StorageError interface.
type storageError struct {
	responseError
	serviceCode ServiceCodeType
	details     map[string]string
}

// newStorageError creates an error object that implements the error interface.
func newStorageError(cause error, response *http.Response, description string) error {
	return &storageError{
		responseError: responseError{
			ErrorNode:   pipeline.ErrorNode{}.Initialize(cause, 3),
			response:    response,
			description: description,
		},
		serviceCode: ServiceCodeType(response.Header.Get("x-ms-error-code")),
	}
}

// ServiceCode returns service-error information. The caller may examine these values but should not modify any of them.
func (e *storageError) ServiceCode() ServiceCodeType {
	return e.serviceCode
}

// Error implements the error interface's Error method to return a string representation of the error.
func (e *storageError) Error() string {
	b := &bytes.Buffer{}
	fmt.Fprintf(b, "===== RESPONSE ERROR (ServiceCode=%s) =====\n", e.serviceCode)
	fmt.Fprintf(b, "Description=%s, Details: ", e.description)
	if len(e.details) == 0 {
		b.WriteString("(none)\n")
	} else {
		b.WriteRune('\n')
		keys := make([]string, 0, len(e.details))
		// Alphabetize the details
		for k := range e.details {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			fmt.Fprintf(b, "   %s: %+v\n", k, e.details[k])
		}
	}
	req := pipeline.Request{Request: e.response.Request}.Copy() // Make a copy of the response's request
	pipeline.WriteRequestWithResponse(b, prepareRequestForLogging(req), e.response, nil)
	return e.ErrorNode.Error(b.String())
}

// Temporary returns true if the error occurred due to a temporary condition (including an HTTP status of 500 or 503).
func (e *storageError) Temporary() bool {
	if e.response != nil {
		if (e.response.StatusCode == http.StatusInternalServerError) || (e.response.StatusCode == http.StatusServiceUnavailable) || (e.response.StatusCode == http.StatusBadGateway) {
			return true
		}
	}
	return e.ErrorNode.Temporary()
}

// UnmarshalXML performs custom unmarshalling of XML-formatted Azure storage request errors.
func (e *storageError) UnmarshalXML(d *xml.Decoder, start xml.StartElement) (err error) {
	tokName := ""
	var t xml.Token
	for t, err = d.Token(); err == nil; t, err = d.Token() {
		switch tt := t.(type) {
		case xml.StartElement:
			tokName = tt.Name.Local
			break
		case xml.CharData:
			switch tokName {
			case "Message":
				e.description = string(tt)
			default:
				if e.details == nil {
					e.details = map[string]string{}
				}
				e.details[tokName] = string(tt)
			}
		}
	}
	return nil
}
