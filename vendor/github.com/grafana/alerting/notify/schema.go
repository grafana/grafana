package notify

import (
	"errors"
	"fmt"
	"reflect"
	"slices"
	"strings"
	"sync"

	"github.com/grafana/alerting/receivers/alertmanager"
	"github.com/grafana/alerting/receivers/dingding"
	"github.com/grafana/alerting/receivers/discord"
	"github.com/grafana/alerting/receivers/email"
	"github.com/grafana/alerting/receivers/googlechat"
	"github.com/grafana/alerting/receivers/jira"
	"github.com/grafana/alerting/receivers/kafka"
	"github.com/grafana/alerting/receivers/line"
	"github.com/grafana/alerting/receivers/mqtt"
	"github.com/grafana/alerting/receivers/oncall"
	"github.com/grafana/alerting/receivers/opsgenie"
	"github.com/grafana/alerting/receivers/pagerduty"
	"github.com/grafana/alerting/receivers/pushover"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/receivers/sensugo"
	"github.com/grafana/alerting/receivers/slack"
	"github.com/grafana/alerting/receivers/sns"
	"github.com/grafana/alerting/receivers/teams"
	"github.com/grafana/alerting/receivers/telegram"
	"github.com/grafana/alerting/receivers/threema"
	"github.com/grafana/alerting/receivers/victorops"
	"github.com/grafana/alerting/receivers/webex"
	"github.com/grafana/alerting/receivers/webhook"
	"github.com/grafana/alerting/receivers/wechat"
	"github.com/grafana/alerting/receivers/wecom"
)

var (
	ErrUnknownIntegrationType = fmt.Errorf("unknown integration type")
)

// map of all known types including aliases and schema factories
var (
	allSchemas     map[schema.IntegrationType]schema.IntegrationTypeSchema
	aliasToType    map[schema.IntegrationType]schema.IntegrationType
	initSchemaOnce sync.Once
)

func initSchemas() {
	all := []schema.IntegrationTypeSchema{
		alertmanager.Schema,
		dingding.Schema,
		discord.Schema,
		email.Schema,
		googlechat.Schema,
		jira.Schema,
		kafka.Schema,
		line.Schema,
		mqtt.Schema,
		oncall.Schema,
		opsgenie.Schema,
		pagerduty.Schema,
		pushover.Schema,
		sensugo.Schema,
		slack.Schema,
		sns.Schema,
		teams.Schema,
		telegram.Schema,
		threema.Schema,
		victorops.Schema,
		webex.Schema,
		webhook.Schema,
		wechat.Schema,
		wecom.Schema,
	}

	allSch := make(map[schema.IntegrationType]schema.IntegrationTypeSchema, len(all))
	aliases := make(map[schema.IntegrationType]schema.IntegrationType)
	for _, sch := range all {
		if _, ok := allSch[sch.Type]; ok {
			// This panic will happen only if a new schema type or alias with duplicate name are defined. Should never happen.
			panic(fmt.Sprintf("duplicate schema type %s", sch.Type))
		}
		allSch[sch.Type] = sch
		for _, t := range sch.GetAllTypes() {
			if t == sch.Type {
				continue
			}
			if _, ok := aliases[t]; ok {
				// This panic will happen only if a new schema type or alias with duplicate name are defined. Should never happen.
				panic(fmt.Sprintf("duplicate alias %s", t))
			}
			if _, ok := allSch[t]; ok {
				// This panic will happen only if a new schema type or alias with duplicate name are defined. Should never happen.
				panic(fmt.Sprintf("duplicate schema type %s", t))
			}
			aliases[t] = sch.Type
		}
	}
	allSchemas = allSch
	aliasToType = aliases
}

// GetSchemaForAllIntegrations returns all known schema sorted by the main type.
func GetSchemaForAllIntegrations() []schema.IntegrationTypeSchema {
	initSchemaOnce.Do(initSchemas)

	seen := make(map[schema.IntegrationType]struct{}, len(allSchemas))
	result := make([]schema.IntegrationTypeSchema, 0, len(allSchemas))
	for t, sch := range allSchemas {
		if _, ok := seen[t]; ok {
			continue
		}
		result = append(result, sch)
		for _, t := range sch.GetAllTypes() {
			seen[t] = struct{}{}
		}
	}
	slices.SortFunc(result, func(a, b schema.IntegrationTypeSchema) int {
		return strings.Compare(string(a.Type), string(b.Type))
	})
	return result
}

