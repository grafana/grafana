package backend

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"
)

const defaultServerMaxReceiveMessageSize = 1024 * 1024 * 16

// GRPCSettings settings for gRPC.
type GRPCSettings struct {
	// MaxReceiveMsgSize the max gRPC message size in bytes the plugin can receive.
	// If this is <= 0, gRPC uses the default 16MB.
	MaxReceiveMsgSize int

	// MaxSendMsgSize the max gRPC message size in bytes the plugin can send.
	// If this is <= 0, gRPC uses the default `math.MaxInt32`.
	MaxSendMsgSize int
}

// ServeOpts options for serving plugins.
type ServeOpts struct {
	// CheckHealthHandler handler for health checks.
	CheckHealthHandler CheckHealthHandler

	// CallResourceHandler handler for resource calls.
	// Optional to implement.
	CallResourceHandler CallResourceHandler

	// QueryDataHandler handler for data queries.
	// Required to implement if data source.
	QueryDataHandler QueryDataHandler

	// GRPCSettings settings for gPRC.
	GRPCSettings GRPCSettings
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

	grpc_prometheus.EnableHandlingTimeHistogram()
	grpcMiddlewares := []grpc.ServerOption{
		grpc.StreamInterceptor(grpc_middleware.ChainStreamServer(
			grpc_prometheus.StreamServerInterceptor,
		)),
		grpc.UnaryInterceptor(grpc_middleware.ChainUnaryServer(
			grpc_prometheus.UnaryServerInterceptor,
		)),
	}

	if opts.GRPCSettings.MaxReceiveMsgSize <= 0 {
		opts.GRPCSettings.MaxReceiveMsgSize = defaultServerMaxReceiveMessageSize
	}

	grpcMiddlewares = append([]grpc.ServerOption{grpc.MaxRecvMsgSize(opts.GRPCSettings.MaxReceiveMsgSize)}, grpcMiddlewares...)

	if opts.GRPCSettings.MaxSendMsgSize > 0 {
		grpcMiddlewares = append([]grpc.ServerOption{grpc.MaxSendMsgSize(opts.GRPCSettings.MaxSendMsgSize)}, grpcMiddlewares...)
	}

	pluginOpts.GRPCServer = func(opts []grpc.ServerOption) *grpc.Server {
		opts = append(opts, grpcMiddlewares...)
		return grpc.NewServer(opts...)
	}

	return grpcplugin.Serve(pluginOpts)
}
