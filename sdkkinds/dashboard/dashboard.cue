package kinds

import (
	"github.com/grafana/grafana/sdkkinds/dashboard/v0alpha1"
	"github.com/grafana/grafana/sdkkinds/dashboard/v1alpha1"
	"github.com/grafana/grafana/sdkkinds/dashboard/v2alpha1"
)

dashboard: {
	kind:       "Dashboard"
	pluralName: "Dashboards"
	current:    "v0alpha1"

	codegen: {
		ts: {
			enabled: true
			config: {
				enumsAsUnionTypes: true
			}
		}
		go: {
			enabled: true
		}
	}

	versions: {
		"v0alpha1": v0alpha1.Dashboard
		"v1alpha1": v1alpha1.Dashboard
		"v2alpha1": v2alpha1.Dashboard
	}
}
