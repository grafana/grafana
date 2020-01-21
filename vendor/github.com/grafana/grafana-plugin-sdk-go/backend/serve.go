package backend

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend/plugin"
)

//ServeOpts options for serving plugins.
type ServeOpts struct {
	SchemaProvider       SchemaProviderFunc
	CheckHealthHandler   CheckHealthHandler
	DataQueryHandler     DataQueryHandler
	TransformDataHandler TransformDataHandler
}

// Serve starts serving the plugin over gRPC.
func Serve(opts ServeOpts) error {
	sdkAdapter := &sdkAdapter{
		CheckHealthHandler:   opts.CheckHealthHandler,
		DataQueryHandler:     opts.DataQueryHandler,
		TransformDataHandler: opts.TransformDataHandler,
	}

	pluginOpts := plugin.ServeOpts{
		DiagnosticsServer: sdkAdapter,
	}

	if opts.DataQueryHandler != nil {
		pluginOpts.CoreServer = sdkAdapter
	}

	if opts.TransformDataHandler != nil {
		pluginOpts.TransformServer = sdkAdapter
	}

	return plugin.Serve(pluginOpts)
}
