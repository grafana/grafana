package slack

import (
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/receivers/slack/v0mimir1"
	v1 "github.com/grafana/alerting/receivers/slack/v1"
)

const Type schema.IntegrationType = "slack"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "Slack",
	Description:    "Sends notifications to Slack",
	Heading:        "Slack settings",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
		v0mimir1.Schema,
	},
})
