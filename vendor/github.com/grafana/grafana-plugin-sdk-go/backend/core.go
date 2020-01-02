package backend

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
)

// PluginConfig holds configuration for the queried plugin.
type PluginConfig struct {
	ID       int64
	OrgID    int64
	Name     string
	Type     string
	URL      string
	JSONData json.RawMessage
}

// PluginConfigFromProto converts the generated protobuf PluginConfig to this
// package's PluginConfig.
func pluginConfigFromProto(pc *pluginv2.PluginConfig) PluginConfig {
	return PluginConfig{
		ID:       pc.Id,
		OrgID:    pc.OrgId,
		Name:     pc.Name,
		Type:     pc.Type,
		URL:      pc.Url,
		JSONData: json.RawMessage(pc.JsonData),
	}
}

// FetchInfo is type information requested from the Check endpoint.
type FetchInfo int

const (
	// FetchInfoStatus is a request for plugin's status only (no info).
	FetchInfoStatus FetchInfo = iota
	// FetchInfoAPI is a request for an OpenAPI description of the plugin.
	FetchInfoAPI
	// FetchInfoMetrics is a request for Promotheus style metrics on the endpoint.
	FetchInfoMetrics
	// FetchInfoDebug is a request for JSON debug info (admin+ view).
	FetchInfoDebug
)

// fetchInfoFromProtobuf converts the generated protobuf PluginStatusRequest_FetchInfo to this
// package's FetchInfo.
func fetchInfoFromProtobuf(ptype pluginv2.PluginStatusRequest_FetchInfo) (FetchInfo, error) {
	switch ptype {
	case pluginv2.PluginStatusRequest_STATUS:
		return FetchInfoStatus, nil
	case pluginv2.PluginStatusRequest_API:
		return FetchInfoAPI, nil
	case pluginv2.PluginStatusRequest_METRICS:
		return FetchInfoMetrics, nil
	case pluginv2.PluginStatusRequest_DEBUG:
		return FetchInfoDebug, nil

	}
	return FetchInfoStatus, fmt.Errorf("unsupported protobuf FetchInfo type in sdk: %v", ptype)
}

// PluginStatus is the status of the Plugin and should be returned
// with any Check request.
type PluginStatus int

const (
	// PluginStatusUnknown means the status of the plugin is unknown.
	PluginStatusUnknown PluginStatus = iota
	// PluginStatusOk means the status of the plugin is good.
	PluginStatusOk
	// PluginStatusError means the plugin is in an error state.
	PluginStatusError
)

func (ps PluginStatus) toProtobuf() pluginv2.PluginStatusResponse_PluginStatus {
	switch ps {
	case PluginStatusUnknown:
		return pluginv2.PluginStatusResponse_UNKNOWN
	case PluginStatusOk:
		return pluginv2.PluginStatusResponse_OK
	case PluginStatusError:
		return pluginv2.PluginStatusResponse_ERROR
	}
	panic("unsupported protobuf FetchInfo type in sdk")
}

// CheckResponse is the return type from a Check Request.
type CheckResponse struct {
	Status PluginStatus
	Info   string
}

func (cr CheckResponse) toProtobuf() pluginv2.PluginStatusResponse {
	return pluginv2.PluginStatusResponse{
		Status: cr.Status.toProtobuf(),
		Info:   cr.Info,
	}
}

// coreWrapper converts to and from protobuf types.
type coreWrapper struct {
	plugin.NetRPCUnsupportedPlugin

	handlers PluginHandlers
}

// PluginHandlers is the collection of handlers that corresponds to the
// grpc "service BackendPlugin".
type PluginHandlers interface {
	DataQueryHandler
	CheckHandler
	ResourceHandler
}

// CheckHandler handles backend plugin checks.
type CheckHandler interface {
	Check(ctx context.Context, pc PluginConfig, headers map[string]string, fetch FetchInfo) (CheckResponse, error)
}

func (p *coreWrapper) Check(ctx context.Context, req *pluginv2.PluginStatusRequest) (*pluginv2.PluginStatusResponse, error) {
	fetchType, err := fetchInfoFromProtobuf(req.Fetch)
	if err != nil {
		return nil, err
	}
	pc := pluginConfigFromProto(req.Config)
	resp, err := p.handlers.Check(ctx, pc, req.Headers, fetchType)
	if err != nil {
		return nil, err
	}
	pbRes := resp.toProtobuf()
	return &pbRes, nil
}