// GetSchemaForIntegration returns the schema for a specific integration type of its alias.
func GetSchemaForIntegration(integrationType schema.IntegrationType) (schema.IntegrationTypeSchema, bool) {
	initSchemaOnce.Do(initSchemas)
	get := func(t schema.IntegrationType) (schema.IntegrationTypeSchema, bool) {
		sch, ok := allSchemas[t]
		if ok {
			return sch, true
		}
		original, ok := aliasToType[t]
		if ok {
			return allSchemas[original], true
		}
		return schema.IntegrationTypeSchema{}, false
	}

	result, ok := get(integrationType)
	if ok {
		return result, true
	}
	orig, err := IntegrationTypeFromString(string(integrationType))
	if err == nil {
		return get(orig)
	}
	return schema.IntegrationTypeSchema{}, false
}

// GetSchemaVersionForIntegration returns the schema version for a specific integration type and version.
func GetSchemaVersionForIntegration(integrationType schema.IntegrationType, version schema.Version) (schema.IntegrationSchemaVersion, bool) {
	sch, ok := GetSchemaForIntegration(integrationType)
	if !ok {
		return schema.IntegrationSchemaVersion{}, false
	}
	return sch.GetVersion(version)
}

// IsAliasType returns true if the integration type is an alias.
func IsAliasType(integrationType schema.IntegrationType) bool {
	initSchemaOnce.Do(initSchemas)
	_, ok := aliasToType[integrationType]
	if ok {
		return true
	}
	for k := range aliasToType {
		if strings.EqualFold(string(k), string(integrationType)) {
			return true
		}
	}
	return false
}

// OriginalTypeForAlias returns the original type for an alias. Returns true if argument is an original type
func OriginalTypeForAlias(integrationType schema.IntegrationType) (schema.IntegrationType, bool) {
	initSchemaOnce.Do(initSchemas)
	original, ok := aliasToType[integrationType]
	if ok {
		return original, true
	}
	for k, v := range aliasToType {
		if strings.EqualFold(string(k), string(integrationType)) {
			return v, true
		}
	}
	it, err := IntegrationTypeFromString(string(integrationType))
	return it, err == nil
}

// IsKnownIntegrationType returns true if the integration type is known.
func IsKnownIntegrationType(integrationType schema.IntegrationType) bool {
	_, err := IntegrationTypeFromString(string(integrationType))
	return err == nil
}

// IntegrationTypeFromString returns a valid integration type from string. If string represents an alias, the original type is returned.
func IntegrationTypeFromString(s string) (schema.IntegrationType, error) {
	initSchemaOnce.Do(initSchemas)
	t := schema.IntegrationType(s)
	_, ok := allSchemas[t]
	if ok {
		return t, nil
	}
	_, ok = aliasToType[t]
	if ok {
		return t, nil
	}
	// Case-insensitive search in case the input string uses incorrect case.
	for k := range allSchemas {
		if strings.EqualFold(string(k), s) {
			return k, nil
		}
	}
	for k := range aliasToType {
		if strings.EqualFold(string(k), s) {
			return k, nil
		}
	}
	return "", fmt.Errorf("%w: %s", ErrUnknownIntegrationType, s)
}

// IntegrationTypeFromMimirType returns a valid integration type from a type.
// The argument could be a slice of configurations, e.g. Receiver.EmailConfigs or a struct or a pointer of config type, e.g. config.EmailConfig
// The returning type could be alias or original type.
func IntegrationTypeFromMimirType(t any) (schema.IntegrationType, error) {
	var configType = reflect.TypeOf(t)
	return IntegrationTypeFromMimirTypeReflect(configType)
}

// IntegrationTypeFromMimirTypeReflect returns a valid integration type from a reflect.Type.
// Can be type of ConfigReceiver fields, e.g EmailConfigs or type a particular configuration
func IntegrationTypeFromMimirTypeReflect(t reflect.Type) (schema.IntegrationType, error) {
	if t == nil {
		return "", errors.New("nil type")
	}
	if t.Kind() == reflect.Struct {
		return IntegrationTypeFromString(strings.ToLower(strings.TrimSuffix(t.Name(), "Config")))
	}
	if t.Kind() == reflect.Ptr {
		return IntegrationTypeFromMimirTypeReflect(t.Elem())
	}
	if t.Kind() == reflect.Slice {
		return IntegrationTypeFromMimirTypeReflect(t.Elem())
	}
	return "", errors.New("not a struct or slice")
}
