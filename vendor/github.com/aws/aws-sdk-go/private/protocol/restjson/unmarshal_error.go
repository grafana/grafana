package restjson

import (
	"bytes"
	"encoding/json"
	"io"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/private/protocol"
	"github.com/aws/aws-sdk-go/private/protocol/json/jsonutil"
	"github.com/aws/aws-sdk-go/private/protocol/rest"
)

const (
	errorTypeHeader    = "X-Amzn-Errortype"
	errorMessageHeader = "X-Amzn-Errormessage"
)

// UnmarshalTypedError provides unmarshaling errors API response errors
// for both typed and untyped errors.
type UnmarshalTypedError struct {
	exceptions map[string]func(protocol.ResponseMetadata) error
}

// NewUnmarshalTypedError returns an UnmarshalTypedError initialized for the
// set of exception names to the error unmarshalers
func NewUnmarshalTypedError(exceptions map[string]func(protocol.ResponseMetadata) error) *UnmarshalTypedError {
	return &UnmarshalTypedError{
		exceptions: exceptions,
	}
}

// UnmarshalError attempts to unmarshal the HTTP response error as a known
// error type. If unable to unmarshal the error type, the generic SDK error
// type will be used.
func (u *UnmarshalTypedError) UnmarshalError(
	resp *http.Response,
	respMeta protocol.ResponseMetadata,
) (error, error) {
	code, msg, err := unmarshalErrorInfo(resp)
	if err != nil {
		return nil, err
	}

	fn, ok := u.exceptions[code]
	if !ok {
		return awserr.NewRequestFailure(
			awserr.New(code, msg, nil),
			respMeta.StatusCode,
			respMeta.RequestID,
		), nil
	}

	v := fn(respMeta)
	if err := jsonutil.UnmarshalJSONCaseInsensitive(v, resp.Body); err != nil {
		return nil, err
	}

	if err := rest.UnmarshalResponse(resp, v, true); err != nil {
		return nil, err
	}

	return v, nil
}

// UnmarshalErrorHandler is a named request handler for unmarshaling restjson
// protocol request errors
var UnmarshalErrorHandler = request.NamedHandler{
	Name: "awssdk.restjson.UnmarshalError",
	Fn:   UnmarshalError,
}

// UnmarshalError unmarshals a response error for the REST JSON protocol.
func UnmarshalError(r *request.Request) {
	defer r.HTTPResponse.Body.Close()

	code, msg, err := unmarshalErrorInfo(r.HTTPResponse)
	if err != nil {
		r.Error = awserr.NewRequestFailure(
			awserr.New(request.ErrCodeSerialization, "failed to unmarshal response error", err),
			r.HTTPResponse.StatusCode,
			r.RequestID,
		)
		return
	}

	r.Error = awserr.NewRequestFailure(
		awserr.New(code, msg, nil),
		r.HTTPResponse.StatusCode,
		r.RequestID,
	)
}

type jsonErrorResponse struct {
	Type    string `json:"__type"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (j *jsonErrorResponse) SanitizedCode() string {
	code := j.Code
	if len(j.Type) > 0 {
		code = j.Type
	}
	return sanitizeCode(code)
}

// Remove superfluous components from a restJson error code.
//   - If a : character is present, then take only the contents before the
//     first : character in the value.
//   - If a # character is present, then take only the contents after the first
//     # character in the value.
//
// All of the following error values resolve to FooError:
//   - FooError
//   - FooError:http://internal.amazon.com/coral/com.amazon.coral.validate/
//   - aws.protocoltests.restjson#FooError
//   - aws.protocoltests.restjson#FooError:http://internal.amazon.com/coral/com.amazon.coral.validate/
func sanitizeCode(code string) string {
	noColon := strings.SplitN(code, ":", 2)[0]
	hashSplit := strings.SplitN(noColon, "#", 2)
	return hashSplit[len(hashSplit)-1]
}

// attempt to garner error details from the response, preferring header values
// when present
func unmarshalErrorInfo(resp *http.Response) (code string, msg string, err error) {
	code = sanitizeCode(resp.Header.Get(errorTypeHeader))
	msg = resp.Header.Get(errorMessageHeader)
	if len(code) > 0 && len(msg) > 0 {
		return
	}

	// a modeled error will have to be re-deserialized later, so the body must
	// be preserved
	var buf bytes.Buffer
	tee := io.TeeReader(resp.Body, &buf)
	defer func() { resp.Body = ioutil.NopCloser(&buf) }()

	var jsonErr jsonErrorResponse
	if decodeErr := json.NewDecoder(tee).Decode(&jsonErr); decodeErr != nil && decodeErr != io.EOF {
		err = awserr.NewUnmarshalError(decodeErr, "failed to decode response body", buf.Bytes())
		return
	}

	if len(code) == 0 {
		code = jsonErr.SanitizedCode()
	}
	if len(msg) == 0 {
		msg = jsonErr.Message
	}
	return
}
