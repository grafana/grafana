package victorops

import (
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/receivers/victorops/v0mimir1"
	v1 "github.com/grafana/alerting/receivers/victorops/v1"
)

const Type schema.IntegrationType = "victorops"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "VictorOps",
	Description:    "Sends notifications to VictorOps",
	Heading:        "VictorOps settings",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
		v0mimir1.Schema,
	},
})
