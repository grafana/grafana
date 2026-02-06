package v1

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"

	"github.com/pkg/errors"
	"github.com/prometheus/common/model"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/receivers/schema"
)

const Version = schema.V1

var (
	DefaultSummary     = `{{ template "jira.default.summary" . }}`
	DefaultDescription = `{{ template "jira.default.description" . }}`
	DefaultPriority    = `{{ template "jira.default.priority" . }}`
)

type Config struct {
	URL *url.URL

	Project     string
	Summary     string
	Description string
	Labels      []string
	Priority    string
	IssueType   string

	ReopenTransition  string
	ResolveTransition string
	WontFixResolution string
	ReopenDuration    model.Duration

	DedupKeyFieldName string
	Fields            map[string]any

	User     string
	Password string
	Token    string
}

func NewConfig(jsonData json.RawMessage, decryptFn receivers.DecryptFunc) (Config, error) {
	type raw struct {
		URL               string   `yaml:"api_url,omitempty" json:"api_url,omitempty"`
		Project           string   `yaml:"project,omitempty" json:"project,omitempty"`
		Summary           string   `yaml:"summary,omitempty" json:"summary,omitempty"`
		Description       string   `yaml:"description,omitempty" json:"description,omitempty"`
		Labels            []string `yaml:"labels,omitempty" json:"labels,omitempty"`
		Priority          string   `yaml:"priority,omitempty" json:"priority,omitempty"`
		IssueType         string   `yaml:"issue_type,omitempty" json:"issue_type,omitempty"`
		ReopenTransition  string   `yaml:"reopen_transition,omitempty" json:"reopen_transition,omitempty"`
		ResolveTransition string   `yaml:"resolve_transition,omitempty" json:"resolve_transition,omitempty"`
		WontFixResolution string   `yaml:"wont_fix_resolution,omitempty" json:"wont_fix_resolution,omitempty"`
		ReopenDuration    string   `yaml:"reopen_duration,omitempty" json:"reopen_duration,omitempty"`
		// Allows to store group key identifier in a custom field instead of a label.
		DedupKeyFieldName string         `yaml:"dedup_key_field,omitempty" json:"dedup_key_field,omitempty"`
		Fields            map[string]any `yaml:"fields,omitempty" json:"fields,omitempty"`
		// This is user (email) and password - api token from https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/
		// See https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/#basic-auth-for-rest-apis
		User     string `yaml:"user,omitempty" json:"user,omitempty"`
		Password string `yaml:"password,omitempty" json:"password,omitempty"`
		// This is PAT token https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html
		Token string `yaml:"api_token,omitempty" json:"api_token,omitempty"`
	}

	settings := raw{}
	err := json.Unmarshal(jsonData, &settings)
	if err != nil {
		return Config{}, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	if settings.URL == "" {
		return Config{}, errors.New("could not find api_url property in settings")
	}
	u, err := url.Parse(settings.URL)
	if err != nil {
		return Config{}, fmt.Errorf("field api_url is not a valid URL: %w", err)
	}

	var d model.Duration
	if settings.ReopenDuration != "" {
		d, err = model.ParseDuration(settings.ReopenDuration)
		if err != nil {
			return Config{}, fmt.Errorf("field reopen_duration is not a valid duration: %w", err)
		}
	}

	if settings.Project == "" {
		return Config{}, fmt.Errorf("missing project in jira_config")
	}
	if settings.IssueType == "" {
		return Config{}, fmt.Errorf("missing issue_type in jira_config")
	}

	if settings.Summary == "" {
		settings.Summary = DefaultSummary
	}
	if settings.Description == "" {
		settings.Description = DefaultDescription
	}
	if settings.Priority == "" {
		settings.Priority = DefaultPriority
	}

	settings.User = decryptFn("user", settings.User)
	settings.Password = decryptFn("password", settings.Password)
	settings.Token = decryptFn("api_token", settings.Token)
	if settings.Token == "" && (settings.User == "" || settings.Password == "") {
		return Config{}, errors.New("either token or both user and password must be set")
	}
	if settings.Token != "" && (settings.User != "" || settings.Password != "") {
		return Config{}, errors.New("provided both token and user/password, only one is allowed at a time")
	}

	if settings.DedupKeyFieldName != "" {
		matched, err := regexp.MatchString(`^[0-9]+$`, settings.DedupKeyFieldName)
		if err != nil {
			return Config{}, fmt.Errorf("failed to validate dedup_key_field: %w", err)
		}
		if !matched {
			return Config{}, errors.New("dedup_key_field must match the format [0-9]+")
		}
	}

	var fields map[string]any
	if len(settings.Fields) > 0 {
		fields = make(map[string]any, len(settings.Fields))
		for k, v := range settings.Fields {
			val := v
			// The current UI does not support complex structures and therefore all values are strings.
			// However, it's not the case in provisioning or if integration was created via API.
			// Here we check if the value is string and it's a valid JSON, and then parse it and assign to the key.
			if strVal, ok := v.(string); ok {
				var jsonData any
				if json.Valid([]byte(strVal)) {
					err := json.Unmarshal([]byte(strVal), &jsonData)
					if err == nil {
						val = jsonData
					}
				}
			}
			fields[k] = val
		}
	}

	return Config{
		URL:               u,
		Project:           settings.Project,
		Summary:           settings.Summary,
		Description:       settings.Description,
		Labels:            settings.Labels,
		Priority:          settings.Priority,
		IssueType:         settings.IssueType,
		ReopenTransition:  settings.ReopenTransition,
		ResolveTransition: settings.ResolveTransition,
		WontFixResolution: settings.WontFixResolution,
		ReopenDuration:    d,
		Fields:            fields,
		User:              settings.User,
		Password:          settings.Password,
		Token:             settings.Token,
		DedupKeyFieldName: settings.DedupKeyFieldName,
	}, nil
}

var Schema = schema.IntegrationSchemaVersion{
	Version:   Version,
	CanCreate: true,
	Options: []schema.Field{
		{
			Label:        "API URL of Jira instance, including version of API",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "https://grafana.atlassian.net/rest/api/3",
			PropertyName: "api_url",
			Description:  "Supported v2 or v3 APIs",
			Required:     true,
			Protected:    true,
		},
		{
			Label:        "HTTP Basic Authentication - Username",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			PropertyName: "user",
			Description:  "Username to use for Jira authentication.",
			Secure:       true,
			Required:     false,
		},
		{
			Label:        "HTTP Basic Authentication - Password",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypePassword,
			PropertyName: "password",
			// Go to https://id.atlassian.com/manage-profile/security/api-tokens to obtain a token.
			Description: "Password to use for Jira authentication.",
			Secure:      true,
			Required:    false,
		},
		{
			Label:        "Authorization Header - Personal Access Token",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypePassword,
			PropertyName: "api_token",
			// Go to https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html for how to obtain a token.
			Description: "Personal Access Token that is used as a bearer authorization header.",
			Secure:      true,
			Required:    false,
		},
		{
			Label:        "Project Key",
			Description:  "The project key associated with the relevant Jira project",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "Grafana",
			PropertyName: "project",
			Required:     true,
		},
		{
			Label:        "Issue Type",
			Description:  "The type of the Jira issue (e.g., Bug, Task, Story). You can use templates to customize this field.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "Task",
			Required:     true,
			PropertyName: "issue_type",
		},
		{
			Label:        "Summary",
			Description:  fmt.Sprintf("The summary of the Jira issue. You can use templates to customize this field. Maximum length is %d characters.", MaxSummaryLenRunes),
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  DefaultSummary,
			PropertyName: "summary",
		},
		{
			Label:        "Description",
			Description:  fmt.Sprintf("The description of the Jira issue. You can use templates to customize this field. Maximum length is %d characters.", MaxDescriptionLenRunes),
			Element:      schema.ElementTypeTextArea,
			InputType:    schema.InputTypeText,
			Placeholder:  DefaultDescription,
			PropertyName: "description",
		},
		{
			Label:        "Labels",
			Description:  "Labels to assign to the Jira issue. You can use templates to customize this field.",
			Element:      schema.ElementStringArray,
			Placeholder:  "",
			PropertyName: "labels",
		},
		{
			Label:        "Priority",
			Description:  "The priority of the Jira issue (e.g., High, Medium, Low). You can use templates to customize this field.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  DefaultPriority,
			PropertyName: "priority",
			Required:     false,
		},
		{
			Label:        "Resolve Transition",
			Description:  `Name of the workflow transition to resolve an issue. The target status must have the category "done". If not set, the issue will not be resolved.`,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "",
			PropertyName: "resolve_transition",
			Required:     false,
		},
		{
			Label:        "Reopen Transition",
			Description:  `Name of the workflow transition to resolve an issue. The target status must not have the category "done". If not set, the issue will not be reopened.`,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "",
			PropertyName: "reopen_transition",
			Required:     false,
		},
		{
			Label:        "Reopen Duration",
			Description:  "Reopen the issue when it is not older than this value in minutes. Otherwise, create a new issue.",
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "10m",
			PropertyName: "reopen_duration",
		},
		{
			Label:        "\"Won't fix\" Transition",
			Description:  `If reopen transition is defined, ignore issues with that resolution.`,
			Element:      schema.ElementTypeInput,
			InputType:    schema.InputTypeText,
			Placeholder:  "",
			PropertyName: "wont_fix_resolution",
			Required:     false,
		},
		{
			Label:          "Custom field ID for deduplication",
			Description:    "Id of the custom field where the deduplication key should be stored. Otherwise, it is added to labels in format 'ALERT($KEY).'",
			Element:        schema.ElementTypeInput,
			InputType:      schema.InputTypeText,
			Placeholder:    "10000",
			ValidationRule: "^[0-9]+$",
			PropertyName:   "dedup_key_field",
		},
		{
			Label:        "Custom Field Data",
			Description:  "Custom field data to set on the Jira issue.",
			Element:      schema.ElementTypeKeyValueMap,
			InputType:    schema.InputTypeText,
			Placeholder:  "",
			PropertyName: "fields",
		},
	},
}
