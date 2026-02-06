package grpcplugin

import (
	"context"

	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

// AdmissionServer represents an admission control server.
type AdmissionServer interface {
	pluginv2.AdmissionControlServer
}

// AdmissionClient represents an admission control client.
type AdmissionClient interface {
	pluginv2.AdmissionControlClient
}

// AdmissionGRPCPlugin implements the GRPCPlugin interface from github.com/hashicorp/go-plugin.
type AdmissionGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	plugin.GRPCPlugin
	AdmissionServer AdmissionServer
}

// GRPCServer registers p as an admission control gRPC server.
func (p *AdmissionGRPCPlugin) GRPCServer(_ *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterAdmissionControlServer(s, &admissionGRPCServer{
		server: p.AdmissionServer,
	})
	return nil
}

func (p *AdmissionGRPCPlugin) GRPCClient(_ context.Context, _ *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &admissionGRPCClient{client: pluginv2.NewAdmissionControlClient(c)}, nil
}

type admissionGRPCServer struct {
	server AdmissionServer
}

func (s *admissionGRPCServer) ValidateAdmission(ctx context.Context, req *pluginv2.AdmissionRequest) (*pluginv2.ValidationResponse, error) {
	return s.server.ValidateAdmission(ctx, req)
}

func (s *admissionGRPCServer) MutateAdmission(ctx context.Context, req *pluginv2.AdmissionRequest) (*pluginv2.MutationResponse, error) {
	return s.server.MutateAdmission(ctx, req)
}

type admissionGRPCClient struct {
	client AdmissionClient
}

func (s *admissionGRPCClient) ValidateAdmission(ctx context.Context, req *pluginv2.AdmissionRequest, opts ...grpc.CallOption) (*pluginv2.ValidationResponse, error) {
	return s.client.ValidateAdmission(ctx, req, opts...)
}

func (s *admissionGRPCClient) MutateAdmission(ctx context.Context, req *pluginv2.AdmissionRequest, opts ...grpc.CallOption) (*pluginv2.MutationResponse, error) {
	return s.client.MutateAdmission(ctx, req, opts...)
}

var _ AdmissionServer = &admissionGRPCServer{}
var _ AdmissionClient = &admissionGRPCClient{}
