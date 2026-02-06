package typescript

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

type enumFormatter interface {
	formatDeclaration(def ast.Object) string
	formatValue(enumObj ast.Object, val any) string
}

type packageMapper func(pkg string) string

type typeFormatter struct {
	packageMapper func(pkg string) string
	enums         enumFormatter
	forBuilder    bool
	context       languages.Context
}

func defaultTypeFormatter(config Config, context languages.Context, packageMapper packageMapper) *typeFormatter {
	return &typeFormatter{
		packageMapper: packageMapper,
		context:       context,
		enums:         config.enumFormatter(packageMapper),
	}
}

func builderTypeFormatter(config Config, context languages.Context, packageMapper packageMapper) *typeFormatter {
	return &typeFormatter{
		packageMapper: packageMapper,
		forBuilder:    true,
		context:       context,
		enums:         config.enumFormatter(packageMapper),
	}
}

func (formatter *typeFormatter) variantInterface(variant string) string {
	referredPkg := formatter.packageMapper("cog")

	return fmt.Sprintf("%s.%s", referredPkg, tools.UpperCamelCase(variant))
}

func (formatter *typeFormatter) formatTypeDeclaration(def ast.Object) string {
	var buffer strings.Builder

	buffer.WriteString("export ")

	objectName := formatObjectName(def.Name)

	switch def.Type.Kind {
	case ast.KindStruct:
		buffer.WriteString(fmt.Sprintf("interface %s ", objectName))
		buffer.WriteString(formatter.formatStructFields(def.Type))
		buffer.WriteString("\n")
	case ast.KindEnum:
		buffer.WriteString(formatter.enums.formatDeclaration(def))
		buffer.WriteString("\n")
	case ast.KindDisjunction, ast.KindMap, ast.KindArray, ast.KindRef:
		buffer.WriteString(fmt.Sprintf("type %s = %s;\n", objectName, formatter.formatType(def.Type)))
	case ast.KindScalar:
		scalarType := def.Type.AsScalar()
		typeValue := formatValue(scalarType.Value)

		if !scalarType.IsConcrete() || def.Type.Hints["kind"] == "type" {
			if !scalarType.IsConcrete() {
				typeValue = formatter.formatScalarKind(scalarType.ScalarKind)
			}

			buffer.WriteString(fmt.Sprintf("type %s = %s;\n", objectName, typeValue))
		} else {
			buffer.WriteString(fmt.Sprintf("const %s = %s;\n", objectName, typeValue))
		}
	case ast.KindIntersection:
		buffer.WriteString(fmt.Sprintf("interface %s ", objectName))
		buffer.WriteString(formatter.formatType(def.Type))
		buffer.WriteString("\n")
	case ast.KindComposableSlot:
		buffer.WriteString(fmt.Sprintf("interface %s %s\n", objectName, formatter.variantInterface(string(def.Type.AsComposableSlot().Variant))))
	default:
		return fmt.Sprintf("unhandled object of type: %s", def.Type.Kind)
	}

	return buffer.String()
}

func (formatter *typeFormatter) formatType(def ast.Type) string {
	return formatter.doFormatType(def, formatter.forBuilder)
}

