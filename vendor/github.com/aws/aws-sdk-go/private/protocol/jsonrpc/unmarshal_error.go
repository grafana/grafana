package jsonrpc

import (
	"bytes"
	"io"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/private/protocol"
	"github.com/aws/aws-sdk-go/private/protocol/json/jsonutil"
)

const (
	awsQueryError = "x-amzn-query-error"
	// A valid header example - "x-amzn-query-error": "<QueryErrorCode>;<ErrorType>"
	awsQueryErrorPartsCount = 2
)

// UnmarshalTypedError provides unmarshaling errors API response errors
// for both typed and untyped errors.
type UnmarshalTypedError struct {
	exceptions      map[string]func(protocol.ResponseMetadata) error
	queryExceptions map[string]func(protocol.ResponseMetadata, string) error
}

// NewUnmarshalTypedError returns an UnmarshalTypedError initialized for the
// set of exception names to the error unmarshalers
func NewUnmarshalTypedError(exceptions map[string]func(protocol.ResponseMetadata) error) *UnmarshalTypedError {
	return &UnmarshalTypedError{
		exceptions:      exceptions,
		queryExceptions: map[string]func(protocol.ResponseMetadata, string) error{},
	}
}

// NewUnmarshalTypedErrorWithOptions works similar to NewUnmarshalTypedError applying options to the UnmarshalTypedError
// before returning it
func NewUnmarshalTypedErrorWithOptions(exceptions map[string]func(protocol.ResponseMetadata) error, optFns ...func(*UnmarshalTypedError)) *UnmarshalTypedError {
	unmarshaledError := NewUnmarshalTypedError(exceptions)
	for _, fn := range optFns {
		fn(unmarshaledError)
	}
	return unmarshaledError
}

// WithQueryCompatibility is a helper function to construct a functional option for use with NewUnmarshalTypedErrorWithOptions.
// The queryExceptions given act as an override for unmarshalling errors when query compatible error codes are found.
// See also [awsQueryCompatible trait]
//
// [awsQueryCompatible trait]: https://smithy.io/2.0/aws/protocols/aws-query-protocol.html#aws-protocols-awsquerycompatible-trait
func WithQueryCompatibility(queryExceptions map[string]func(protocol.ResponseMetadata, string) error) func(*UnmarshalTypedError) {
	return func(typedError *UnmarshalTypedError) {
		typedError.queryExceptions = queryExceptions
	}
}

// UnmarshalError attempts to unmarshal the HTTP response error as a known
// error type. If unable to unmarshal the error type, the generic SDK error
// type will be used.
func (u *UnmarshalTypedError) UnmarshalError(
	resp *http.Response,
	respMeta protocol.ResponseMetadata,
) (error, error) {

	var buf bytes.Buffer
	var jsonErr jsonErrorResponse
	teeReader := io.TeeReader(resp.Body, &buf)
	err := jsonutil.UnmarshalJSONError(&jsonErr, teeReader)
	if err != nil {
		return nil, err
	}
	body := ioutil.NopCloser(&buf)

	// Code may be separated by hash(#), with the last element being the code
	// used by the SDK.
	codeParts := strings.SplitN(jsonErr.Code, "#", 2)
	code := codeParts[len(codeParts)-1]
	msg := jsonErr.Message

	queryCodeParts := queryCodeParts(resp, u)

	if fn, ok := u.exceptions[code]; ok {
		// If query-compatible exceptions are found and query-error-header is found,
		// then use associated constructor to get exception with query error code.
		//
		// If exception code is known, use associated constructor to get a value
		// for the exception that the JSON body can be unmarshaled into.
		var v error
		queryErrFn, queryExceptionsFound := u.queryExceptions[code]
		if len(queryCodeParts) == awsQueryErrorPartsCount && queryExceptionsFound {
			v = queryErrFn(respMeta, queryCodeParts[0])
		} else {
			v = fn(respMeta)
		}
		err := jsonutil.UnmarshalJSONCaseInsensitive(v, body)
		if err != nil {
			return nil, err
		}
		return v, nil
	}

	if len(queryCodeParts) == awsQueryErrorPartsCount && len(u.queryExceptions) > 0 {
		code = queryCodeParts[0]
	}

	// fallback to unmodeled generic exceptions
	return awserr.NewRequestFailure(
		awserr.New(code, msg, nil),
		respMeta.StatusCode,
		respMeta.RequestID,
	), nil
}

// A valid header example - "x-amzn-query-error": "<QueryErrorCode>;<ErrorType>"
func queryCodeParts(resp *http.Response, u *UnmarshalTypedError) []string {
	queryCodeHeader := resp.Header.Get(awsQueryError)
	var queryCodeParts []string
	if queryCodeHeader != "" && len(u.queryExceptions) > 0 {
		queryCodeParts = strings.Split(queryCodeHeader, ";")
	}
	return queryCodeParts
}

// UnmarshalErrorHandler is a named request handler for unmarshaling jsonrpc
// protocol request errors
var UnmarshalErrorHandler = request.NamedHandler{
	Name: "awssdk.jsonrpc.UnmarshalError",
	Fn:   UnmarshalError,
}

// UnmarshalError unmarshals an error response for a JSON RPC service.
func UnmarshalError(req *request.Request) {
	defer req.HTTPResponse.Body.Close()

	var jsonErr jsonErrorResponse
	err := jsonutil.UnmarshalJSONError(&jsonErr, req.HTTPResponse.Body)
	if err != nil {
		req.Error = awserr.NewRequestFailure(
			awserr.New(request.ErrCodeSerialization,
				"failed to unmarshal error message", err),
			req.HTTPResponse.StatusCode,
			req.RequestID,
		)
		return
	}

	codes := strings.SplitN(jsonErr.Code, "#", 2)
	req.Error = awserr.NewRequestFailure(
		awserr.New(codes[len(codes)-1], jsonErr.Message, nil),
		req.HTTPResponse.StatusCode,
		req.RequestID,
	)
}

type jsonErrorResponse struct {
	Code    string `json:"__type"`
	Message string `json:"message"`
}
