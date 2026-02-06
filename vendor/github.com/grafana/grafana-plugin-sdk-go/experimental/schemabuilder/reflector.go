package schemabuilder

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	sdkapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/invopop/jsonschema"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/validation/strfmt"
	"k8s.io/kube-openapi/pkg/validation/validate"
)

// SchemaBuilder is a helper function that can be used by
// backend build processes to produce static schema definitions
// This is not intended as runtime code, and is not the only way to
// produce a schema (we may also want/need to use typescript as the source)
type Builder struct {
	opts      BuilderOptions
	reflector *jsonschema.Reflector // Needed to use comments
	query     []sdkapi.QueryTypeDefinition
}

type CodePaths struct {
	// ex "github.com/grafana/github-datasource/pkg/models"
	BasePackage string

	// ex "./"
	CodePath string
}

type BuilderOptions struct {
	// The plugin type ID used in the DataSourceRef type property
	PluginID []string

	// Scan comments and enumerations
	ScanCode []CodePaths

	// explicitly define the enumeration fields
	Enums []reflect.Type
}

type QueryTypeInfo struct {
	// The management name
	Name string
	// Optional description
	Description string
	// Optional discriminators
	Discriminators []sdkapi.DiscriminatorFieldValue
	// Raw GO type used for reflection
	GoType reflect.Type
	// Add sample queries
	Examples []sdkapi.QueryExample
}

type SettingTypeInfo struct {
	// The management name
	Name string
	// Optional discriminators
	Discriminators []sdkapi.DiscriminatorFieldValue
	// Raw GO type used for reflection
	GoType reflect.Type
	// Map[string]string
	SecureGoType reflect.Type
}

func NewSchemaBuilder(opts BuilderOptions) (*Builder, error) {
	if len(opts.PluginID) < 1 {
		return nil, fmt.Errorf("missing plugin id")
	}

	r := new(jsonschema.Reflector)
	r.DoNotReference = true
	for _, scan := range opts.ScanCode {
		if err := r.AddGoComments(scan.BasePackage, scan.CodePath); err != nil {
			return nil, err
		}
	}
	customMapper := map[reflect.Type]*jsonschema.Schema{
		reflect.TypeOf(data.Frame{}): {
			Type: "object",
			Extras: map[string]any{
				"x-grafana-type": "data.DataFrame",
			},
			AdditionalProperties: jsonschema.TrueSchema,
		},
		reflect.TypeOf(sdkapi.Unstructured{}): {
			Type:                 "object",
			AdditionalProperties: jsonschema.TrueSchema,
		},
		reflect.TypeOf(sdkapi.JSONSchema{}): {
			Type: "object",
			Ref:  draft04,
		},
	}
	r.Mapper = func(t reflect.Type) *jsonschema.Schema {
		return customMapper[t]
	}

	if len(opts.Enums) > 0 {
		fields := []EnumField{}
		for _, scan := range opts.ScanCode {
			enums, err := findEnumFields(scan.BasePackage, scan.CodePath)
			if err != nil {
				return nil, err
			}
			fields = append(fields, enums...)
		}

		for _, etype := range opts.Enums {
			name := etype.Name()
			pack := etype.PkgPath()
			for _, f := range fields {
				if f.Name == name && f.Package == pack {
					enumValueDescriptions := map[string]string{}
					s := &jsonschema.Schema{
						Type: "string",
						Extras: map[string]any{
							"x-enum-description": enumValueDescriptions,
						},
					}
					for _, val := range f.Values {
						s.Enum = append(s.Enum, val.Value)
						if val.Comment != "" {
							enumValueDescriptions[val.Value] = val.Comment
						}
					}
					customMapper[etype] = s
				}
			}
		}
	}

	return &Builder{
		opts:      opts,
		reflector: r,
	}, nil
}

func (b *Builder) Reflector() *jsonschema.Reflector {
	return b.reflector
}

func (b *Builder) AddQueries(inputs ...QueryTypeInfo) error {
	for _, info := range inputs {
		schema := b.reflector.ReflectFromType(info.GoType)
		if schema == nil {
			return fmt.Errorf("missing schema")
		}
		updateEnumDescriptions(schema)

		name := info.Name
		if name == "" {
			for _, dis := range info.Discriminators {
				if name != "" {
					name += "-"
				}
				name += dis.Value
			}
			if name == "" {
				return fmt.Errorf("missing name or discriminators")
			}
		}

		// We need to be careful to only use draft-04 so that this is possible to use
		// with kube-openapi
		schema.Version = draft04
		schema.ID = ""
		schema.Anchor = ""
		spec, err := asJSONSchema(schema)
		if err != nil {
			return err
		}

		b.query = append(b.query, sdkapi.QueryTypeDefinition{
			ObjectMeta: sdkapi.ObjectMeta{
				Name: name,
			},
			Spec: sdkapi.QueryTypeDefinitionSpec{
				Description:    info.Description,
				Discriminators: info.Discriminators,
				Schema: sdkapi.JSONSchema{
					Spec: spec,
				},
				Examples: info.Examples,
			},
		})
	}
	return nil
}

