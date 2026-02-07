package email

import (
	"github.com/grafana/alerting/receivers/email/v0mimir1"
	v1 "github.com/grafana/alerting/receivers/email/v1"
	"github.com/grafana/alerting/receivers/schema"
)

const Type schema.IntegrationType = "email"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "Email",
	Heading:        "Email settings",
	Description:    "Sends notifications using Grafana server configured SMTP settings",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
		v0mimir1.Schema,
	},
})
