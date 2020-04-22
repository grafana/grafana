package backend

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"
)

//ServeOpts options for serving plugins.
type ServeOpts struct {
	// CheckHealthHandler handler for health checks.
	CheckHealthHandler CheckHealthHandler

	// CallResourceHandler handler for resource calls.
	// Optional to implement.
	CallResourceHandler CallResourceHandler

	// QueryDataHandler handler for data queries.
	// Required to implement if data source.
	QueryDataHandler QueryDataHandler

	// TransformDataHandler handler for data transformations.
	// Very experimental and shouldn't be implemented in most cases.
	// Optional to implement.
	TransformDataHandler TransformDataHandler

	// MaxGRPCReceiveMsgSize the max gRPC message size in bytes the plugin can receive.
	// If this is <= 0, gRPC uses the default 4MB.
	MaxGRPCReceiveMsgSize int

	// MaxGRPCSendMsgSize the max gRPC message size in bytes the plugin can send.
	// If this is <= 0, gRPC uses the default `math.MaxInt32`.
	MaxGRPCSendMsgSize int
}

// Serve starts serving the plugin over gRPC.
func Serve(opts ServeOpts) error {
	pluginOpts := grpcplugin.ServeOpts{
		DiagnosticsServer: newDiagnosticsSDKAdapter(prometheus.DefaultGatherer, opts.CheckHealthHandler),
	}

	if opts.CallResourceHandler != nil {
		pluginOpts.ResourceServer = newResourceSDKAdapter(opts.CallResourceHandler)
	}

	if opts.QueryDataHandler != nil {
		pluginOpts.DataServer = newDataSDKAdapter(opts.QueryDataHandler)
	}

	if opts.TransformDataHandler != nil {
		pluginOpts.TransformServer = newTransformSDKAdapter(opts.TransformDataHandler)
	}

	grpc_prometheus.EnableHandlingTimeHistogram()
	grpcMiddlewares := []grpc.ServerOption{
		grpc.StreamInterceptor(grpc_middleware.ChainStreamServer(
			grpc_prometheus.StreamServerInterceptor,
		)),
		grpc.UnaryInterceptor(grpc_middleware.ChainUnaryServer(
			grpc_prometheus.UnaryServerInterceptor,
		)),
	}

	if opts.MaxGRPCReceiveMsgSize > 0 {
		grpcMiddlewares = append([]grpc.ServerOption{grpc.MaxRecvMsgSize(opts.MaxGRPCReceiveMsgSize)}, grpcMiddlewares...)
	}

	if opts.MaxGRPCSendMsgSize > 0 {
		grpcMiddlewares = append([]grpc.ServerOption{grpc.MaxSendMsgSize(opts.MaxGRPCSendMsgSize)}, grpcMiddlewares...)
	}

	pluginOpts.GRPCServer = func(opts []grpc.ServerOption) *grpc.Server {
		opts = append(opts, grpcMiddlewares...)
		return grpc.NewServer(opts...)
	}

	return grpcplugin.Serve(pluginOpts)
}
