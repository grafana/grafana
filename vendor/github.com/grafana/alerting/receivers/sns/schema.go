package sns

import (
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/receivers/sns/v0mimir1"
	v1 "github.com/grafana/alerting/receivers/sns/v1"
)

const Type schema.IntegrationType = "sns"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "AWS SNS",
	Description:    "Sends notifications to AWS Simple Notification Service",
	Heading:        "AWS SNS settings",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
		v0mimir1.Schema,
	},
})
