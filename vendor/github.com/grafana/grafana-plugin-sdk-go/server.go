package grafana

import (
	plugin "github.com/hashicorp/go-plugin"
)

const (
	magicCookieKey   = "grafana_plugin_type"
	magicCookieValue = "datasource"
)

// Server serves all registered data source handlers.
type Server struct {
	datasources map[string]DataSourceHandler
}

// NewServer returns a new instance of Server.
func NewServer() *Server {
	return &Server{
		datasources: make(map[string]DataSourceHandler),
	}
}

// HandleDataSource registers a new data source.
//
// The plugin ID should be in the format <org>-<name>-datasource.
func (g *Server) HandleDataSource(pluginID string, p DataSourceHandler) {
	g.datasources[pluginID] = p
}

// Serve starts serving the registered handlers over gRPC.
func (g *Server) Serve() error {
	plugins := make(map[string]plugin.Plugin)

	for id, h := range g.datasources {
		plugins[id] = &DatasourcePluginImpl{
			Impl: datasourcePluginWrapper{
				handler: h,
			},
		}
	}

	plugin.Serve(&plugin.ServeConfig{
		HandshakeConfig: plugin.HandshakeConfig{
			ProtocolVersion:  1,
			MagicCookieKey:   magicCookieKey,
			MagicCookieValue: magicCookieValue,
		},
		Plugins:    plugins,
		GRPCServer: plugin.DefaultGRPCServer,
	})

	return nil
}