// Update the schema definition file
// When placed in `static/schema/query.types.json` folder of a plugin distribution,
// it can be used to advertise various query types
// If the spec contents have changed, the test will fail (but still update the output)
func (b *Builder) UpdateQueryDefinition(t *testing.T, outdir string) sdkapi.QueryTypeDefinitionList {
	t.Helper()

	outfile := filepath.Join(outdir, "query.types.json")
	now := time.Now().UTC()
	rv := fmt.Sprintf("%d", now.UnixMilli())

	defs := sdkapi.QueryTypeDefinitionList{}
	byName := make(map[string]*sdkapi.QueryTypeDefinition)
	body, err := os.ReadFile(outfile) // #nosec G304
	if err == nil {
		err = json.Unmarshal(body, &defs)
		if err == nil {
			for i, def := range defs.Items {
				byName[def.Name] = &defs.Items[i]
			}
		}
	}
	defs.Kind = "QueryTypeDefinitionList"
	defs.APIVersion = "query.grafana.app/v0alpha1"

	// The updated schemas
	for _, def := range b.query {
		found, ok := byName[def.Name]
		if !ok {
			defs.ResourceVersion = rv
			def.ResourceVersion = rv
			def.CreationTimestamp = now.Format(time.RFC3339)

			defs.Items = append(defs.Items, def)
		} else {
			x := sdkapi.AsUnstructured(def.Spec)
			y := sdkapi.AsUnstructured(found.Spec)
			if diff := cmp.Diff(stripNilValues(x.Object), stripNilValues(y.Object), cmpopts.EquateEmpty()); diff != "" {
				fmt.Printf("Spec changed:\n%s\n", diff)
				found.ResourceVersion = rv
				found.Spec = def.Spec
			}
			delete(byName, def.Name)
		}
	}

	if defs.ResourceVersion == "" {
		defs.ResourceVersion = rv
	}

	if len(byName) > 0 {
		require.FailNow(t, "query type removed, manually update (for now)")
	}
	maybeUpdateFile(t, outfile, defs, body)

	// Update the query save model schema
	//------------------------------------
	outfile = filepath.Join(outdir, "query.panel.schema.json")
	schema, err := GetQuerySchema(QuerySchemaOptions{
		PluginID:   b.opts.PluginID,
		QueryTypes: defs.Items,
		Mode:       SchemaTypePanelModel,
	})
	require.NoError(t, err)

	body, _ = os.ReadFile(outfile) // #nosec G304 // #nosec G304
	maybeUpdateFile(t, outfile, schema, body)

	panel := pseudoPanel{
		Type: "table",
	}
	panel.Targets = examplePanelTargets(&sdkapi.DataSourceRef{
		Type: b.opts.PluginID[0],
		UID:  "TheUID",
	}, defs)

	outfile = filepath.Join(outdir, "query.panel.example.json")
	body, _ = os.ReadFile(outfile) // #nosec G304 // #nosec G304
	maybeUpdateFile(t, outfile, panel, body)

	// Update the request payload schema
	//------------------------------------
	outfile = filepath.Join(outdir, "query.request.schema.json")
	schema, err = GetQuerySchema(QuerySchemaOptions{
		PluginID:   b.opts.PluginID,
		QueryTypes: defs.Items,
		Mode:       SchemaTypeQueryRequest,
	})
	require.NoError(t, err)

	body, _ = os.ReadFile(outfile) // #nosec G304
	maybeUpdateFile(t, outfile, schema, body)

	request := exampleRequest(defs)
	outfile = filepath.Join(outdir, "query.request.example.json")
	body, _ = os.ReadFile(outfile) // #nosec G304
	maybeUpdateFile(t, outfile, request, body)

	validator := validate.NewSchemaValidator(schema, nil, "", strfmt.Default)
	result := validator.Validate(request)
	if result.HasErrorsOrWarnings() {
		for _, err := range result.Errors {
			assert.NoError(t, err)
		}
		for _, err := range result.Warnings {
			assert.NoError(t, err, "warning")
		}

		body, err = json.MarshalIndent(result, "", "  ")
		require.NoError(t, err)
		fmt.Printf("Validation: %s\n", string(body))
		require.Fail(t, "validation failed")
	}
	require.True(t, result.MatchCount > 0, "must have some rules")
	return defs
}

func maybeUpdateFile(t *testing.T, outfile string, value any, body []byte) {
	t.Helper()

	out, err := json.MarshalIndent(value, "", "  ")
	require.NoError(t, err)

	update := false
	if err == nil {
		if !assert.JSONEq(t, string(out), string(body)) {
			update = true
		}
	} else {
		update = true
	}
	if update {
		err = os.WriteFile(outfile, out, 0600)
		require.NoError(t, err, "error writing file")
	}
}

func stripNilValues(input map[string]any) map[string]any {
	for k, v := range input {
		if v == nil {
			delete(input, k)
		} else {
			sub, ok := v.(map[string]any)
			if ok {
				stripNilValues(sub)
			}
		}
	}
	return input
}
