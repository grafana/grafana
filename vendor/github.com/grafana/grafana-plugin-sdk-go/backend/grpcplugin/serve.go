package grpcplugin

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	plugin "github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

//ServeOpts options for serving plugins.
type ServeOpts struct {
	DiagnosticsServer DiagnosticsServer
	ResourceServer    ResourceServer
	DataServer        DataServer
	TransformServer   TransformServer

	// GRPCServer factory method for creating GRPC server.
	// If nil, the default one will be used.
	GRPCServer func(options []grpc.ServerOption) *grpc.Server
}

// Serve starts serving the plugin over gRPC.
func Serve(opts ServeOpts) error {
	versionedPlugins := make(map[int]plugin.PluginSet)
	pSet := make(plugin.PluginSet)

	if opts.DiagnosticsServer != nil {
		pSet["diagnostics"] = &DiagnosticsGRPCPlugin{
			DiagnosticsServer: opts.DiagnosticsServer,
		}
	}

	if opts.ResourceServer != nil {
		pSet["resource"] = &ResourceGRPCPlugin{
			ResourceServer: opts.ResourceServer,
		}
	}

	if opts.DataServer != nil {
		pSet["data"] = &DataGRPCPlugin{
			DataServer: opts.DataServer,
		}
	}

	if opts.TransformServer != nil {
		pSet["transform"] = &TransformGRPCPlugin{
			TransformServer: opts.TransformServer,
		}
	}

	versionedPlugins[ProtocolVersion] = pSet

	if opts.GRPCServer == nil {
		opts.GRPCServer = plugin.DefaultGRPCServer
	}

	plugKeys := []string{}
	for k := range pSet {
		plugKeys = append(plugKeys, k)
	}
	log.DefaultLogger.Debug("Serving plugin", "plugins", plugKeys)
	plugin.Serve(&plugin.ServeConfig{
		HandshakeConfig:  handshake,
		VersionedPlugins: versionedPlugins,
		GRPCServer:       opts.GRPCServer,
	})
	log.DefaultLogger.Debug("Plugin server exited")

	return nil
}
