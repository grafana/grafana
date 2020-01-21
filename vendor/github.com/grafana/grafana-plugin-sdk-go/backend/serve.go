package backend

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend/internal/adapter"
	"github.com/grafana/grafana-plugin-sdk-go/backend/models"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

type ServeOpts struct {
	SchemaProvider       models.SchemaProviderFunc
	CheckHealthHandler   models.CheckHealthHandler
	DataQueryHandler     models.DataQueryHandler
	TransformDataHandler models.TransformDataHandler

	// GRPCServer factory method for creating GRPC server.
	// If nil, the default one will be used.
	GRPCServer func(options []grpc.ServerOption) *grpc.Server
}

// Serve starts serving the plugin over gRPC.
func Serve(opts ServeOpts) error {
	versionedPlugins := make(map[int]plugin.PluginSet)
	pSet := make(plugin.PluginSet)

	sdkAdapter := &adapter.SDKAdapter{
		CheckHealthHandler:   opts.CheckHealthHandler,
		DataQueryHandler:     opts.DataQueryHandler,
		TransformDataHandler: opts.TransformDataHandler,
	}

	pSet["diagnostics"] = &DiagnosticsGRPCPlugin{
		DiagnosticsServer: sdkAdapter,
	}

	if opts.DataQueryHandler != nil {
		pSet["backend"] = &CoreGRPCPlugin{
			CoreServer: sdkAdapter,
		}
	}

	if opts.TransformDataHandler != nil {
		pSet["transform"] = &TransformGRPCPlugin{
			TransformServer: sdkAdapter,
		}
	}

	versionedPlugins[ProtocolVersion] = pSet

	if opts.GRPCServer == nil {
		// opts.GRPCServer = plugin.DefaultGRPCServer
		// hack for now to add grpc prometheuc server interceptor
		opts.GRPCServer = func(serverOptions []grpc.ServerOption) *grpc.Server {
			mergedOptions := serverOptions
			mergedOptions = append(mergedOptions, grpc.UnaryInterceptor(grpc_prometheus.UnaryServerInterceptor))
			server := grpc.NewServer(mergedOptions...)
			grpc_prometheus.Register(server)
			return server
		}
	}

	plugin.Serve(&plugin.ServeConfig{
		HandshakeConfig:  Handshake,
		VersionedPlugins: versionedPlugins,
		GRPCServer:       opts.GRPCServer,
	})

	return nil
}
