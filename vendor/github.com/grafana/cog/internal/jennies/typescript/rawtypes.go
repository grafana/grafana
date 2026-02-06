package typescript

import (
	"fmt"
	"strings"

	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/orderedmap"
	"github.com/grafana/cog/internal/tools"
)

type raw string

type RawTypes struct {
	config        Config
	tmpl          *template.Template
	typeFormatter *typeFormatter
	schemas       ast.Schemas
}

func (jenny RawTypes) JennyName() string {
	return "TypescriptRawTypes"
}

func (jenny RawTypes) Generate(context languages.Context) (codejen.Files, error) {
	jenny.schemas = context.Schemas
	files := make(codejen.Files, 0, len(context.Schemas))

	for _, schema := range context.Schemas {
		output, err := jenny.generateSchema(context, schema)
		if err != nil {
			return nil, err
		}

		filename := jenny.config.pathWithPrefix(
			formatPackageName(schema.Package),
			"types.gen.ts",
		)

		files = append(files, *codejen.NewFile(filename, output, jenny))
	}

	return files, nil
}

func (jenny RawTypes) generateSchema(context languages.Context, schema *ast.Schema) ([]byte, error) {
	var buffer strings.Builder
	var err error

	imports := NewImportMap(jenny.config.PackagesImportMap)
	pkgMapper := func(pkg string) string {
		if imports.IsIdentical(pkg, schema.Package) {
			return ""
		}

		return imports.Add(pkg, fmt.Sprintf("../%s", pkg))
	}

	jenny.typeFormatter = defaultTypeFormatter(jenny.config, context, pkgMapper)

	schema.Objects.Iterate(func(_ string, object ast.Object) {
		typeDefGen, innerErr := jenny.formatObject(object, pkgMapper)
		if innerErr != nil {
			err = innerErr
			return
		}

		buffer.Write(typeDefGen)
		buffer.WriteString("\n")
	})
	if err != nil {
		return nil, err
	}

	importStatements := imports.String()
	if importStatements != "" {
		importStatements += "\n\n"
	}

	return []byte(importStatements + buffer.String()), nil
}

func (jenny RawTypes) formatObject(def ast.Object, packageMapper packageMapper) ([]byte, error) {
	var buffer strings.Builder

	for _, commentLine := range def.Comments {
		buffer.WriteString(fmt.Sprintf("// %s\n", commentLine))
	}

	buffer.WriteString(jenny.typeFormatter.formatTypeDeclaration(def))

	objectName := tools.CleanupNames(def.Name)

	// generate a "default value factory" for every object, except for constants or composability slots
	if (!def.Type.IsScalar() && !def.Type.IsComposableSlot()) || (def.Type.IsScalar() && !def.Type.AsScalar().IsConcrete()) {
		buffer.WriteString("\n")

		buffer.WriteString(fmt.Sprintf("export const default%[1]s = (): %[2]s => (", tools.UpperCamelCase(objectName), objectName))

		formattedDefaults := formatValue(jenny.defaultValueForObject(def, packageMapper))
		buffer.WriteString(formattedDefaults)

		buffer.WriteString(");\n")
	}

	customMethodsBlock := template.CustomObjectMethodsBlock(def)
	if jenny.tmpl.Exists(customMethodsBlock) {
		err := jenny.tmpl.RenderInBuffer(&buffer, customMethodsBlock, map[string]any{
			"Object": def,
		})
		if err != nil {
			return nil, err
		}
		buffer.WriteString("\n")
	}

	return []byte(buffer.String()), nil
}

func prefixLinesWith(input string, prefix string) string {
	lines := strings.Split(input, "\n")
	prefixed := make([]string, 0, len(lines))

	for _, line := range lines {
		prefixed = append(prefixed, prefix+line)
	}

	return strings.Join(prefixed, "\n")
}

/******************************************************************************
* 					 Default and "empty" values management 					  *
******************************************************************************/

func (jenny RawTypes) defaultValueForObject(object ast.Object, packageMapper packageMapper) any {
	switch object.Type.Kind {
	case ast.KindEnum:
		enum := object.Type.AsEnum()
		defaultValue := enum.Values[0].Value
		if object.Type.Default != nil {
			defaultValue = object.Type.Default
		}

		return raw(jenny.typeFormatter.enums.formatValue(object, defaultValue))
	default:
		return jenny.defaultValueForType(object.Type, packageMapper)
	}
}

