package backend

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// TransformGRPCPlugin implements the GRPCPlugin interface from github.com/hashicorp/go-plugin.
type TransformGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	plugin.GRPCPlugin
	adapter *sdkAdapter
}

func (p *TransformGRPCPlugin) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	pluginv2.RegisterTransformServer(s, &transformGRPCServer{
		adapter: p.adapter,
		broker:  broker,
	})
	return nil
}

func (p *TransformGRPCPlugin) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &transformGRPCClient{client: pluginv2.NewTransformClient(c), broker: broker}, nil
}

type transformGRPCServer struct {
	broker  *plugin.GRPCBroker
	adapter *sdkAdapter
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
	api := &TransformCallBackGrpcClient{pluginv2.NewTransformCallBackClient(conn)}
	return t.adapter.TransformData(ctx, req, api)
}

type transformGRPCClient struct {
	broker *plugin.GRPCBroker
	client pluginv2.TransformClient
}

func (t *transformGRPCClient) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest, callBack TransformCallBack) (*pluginv2.DataQueryResponse, error) {
	callBackServer := &TransformCallBackGrpcServer{Impl: callBack}

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

type TransformCallBackGrpcClient struct {
	client pluginv2.TransformCallBackClient
}

func (t *TransformCallBackGrpcClient) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	return t.client.DataQuery(ctx, req)
}

type TransformCallBackGrpcServer struct {
	Impl TransformCallBack
}

func (g *TransformCallBackGrpcServer) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	return g.Impl.DataQuery(ctx, req)
}
