package backend

import (
	"context"
	"errors"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/status"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

const (
	errorSourceMetadataKey = "errorSource"
)

// dataSDKAdapter adapter between low level plugin protocol and SDK interfaces.
type dataSDKAdapter struct {
	queryDataHandler QueryDataHandler
}

func newDataSDKAdapter(handler QueryDataHandler) *dataSDKAdapter {
	return &dataSDKAdapter{
		queryDataHandler: handler,
	}
}

func (a *dataSDKAdapter) QueryData(ctx context.Context, req *pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error) {
	parsedReq := FromProto().QueryDataRequest(req)
	resp, err := a.queryDataHandler.QueryData(ctx, parsedReq)
	if err != nil {
		return nil, enrichWithErrorSourceInfo(err)
	}

	if resp == nil {
		return nil, errors.New("both response and error are nil, but one must be provided")
	}

	return ToProto().QueryDataResponse(resp)
}

// enrichWithErrorSourceInfo returns a gRPC status error with error source info as metadata.
func enrichWithErrorSourceInfo(err error) error {
	var errorSource status.Source
	if IsDownstreamError(err) {
		errorSource = status.SourceDownstream
	} else if IsPluginError(err) {
		errorSource = status.SourcePlugin
	}

	// Unless the error is explicitly marked as a plugin or downstream error, we don't enrich it.
	if errorSource == "" {
		return err
	}

	status := grpcstatus.New(codes.Unknown, err.Error())
	status, innerErr := status.WithDetails(&errdetails.ErrorInfo{
		Metadata: map[string]string{
			errorSourceMetadataKey: errorSource.String(),
		},
	})
	if innerErr != nil {
		return err
	}

	return status.Err()
}

// HandleGrpcStatusError handles gRPC status errors by extracting the error source from the error details and injecting
// the error source into context.
func ErrorSourceFromGrpcStatusError(ctx context.Context, err error) (status.Source, bool) {
	st := grpcstatus.Convert(err)
	if st == nil {
		return status.DefaultSource, false
	}
	for _, detail := range st.Details() {
		if errorInfo, ok := detail.(*errdetails.ErrorInfo); ok {
			errorSource, exists := errorInfo.Metadata[errorSourceMetadataKey]
			if !exists {
				break
			}

			switch errorSource {
			case string(ErrorSourceDownstream):
				innerErr := WithErrorSource(ctx, ErrorSourceDownstream)
				if innerErr != nil {
					Logger.Error("Could not set downstream error source", "error", innerErr)
				}
				return status.SourceDownstream, true
			case string(ErrorSourcePlugin):
				errorSourceErr := WithErrorSource(ctx, ErrorSourcePlugin)
				if errorSourceErr != nil {
					Logger.Error("Could not set plugin error source", "error", errorSourceErr)
				}
				return status.SourcePlugin, true
			}
		}
	}
	return status.DefaultSource, false
}
