package plugin

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

type TransformServer interface {
	TransformData(ctx context.Context, req *pluginv2.QueryDataRequest, callback TransformDataCallBack) (*pluginv2.QueryDataResponse, error)
}

type TransformClient interface {
	TransformData(ctx context.Context, req *pluginv2.QueryDataRequest, callback TransformDataCallBack) (*pluginv2.QueryDataResponse, error)
}

type TransformDataCallBack interface {
	QueryData(ctx context.Context, req *pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error)
}

// TransformGRPCPlugin implements the GRPCPlugin interface from github.com/hashicorp/go-plugin.
type TransformGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	plugin.GRPCPlugin
	TransformServer TransformServer
}

func (p *TransformGRPCPlugin) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterTransformServer(s, &transformGRPCServer{
		server: p.TransformServer,
		broker: broker,
	})
	return nil
}

func (p *TransformGRPCPlugin) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &transformGRPCClient{client: pluginv2.NewTransformClient(c), broker: broker}, nil
}

type transformGRPCServer struct {
	broker *plugin.GRPCBroker
	server TransformServer
}

func (t *transformGRPCServer) TransformData(ctx context.Context, req *pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, fmt.Errorf("transform request is missing metadata")
	}
	rawReqIDValues := md.Get("broker_requestId") // TODO const
	if len(rawReqIDValues) != 1 {
		return nil, fmt.Errorf("transform request metadata is missing broker_requestId, %v", md)
	}
	id64, err := strconv.ParseUint(rawReqIDValues[0], 10, 32)
	if err != nil {
		return nil, err
	}
	conn, err := t.broker.Dial(uint32(id64))
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	api := &transformDataCallBackGrpcClient{pluginv2.NewTransformDataCallBackClient(conn)}
	return t.server.TransformData(ctx, req, api)
}

type transformGRPCClient struct {
	broker *plugin.GRPCBroker
	client pluginv2.TransformClient
}

func (t *transformGRPCClient) TransformData(ctx context.Context, req *pluginv2.QueryDataRequest, callBack TransformDataCallBack) (*pluginv2.QueryDataResponse, error) {
	callBackServer := &transformDataCallBackGrpcServer{Impl: callBack}

	var s *grpc.Server
	serverFunc := func(opts []grpc.ServerOption) *grpc.Server {
		s = grpc.NewServer(opts...)
		pluginv2.RegisterTransformDataCallBackServer(s, callBackServer)

		return s
	}
	brokerID := t.broker.NextId()

	go t.broker.AcceptAndServe(brokerID, serverFunc)
	ctx = metadata.AppendToOutgoingContext(ctx, "broker_requestId", strconv.FormatUint(uint64(brokerID), 10))
	res, err := t.client.TransformData(ctx, req)
	s.Stop()
	return res, err
}

// Callback

type transformDataCallBackGrpcServer struct {
	Impl TransformDataCallBack
}

func (g *transformDataCallBackGrpcServer) QueryData(ctx context.Context, req *pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error) {
	return g.Impl.QueryData(ctx, req)
}

type transformDataCallBackGrpcClient struct {
	client pluginv2.TransformDataCallBackClient
}

func (t *transformDataCallBackGrpcClient) QueryData(ctx context.Context, req *pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error) {
	return t.client.QueryData(ctx, req)
}

var _ pluginv2.TransformServer = &transformGRPCServer{}
var _ TransformClient = &transformGRPCClient{}
var _ TransformDataCallBack = &transformDataCallBackGrpcServer{}
var _ TransformDataCallBack = &transformDataCallBackGrpcClient{}
