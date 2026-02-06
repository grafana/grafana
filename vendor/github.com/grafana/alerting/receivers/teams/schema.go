package teams

import (
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/receivers/teams/v0mimir1"
	"github.com/grafana/alerting/receivers/teams/v0mimir2"
	v1 "github.com/grafana/alerting/receivers/teams/v1"
)

const Type schema.IntegrationType = "teams"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "Microsoft Teams",
	Description:    "Sends notifications using Incoming Webhook connector to Microsoft Teams",
	Heading:        "Teams settings",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
		v0mimir2.Schema,
		v0mimir1.Schema,
	},
})
