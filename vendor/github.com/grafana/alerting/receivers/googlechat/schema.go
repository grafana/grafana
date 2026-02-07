package googlechat

import (
	v1 "github.com/grafana/alerting/receivers/googlechat/v1"
	"github.com/grafana/alerting/receivers/schema"
)

const Type schema.IntegrationType = "googlechat"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "Google Chat",
	Description:    "Sends notifications to Google Chat via webhooks based on the official JSON message format",
	Heading:        "Google Chat settings",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
	},
})
