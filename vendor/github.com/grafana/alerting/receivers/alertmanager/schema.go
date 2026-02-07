package alertmanager

import (
	v1 "github.com/grafana/alerting/receivers/alertmanager/v1"
	"github.com/grafana/alerting/receivers/schema"
)

const Type schema.IntegrationType = "prometheus-alertmanager"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "Alertmanager",
	Description:    "Sends notifications to Alertmanager",
	Heading:        "Alertmanager Settings",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
	},
})
