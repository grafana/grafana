package jira

import (
	"github.com/grafana/alerting/receivers/jira/v0mimir1"
	v1 "github.com/grafana/alerting/receivers/jira/v1"
	"github.com/grafana/alerting/receivers/schema"
)

const Type schema.IntegrationType = "jira"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:           Type,
	Name:           "Jira",
	Description:    "Creates Jira issues from alerts",
	Heading:        "Jira settings",
	CurrentVersion: v1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v1.Schema,
		v0mimir1.Schema,
	},
})