func (jenny RawTypes) defaultValueForType(typeDef ast.Type, packageMapper packageMapper) any {
	if typeDef.Default != nil {
		return typeDef.Default
	}

	switch typeDef.Kind {
	case ast.KindDisjunction:
		return jenny.defaultValueForType(typeDef.AsDisjunction().Branches[0], packageMapper)
	case ast.KindStruct:
		return jenny.defaultValuesForStructType(typeDef, packageMapper)
	case ast.KindEnum: // anonymous enum
		defaultValue := typeDef.AsEnum().Values[0].Value
		if typeDef.Default != nil {
			defaultValue = typeDef.Default
		}

		return defaultValue
	case ast.KindRef:
		return jenny.defaultValuesForReference(typeDef, packageMapper)
	case ast.KindMap:
		return raw("{}")
	case ast.KindArray:
		return raw("[]")
	case ast.KindScalar:
		return defaultValueForScalar(typeDef.AsScalar())
	case ast.KindIntersection:
		return jenny.defaultValuesForIntersection(typeDef.AsIntersection(), packageMapper)
	case ast.KindConstantRef:
		return jenny.defaultValueForConstantReferences(typeDef.AsConstantRef())
	default:
		return "unknown"
	}
}

func (jenny RawTypes) defaultValuesForStructType(structType ast.Type, packageMapper packageMapper) *orderedmap.Map[string, any] {
	defaults := orderedmap.New[string, any]()

	for _, field := range structType.AsStruct().Fields {
		if field.Type.Default != nil {
			switch field.Type.Kind {
			case ast.KindRef:
				defaults.Set(field.Name, jenny.defaultValuesForReference(field.Type, packageMapper))
				continue
			case ast.KindStruct:
				defaultMap := field.Type.Default.(map[string]interface{})
				defaults.Set(field.Name, jenny.defaultValueForStructs(field.Type.AsStruct(), orderedmap.FromMap(defaultMap)))
				continue
			default:
				defaults.Set(field.Name, field.Type.Default)
				continue
			}
		}

		if !field.Required && !field.Type.IsConstantRef() {
			continue
		}

		defaults.Set(field.Name, jenny.defaultValueForType(field.Type, packageMapper))
	}

	if structType.ImplementsVariant() {
		variant := tools.UpperCamelCase(structType.ImplementedVariant())
		defaults.Set("_implements"+variant+"Variant", raw("() => {}"))
	}

	return defaults
}

func defaultValueForScalar(scalar ast.ScalarType) any {
	// The scalar represents a constant
	if scalar.Value != nil {
		return scalar.Value
	}

	switch scalar.ScalarKind {
	case ast.KindNull:
		return raw("null")
	case ast.KindAny:
		return raw("{}")

	case ast.KindBytes, ast.KindString:
		return raw("\"\"")

	case ast.KindFloat32, ast.KindFloat64:
		return 0.0

	case ast.KindUint8, ast.KindUint16, ast.KindUint32, ast.KindUint64:
		return 0

	case ast.KindInt8, ast.KindInt16, ast.KindInt32, ast.KindInt64:
		return 0

	case ast.KindBool:
		return false

	default:
		return "unknown"
	}
}

func (jenny RawTypes) defaultValuesForIntersection(intersectDef ast.IntersectionType, packageMapper packageMapper) *orderedmap.Map[string, any] {
	defaults := orderedmap.New[string, any]()

	for _, branch := range intersectDef.Branches {
		if branch.Ref != nil {
			continue
		}

		if branch.Struct != nil {
			strctDef := jenny.defaultValuesForStructType(branch, packageMapper)
			strctDef.Iterate(func(key string, value any) {
				defaults.Set(key, value)
			})
		}

		// TODO: Add them for other types?
	}

	return defaults
}

