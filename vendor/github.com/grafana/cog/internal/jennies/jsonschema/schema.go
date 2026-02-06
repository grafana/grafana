package jsonschema

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/orderedmap"
	"github.com/grafana/cog/internal/tools"
)

type Definition = *orderedmap.Map[string, any]

type Schema struct {
	Config             Config
	ReferenceFormatter func(ref ast.RefType) string
	// OpenAPI3Compatible dictates whether the generated JSONSchema will be compatible with OpenAPI 3.0,
	// rather than JSONSchema (OpenAPI 3.1 is fully compatible with JSON Schema)
	OpenAPI3Compatible bool

	foreignObjects     *orderedmap.Map[string, ast.Object]
	referenceResolver  func(ref ast.RefType) (ast.Object, bool)
	isForeignReference func(ref ast.RefType) bool
}

func (jenny Schema) JennyName() string {
	return "JSONSchema"
}

func (jenny Schema) Generate(context languages.Context) (codejen.Files, error) {
	files := make(codejen.Files, 0, len(context.Schemas))

	if jenny.ReferenceFormatter == nil {
		jenny.ReferenceFormatter = jenny.defaultRefFormatter
	}

	for _, schema := range context.Schemas {
		output, err := jenny.toJSON(jenny.GenerateSchema(context, schema))
		if err != nil {
			return nil, err
		}

		files = append(files, *codejen.NewFile(schema.Package+".jsonschema.json", output, jenny))
	}

	return files, nil
}

func (jenny Schema) toJSON(input any) ([]byte, error) {
	if !jenny.Config.Compact {
		return json.MarshalIndent(input, "", "  ")
	}

	return json.Marshal(input)
}

func (jenny Schema) GenerateSchema(context languages.Context, schema *ast.Schema) Definition {
	jenny.foreignObjects = orderedmap.New[string, ast.Object]()

	jenny.isForeignReference = func(ref ast.RefType) bool {
		return ref.ReferredPkg != schema.Package
	}
	jenny.referenceResolver = func(ref ast.RefType) (ast.Object, bool) {
		return context.LocateObject(ref.ReferredPkg, ref.ReferredType)
	}

	jsonSchema := orderedmap.New[string, any]()
	jsonSchema.Set("$schema", "http://json-schema.org/draft-07/schema#")

	if schema.EntryPoint != "" {
		jsonSchema.Set("$ref", jenny.ReferenceFormatter(ast.RefType{
			ReferredPkg:  schema.Package,
			ReferredType: schema.EntryPoint,
		}))
	}

	definitions := orderedmap.New[string, Definition]()
	schema.Objects.Iterate(func(_ string, object ast.Object) {
		definitions.Set(object.Name, jenny.objectToDefinition(object))
	})

	for {
		if jenny.foreignObjects.Len() == 0 {
			break
		}

		foreignObjects := jenny.foreignObjects
		jenny.foreignObjects = orderedmap.New[string, ast.Object]()

		foreignObjects.Iterate(func(_ string, foreignObject ast.Object) {
			definitions.Set(foreignObject.Name, jenny.objectToDefinition(foreignObject))
		})
	}

	jsonSchema.Set("definitions", definitions)

	return jsonSchema
}

func (jenny Schema) objectToDefinition(object ast.Object) Definition {
	definition := jenny.formatType(object.Type)

	if comments := jenny.objectComments(object); len(comments) != 0 {
		definition.Set("description", comments)
	}

	return definition
}

func (jenny Schema) formatType(typeDef ast.Type) Definition {
	switch typeDef.Kind {
	case ast.KindStruct:
		return jenny.formatStruct(typeDef)
	case ast.KindScalar:
		return jenny.formatScalar(typeDef)
	case ast.KindRef:
		return jenny.formatRef(typeDef)
	case ast.KindEnum:
		return jenny.formatEnum(typeDef)
	case ast.KindArray:
		return jenny.formatArray(typeDef)
	case ast.KindMap:
		return jenny.formatMap(typeDef)
	case ast.KindDisjunction:
		return jenny.formatDisjunction(typeDef)
	case ast.KindIntersection:
		return jenny.formatIntersection(typeDef)
	case ast.KindComposableSlot:
		return jenny.formatComposableSlot()
	case ast.KindConstantRef:
		return jenny.formatConstantRef(typeDef)
	}

	return orderedmap.New[string, any]()
}

