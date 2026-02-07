package wechat

import (
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/receivers/wechat/v0mimir1"
)

const Type schema.IntegrationType = "wechat"

var Schema = schema.InitSchema(schema.IntegrationTypeSchema{
	Type:        Type,
	Name:        "WeChat",
	Description: "Sends notifications to WeChat",
	Heading:     "WeChat settings",

	CurrentVersion: v0mimir1.Version,
	Versions: []schema.IntegrationSchemaVersion{
		v0mimir1.Schema,
	},
})
