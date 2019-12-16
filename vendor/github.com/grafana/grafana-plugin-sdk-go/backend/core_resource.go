package backend

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

type ResourceRequest struct {
	Headers map[string]string
	Method  string
	Path    string
	Body    []byte
}

func resourceRequestFromProtobuf(req *pluginv2.ResourceRequest) *ResourceRequest {
	return &ResourceRequest{
		Headers: req.Headers,
		Method:  req.Method,
		Path:    req.Path,
		Body:    req.Body,
	}
}

type ResourceResponse struct {
	Headers map[string]string
	Code    int32
	Body    []byte
}

func (rr *ResourceResponse) toProtobuf() *pluginv2.ResourceResponse {
	return &pluginv2.ResourceResponse{
		Headers: rr.Headers,
		Code:    rr.Code,
		Body:    rr.Body,
	}
}

// ResourceHandler handles backend plugin checks.
type ResourceHandler interface {
	Resource(ctx context.Context, pc PluginConfig, req *ResourceRequest) (*ResourceResponse, error)
}

func (p *coreWrapper) Resource(ctx context.Context, req *pluginv2.ResourceRequest) (*pluginv2.ResourceResponse, error) {
	pc := pluginConfigFromProto(req.Config)
	resourceReq := resourceRequestFromProtobuf(req)
	res, err := p.handlers.Resource(ctx, pc, resourceReq)
	if err != nil {
		return nil, err
	}
	return res.toProtobuf(), nil

}
