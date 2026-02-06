package golang

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

type typeFormatter struct {
	imports       *common.DirectImportMap
	packageMapper func(pkg string) string
	config        Config

	forBuilder bool
	context    languages.Context
}

func defaultTypeFormatter(config Config, context languages.Context, imports *common.DirectImportMap, packageMapper func(pkg string) string) *typeFormatter {
	return &typeFormatter{
		imports:       imports,
		packageMapper: packageMapper,
		config:        config,
		context:       context,
	}
}

func builderTypeFormatter(config Config, context languages.Context, imports *common.DirectImportMap, packageMapper func(pkg string) string) *typeFormatter {
	return &typeFormatter{
		imports:       imports,
		packageMapper: packageMapper,
		config:        config,
		forBuilder:    true,
		context:       context,
	}
}

func (formatter *typeFormatter) formatType(def ast.Type) string {
	return formatter.doFormatType(def, formatter.forBuilder)
}

func (formatter *typeFormatter) formatTypeDeclaration(def ast.Object) string {
	var buffer strings.Builder

	defName := formatObjectName(def.Name)

	switch def.Type.Kind {
	case ast.KindEnum:
		buffer.WriteString(formatter.formatEnumDef(def))
	case ast.KindScalar:
		scalarType := def.Type.AsScalar()

		// nolint: gocritic
		if scalarType.Value != nil {
			buffer.WriteString(fmt.Sprintf("const %s = %s", defName, formatScalar(scalarType.Value)))
		} else if scalarType.ScalarKind == ast.KindBytes {
			buffer.WriteString(fmt.Sprintf("type %s %s", defName, "[]byte"))
		} else {
			buffer.WriteString(fmt.Sprintf("type %s %s", defName, formatter.formatType(def.Type)))
		}
	case ast.KindRef:
		buffer.WriteString(fmt.Sprintf("type %s = %s", defName, formatter.formatType(def.Type)))
	case ast.KindMap, ast.KindArray, ast.KindStruct, ast.KindIntersection:
		buffer.WriteString(fmt.Sprintf("type %s %s", defName, formatter.formatType(def.Type)))
	case ast.KindConstantRef:
		buffer.WriteString(fmt.Sprintf("const %s = %s", defName, formatScalar(def.Type.AsConstantRef().ReferenceValue)))
	default:
		return fmt.Sprintf("unhandled type def kind: %s", def.Type.Kind)
	}

	return buffer.String()
}

func (formatter *typeFormatter) formatEnumDef(def ast.Object) string {
	var buffer strings.Builder

	enumName := formatObjectName(def.Name)
	enumType := def.Type.AsEnum()

	buffer.WriteString(fmt.Sprintf("type %s %s\n", enumName, formatter.formatType(enumType.Values[0].Type)))

	buffer.WriteString("const (\n")
	for _, val := range enumType.Values {
		name := tools.CleanupNames(formatObjectName(val.Name))
		buffer.WriteString(fmt.Sprintf("\t%s %s = %#v\n", name, enumName, val.Value))
	}
	buffer.WriteString(")\n")

	return buffer.String()
}

func (formatter *typeFormatter) doFormatType(def ast.Type, resolveBuilders bool) string {
	actualFormatter := func() string {
		if def.IsAny() && formatter.config.AnyAsInterface {
			return "interface{}"
		}
		if def.IsAny() {
			return "any"
		}

		if def.IsComposableSlot() {
			formatted := formatter.variantInterface(string(def.AsComposableSlot().Variant))

			if !resolveBuilders {
				return formatted
			}

			cogAlias := formatter.packageMapper("cog")

			return fmt.Sprintf("%s.Builder[%s]", cogAlias, formatted)
		}

		if def.IsArray() {
			return formatter.formatArray(def.AsArray(), resolveBuilders)
		}

		if def.IsMap() {
			return formatter.formatMap(def.AsMap(), resolveBuilders)
		}

		if def.IsScalar() {
			typeName := def.AsScalar().ScalarKind
			if def.HasHint(ast.HintStringFormatDateTime) {
				typeName = "time.Time"
				formatter.imports.Add("time", "time")
			}
			if def.Nullable {
				typeName = "*" + typeName
			}
			if def.AsScalar().ScalarKind == ast.KindBytes {
				typeName = "[]byte"
			}

			return string(typeName)
		}

		if def.IsRef() {
			return formatter.formatRef(def, resolveBuilders)
		}

		if def.IsConstantRef() {
			return formatter.formatConstantRef(def)
		}

		// anonymous struct or struct body
		if def.IsStruct() {
			output := formatter.formatStructBody(def.AsStruct())
			if def.Nullable {
				output = "*" + output
			}

			return output
		}

		if def.IsIntersection() {
			return formatter.formatIntersection(def.AsIntersection())
		}

		// FIXME: we should never be here
		return "unknown"
	}

	passesTrail := ""
	if formatter.config.debug && len(def.PassesTrail) != 0 {
		passesTrail = fmt.Sprintf(" /* %s */", strings.Join(def.PassesTrail, ", "))
	}

	return actualFormatter() + passesTrail
}