func (jenny Schema) formatScalar(typeDef ast.Type) Definition {
	definition := orderedmap.New[string, any]()

	switch typeDef.AsScalar().ScalarKind {
	case ast.KindNull:
		definition.Set("type", "null")
	case ast.KindAny:
		definition.Set("type", "object")
		definition.Set("additionalProperties", map[string]any{})
	case ast.KindBytes:
		definition.Set("type", "string")
		jenny.addStringConstraints(definition, typeDef)
	case ast.KindString:
		definition.Set("type", "string")
		jenny.addStringConstraints(definition, typeDef)
		if typeDef.HasHint(ast.HintStringFormatDateTime) {
			definition.Set("format", "date-time")
		}
	case ast.KindBool:
		definition.Set("type", "boolean")
	case ast.KindFloat32, ast.KindFloat64:
		definition.Set("type", "number")
		jenny.addNumberConstraints(definition, typeDef)
	case ast.KindUint8, ast.KindUint16, ast.KindUint32, ast.KindUint64,
		ast.KindInt8, ast.KindInt16, ast.KindInt32, ast.KindInt64:
		definition.Set("type", "integer")
		jenny.addNumberConstraints(definition, typeDef)
	}

	// constant value?
	if typeDef.AsScalar().IsConcrete() {
		definition.Set("const", typeDef.AsScalar().Value)
	}

	return definition
}

func (jenny Schema) addStringConstraints(definition *orderedmap.Map[string, any], typeDef ast.Type) {
	for _, constraint := range typeDef.AsScalar().Constraints {
		switch constraint.Op {
		case ast.MinLengthOp:
			definition.Set("minLength", constraint.Args[0])
		case ast.MaxLengthOp:
			definition.Set("maxLength", constraint.Args[0])
		}
	}
}

func (jenny Schema) addNumberConstraints(definition *orderedmap.Map[string, any], typeDef ast.Type) {
	for _, constraint := range typeDef.AsScalar().Constraints {
		switch constraint.Op {
		case ast.LessThanOp:
			if jenny.OpenAPI3Compatible {
				definition.Set("maximum", constraint.Args[0])
				definition.Set("exclusiveMaximum", true)
			} else {
				definition.Set("exclusiveMaximum", constraint.Args[0])
			}
		case ast.LessThanEqualOp:
			definition.Set("maximum", constraint.Args[0])
		case ast.GreaterThanOp:
			if jenny.OpenAPI3Compatible {
				definition.Set("minimum", constraint.Args[0])
				definition.Set("exclusiveMinimum", true)
			} else {
				definition.Set("exclusiveMinimum", constraint.Args[0])
			}
		case ast.GreaterThanEqualOp:
			definition.Set("minimum", constraint.Args[0])
		case ast.MultipleOfOp:
			definition.Set("multipleOf", constraint.Args[0])
		}
	}
}

func (jenny Schema) formatStruct(typeDef ast.Type) Definition {
	definition := orderedmap.New[string, any]()

	definition.Set("type", "object")
	definition.Set("additionalProperties", false)
	if typeDef.HasHint(ast.HintOpenStruct) {
		if val, _ := typeDef.Hints[ast.HintOpenStruct].(string); strings.ToLower(val)[0] == 't' {
			definition.Set("additionalProperties", map[string]any{})
		}
	}

	properties := orderedmap.New[string, any]()
	var required []string

	for _, field := range typeDef.AsStruct().Fields {
		fieldDef := jenny.formatType(field.Type)

		if comments := jenny.fieldComments(field); len(comments) != 0 {
			fieldDef.Set("description", comments)
		}

		properties.Set(field.Name, fieldDef)

		if field.Required {
			required = append(required, field.Name)
		}

		// TODO: review defaults management
		if field.Type.Default != nil {
			fieldDef.Set("default", field.Type.Default)
		}
	}

	if len(required) != 0 {
		definition.Set("required", required)
	}

	definition.Set("properties", properties)

	return definition
}

