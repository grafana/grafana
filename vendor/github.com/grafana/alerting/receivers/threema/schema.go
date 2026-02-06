package threema

import (
	"github.com/grafana/alerting/receivers/schema"
	v1 "github.com/grafana/alerting/receivers/threema/v1"
)

const Type schema.IntegrationType = "threema"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:        Type,
	Name:        "Threema Gateway",
	Description: "Sends notifications to Threema using Threema Gateway (Basic IDs)",
	Heading:     "Threema Gateway settings",
	Info: "Notifications can be configured for any Threema Gateway ID of type \"Basic\". End-to-End IDs are not currently supported." +
		"The Threema Gateway ID can be set up at https://gateway.threema.ch/.",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
	},
})
