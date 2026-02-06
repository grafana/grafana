package discord

import (
	"github.com/grafana/alerting/receivers/discord/v0mimir1"
	v1 "github.com/grafana/alerting/receivers/discord/v1"
	"github.com/grafana/alerting/receivers/schema"
)

const Type schema.IntegrationType = "discord"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "Discord",
	Heading:        "Discord settings",
	Description:    "Sends notifications to Discord",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
		v0mimir1.Schema,
	},
})