func (jenny Schema) formatRef(typeDef ast.Type) Definition {
	definition := orderedmap.New[string, any]()
	ref := typeDef.AsRef()

	if jenny.isForeignReference(ref) {
		referredObject, found := jenny.referenceResolver(ref)

		if found {
			jenny.foreignObjects.Set(referredObject.SelfRef.String(), referredObject)
		}
	}

	// TODO: handle foreign refs
	definition.Set("$ref", jenny.ReferenceFormatter(ref))

	return definition
}

func (jenny Schema) formatConstantRef(typeDef ast.Type) Definition {
	definition := orderedmap.New[string, any]()
	constRef := typeDef.AsConstantRef()
	ref := ast.NewRef(constRef.ReferredPkg, constRef.ReferredType).AsRef()

	if jenny.isForeignReference(ref) {
		referredObject, found := jenny.referenceResolver(ref)

		if found {
			jenny.foreignObjects.Set(referredObject.SelfRef.String(), referredObject)
		}
	}

	obj, ok := jenny.referenceResolver(ref)
	if !ok {
		definition.Set("$ref", jenny.ReferenceFormatter(ref))
		return definition
	}

	// TODO: handle foreign refs
	if obj.Type.IsEnum() {
		definition.Set("allOf", []Definition{jenny.formatType(ref.AsType())})
	} else {
		definition.Set("$ref", jenny.ReferenceFormatter(ref))
	}

	if obj, ok := jenny.referenceResolver(ref); ok && obj.Type.IsEnum() {
		definition.Set("default", constRef.ReferenceValue)
	}

	return definition
}

func (jenny Schema) defaultRefFormatter(ref ast.RefType) string {
	return fmt.Sprintf("#/definitions/%s", ref.ReferredType)
}

func (jenny Schema) formatEnum(typeDef ast.Type) Definition {
	definition := orderedmap.New[string, any]()

	values := tools.Map(typeDef.AsEnum().Values, func(value ast.EnumValue) any {
		return value.Value
	})

	definition.Set("enum", values)
	// Make an educated guess about the enum type by looking at the first element in the values set
	if len(typeDef.AsEnum().Values) > 0 {
		def := jenny.formatType(typeDef.AsEnum().Values[0].Type)
		definition.Set("type", def.Get("type"))
	}

	return definition
}

func (jenny Schema) formatArray(typeDef ast.Type) Definition {
	definition := orderedmap.New[string, any]()

	definition.Set("type", "array")
	definition.Set("items", jenny.formatType(typeDef.AsArray().ValueType))

	return definition
}

func (jenny Schema) formatMap(typeDef ast.Type) Definition {
	definition := orderedmap.New[string, any]()

	definition.Set("type", "object")
	definition.Set("additionalProperties", jenny.formatType(typeDef.AsMap().ValueType))

	return definition
}

func (jenny Schema) formatDisjunction(typeDef ast.Type) Definition {
	definition := orderedmap.New[string, any]()
	branches := tools.Map(typeDef.AsDisjunction().Branches, jenny.formatType)

	definition.Set("oneOf", branches)

	return definition
}

func (jenny Schema) formatIntersection(typeDef ast.Type) Definition {
	definition := orderedmap.New[string, any]()
	branches := tools.Map(typeDef.AsIntersection().Branches, jenny.formatType)

	definition.Set("allOf", branches)

	return definition
}

func (jenny Schema) formatComposableSlot() Definition {
	definition := orderedmap.New[string, any]()

	// Same as "any"
	definition.Set("type", "object")
	definition.Set("additionalProperties", map[string]any{})

	return definition
}

func (jenny Schema) objectComments(object ast.Object) string {
	comments := object.Comments
	if jenny.Config.Debug {
		passesTrail := tools.Map(object.PassesTrail, func(trail string) string {
			return fmt.Sprintf("Modified by compiler pass '%s'", trail)
		})
		comments = append(comments, passesTrail...)
	}

	return strings.Join(comments, "\n")
}

func (jenny Schema) fieldComments(field ast.StructField) string {
	comments := field.Comments
	if jenny.Config.Debug {
		comments = append(comments, tools.Map(field.PassesTrail, jenny.passTrailFormatter)...)
		comments = append(comments, tools.Map(field.Type.PassesTrail, jenny.passTrailFormatter)...)
	}

	return strings.Join(comments, "\n")
}

func (jenny Schema) passTrailFormatter(trail string) string {
	return fmt.Sprintf("Modified by compiler pass '%s'", trail)
}
