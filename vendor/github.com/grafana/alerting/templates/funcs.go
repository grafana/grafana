package templates

import (
	"github.com/prometheus/alertmanager/template"

	"github.com/grafana/alerting/templates/mimir"
)

var (
	DefaultFuncs = template.DefaultFuncs
)

func defaultTemplatesPerKind(kind Kind) []string {
	switch kind {
	case GrafanaKind:
		return []string{
			DefaultTemplateString,
		}
	case MimirKind:
		return nil
	default:
		return nil
	}
}

func defaultOptionsPerKind(kind Kind, orgID string) []template.Option {
	switch kind {
	case GrafanaKind:
		return []template.Option{
			addFuncs,
			mimir.WithCustomFunctions(orgID),
		}
	case MimirKind:
		return []template.Option{
			mimir.WithCustomFunctions(orgID),
		}
	default:
		return nil
	}
}