func (formatter *typeFormatter) doFormatType(def ast.Type, resolveBuilders bool) string {
	switch def.Kind {
	case ast.KindDisjunction:
		return formatter.formatDisjunction(def.AsDisjunction(), resolveBuilders)
	case ast.KindRef:
		formatted := tools.CleanupNames(def.AsRef().ReferredType)

		referredPkg := formatter.packageMapper(def.AsRef().ReferredPkg)
		if referredPkg != "" {
			formatted = referredPkg + "." + formatted
		}

		if resolveBuilders && formatter.context.ResolveToBuilder(def) {
			cogAlias := formatter.packageMapper("cog")

			return fmt.Sprintf("%s.Builder<%s>", cogAlias, formatted)
		}

		// if the field's type is a reference to a constant,
		// we need to use the constant's value instead.
		// ie: `SomeField: "foo"` instead of `SomeField: MyStringConstant`
		if def.IsRef() {
			referredType, found := formatter.context.LocateObject(def.AsRef().ReferredPkg, def.AsRef().ReferredType)
			if found && referredType.Type.IsConcreteScalar() {
				return formatter.doFormatType(referredType.Type, resolveBuilders)
			}
		}

		return formatted
	case ast.KindArray:
		return formatter.formatArray(def.AsArray(), resolveBuilders)
	case ast.KindStruct:
		return formatter.formatStructFields(def)
	case ast.KindMap:
		return formatter.formatMap(def.AsMap(), resolveBuilders)
	case ast.KindEnum:
		return formatter.formatAnonymousEnum(def.AsEnum())
	case ast.KindScalar:
		// This scalar actually refers to a constant
		if def.AsScalar().Value != nil {
			return formatValue(def.AsScalar().Value)
		}

		return formatter.formatScalarKind(def.AsScalar().ScalarKind)
	case ast.KindIntersection:
		return formatter.formatIntersection(def.AsIntersection())
	case ast.KindComposableSlot:
		formatted := formatter.variantInterface(string(def.AsComposableSlot().Variant))

		if !resolveBuilders {
			return formatted
		}

		cogAlias := formatter.packageMapper("cog")

		return fmt.Sprintf("%s.Builder<%s>", cogAlias, formatted)
	case ast.KindConstantRef:
		return formatter.formatConstantReferences(def.AsConstantRef())
	default:
		return string(def.Kind)
	}
}

func (formatter *typeFormatter) formatStructFields(structType ast.Type) string {
	var buffer strings.Builder

	buffer.WriteString("{\n")

	for _, fieldDef := range structType.AsStruct().Fields {
		fieldDefGen := formatter.formatField(fieldDef)

		buffer.WriteString(
			strings.TrimSuffix(
				prefixLinesWith(fieldDefGen, "\t"),
				"\t",
			),
		)
	}

	if structType.ImplementsVariant() {
		variant := tools.UpperCamelCase(structType.ImplementedVariant())
		buffer.WriteString(fmt.Sprintf("\t_implements%sVariant(): void;\n", variant))
	}

	buffer.WriteString("}")

	return buffer.String()
}

func (formatter *typeFormatter) formatField(def ast.StructField) string {
	var buffer strings.Builder

	for _, commentLine := range def.Comments {
		buffer.WriteString(fmt.Sprintf("// %s\n", commentLine))
	}

	required := ""
	if !def.Required {
		required = "?"
	}

	formattedType := formatter.doFormatType(def.Type, false)

	buffer.WriteString(fmt.Sprintf(
		"%s%s: %s;\n",
		def.Name,
		required,
		formattedType,
	))

	return buffer.String()
}

func (formatter *typeFormatter) formatScalarKind(kind ast.ScalarKind) string {
	switch kind {
	case ast.KindNull:
		return "null"
	case ast.KindAny:
		return "any"

	case ast.KindBytes, ast.KindString:
		return "string"

	case ast.KindFloat32, ast.KindFloat64:
		return "number"
	case ast.KindUint8, ast.KindUint16, ast.KindUint32, ast.KindUint64:
		return "number"
	case ast.KindInt8, ast.KindInt16, ast.KindInt32, ast.KindInt64:
		return "number"

	case ast.KindBool:
		return "boolean"
	default:
		return string(kind)
	}
}

func (formatter *typeFormatter) formatArray(def ast.ArrayType, resolveBuilders bool) string {
	subTypeString := formatter.doFormatType(def.ValueType, resolveBuilders)

	if def.ValueType.IsDisjunction() {
		return fmt.Sprintf("(%s)[]", subTypeString)
	}

	return fmt.Sprintf("%s[]", subTypeString)
}

func (formatter *typeFormatter) formatDisjunction(def ast.DisjunctionType, resolveBuilders bool) string {
	subTypes := make([]string, 0, len(def.Branches))
	for _, subType := range def.Branches {
		subTypes = append(subTypes, formatter.doFormatType(subType, resolveBuilders))
	}

	return strings.Join(subTypes, " | ")
}

