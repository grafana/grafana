package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/textproto"
	"strconv"
	"strings"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc/grpclog"
	"google.golang.org/protobuf/proto"

	"github.com/openfga/openfga/pkg/server/errors"
)

// XHttpCode is used to set the header for the response HTTP code.
const XHttpCode = "x-http-code"

// HTTPResponseModifier is a helper function designed to modify the status code in the context of HTTP responses.
func HTTPResponseModifier(ctx context.Context, w http.ResponseWriter, p proto.Message) error {
	md, ok := runtime.ServerMetadataFromContext(ctx)
	if !ok {
		return nil
	}

	// Set http status code.
	if vals := md.HeaderMD.Get(XHttpCode); len(vals) > 0 {
		code, err := strconv.Atoi(vals[0])
		if err != nil {
			return err
		}
		// Delete the headers to not expose any grpc-metadata in http response.
		delete(md.HeaderMD, XHttpCode)
		delete(w.Header(), "Grpc-Metadata-X-Http-Code")
		w.WriteHeader(code)
	}

	return nil
}

func requestAcceptsTrailers(req *http.Request) bool {
	te := req.Header.Get("TE")
	return strings.Contains(strings.ToLower(te), "trailers")
}

func handleForwardResponseTrailerHeader(w http.ResponseWriter, md runtime.ServerMetadata) {
	for k := range md.TrailerMD {
		tKey := textproto.CanonicalMIMEHeaderKey(fmt.Sprintf("%s%s", runtime.MetadataTrailerPrefix, k))
		w.Header().Add("Trailer", tKey)
	}
}

func handleForwardResponseTrailer(w http.ResponseWriter, md runtime.ServerMetadata) {
	for k, vs := range md.TrailerMD {
		tKey := fmt.Sprintf("%s%s", runtime.MetadataTrailerPrefix, k)
		for _, v := range vs {
			w.Header().Add(tKey, v)
		}
	}
}

// CustomHTTPErrorHandler handles custom error objects in the context of HTTP requests.
// It is similar to [runtime.DefaultHTTPErrorHandler] but accepts an [*errors.EncodedError] object.
func CustomHTTPErrorHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, err *errors.EncodedError) {
	// Convert as error object.
	pb := err.ActualError

	w.Header().Del("Trailer")
	w.Header().Del("Transfer-Encoding")

	w.Header().Set("Content-Type", "application/json")

	buf := bytes.NewBuffer([]byte{})
	jsonEncoder := json.NewEncoder(buf)
	jsonEncoder.SetEscapeHTML(false)
	if err := jsonEncoder.Encode(pb); err != nil {
		grpclog.Errorf("failed to json encode the protobuf error '%v'", pb)
	}

	md, ok := runtime.ServerMetadataFromContext(ctx)
	if !ok {
		grpclog.Infof("Failed to extract ServerMetadata from context")
	}
	for k, val := range md.HeaderMD {
		for _, individualVal := range val {
			if k != "content-type" {
				w.Header().Set(k, individualVal)
			}
		}
	}

	// RFC 7230 https://tools.ietf.org/html/rfc7230#section-4.1.2
	// Unless the request includes a TE header field indicating "trailers"
	// is acceptable, as described in Section 4.3, a server SHOULD NOT
	// generate trailer fields that it believes are necessary for the user
	// agent to receive.
	doForwardTrailers := requestAcceptsTrailers(r)

	if doForwardTrailers {
		handleForwardResponseTrailerHeader(w, md)
		w.Header().Set("Transfer-Encoding", "chunked")
	}

	st := err.HTTPStatusCode

	w.WriteHeader(st)
	if _, err := w.Write(buf.Bytes()); err != nil { // nosemgrep: no-direct-write-to-responsewriter
		grpclog.Infof("Failed to write response: %v", err)
	}

	if doForwardTrailers {
		handleForwardResponseTrailer(w, md)
	}
}
