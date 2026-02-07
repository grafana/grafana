package v0alpha1

import (
	"embed"

	"k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

//go:embed query.schema.json query.definition.schema.json
var f embed.FS

func GetOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	return map[string]common.OpenAPIDefinition{
		"github.com/grafana/grafana-plugin-sdk-go/backend.DataResponse":                                    schemaDataResponse(ref),
		"github.com/grafana/grafana-plugin-sdk-go/data.Frame":                                              schemaDataFrame(ref),
		"github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1.DataQuery":               schemaDataQuery(ref),
		"github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1.QueryTypeDefinitionSpec": schemaQueryTypeDefinitionSpec(ref),
		"github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1.DataSourceRef":           schemaDataSourceRef(ref),
	}
}

// Individual response
func schemaDataResponse(_ common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description:          "todo... improve schema",
				Type:                 []string{"object"},
				AdditionalProperties: &spec.SchemaOrBool{Allows: true},
			},
		},
	}
}

func schemaDataFrame(_ common.ReferenceCallback) common.OpenAPIDefinition {
	return common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description:          "any object for now",
				Type:                 []string{"object"},
				Properties:           map[string]spec.Schema{},
				AdditionalProperties: &spec.SchemaOrBool{Allows: true},
			},
		},
	}
}

func schemaDataSourceRef(_ common.ReferenceCallback) common.OpenAPIDefinition {
	s, _ := DataQuerySchema()
	if s == nil {
		s = &spec.Schema{}
	}
	p, ok := s.Properties["datasource"]
	if !ok {
		p = spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type:                 []string{"object"},
				AdditionalProperties: &spec.SchemaOrBool{Allows: true},
			},
		}
	}
	return common.OpenAPIDefinition{
		Schema: p,
	}
}

func schemaQueryTypeDefinitionSpec(_ common.ReferenceCallback) common.OpenAPIDefinition {
	s, _ := loadSchema("query.definition.schema.json")
	if s == nil {
		s = &spec.Schema{}
	}
	return common.OpenAPIDefinition{
		Schema: *s,
	}
}

func schemaDataQuery(_ common.ReferenceCallback) common.OpenAPIDefinition {
	s, _ := DataQuerySchema()
	if s == nil {
		s = &spec.Schema{}
	}
	s.Type = []string{"object"}
	s.AdditionalProperties = &spec.SchemaOrBool{Allows: true}
	return common.OpenAPIDefinition{Schema: *s}
}

// Get the cached feature list (exposed as a k8s resource)
func DataQuerySchema() (*spec.Schema, error) {
	return loadSchema("query.schema.json")
}

// Get the cached feature list (exposed as a k8s resource)
func loadSchema(path string) (*spec.Schema, error) {
	body, err := f.ReadFile(path)
	if err != nil {
		return nil, err
	}
	s := &spec.Schema{}
	err = s.UnmarshalJSON(body)
	return s, err
}
