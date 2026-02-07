package v1

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/aws/aws-sdk-go/aws/arn"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/templates"
)

const Version = schema.V1

type SigV4Config struct {
	Region    string `json:"region,omitempty" yaml:"region,omitempty"`
	AccessKey string `json:"access_key,omitempty" yaml:"access_key,omitempty"`
	SecretKey string `json:"secret_key,omitempty" yaml:"secret_key,omitempty"`
	Profile   string `json:"profile,omitempty" yaml:"profile,omitempty"`
	RoleARN   string `json:"role_arn,omitempty" yaml:"role_arn,omitempty"`
}

type Config struct {
	APIUrl      string            `yaml:"api_url,omitempty" json:"api_url,omitempty"`
	Sigv4       SigV4Config       `yaml:"sigv4" json:"sigv4"`
	TopicARN    string            `yaml:"topic_arn,omitempty" json:"topic_arn,omitempty"`
	PhoneNumber string            `yaml:"phone_number,omitempty" json:"phone_number,omitempty"`
	TargetARN   string            `yaml:"target_arn,omitempty" json:"target_arn,omitempty"`
	Subject     string            `yaml:"subject,omitempty" json:"subject,omitempty"`
	Message     string            `yaml:"message,omitempty" json:"message,omitempty"`
	Attributes  map[string]string `yaml:"attributes,omitempty" json:"attributes,omitempty"`
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	var settings Config
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	if settings.TopicARN != "" {
		_, err = arn.Parse(settings.TopicARN)
		if err != nil {
			return Config{}, errors.New("invalid topic ARN provided")
		}
	}

	if settings.TargetARN != "" {
		_, err = arn.Parse(settings.TargetARN)
		if err != nil {
			return Config{}, errors.New("invalid target ARN provided")
		}
	}

	if settings.TopicARN == "" && settings.TargetARN == "" && settings.PhoneNumber == "" {
		return Config{}, errors.New("must specify topicArn, targetArn, or phone number")
	}
	if settings.Subject == "" {
		settings.Subject = templates.DefaultMessageTitleEmbed
	}
	if settings.Message == "" {
		settings.Message = templates.DefaultMessageEmbed
	}

	settings.Sigv4.AccessKey = decryptFn("sigv4.access_key", settings.Sigv4.AccessKey)
	settings.Sigv4.SecretKey = decryptFn("sigv4.secret_key", settings.Sigv4.SecretKey)
	if settings.Sigv4.AccessKey == "" && settings.Sigv4.SecretKey != "" || settings.Sigv4.AccessKey != "" && settings.Sigv4.SecretKey == "" {
		return Config{}, errors.New("must specify both access key and secret key")
	}
	return settings, nil
}

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: true,
	Options: []schema.Field{
		{
			Label:        "The Amazon SNS API URL",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "",
			PropertyName: "api_url",
		},
		{
			Label:        "SigV4 Authentication",
			Description:  "Configures AWS's Signature Verification 4 signing process to sign requests",
			Element:      schema.ElementTypeSubform,
			PropertyName: "sigv4",
			SubformOptions: []schema.Field{
				{
					Label:        "Region",
					Description:  "The AWS region. If blank, the region from the default credentials chain is used.",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					Placeholder:  "",
					PropertyName: "region",
				},
				{
					Label:        "Access Key",
					Description:  "The AWS API access key.",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					Placeholder:  "",
					PropertyName: "access_key",
					Secure:       true,
				},
				{
					Label:        "Secret Key",
					Description:  "The AWS API secret key.",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					Placeholder:  "",
					PropertyName: "secret_key",
					Secure:       true,
				},
				{
					Label:        "Profile",
					Description:  "Named AWS profile used to authenticate",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					Placeholder:  "",
					PropertyName: "profile",
				},
				{
					Label:        "Role ARN",
					Description:  "AWS Role ARN, an alternative to using AWS API keys",
					Element:      schema.ElementTypeInput,
					InputType:    schema.InputTypeText,
					Placeholder:  "",
					PropertyName: "role_arn",
				},
			},
		},
		{
			Label:        "SNS topic ARN",
			Description:  "If you don't specify this value, you must specify a value for the phone_number or target_arn. If you are using a FIFO SNS topic you should set a message group interval longer than 5 minutes to prevent messages with the same group key being deduplicated by the SNS default deduplication window.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "",
			PropertyName: "topic_arn",
		},
		{
			Label:        "Phone number",
			Description:  "Phone number if message is delivered via SMS in E.164 format. If you don't specify this value, you must specify a value for the topic_arn or target_arn",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  ``,
			PropertyName: "phone_number",
			Secure:       false,
		},
		{
			Label:        "Target ARN",
			Description:  "The mobile platform endpoint ARN if message is delivered via mobile notifications. If you don't specify this value, you must specify a value for the topic_arn or phone_number",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  ``,
			PropertyName: "target_arn",
		},
		{
			Label:        "Subject",
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			Description:  "Optional subject. By default, this field uses the default title template and can be customized with templates and custom messages. It cannot be an empty string",
			PropertyName: "subject",
			Placeholder:  templates.DefaultMessageTitleEmbed,
		},
		{
			Label:        "Message",
			Description:  "Optional message. By default, this field uses the default message template and can be customized with templates and custom messages",
			Element:      schema.ElementTypeTextArea,
			PropertyName: "message",
			Placeholder:  templates.DefaultMessageEmbed,
		},
		{
			Label:        "Attributes",
			Description:  "SNS message attributes",
			Element:      schema.ElementTypeKeyValueMap,
			InputType:    schema.InputTypeText,
			PropertyName: "attributes",
		},
	},
}
