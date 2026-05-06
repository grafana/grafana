package backend

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

// streamSDKAdapter adapter between low level plugin protocol and SDK interfaces.
type streamSDKAdapter struct {
	streamHandler StreamHandler
}

func newStreamSDKAdapter(handler StreamHandler) *streamSDKAdapter {
	return &streamSDKAdapter{
		streamHandler: handler,
	}
}

func (a *streamSDKAdapter) SubscribeStream(ctx context.Context, protoReq *pluginv2.SubscribeStreamRequest) (*pluginv2.SubscribeStreamResponse, error) {
	if a.streamHandler == nil {
		return nil, status.Error(codes.Unimplemented, "not implemented")
	}

	parsedReq := FromProto().SubscribeStreamRequest(protoReq)
	resp, err := a.streamHandler.SubscribeStream(ctx, parsedReq)
	if err != nil {
		return nil, err
	}

	return ToProto().SubscribeStreamResponse(resp), nil
}

func (a *streamSDKAdapter) PublishStream(ctx context.Context, protoReq *pluginv2.PublishStreamRequest) (*pluginv2.PublishStreamResponse, error) {
	if a.streamHandler == nil {
		return nil, status.Error(codes.Unimplemented, "not implemented")
	}

	parsedReq := FromProto().PublishStreamRequest(protoReq)
	resp, err := a.streamHandler.PublishStream(ctx, parsedReq)
	if err != nil {
		return nil, err
	}

	return ToProto().PublishStreamResponse(resp), nil
}

type runStreamServer struct {
	protoSrv pluginv2.Stream_RunStreamServer
}

func (r *runStreamServer) Send(packet *StreamPacket) error {
	return r.protoSrv.Send(ToProto().StreamPacket(packet))
}

func (a *streamSDKAdapter) RunStream(protoReq *pluginv2.RunStreamRequest, protoSrv pluginv2.Stream_RunStreamServer) error {
	if a.streamHandler == nil {
		return status.Error(codes.Unimplemented, "not implemented")
	}
	ctx := protoSrv.Context()
	parsedReq := FromProto().RunStreamRequest(protoReq)
	sender := NewStreamSender(&runStreamServer{protoSrv: protoSrv})
	return a.streamHandler.RunStream(ctx, parsedReq, sender)
}
