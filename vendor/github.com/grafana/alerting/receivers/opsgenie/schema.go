package opsgenie

import (
	"github.com/grafana/alerting/receivers/opsgenie/v0mimir1"
	v1 "github.com/grafana/alerting/receivers/opsgenie/v1"
	"github.com/grafana/alerting/receivers/schema"
)

const Type schema.IntegrationType = "opsgenie"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "OpsGenie",
	Description:    "Sends notifications to OpsGenie",
	Heading:        "OpsGenie settings",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
		v0mimir1.Schema,
	},
})
