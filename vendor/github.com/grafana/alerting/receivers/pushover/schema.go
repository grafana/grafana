package pushover

import (
	"github.com/grafana/alerting/receivers/pushover/v0mimir1"
	v1 "github.com/grafana/alerting/receivers/pushover/v1"
	"github.com/grafana/alerting/receivers/schema"
)

const Type schema.IntegrationType = "pushover"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "Pushover",
	Description:    "Sends HTTP POST request to the Pushover API",
	Heading:        "Pushover settings",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
		v0mimir1.Schema,
	},
})
