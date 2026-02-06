package webhook

import (
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/receivers/webhook/v0mimir1"
	v1 "github.com/grafana/alerting/receivers/webhook/v1"
)

const Type schema.IntegrationType = "webhook"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "Webhook",
	Description:    "Sends HTTP POST request to a URL",
	Heading:        "Webhook settings",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
		v0mimir1.Schema,
	},
})
