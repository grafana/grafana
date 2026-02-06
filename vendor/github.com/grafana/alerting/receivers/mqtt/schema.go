package mqtt

import (
	v1 "github.com/grafana/alerting/receivers/mqtt/v1"
	"github.com/grafana/alerting/receivers/schema"
)

const Type schema.IntegrationType = "mqtt"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "MQTT",
	Description:    "Sends notifications to an MQTT broker",
	Heading:        "MQTT settings",
	Info:           "The MQTT notifier sends messages to an MQTT broker. The message is sent to the topic specified in the configuration. ",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
	},
})
