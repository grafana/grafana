package jsonschema

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"sort"
	"strings"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/orderedmap"
	"github.com/grafana/cog/internal/tools"
	schemaparser "github.com/santhosh-tekuri/jsonschema/v5"
)

var errUndescriptiveSchema = fmt.Errorf("the schema does not appear to be describing anything")

const (
	typeNull    = "null"
	typeBoolean = "boolean"
	typeObject  = "object"
	typeArray   = "array"
	typeString  = "string"
	typeNumber  = "number"
	typeInteger = "integer"

	formatDateTime = "date-time"
)

type Config struct {
	// Package name used to generate code into.
	Package string

	SchemaMetadata ast.SchemaMeta

	// Path to the schema file, if any.
	SchemaPath string
}

type generator struct {
	schema *ast.Schema
	seen   map[string]struct{}
}

func GenerateAST(schemaReader io.Reader, c Config) (*ast.Schema, error) {
	g := &generator{
		seen:   make(map[string]struct{}),
		schema: ast.NewSchema(c.Package, c.SchemaMetadata),
	}

	compiler := schemaparser.NewCompiler()
	compiler.ExtractAnnotations = true

	schemaResourceURL := "schema"
	if c.SchemaPath != "" {
		absSchemaPath, err := filepath.Abs(c.SchemaPath)
		if err != nil {
			return nil, fmt.Errorf("[%s] could not resolve base directory: %w", c.Package, err)
		}

		schemaResourceURL = "file://" + absSchemaPath
	}

	if err := compiler.AddResource(schemaResourceURL, schemaReader); err != nil {
		return nil, fmt.Errorf("[%s] %w", c.Package, err)
	}

	schema, err := compiler.Compile(schemaResourceURL)
	if err != nil {
		return nil, fmt.Errorf("[%s] %w", c.Package, err)
	}

	rootObjectName := c.Package

	// The root of the schema is an actual type/object
	if schema.Ref == nil {
		if err := g.declareDefinition(rootObjectName, schema); err != nil {
			return nil, fmt.Errorf("[%s] %w", c.Package, err)
		}
	} else {
		rootObjectName = g.definitionNameFromRef(schema)

		// The root of the schema contains definitions, and a reference to the "main" object
		if err := g.declareDefinition(rootObjectName, schema.Ref); err != nil {
			return nil, fmt.Errorf("[%s] %w", c.Package, err)
		}
	}

	if c.SchemaMetadata.Variant != "" {
		g.schema.Objects.Get(rootObjectName).Type.Hints[ast.HintImplementsVariant] = string(c.SchemaMetadata.Variant)
	}

	g.schema.EntryPoint = rootObjectName
	g.schema.EntryPointType = g.schema.Objects.Get(rootObjectName).SelfRef.AsType()

	// To ensure a consistent output, since github.com/santhosh-tekuri/jsonschema
	// doesn't guarantee the order of the definitions it parses.
	g.schema.Objects.Sort(orderedmap.SortStrings)

	return g.schema, nil
}

func (g *generator) declareDefinition(definitionName string, schema *schemaparser.Schema) error {
	if _, found := g.seen[definitionName]; found {
		return nil
	}

	g.seen[definitionName] = struct{}{}

	def, err := g.walkDefinition(schema)
	if err != nil {
		return fmt.Errorf("%s: %w", definitionName, err)
	}

	g.schema.AddObject(ast.Object{
		Name: definitionName,
		Type: def,
		SelfRef: ast.RefType{
			ReferredPkg:  g.schema.Package,
			ReferredType: definitionName,
		},
	})

	return nil
}

func (g *generator) walkDefinition(schema *schemaparser.Schema) (ast.Type, error) {
	var def ast.Type
	var err error

	if schema.Ref != nil {
		return g.walkRef(schema)
	}

	if schema.OneOf != nil {
		return g.walkOneOf(schema)
	}

	if schema.AnyOf != nil {
		return g.walkAnyOf(schema)
	}

	if schema.AllOf != nil {
		return g.walkAllOf(schema)
	}

	if schema.Enum != nil {
		return g.walkEnum(schema)
	}

	if len(schema.Types) == 0 {
		if schema.Properties != nil || schema.PatternProperties != nil || schema.AdditionalProperties != nil {
			return g.walkObject(schema)
		}

		if len(schema.Constant) != 0 {
			return g.walkUntypedConstant(schema)
		}

		return ast.Any(), nil
	}

	// nolint: gocritic
	if len(schema.Types) > 1 {
		def, err = g.walkScalarDisjunction(schema.Types)
	} else if schema.Enum != nil {
		def, err = g.walkEnum(schema)
	} else {
		switch schema.Types[0] {
		case typeNull:
			def = ast.Null()
		case typeBoolean:
			def, err = g.walkBool(schema)
		case typeString:
			def, err = g.walkString(schema)
		case typeObject:
			def, err = g.walkObject(schema)
		case typeNumber, typeInteger:
			def, err = g.walkNumber(schema)
		case typeArray:
			def, err = g.walkList(schema)
		default:
			return ast.Type{}, fmt.Errorf("unexpected schema with type '%s'", schema.Types[0])
		}
	}

	return def, err
}