func (jenny RawTypes) defaultValuesForReference(typeDef ast.Type, packageMapper packageMapper) any {
	ref := typeDef.AsRef()

	pkg := packageMapper(ref.ReferredPkg)
	referredType, _ := jenny.schemas.LocateObject(ref.ReferredPkg, ref.ReferredType)
	referredTypeName := formatObjectName(referredType.Name)

	// is the reference to a constant?
	if referredType.Type.IsConcreteScalar() {
		if pkg != "" {
			return raw(fmt.Sprintf("%s.%s", pkg, referredTypeName))
		}

		return raw(referredTypeName)
	}

	if referredType.Type.IsEnum() {
		return raw(jenny.typeFormatter.enums.formatValue(referredType, typeDef.Default))
	}

	if hasStructDefaults(referredType.Type, typeDef.Default) {
		defaultMap := typeDef.Default.(map[string]any)
		return jenny.defaultValueForStructs(referredType.Type.AsStruct(), orderedmap.FromMap(defaultMap))
	}

	if pkg != "" {
		return raw(fmt.Sprintf("%s.default%s()", pkg, tools.UpperCamelCase(referredTypeName)))
	}

	return raw(fmt.Sprintf("default%s()", tools.UpperCamelCase(referredTypeName)))
}

func (jenny RawTypes) defaultValueForStructs(def ast.StructType, m *orderedmap.Map[string, any]) any {
	var buffer strings.Builder

	for _, f := range def.Fields {
		if m.Has(f.Name) {
			switch x := m.Get(f.Name).(type) {
			case map[string]any:
				buffer.WriteString(fmt.Sprintf("%s: %v, ", f.Name, jenny.defaultValueForStructs(f.Type.AsStruct(), orderedmap.FromMap(x))))
			case nil:
				buffer.WriteString(fmt.Sprintf("%s: %v, ", f.Name, formatValue([]any{})))
			default:
				if f.Type.IsRef() {
					ref := f.Type.AsRef()
					referredType, refFound := jenny.schemas.LocateObject(ref.ReferredPkg, ref.ReferredType)

					if refFound && referredType.Type.IsEnum() {
						buffer.WriteString(fmt.Sprintf("%s: %v, ", f.Name, jenny.typeFormatter.enums.formatValue(referredType, x)))
						continue
					}
				}

				buffer.WriteString(fmt.Sprintf("%s: %v, ", f.Name, formatValue(x)))
			}
		} else if f.Required {
			switch f.Type.Kind {
			case ast.KindStruct:
				buffer.WriteString(fmt.Sprintf("%s: { %v }, ", f.Name, defaultEmptyValuesForStructs(f.Type.AsStruct())))
			case ast.KindArray:
				buffer.WriteString(fmt.Sprintf("%s: []", f.Name))
			case ast.KindScalar:
				buffer.WriteString(fmt.Sprintf("%s: %v, ", f.Name, defaultValueForScalar(f.Type.AsScalar())))
			}
		}
	}

	return raw(fmt.Sprintf("{ %+v}", buffer.String()))
}

func defaultEmptyValuesForStructs(def ast.StructType) string {
	var buffer strings.Builder

	for _, f := range def.Fields {
		switch f.Type.Kind {
		case ast.KindStruct:
			buffer.WriteString(fmt.Sprintf("%s: { %v }, ", f.Name, defaultEmptyValuesForStructs(f.Type.AsStruct())))
		case ast.KindArray:
			buffer.WriteString(fmt.Sprintf("%s: []", f.Name))
		case ast.KindScalar:
			buffer.WriteString(fmt.Sprintf("%s: %v, ", f.Name, defaultValueForScalar(f.Type.AsScalar())))
		default:
		}
	}

	return buffer.String()
}

func (jenny RawTypes) defaultValueForConstantReferences(def ast.ConstantReferenceType) any {
	referredType, ok := jenny.schemas.LocateObject(def.ReferredPkg, def.ReferredType)
	if !ok {
		return "unknown"
	}

	if referredType.Type.IsEnum() {
		return raw(jenny.typeFormatter.enums.formatValue(referredType, def.ReferenceValue))
	}

	if referredType.Type.IsScalar() {
		return raw(def.ReferredType)
	}

	return "unknown"
}

func hasStructDefaults(typeDef ast.Type, defaults any) bool {
	_, ok := defaults.(map[string]interface{})
	return ok && typeDef.IsStruct()
}
