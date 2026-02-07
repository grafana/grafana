package kafka

import (
	v1 "github.com/grafana/alerting/receivers/kafka/v1"
	"github.com/grafana/alerting/receivers/schema"
)

const Type schema.IntegrationType = "kafka"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "Kafka REST Proxy",
	Description:    "Sends notifications to Kafka Rest Proxy",
	Heading:        "Kafka settings",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
	},
})