func (g *generator) walkScalarDisjunction(types []string) (ast.Type, error) {
	branches := make([]ast.Type, 0, len(types))

	for _, typeName := range types {
		switch typeName {
		case typeNull:
			branches = append(branches, ast.Null())
		case typeBoolean:
			branches = append(branches, ast.Bool())
		case typeString:
			branches = append(branches, ast.String())
		case typeNumber:
			branches = append(branches, ast.NewScalar(ast.KindFloat64))
		case typeInteger:
			branches = append(branches, ast.NewScalar(ast.KindInt64))
		default:
			return ast.Type{}, fmt.Errorf("unexpected type in scalar disjunction '%s'", typeName)
		}
	}

	return ast.NewDisjunction(branches), nil
}

func (g *generator) walkDisjunctionBranches(branches []*schemaparser.Schema) ([]ast.Type, error) {
	definitions := make([]ast.Type, 0, len(branches))
	for _, oneOf := range branches {
		branch, err := g.walkDefinition(oneOf)
		if err != nil {
			return nil, err
		}

		definitions = append(definitions, branch)
	}

	return definitions, nil
}

func (g *generator) walkUntypedConstant(schema *schemaparser.Schema) (ast.Type, error) {
	value := schema.Constant[0]

	switch constant := value.(type) {
	case json.Number:
		if val, err := constant.Int64(); err == nil {
			return ast.NewScalar(ast.KindInt64, ast.Value(val)), nil
		} else if val, err := constant.Float64(); err == nil {
			return ast.NewScalar(ast.KindFloat64, ast.Value(val)), nil
		} else {
			return ast.Type{}, fmt.Errorf("could not parse json.Number %v", constant)
		}
	case bool:
		return ast.Bool(ast.Value(constant)), nil
	case string:
		return ast.String(ast.Value(constant)), nil
	case nil:
		return ast.Null(), nil
	default:
		return ast.Type{}, fmt.Errorf("unhandled constant type %T", value)
	}
}

func (g *generator) walkOneOf(schema *schemaparser.Schema) (ast.Type, error) {
	if len(schema.OneOf) == 0 {
		return ast.Type{}, fmt.Errorf("oneOf with no branches")
	}

	branches, err := g.walkDisjunctionBranches(schema.OneOf)
	if err != nil {
		return ast.Type{}, err
	}

	return ast.NewDisjunction(branches), nil
}

// TODO: what's the difference between oneOf and anyOf?
func (g *generator) walkAnyOf(schema *schemaparser.Schema) (ast.Type, error) {
	if len(schema.AnyOf) == 0 {
		return ast.Type{}, fmt.Errorf("anyOf with no branches")
	}

	branches, err := g.walkDisjunctionBranches(schema.AnyOf)
	if err != nil {
		return ast.Type{}, err
	}

	return ast.NewDisjunction(branches), nil
}

func (g *generator) walkAllOf(schema *schemaparser.Schema) (ast.Type, error) {
	branches := make([]ast.Type, len(schema.AllOf))
	for i, sch := range schema.AllOf {
		def, err := g.walkDefinition(sch)
		if err != nil {
			return ast.Type{}, err
		}

		branches[i] = def
	}

	if len(branches) == 1 {
		return branches[0], nil
	}

	return ast.NewIntersection(branches), nil
}

func (g *generator) definitionNameFromRef(schema *schemaparser.Schema) string {
	parts := strings.Split(schema.Ref.Location, "/")

	return parts[len(parts)-1] // Very naive
}

func (g *generator) walkRef(schema *schemaparser.Schema) (ast.Type, error) {
	referredKindName := g.definitionNameFromRef(schema)

	if err := g.declareDefinition(referredKindName, schema.Ref); err != nil {
		return ast.Type{}, err
	}

	// TODO: get the correct package for the referred type
	return ast.NewRef(g.schema.Package, referredKindName), nil
}

func (g *generator) walkString(schema *schemaparser.Schema) (ast.Type, error) {
	def := ast.String(ast.Default(schema.Default))

	if schema.Constant != nil {
		def.Scalar.Value = schema.Constant[0]
	}

	// to handle constant values defined as a string with a "static" regex:
	// ```
	// "someField": {
	// 	  "type": "string",
	// 	  "pattern": "^math$"
	// }
	// ```
	if schema.Pattern != nil && tools.RegexMatchesConstantString(schema.Pattern.String()) {
		def.Scalar.Value = tools.ConstantStringFromRegex(schema.Pattern.String())
	}

	if schema.Format == formatDateTime {
		def.Hints[ast.HintStringFormatDateTime] = true
	}

	if schema.MinLength != -1 {
		def.Scalar.Constraints = append(def.Scalar.Constraints, ast.TypeConstraint{
			Op:   ast.MinLengthOp,
			Args: []any{schema.MinLength},
		})
	}
	if schema.MaxLength != -1 {
		def.Scalar.Constraints = append(def.Scalar.Constraints, ast.TypeConstraint{
			Op:   ast.MaxLengthOp,
			Args: []any{schema.MaxLength},
		})
	}

	return def, nil
}

