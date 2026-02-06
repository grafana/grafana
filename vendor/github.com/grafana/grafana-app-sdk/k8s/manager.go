package k8s

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"sort"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	kschema "k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/resource"
)

// ResourceManager is a struct that implements resource.Manager, allowing a user to manage Schemas as
// Custom Resource Definitions in kubernetes.
type ResourceManager struct {
	client rest.Interface
}

// NewManager creates a new ResourceManager
func NewManager(cfg rest.Config) (*ResourceManager, error) {
	// Create the kubernetes client for CRD's
	cfg.GroupVersion = &kschema.GroupVersion{
		Group:   "apiextensions.k8s.io",
		Version: "v1",
	}
	cfg.NegotiatedSerializer = serializer.WithoutConversionCodecFactory{
		CodecFactory: serializer.NewCodecFactory(runtime.NewScheme()),
	}
	client, err := rest.RESTClientFor(&cfg)
	if err != nil {
		return nil, err
	}
	return &ResourceManager{
		client: client,
	}, nil
}

// WaitForAvailability polls the kubernetes API server every second until it gets a successful response
// for the Schema's CRD name
func (m *ResourceManager) WaitForAvailability(ctx context.Context, schema resource.Schema) error {
	name := fmt.Sprintf("%s.%s", schema.Plural(), schema.Group())
	sc := 0
	t := time.NewTicker(time.Second)
	defer t.Stop()
	for {
		select {
		case <-t.C:
			err := m.client.Get().Resource("customresourcedefinitions").Name(name).
				Do(ctx).StatusCode(&sc).Error()
			if err == nil {
				return nil
			}
			if err != nil && sc != http.StatusNotFound {
				return err
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// RegisterSchema converts a Schema to a Custom Resource Definition, then attempts to create it in kubernetes.
// If a CRD already exists for the name, it checks to see if this is a new version and attempts to update the CRD
// with the new version.
func (m *ResourceManager) RegisterSchema(ctx context.Context, schema resource.Schema,
	options resource.RegisterSchemaOptions) error {
	name := fmt.Sprintf("%s.%s", schema.Plural(), schema.Group())

	// First, check if the CRD already exists
	sc := 0
	existing := CustomResourceDefinition{}
	err := m.client.Get().Resource("customresourcedefinitions").Name(name).
		Do(ctx).StatusCode(&sc).Into(&existing)
	if err != nil && sc != http.StatusNotFound {
		return ParseKubernetesError(nil, sc, err)
	}
	if sc == http.StatusNotFound {
		// Create new
		return m.create(ctx, schema, name)
	}
	// Check if the provided version already exists
	replaced := false
	for idx, v := range existing.Spec.Versions {
		if v.Name == schema.Version() {
			if !options.UpdateOnConflict {
				if options.NoErrorOnConflict {
					return nil // Quietly exit
				}
				return errors.New("schema with identical kind, group, and version already registered")
			}
			// Replace with the new version
			existing.Spec.Versions[idx] = toVersion(schema)
			replaced = true
			break
		}
	}
	if !replaced {
		// If we didn't replace a version, append
		existing.Spec.Versions = append(existing.Spec.Versions, toVersion(schema))
	}
	// Make sure the latest is the one with storage = true
	sort.Slice(existing.Spec.Versions, func(i, j int) bool {
		return existing.Spec.Versions[i].Name > existing.Spec.Versions[j].Name
	})
	for i := 0; i < len(existing.Spec.Versions); i++ {
		existing.Spec.Versions[i].Storage = false
	}
	existing.Spec.Versions[len(existing.Spec.Versions)-1].Storage = true
	bytes, err := json.Marshal(existing)
	if err != nil {
		return err
	}
	err = m.client.Put().Resource("customresourcedefinitions").Body(bytes).Do(ctx).StatusCode(&sc).Error()
	if err != nil {
		return ParseKubernetesError(nil, sc, err)
	}
	if options.WaitForAvailability {
		return m.WaitForAvailability(ctx, schema)
	}
	return nil
}

func (m *ResourceManager) create(ctx context.Context, schema resource.Schema, name string) error {
	crd := CustomResourceDefinition{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "apiextensions.k8s.io/v1",
			Kind:       "CustomResourceDefinition",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
		Spec: CustomResourceDefinitionSpec{
			Group: schema.Group(),
			// Versions defined later
			Names: CustomResourceDefinitionSpecNames{
				Kind:   schema.Kind(),
				Plural: schema.Plural(),
			},
			Scope: "Namespaced",
		},
	}
	version := toVersion(schema)
	version.Storage = true
	crd.Spec.Versions = []CustomResourceDefinitionSpecVersion{
		version,
	}
	bytes, err := json.Marshal(crd)
	if err != nil {
		return err
	}
	sc := 0
	err = m.client.Post().Resource("customresourcedefinitions").Body(bytes).Do(ctx).StatusCode(&sc).Error()
	return ParseKubernetesError(nil, sc, err)
}

func toVersion(schema resource.Schema) CustomResourceDefinitionSpecVersion {
	obj := schema.ZeroValue()
	version := CustomResourceDefinitionSpecVersion{
		Name:         schema.Version(),
		Served:       true,
		Storage:      false,
		Subresources: make(map[string]any),
	}
	schemaProperties := map[string]any{
		"spec": map[string]any{
			"type":       openAPITypeObject,
			"properties": toOpenAPIV3(reflect.TypeOf(obj.GetSpec())),
		},
	}
	// Check for status, scale subresources
	if status, ok := obj.GetSubresources()["status"]; ok {
		schemaProperties["status"] = map[string]any{
			"type":       openAPITypeObject,
			"properties": toOpenAPIV3(reflect.TypeOf(status)),
		}
		// Add the subresource as an empty struct (this signals kubernetes to use the one supplied in the schema)
		version.Subresources["status"] = struct{}{}
	}
	if scale, ok := obj.GetSubresources()["scale"]; ok {
		schemaProperties["scale"] = map[string]any{
			"type":       openAPITypeObject,
			"properties": toOpenAPIV3(reflect.TypeOf(scale)),
		}
		// Add the subresource as an empty struct (this signals kubernetes to use the one supplied in the schema)
		version.Subresources["scale"] = struct{}{}
	}
	version.Schema = map[string]any{
		"openAPIV3Schema": map[string]any{
			"type":       openAPITypeObject,
			"properties": schemaProperties,
		},
	}
	return version
}

const (
	openAPITypeObject = "object"
)

// toOpenAPIV3 converts a struct into a map[string]any representation of an OpenAPIV3-compliant JSON spec
func toOpenAPIV3(typ reflect.Type) map[string]any { // nolint: funlen
	for typ.Kind() == reflect.Pointer {
		typ = typ.Elem()
	}
	m := make(map[string]any)
	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)

		// Process type
		fieldType := field.Type
		for fieldType.Kind() == reflect.Pointer {
			fieldType = fieldType.Elem()
		}
		v := make(map[string]any)
		switch fieldType.Kind() {
		case reflect.Int, reflect.Int16, reflect.Int32, reflect.Int64:
			v["type"] = "integer"
		case reflect.Float32, reflect.Float64:
			v["type"] = "number"
		case reflect.String:
			v["type"] = "string"
		case reflect.Bool:
			v["type"] = "boolean"
		case reflect.Map, reflect.Interface:
			// A promoted/embedded map or interface should just result in our spec accepting and
			// preserving arbitrary keys
			if field.Anonymous {
				m["x-kubernetes-preserve-unknown-fields"] = true
				continue
			}
			v["type"] = openAPITypeObject
			// Use x-kubernetes-preserve-unknown-fields here, because kubernetes acts weird
			// when using additionalProperties
			v["x-kubernetes-preserve-unknown-fields"] = true
		case reflect.Struct:
			props := toOpenAPIV3(fieldType)
			if field.Anonymous { // Embed anonymous fields
				for key, val := range props {
					m[key] = val
				}
				continue
			}
			v["type"] = openAPITypeObject
			v["properties"] = toOpenAPIV3(fieldType)
		case reflect.Slice, reflect.Array:
			v["type"] = "array"
			itemType := fieldType.Elem()
			for itemType.Kind() == reflect.Pointer {
				itemType = itemType.Elem()
			}
			// TODO: embedded switch is gross
			vv := make(map[string]any)
			switch itemType.Kind() {
			case reflect.Int, reflect.Int16, reflect.Int32, reflect.Int64:
				vv["type"] = "integer"
			case reflect.Float32, reflect.Float64:
				vv["type"] = "number"
			case reflect.String:
				vv["type"] = "string"
			case reflect.Bool:
				vv["type"] = "boolean"
			case reflect.Struct, reflect.Slice, reflect.Array:
				vv["type"] = openAPITypeObject
				vv["properties"] = toOpenAPIV3(itemType)
			default:
				// Any other types (map, interface, anything unknown), treat it like an array of arbitrary objects
				vv["type"] = openAPITypeObject
				// Use x-kubernetes-preserve-unknown-fields here, because kubernetes acts weird
				// when using additionalProperties
				vv["x-kubernetes-preserve-unknown-fields"] = true
			}
			v["items"] = vv
		default:
			continue // Not a type we can handle
		}

		m[getFieldKey(&field)] = v
	}
	return m
}

// getFieldKey will return the field's JSON tag, if present, and if not present, the field name
func getFieldKey(field *reflect.StructField) string {
	name := field.Tag.Get("json")
	if name == "" {
		return field.Name
	}
	parts := strings.Split(name, ",")
	if len(parts) > 1 {
		return parts[0]
	}
	return name
}

// CustomResourceDefinition is the kubernetes-API-compliant representation of a Custom Resource Definition
type CustomResourceDefinition struct {
	metav1.TypeMeta   `json:",inline" yaml:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty" yaml:"metadata,omitempty"`
	Spec              CustomResourceDefinitionSpec `json:"spec"`
}

// DeepCopyObject implements runtime.Object.
func (crd *CustomResourceDefinition) DeepCopyObject() runtime.Object {
	return DeepCopyObject(crd)
}

// CustomResourceDefinitionSpec is the body or spec of a kubernetes Custom Resource Definition
type CustomResourceDefinitionSpec struct {
	Group      string                                  `json:"group" yaml:"group"`
	Versions   []CustomResourceDefinitionSpecVersion   `json:"versions" yaml:"versions"`
	Names      CustomResourceDefinitionSpecNames       `json:"names" yaml:"names"`
	Conversion *CustomResourceDefinitionSpecConversion `json:"conversion,omitempty" yaml:"conversion,omitempty"`
	Scope      string                                  `json:"scope" yaml:"scope"`
}

type CustomResourceDefinitionSpecConversion struct {
	Strategy string                                         `json:"strategy" yaml:"strategy"`
	Webhook  *CustomResourceDefinitionSpecConversionWebhook `json:"webhook,omitempty" yaml:"webhook,omitempty"`
}

type CustomResourceDefinitionSpecConversionWebhook struct {
	ConversionReviewVersions []string                             `json:"conversionReviewVersions" yaml:"conversionReviewVersions"`
	ClientConfig             CustomResourceDefinitionClientConfig `json:"clientConfig" yaml:"clientConfig"`
}

type CustomResourceDefinitionClientConfig struct {
	Service *CustomResourceDefinitionClientConfigService `json:"service,omitempty" yaml:"service,omitempty"`
	URL     string                                       `json:"url,omitempty" yaml:"url,omitempty"`
}

type CustomResourceDefinitionClientConfigService struct {
	Name      string `json:"name,omitempty" yaml:"name,omitempty"`
	Namespace string `json:"namespace,omitempty" yaml:"namespace,omitempty"`
	Path      string `json:"path" yaml:"path"`
}

// CustomResourceDefinitionSpecVersion is the representation of a specific version of a CRD, as part of the overall spec
type CustomResourceDefinitionSpecVersion struct {
	Name                     string                                            `json:"name" yaml:"name"`
	Served                   bool                                              `json:"served" yaml:"served"`
	Storage                  bool                                              `json:"storage" yaml:"storage"`
	Schema                   map[string]any                                    `json:"schema" yaml:"schema"`
	Subresources             map[string]any                                    `json:"subresources,omitempty" yaml:"subresources,omitempty"`
	SelectableFields         []CustomResourceDefinitionSelectableField         `json:"selectableFields,omitempty" yaml:"selectableFields,omitempty"`
	AdditionalPrinterColumns []CustomResourceDefinitionAdditionalPrinterColumn `json:"additionalPrinterColumns,omitempty" yaml:"additionalPrinterColumns,omitempty"`
}

// CustomResourceDefinitionSpecNames is the struct representing the names (kind and plural) of a kubernetes CRD
type CustomResourceDefinitionSpecNames struct {
	Kind   string `json:"kind" yaml:"kind"`
	Plural string `json:"plural" yaml:"plural"`
}

// CustomResourceDefinitionSelectableField is the struct representing a selectable field in a kubernetes CRD.
// This is a copy of https://pkg.go.dev/k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1#SelectableField
// with YAML tags attached to the field.
type CustomResourceDefinitionSelectableField struct {
	JSONPath string `json:"jsonPath" yaml:"jsonPath"`
}

// CustomResourceDefinitionAdditionalPrinterColumn is the struct representing an additional printer column in a kubernetes CRD.
// This is a copy of https://pkg.go.dev/k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1#CustomResourceDefinitionAdditionalPrinterColumn
type CustomResourceDefinitionAdditionalPrinterColumn struct {
	Name        string  `json:"name" yaml:"name"`
	Type        string  `json:"type" yaml:"type"`
	Format      *string `json:"format,omitempty" yaml:"format,omitempty"`
	Description *string `json:"description,omitempty" yaml:"description,omitempty"`
	Priority    *int32  `json:"priority,omitempty" yaml:"priority,omitempty"`
	JSONPath    string  `json:"jsonPath" yaml:"jsonPath"`
}

// DeepCopyObject is an implementation of the receiver method required for implementing runtime.Object.
func DeepCopyObject(in any) runtime.Object {
	val := reflect.ValueOf(in).Elem()

	cpy := reflect.New(val.Type())
	cpy.Elem().Set(val)

	// Using the <obj>, <ok> for the type conversion ensures that it doesn't panic if it can't be converted
	if obj, ok := cpy.Interface().(runtime.Object); ok {
		return obj
	}

	// TODO: better return than nil?
	return nil
}
