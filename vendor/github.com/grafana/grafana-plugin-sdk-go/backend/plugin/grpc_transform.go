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
	TransformData(ctx context.Context, req *pluginv2.DataQueryRequest, callback TransformCallBack) (*pluginv2.DataQueryResponse, error)
}

type transformClient interface {
	DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest, callback TransformCallBack) (*pluginv2.DataQueryResponse, error)
}

type TransformCallBack interface {
	DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error)
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

func (t *transformGRPCServer) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
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
	api := &transformCallBackGrpcClient{pluginv2.NewTransformCallBackClient(conn)}
	return t.server.TransformData(ctx, req, api)
}

type transformGRPCClient struct {
	broker *plugin.GRPCBroker
	client pluginv2.TransformClient
}

func (t *transformGRPCClient) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest, callBack TransformCallBack) (*pluginv2.DataQueryResponse, error) {
	callBackServer := &transformCallBackGrpcServer{Impl: callBack}

	var s *grpc.Server
	serverFunc := func(opts []grpc.ServerOption) *grpc.Server {
		s = grpc.NewServer(opts...)
		pluginv2.RegisterTransformCallBackServer(s, callBackServer)

		return s
	}
	brokerID := t.broker.NextId()

	go t.broker.AcceptAndServe(brokerID, serverFunc)
	ctx = metadata.AppendToOutgoingContext(ctx, "broker_requestId", strconv.FormatUint(uint64(brokerID), 10))
	res, err := t.client.DataQuery(ctx, req)
	s.Stop()
	return res, err
}

// Callback

type transformCallBackGrpcServer struct {
	Impl TransformCallBack
}

func (g *transformCallBackGrpcServer) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	return g.Impl.DataQuery(ctx, req)
}

type transformCallBackGrpcClient struct {
	client pluginv2.TransformCallBackClient
}

func (t *transformCallBackGrpcClient) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	return t.client.DataQuery(ctx, req)
}

var _ pluginv2.TransformServer = &transformGRPCServer{}
var _ transformClient = &transformGRPCClient{}
var _ pluginv2.TransformServer = &transformCallBackGrpcServer{}
var _ pluginv2.TransformServer = &transformCallBackGrpcClient{}
