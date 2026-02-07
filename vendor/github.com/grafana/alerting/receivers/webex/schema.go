package webex

import (
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/receivers/webex/v0mimir1"
	v1 "github.com/grafana/alerting/receivers/webex/v1"
)

const Type schema.IntegrationType = "webex"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "Cisco Webex Teams",
	Description:    "Sends notifications to Cisco Webex Teams",
	Heading:        "Webex settings",
	Info:           "Notifications can be configured for any Cisco Webex Teams",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
		v0mimir1.Schema,
	},
})
