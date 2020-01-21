package adapter

import "github.com/grafana/grafana-plugin-sdk-go/backend/models"

// SDKAdapter adapter between low level and SDK interfaces.
type SDKAdapter struct {
	SchemaProvider       models.SchemaProviderFunc
	CheckHealthHandler   models.CheckHealthHandler
	DataQueryHandler     models.DataQueryHandler
	TransformDataHandler models.TransformDataHandler
	schema               models.Schema
}
