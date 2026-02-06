package schemabuilder

import (
	"encoding/json"
	"fmt"

	sdkapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

// The k8s compatible jsonschema version
const draft04 = "https://json-schema.org/draft-04/schema#"

// Supported expression types
// +enum
type SchemaType string

const (
	// Single query target saved in a dashboard/panel/alert JSON
	SchemaTypeSaveModel SchemaType = "save"

	// Single query payload included in a query request
	SchemaTypeQueryPayload SchemaType = "payload"

	// Pseudo panel model including multiple targets (not mixed)
	SchemaTypePanelModel SchemaType = "panel"

	// Query request against a single data source (not mixed)
	SchemaTypeQueryRequest SchemaType = "request"
)

type QuerySchemaOptions struct {
	PluginID   []string
	QueryTypes []sdkapi.QueryTypeDefinition
	Mode       SchemaType
}

// Given definitions for a plugin, return a valid spec
func GetQuerySchema(opts QuerySchemaOptions) (*spec.Schema, error) {
	isRequest := opts.Mode == SchemaTypeQueryPayload || opts.Mode == SchemaTypeQueryRequest
	generic, err := sdkapi.DataQuerySchema()
	if err != nil {
		return nil, err
	}

	ignoreForSave := map[string]bool{"maxDataPoints": true, "intervalMs": true}
	common := make(map[string]spec.Schema)
	for key, val := range generic.Properties {
		if !isRequest && ignoreForSave[key] {
			continue //
		}

		if key == "datasource" {
			pattern := ""
			for _, pid := range opts.PluginID {
				if pattern != "" {
					pattern += "|"
				}
				pattern += `^` + pid + `$`
			}
			if pattern == "" {
				if opts.Mode == SchemaTypePanelModel {
					return nil, fmt.Errorf("panel model requires pluginId")
				}
			} else {
				t := val.Properties["type"]
				t.Pattern = pattern
				val.Properties["type"] = t
			}
		}

		common[key] = val
	}

	// The types for each query type
	queryTypes := []*spec.Schema{}
	for _, qt := range opts.QueryTypes {
		node := qt.Spec.Schema.DeepCopy().Spec
		if node == nil {
			return nil, fmt.Errorf("missing schema for: %s", qt.Name)
		}

		// Match all discriminators
		for _, d := range qt.Spec.Discriminators {
			ds, ok := node.Properties[d.Field]
			if !ok {
				ds = *spec.StringProperty()
			}
			ds.Pattern = `^` + d.Value + `$`
			node.Properties[d.Field] = ds
			node.Required = append(node.Required, d.Field)
		}

		queryTypes = append(queryTypes, node)
	}

	s := &spec.Schema{
		SchemaProps: spec.SchemaProps{
			Type:       []string{"object"},
			Schema:     draft04,
			Properties: make(map[string]spec.Schema),
		},
	}

	// Single node -- just union the global and local properties
	if len(queryTypes) == 1 {
		s = queryTypes[0]
		s.Schema = draft04
		for key, val := range generic.Properties {
			_, found := s.Properties[key]
			if found {
				continue
			}
			s.Properties[key] = val
		}
	} else {
		for _, qt := range queryTypes {
			qt.Required = append(qt.Required, "refId")

			for k, v := range common {
				_, found := qt.Properties[k]
				if found {
					continue
				}
				qt.Properties[k] = v
			}

			s.OneOf = append(s.OneOf, *qt)
		}
	}

	switch opts.Mode {
	case SchemaTypeQueryRequest:
		return addRequestWrapper(s), nil
	case SchemaTypePanelModel:
		return addPanelWrapper(s), nil
	}
	return s, nil
}

// moves the schema the the query slot in a request
func addRequestWrapper(s *spec.Schema) *spec.Schema {
	return &spec.Schema{
		SchemaProps: spec.SchemaProps{
			Schema:               draft04,
			Type:                 []string{"object"},
			Required:             []string{"queries"},
			AdditionalProperties: &spec.SchemaOrBool{Allows: false},
			Properties: map[string]spec.Schema{
				"from": *spec.StringProperty().WithDescription(
					"From Start time in epoch timestamps in milliseconds or relative using Grafana time units."),
				"to": *spec.StringProperty().WithDescription(
					"To end time in epoch timestamps in milliseconds or relative using Grafana time units."),
				"queries": *spec.ArrayProperty(s),
				"debug":   *spec.BoolProperty(),
				"$schema": *spec.StringProperty().WithDescription("helper"),
			},
		},
	}
}

// Pretends to be a panel object
func addPanelWrapper(s *spec.Schema) *spec.Schema {
	return &spec.Schema{
		SchemaProps: spec.SchemaProps{
			Schema:               draft04,
			Type:                 []string{"object"},
			Required:             []string{"targets", "type"},
			AdditionalProperties: &spec.SchemaOrBool{Allows: true},
			Properties: map[string]spec.Schema{
				"type":    *spec.StringProperty().WithDescription("the panel type"),
				"targets": *spec.ArrayProperty(s),
			},
		},
	}
}

func asJSONSchema(v any) (*spec.Schema, error) {
	s, ok := v.(*spec.Schema)
	if ok {
		return s, nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	s = &spec.Schema{}
	err = json.Unmarshal(b, s)
	return s, err
}
