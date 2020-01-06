package backend

import (
	"github.com/grafana/grafana-plugin-sdk-go/common"
	plugin "github.com/hashicorp/go-plugin"
)

// Serve starts serving the datasource plugin over gRPC.
func Serve(backendHandlers PluginHandlers, transformHandlers TransformHandlers) error {
	versionedPlugins := make(map[int]plugin.PluginSet)

	pSet := make(plugin.PluginSet)
	if backendHandlers != nil {
		pSet["backend"] = &CoreGRPCPlugin{
			adapter: &sdkAdapter{
				handlers: backendHandlers,
			},
		}
	}

	if transformHandlers != nil {
		pSet["transform"] = &TransformGRPCPlugin{
			adapter: &transformSDKAdapter{
				handlers: transformHandlers,
			},
		}
	}

	versionedPlugins[common.ProtocolVersion] = pSet

	plugin.Serve(&plugin.ServeConfig{
		HandshakeConfig:  common.Handshake,
		VersionedPlugins: versionedPlugins,
		GRPCServer:       plugin.DefaultGRPCServer,
	})

	return nil
}
