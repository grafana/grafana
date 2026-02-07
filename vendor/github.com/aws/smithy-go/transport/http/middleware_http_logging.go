package http

import (
	"context"
	"fmt"
	"net/http/httputil"

	"github.com/aws/smithy-go/logging"
	"github.com/aws/smithy-go/middleware"
)

// RequestResponseLogger is a deserialize middleware that will log the request and response HTTP messages and optionally
// their respective bodies. Will not perform any logging if none of the options are set.
type RequestResponseLogger struct {
	LogRequest         bool
	LogRequestWithBody bool

	LogResponse         bool
	LogResponseWithBody bool
}

// ID is the middleware identifier.
func (r *RequestResponseLogger) ID() string {
	return "RequestResponseLogger"
}

// HandleDeserialize will log the request and response HTTP messages if configured accordingly.
func (r *RequestResponseLogger) HandleDeserialize(
	ctx context.Context, in middleware.DeserializeInput, next middleware.DeserializeHandler,
) (
	out middleware.DeserializeOutput, metadata middleware.Metadata, err error,
) {
	logger := middleware.GetLogger(ctx)

	if r.LogRequest || r.LogRequestWithBody {
		smithyRequest, ok := in.Request.(*Request)
		if !ok {
			return out, metadata, fmt.Errorf("unknown transport type %T", in)
		}

		rc := smithyRequest.Build(ctx)
		reqBytes, err := httputil.DumpRequestOut(rc, r.LogRequestWithBody)
		if err != nil {
			return out, metadata, err
		}

		logger.Logf(logging.Debug, "Request\n%v", string(reqBytes))

		if r.LogRequestWithBody {
			smithyRequest, err = smithyRequest.SetStream(rc.Body)
			if err != nil {
				return out, metadata, err
			}
			in.Request = smithyRequest
		}
	}

	out, metadata, err = next.HandleDeserialize(ctx, in)

	if (err == nil) && (r.LogResponse || r.LogResponseWithBody) {
		smithyResponse, ok := out.RawResponse.(*Response)
		if !ok {
			return out, metadata, fmt.Errorf("unknown transport type %T", out.RawResponse)
		}

		respBytes, err := httputil.DumpResponse(smithyResponse.Response, r.LogResponseWithBody)
		if err != nil {
			return out, metadata, fmt.Errorf("failed to dump response %w", err)
		}

		logger.Logf(logging.Debug, "Response\n%v", string(respBytes))
	}

	return out, metadata, err
}