func (formatter *typeFormatter) formatMap(def ast.MapType, resolveBuilders bool) string {
	keyTypeString := formatter.doFormatType(def.IndexType, resolveBuilders)
	valueTypeString := formatter.doFormatType(def.ValueType, resolveBuilders)

	return fmt.Sprintf("Record<%s, %s>", keyTypeString, valueTypeString)
}

func (formatter *typeFormatter) formatAnonymousEnum(def ast.EnumType) string {
	values := make([]string, 0, len(def.Values))
	for _, value := range def.Values {
		values = append(values, fmt.Sprintf("%#v", value.Value))
	}

	enumeration := strings.Join(values, " | ")

	return enumeration
}

func (formatter *typeFormatter) formatIntersection(def ast.IntersectionType) string {
	var buffer strings.Builder

	refs := make([]ast.Type, 0)
	rest := make([]ast.Type, 0)
	for _, b := range def.Branches {
		if b.Ref != nil {
			refs = append(refs, b)
			continue
		}
		rest = append(rest, b)
	}

	if len(refs) > 0 {
		buffer.WriteString("extends ")
	}

	for i, ref := range refs {
		if i != 0 && i < len(refs) {
			buffer.WriteString(", ")
		}

		buffer.WriteString(formatter.doFormatType(ref, false))
	}

	buffer.WriteString(" {\n")

	for _, r := range rest {
		if r.Struct != nil {
			for _, fieldDef := range r.AsStruct().Fields {
				buffer.WriteString("\t" + formatter.formatField(fieldDef))
			}
			continue
		}
		buffer.WriteString("\t" + formatter.doFormatType(r, false))
	}

	buffer.WriteString("}")

	return buffer.String()
}

func (formatter *typeFormatter) formatConstantReferences(def ast.ConstantReferenceType) string {
	referredType, found := formatter.context.LocateObject(def.ReferredPkg, def.ReferredType)
	if !found {
		return "unknown"
	}

	if referredType.Type.IsEnum() {
		return formatter.enums.formatValue(referredType, def.ReferenceValue)
	}
	if referredType.Type.IsScalar() {
		return formatValue(def.ReferenceValue)
	}

	return "unknown"
}

type enumAsTypeFormatter struct {
	packageMapper func(pkg string) string
}

func (formatter *enumAsTypeFormatter) formatDeclaration(def ast.Object) string {
	var buffer strings.Builder
	objectName := formatObjectName(def.Name)

	buffer.WriteString(fmt.Sprintf("enum %s {\n", objectName))
	for _, val := range def.Type.AsEnum().Values {
		buffer.WriteString(fmt.Sprintf("\t%s = %s,\n", formatEnumMemberName(val.Name), formatValue(val.Value)))
	}
	buffer.WriteString("}")

	return buffer.String()
}

func (formatter *enumAsTypeFormatter) formatValue(enumObj ast.Object, val any) string {
	referredPkg := formatter.packageMapper(enumObj.SelfRef.ReferredPkg)
	pkgPrefix := ""
	if referredPkg != "" {
		pkgPrefix = referredPkg + "."
	}

	member, _ := enumObj.Type.AsEnum().MemberForValue(val)

	return fmt.Sprintf("%s%s.%s", pkgPrefix, enumObj.Name, formatEnumMemberName(member.Name))
}

type enumAsDisjunctionFormatter struct {
}

func (formatter *enumAsDisjunctionFormatter) formatDeclaration(def ast.Object) string {
	values := tools.Map(def.Type.Enum.Values, func(value ast.EnumValue) string {
		return formatValue(value.Value)
	})

	return fmt.Sprintf("type %s = %s;", formatObjectName(def.Name), strings.Join(values, " | "))
}

func (formatter *enumAsDisjunctionFormatter) formatValue(enumObj ast.Object, val any) string {
	if val == nil {
		return formatValue(enumObj.Type.Enum.Values[0].Value)
	}

	return formatValue(val)
}
