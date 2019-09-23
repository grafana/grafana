package grafana

import (
	plugin "github.com/hashicorp/go-plugin"
)

const (
	magicCookieKey   = "grafana_plugin_type"
	magicCookieValue = "datasource"
)

type Server struct {
	datasources map[string]DatasourceHandler
}

func NewServer() *Server {
	return &Server{
		datasources: make(map[string]DatasourceHandler),
	}
}

func (g *Server) HandleDatasource(pluginID string, p DatasourceHandler) {
	g.datasources[pluginID] = p
}

func (g *Server) Serve() error {
	plugins := make(map[string]plugin.Plugin)

	for id, h := range g.datasources {
		plugins[id] = &datasourcePlugin{
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
