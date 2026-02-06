package v0mimir1

import (
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V0mimir1

type Config = config.SNSConfig

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: false,
	Options: []schema.Field{
		{
			Label:        "API URL",
			Description:  "The Amazon SNS API URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "api_url",
		},
		{
			Label:        "SigV4 authentication",
			Description:  "Configures AWS's Signature Verification 4 signing process to sign requests",
			Element:      schema.ElementTypeSubform,
			PropertyName: "sigv4",
			SubformOptions: []schema.Field{
				{
					Label:        "Region",
					Description:  "The AWS region. If blank, the region from the default credentials chain is used",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "Region",
				},
				{
					Label:        "Access key",
					Description:  "The AWS API access_key. If blank the environment variable \"AWS_ACCESS_KEY_ID\" is used",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "AccessKey",
					Secure:       false,
				},
				{
					Label:        "Secret key",
					Description:  "The AWS API secret_key. If blank the environment variable \"AWS_ACCESS_SECRET_ID\" is used",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypePassword,
					PropertyName: "SecretKey",
					Secure:       true,
				},
				{
					Label:        "Profile",
					Description:  "Named AWS profile used to authenticate",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "Profile",
				},
				{
					Label:        "Role ARN",
					Description:  "AWS Role ARN, an alternative to using AWS API keys",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					PropertyName: "RoleARN",
				},
			},
		},
		{
			Label:        "SNS topic ARN",
			Description:  "If you don't specify this value, you must specify a value for the phone_number or target_arn. If you are using a FIFO SNS topic you should set a message group interval longer than 5 minutes to prevent messages with the same group key being deduplicated by the SNS default deduplication window",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "topic_arn",
		},
		{
			Label:        "Phone number",
			Description:  "Phone number if message is delivered via SMS in E.164 format. If you don't specify this value, you must specify a value for the topic_arn or target_arn",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "phone_number",
		},
		{
			Label:        "Target ARN",
			Description:  "The mobile platform endpoint ARN if message is delivered via mobile notifications. If you don't specify this value, you must specify a value for the topic_arn or phone_number",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "target_arn",
		},
		{
			Label:        "Subject",
			Description:  "Subject line when the message is delivered",
			Placeholder:  config.DefaultSNSConfig.Subject,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "subject",
		},
		{
			Label:        "Message",
			Description:  "The message content of the SNS notification",
			Placeholder:  config.DefaultSNSConfig.Message,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "message",
		},
		{
			Label:        "Attributes",
			Description:  "SNS message attributes",
			Element:      schema.ElementTypeKeyValueMap,
			PropertyName: "attributes",
		},
		schema.V0HttpConfigOption(),
	},
}
