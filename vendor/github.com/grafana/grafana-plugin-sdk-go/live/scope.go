package live

const (
	// ScopeGrafana contains builtin real-time features of Grafana Core.
	ScopeGrafana = "grafana"
	// ScopePlugin passes control to a plugin.
	ScopePlugin = "plugin"
	// ScopeDatasource passes control to a datasource plugin.
	ScopeDatasource = "ds"
	// ScopeStream is a managed data frame stream.
	ScopeStream = "stream"
	// ScopeWatch will watch a k8s style resource
	ScopeWatch = "watch"
)
