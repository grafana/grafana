// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/httpgrpc/httpgrpc.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package httpgrpc

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"

	"github.com/go-kit/log/level"
	spb "github.com/gogo/googleapis/google/rpc"
	"github.com/gogo/protobuf/types"
	"github.com/gogo/status"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/dskit/grpcutil"
	"github.com/grafana/dskit/log"
)

const (
	MetadataMethod = "httpgrpc-method"
	MetadataURL    = "httpgrpc-url"
)

// AppendRequestMetadataToContext appends metadata of HTTPRequest into gRPC metadata.
func AppendRequestMetadataToContext(ctx context.Context, req *HTTPRequest) context.Context {
	return metadata.AppendToOutgoingContext(ctx,
		MetadataMethod, req.Method,
		MetadataURL, req.Url)
}

type nopCloser struct {
	*bytes.Buffer
}

func (nopCloser) Close() error { return nil }

// BytesBuffer returns the underlaying `bytes.buffer` used to build this io.ReadCloser.
func (n nopCloser) BytesBuffer() *bytes.Buffer { return n.Buffer }

// FromHTTPRequest converts an ordinary http.Request into an httpgrpc.HTTPRequest
func FromHTTPRequest(r *http.Request) (*HTTPRequest, error) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}
	return &HTTPRequest{
		Method:  r.Method,
		Url:     r.RequestURI,
		Body:    body,
		Headers: FromHeader(r.Header),
	}, nil
}

// ToHTTPRequest converts httpgrpc.HTTPRequest to http.Request.
func ToHTTPRequest(ctx context.Context, r *HTTPRequest) (*http.Request, error) {
	req, err := http.NewRequest(r.Method, r.Url, nopCloser{Buffer: bytes.NewBuffer(r.Body)})
	if err != nil {
		return nil, err
	}
	ToHeader(r.Headers, req.Header)
	req = req.WithContext(ctx)
	req.RequestURI = r.Url
	req.ContentLength = int64(len(r.Body))
	return req, nil
}

// WriteResponse converts an httpgrpc response to an HTTP one
func WriteResponse(w http.ResponseWriter, resp *HTTPResponse) error {
	ToHeader(resp.Headers, w.Header())
	w.WriteHeader(int(resp.Code))
	_, err := w.Write(resp.Body)
	return err
}

// WriteError converts an httpgrpc error to an HTTP one
func WriteError(w http.ResponseWriter, err error) {
	resp, ok := HTTPResponseFromError(err)
	if ok {
		_ = WriteResponse(w, resp)
	} else {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func ToHeader(hs []*Header, header http.Header) {
	for _, h := range hs {
		// http.Header expects header to be stored in canonical form,
		// otherwise they are inaccessible with Get() on a http.Header struct.
		header[http.CanonicalHeaderKey(h.Key)] = h.Values
	}
}

func FromHeader(hs http.Header) []*Header {
	result := make([]*Header, 0, len(hs))
	for k, vs := range hs {
		result = append(result, &Header{
			Key:    k,
			Values: vs,
		})
	}
	return result
}

// Error returns a HTTP gRPC error that is correctly forwarded over
// gRPC, and can eventually be converted back to a HTTP response with
// HTTPResponseFromError.
func Error(code int, msg string) error {
	return ErrorFromHTTPResponse(&HTTPResponse{
		Code: int32(code),
		Body: []byte(msg),
	})
}

// Errorf returns a HTTP gRPC error that is correctly forwarded over
// gRPC, and can eventually be converted back to a HTTP response with
// HTTPResponseFromError.
func Errorf(code int, tmpl string, args ...interface{}) error {
	return Error(code, fmt.Sprintf(tmpl, args...))
}

// ErrorFromHTTPResponse converts an HTTP response into a grpc error, and uses HTTP response body as an error message.
// Note that if HTTP response body contains non-utf8 string, then returned error cannot be marshalled by protobuf.
func ErrorFromHTTPResponse(resp *HTTPResponse) error {
	return ErrorFromHTTPResponseWithMessage(resp, string(resp.Body))
}

// ErrorFromHTTPResponseWithMessage converts an HTTP response into a grpc error, and uses supplied message for Error message.
func ErrorFromHTTPResponseWithMessage(resp *HTTPResponse, msg string) error {
	a, err := types.MarshalAny(resp)
	if err != nil {
		return err
	}

	return status.ErrorProto(&spb.Status{
		Code:    resp.Code,
		Message: msg,
		Details: []*types.Any{a},
	})
}

// HTTPResponseFromError converts a grpc error into an HTTP response
func HTTPResponseFromError(err error) (*HTTPResponse, bool) {
	s, ok := grpcutil.ErrorToStatus(err)
	if !ok {
		return nil, false
	}

	status := s.Proto()
	if len(status.Details) != 1 {
		return nil, false
	}

	var resp HTTPResponse
	if err := types.UnmarshalAny(status.Details[0], &resp); err != nil {
		level.Error(log.Global()).Log("msg", "got error containing non-response", "err", err)
		return nil, false
	}

	return &resp, true
}
