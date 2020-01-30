package backend

import (
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

type ServeOpts struct {
	CheckHealthHandler   CheckHealthHandler
	DataQueryHandler     DataQueryHandler
	ResourceHandler      ResourceHandler
	TransformDataHandler TransformDataHandler

	// GRPCServer factory method for creating GRPC server.
	// If nil, the default one will be used.
	GRPCServer func(options []grpc.ServerOption) *grpc.Server
}

// Serve starts serving the plugin over gRPC.
func Serve(opts ServeOpts) error {
	versionedPlugins := make(map[int]plugin.PluginSet)
	pSet := make(plugin.PluginSet)

	sdkAdapter := &sdkAdapter{
		checkHealthHandler:   opts.CheckHealthHandler,
		dataQueryHandler:     opts.DataQueryHandler,
		resourceHandler:      opts.ResourceHandler,
		transformDataHandler: opts.TransformDataHandler,
	}

	pSet["diagnostics"] = &DiagnosticsGRPCPlugin{
		server: sdkAdapter,
	}

	if opts.DataQueryHandler != nil || opts.ResourceHandler != nil {
		pSet["backend"] = &CoreGRPCPlugin{
			server: sdkAdapter,
		}
	}

	if opts.TransformDataHandler != nil {
		pSet["transform"] = &TransformGRPCPlugin{
			adapter: sdkAdapter,
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