func (formatter *typeFormatter) variantInterface(variant string) string {
	referredPkg := formatter.packageMapper("cog/variants")

	return referredPkg + "." + formatObjectName(variant)
}

func (formatter *typeFormatter) formatStructBody(def ast.StructType) string {
	var buffer strings.Builder

	buffer.WriteString("struct {\n")

	for i, fieldDef := range def.Fields {
		buffer.WriteString(tools.Indent(formatter.formatField(fieldDef), 4))
		if i != len(def.Fields)-1 {
			buffer.WriteString("\n")
		}
	}

	buffer.WriteString("\n}")

	return buffer.String()
}

func (formatter *typeFormatter) formatField(def ast.StructField) string {
	var buffer strings.Builder

	comments := def.Comments
	if formatter.config.debug {
		passesTrail := tools.Map(def.PassesTrail, func(trail string) string {
			return fmt.Sprintf("Modified by compiler pass '%s'", trail)
		})
		comments = append(comments, passesTrail...)
	}

	for _, commentLine := range comments {
		buffer.WriteString("// " + commentLine + "\n")
	}

	jsonOmitEmpty := ""
	if !def.Required {
		jsonOmitEmpty = ",omitempty"
	}

	fieldType := def.Type

	// if the field's type is a reference to a constant,
	// we need to use the constant's type instead.
	// ie: `SomeField string` instead of `SomeField MyStringConstant`
	if def.Type.IsRef() {
		referredType := formatter.context.ResolveRefs(def.Type)
		if referredType.IsConcreteScalar() {
			fieldType = referredType
		}
	}

	buffer.WriteString(fmt.Sprintf(
		"%s %s `json:\"%s%s\"`",
		formatFieldName(def.Name),
		formatter.doFormatType(fieldType, false),
		def.Name,
		jsonOmitEmpty,
	))

	return buffer.String()
}

func (formatter *typeFormatter) formatArray(def ast.ArrayType, resolveBuilders bool) string {
	subTypeString := formatter.doFormatType(def.ValueType, resolveBuilders)

	return "[]" + subTypeString
}

func (formatter *typeFormatter) formatMap(def ast.MapType, resolveBuilders bool) string {
	keyTypeString := formatter.doFormatType(def.IndexType, resolveBuilders)
	valueTypeString := formatter.doFormatType(def.ValueType, resolveBuilders)

	return fmt.Sprintf("map[%s]%s", keyTypeString, valueTypeString)
}

func (formatter *typeFormatter) formatRef(def ast.Type, resolveBuilders bool) string {
	referredPkg := formatter.packageMapper(def.AsRef().ReferredPkg)
	typeName := formatObjectName(def.AsRef().ReferredType)

	if referredPkg != "" {
		typeName = referredPkg + "." + typeName
	}

	if resolveBuilders && formatter.context.ResolveToBuilder(def) {
		cogAlias := formatter.packageMapper("cog")

		return fmt.Sprintf("%s.Builder[%s]", cogAlias, typeName)
	}

	if def.Nullable {
		typeName = "*" + typeName
	}

	return typeName
}