func (g *generator) walkBool(schema *schemaparser.Schema) (ast.Type, error) {
	def := ast.Bool(ast.Default(schema.Default))

	if schema.Constant != nil {
		def.Scalar.Value = schema.Constant[0]
	}

	return def, nil
}

func (g *generator) walkNumber(schema *schemaparser.Schema) (ast.Type, error) {
	scalarKind := ast.KindInt64
	if schema.Types[0] == typeNumber {
		scalarKind = ast.KindFloat64
	}

	def := ast.NewScalar(scalarKind, ast.Default(schema.Default))

	if schema.Constant != nil {
		def.Scalar.Value = unwrapJSONNumber(schema.Constant[0])
	}

	if schema.Minimum != nil {
		value, _ := schema.Minimum.Float64()
		def.Scalar.Constraints = append(def.Scalar.Constraints, ast.TypeConstraint{
			Op:   ast.GreaterThanEqualOp,
			Args: []any{value},
		})
	}
	if schema.ExclusiveMinimum != nil {
		value, _ := schema.ExclusiveMinimum.Float64()
		def.Scalar.Constraints = append(def.Scalar.Constraints, ast.TypeConstraint{
			Op:   ast.GreaterThanOp,
			Args: []any{value},
		})
	}
	if schema.Maximum != nil {
		value, _ := schema.Maximum.Float64()
		def.Scalar.Constraints = append(def.Scalar.Constraints, ast.TypeConstraint{
			Op:   ast.LessThanEqualOp,
			Args: []any{value},
		})
	}
	if schema.ExclusiveMaximum != nil {
		value, _ := schema.ExclusiveMaximum.Float64()
		def.Scalar.Constraints = append(def.Scalar.Constraints, ast.TypeConstraint{
			Op:   ast.LessThanOp,
			Args: []any{value},
		})
	}

	return def, nil
}

func (g *generator) walkList(schema *schemaparser.Schema) (ast.Type, error) {
	var itemsDef ast.Type
	var err error

	switch {
	case schema.Items == nil && schema.Items2020 == nil:
		itemsDef = ast.Any()
	case schema.Items2020 != nil:
		itemsDef, err = g.walkDefinition(schema.Items2020)
	default:
		// TODO: schema.Items might not be a schema?
		itemsDef, err = g.walkDefinition(schema.Items.(*schemaparser.Schema))
	}

	// items contains an empty schema: `{}`
	if errors.Is(err, errUndescriptiveSchema) {
		itemsDef = ast.Any()
	} else if err != nil {
		return ast.Type{}, err
	}

	return ast.NewArray(itemsDef, ast.Default(schema.Default)), nil
}

func (g *generator) walkEnum(schema *schemaparser.Schema) (ast.Type, error) {
	if len(schema.Enum) == 0 {
		return ast.Type{}, fmt.Errorf("enum with no values")
	}

	// we only want to deal with string or int enums
	enumType := ast.String()
	if _, ok := schema.Enum[0].(string); !ok {
		enumType = ast.NewScalar(ast.KindInt64)
	}

	values := make([]ast.EnumValue, 0, len(schema.Enum))
	for _, enumValue := range schema.Enum {
		values = append(values, ast.EnumValue{
			Type:  enumType,
			Name:  fmt.Sprintf("%v", enumValue),
			Value: unwrapJSONNumber(enumValue),
		})
	}

	return ast.NewEnum(values), nil
}

func (g *generator) walkObject(schema *schemaparser.Schema) (ast.Type, error) {
	if len(schema.Properties) == 0 {
		// `schema.AdditionalProperties` is nil or false or *schemaparser.Schema
		_, ok := schema.AdditionalProperties.(bool)
		if schema.AdditionalProperties == nil || ok {
			return ast.Any(), nil
		}

		valueType, err := g.walkDefinition(schema.AdditionalProperties.(*schemaparser.Schema))
		if err != nil {
			return ast.Type{}, err
		}

		return ast.NewMap(ast.String(), valueType), nil
	}

	// TODO: finish implementation
	fields := make([]ast.StructField, 0, len(schema.Properties))
	for name, property := range schema.Properties {
		fieldDef, err := g.walkDefinition(property)
		if err != nil {
			return ast.Type{}, fmt.Errorf("%s: %w", name, err)
		}

		field := ast.NewStructField(name, fieldDef, ast.Comments(schemaComments(property)))
		field.Required = tools.ItemInList(name, schema.Required)

		fields = append(fields, field)
	}

	// To ensure consistent outputs
	sort.Slice(fields, func(i, j int) bool {
		return fields[i].Name < fields[j].Name
	})

	return ast.NewStruct(fields...), nil
}