func (formatter *typeFormatter) formatConstantRef(def ast.Type) string {
	constRef := def.AsConstantRef()

	obj, ok := formatter.context.LocateObject(constRef.ReferredPkg, constRef.ReferredType)
	if !ok {
		return "unknown"
	}

	nullable := ""
	if def.Nullable {
		nullable = "*"
	}

	if obj.Type.IsScalar() {
		return nullable + string(obj.Type.AsScalar().ScalarKind)
	}

	referredPkg := formatter.packageMapper(constRef.ReferredPkg)
	typeName := formatObjectName(constRef.ReferredType)

	if referredPkg != "" {
		typeName = referredPkg + "." + typeName
	}

	return nullable + typeName
}

func (formatter *typeFormatter) formatIntersection(def ast.IntersectionType) string {
	var buffer strings.Builder

	buffer.WriteString("struct {\n")

	refs := make([]ast.Type, 0)
	rest := make([]ast.Type, 0)
	for _, b := range def.Branches {
		if b.IsRef() {
			refs = append(refs, b)
			continue
		}

		rest = append(rest, b)
	}

	// Collect field names from embedded references to avoid duplicates
	refFieldNames := make(map[string]bool)
	for _, ref := range refs {
		if ref.IsRef() {
			if obj, found := formatter.context.LocateObjectByRef(ref.AsRef()); found {
				if obj.Type.IsStruct() {
					for _, field := range obj.Type.AsStruct().Fields {
						refFieldNames[field.Name] = true
					}
				}
			}
		}
	}

	for _, ref := range refs {
		buffer.WriteString("\t" + formatter.formatRef(ref, false) + "\n")
	}

	if len(refs) > 0 {
		buffer.WriteString("\n")
	}

	for _, r := range rest {
		if r.IsStruct() {
			for _, fieldDef := range r.Struct.Fields {
				// Skip fields that are already defined in embedded references
				if refFieldNames[fieldDef.Name] {
					continue
				}
				buffer.WriteString("\t" + formatter.formatField(fieldDef))
				buffer.WriteString("\n")
			}
			continue
		}

		buffer.WriteString("\t" + formatter.doFormatType(r, false) + "\n")
	}

	buffer.WriteString("}")

	return buffer.String()
}

func makePathFormatter(typeFormatter *typeFormatter) func(path ast.Path) string {
	return func(fieldPath ast.Path) string {
		path := ""

		for i := range fieldPath {
			last := i == len(fieldPath)-1
			output := fieldPath[i].Identifier
			if !fieldPath[i].Root {
				output = formatFieldName(output)
			}

			if fieldPath[i].Index != nil {
				output += "["
				if fieldPath[i].Index.Constant != nil {
					output += formatScalar(fieldPath[i].Index.Constant)
				} else {
					output += formatArgName(fieldPath[i].Index.Argument.Name)
				}
				output += "]"
			}

			// don't generate type hints if:
			// * there isn't one defined
			// * the type isn't "any"
			// * as a trailing element in the path
			if !fieldPath[i].Type.IsAny() || fieldPath[i].TypeHint == nil || i == len(fieldPath)-1 {
				path += output
				if !last && fieldPath[i+1].Index == nil {
					path += "."
				}
				continue
			}

			path += output + fmt.Sprintf(".(*%s)", typeFormatter.doFormatType(*fieldPath[i].TypeHint, false))
			if !last && fieldPath[i+1].Index == nil {
				path += "."
			}
		}

		return path
	}
}

func formatPathForRange(typeFormatter *typeFormatter) func(path ast.Path) string {
	return func(fieldPath ast.Path) string {
		path := ""

		for i := range fieldPath {
			last := i == len(fieldPath)-1
			output := fieldPath[i].Identifier
			if !fieldPath[i].Root {
				output = formatFieldName(output)
			}

			// don't generate type hints if:
			// * there isn't one defined
			// * the type isn't "any"
			// * as a trailing element in the path
			if !fieldPath[i].Type.IsAny() || fieldPath[i].TypeHint == nil || i == len(fieldPath)-1 {
				path += output
				if !last && fieldPath[i+1].Index == nil {
					path += "."
				}
				continue
			}

			path += output + fmt.Sprintf(".(*%s)", typeFormatter.doFormatType(*fieldPath[i].TypeHint, false))
			if !last && fieldPath[i+1].Index == nil {
				path += "."
			}
		}

		return path
	}
}
