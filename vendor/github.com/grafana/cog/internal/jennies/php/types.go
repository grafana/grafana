package php

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

type typeFormatter struct {
	config Config

	forBuilder bool
	context    languages.Context
}

func defaultTypeFormatter(config Config, context languages.Context) *typeFormatter {
	return &typeFormatter{
		config:  config,
		context: context,
	}
}

func builderTypeFormatter(config Config, context languages.Context) *typeFormatter {
	return &typeFormatter{
		config:     config,
		context:    context,
		forBuilder: true,
	}
}
func (formatter *typeFormatter) formatTypeDeclaration(tmpl *template.Template, context languages.Context, def ast.Object) string {
	var buffer strings.Builder

	defName := formatObjectName(def.Name)

	switch def.Type.Kind {
	case ast.KindEnum:
		enum, err := formatter.formatEnumDeclaration(tmpl, context, def)
		if err != nil {
			panic(err)
		}

		buffer.WriteString(enum)
	case ast.KindRef:
		buffer.WriteString(fmt.Sprintf("class %s extends %s {}", defName, formatter.formatType(def.Type)))
	case ast.KindStruct:
		variant := ""
		if def.Type.ImplementsVariant() {
			variant = ", " + formatter.config.fullNamespaceRef("Cog\\"+formatObjectName(def.Type.ImplementedVariant()))
		}

		buffer.WriteString(fmt.Sprintf("class %s implements \\JsonSerializable%s\n{\n", formatObjectName(def.Name), variant))

		for _, fieldDef := range def.Type.Struct.Fields {
			buffer.WriteString(tools.Indent(formatter.formatField(fieldDef), 4))
			buffer.WriteString("\n\n")
		}

		buffer.WriteString("}")
	default:
		return fmt.Sprintf("unhandled type def kind: %s", def.Type.Kind)
	}

	return buffer.String()
}

func (formatter *typeFormatter) formatEnumDeclaration(tmpl *template.Template, context languages.Context, def ast.Object) (string, error) {
	return tmpl.
		Funcs(templateHelpers(templateDeps{
			config:  formatter.config,
			context: context,
		})).
		Render("types/enum.tmpl", map[string]any{
			"Object":   def,
			"EnumType": def.Type.Enum.Values[0].Type,
		})
}

func (formatter *typeFormatter) formatType(def ast.Type) string {
	return formatter.doFormatType(def, formatter.forBuilder)
}

func (formatter *typeFormatter) doFormatType(def ast.Type, resolveBuilders bool) string {
	actualFormatter := func() string {
		if def.IsAny() {
			return ""
		}

		if def.IsComposableSlot() {
			formatted := formatter.variantInterface(string(def.AsComposableSlot().Variant))

			if !resolveBuilders {
				return formatted
			}

			return formatter.config.fullNamespaceRef("Cog\\Builder")
		}

		if def.IsArray() || def.IsMap() {
			return "array"
		}

		if def.IsScalar() {
			return formatter.formatScalar(def)
		}

		if def.IsRef() {
			return formatter.formatRef(def, resolveBuilders)
		}

		if def.IsDisjunction() {
			return ""
		}

		if def.IsConstantRef() {
			return formatter.formatConstantReference(def)
		}

		// FIXME: we should never be here
		return "unknown"
	}

	passesTrail := ""
	if formatter.config.debug && len(def.PassesTrail) != 0 {
		passesTrail = fmt.Sprintf(" /* %s */", strings.Join(def.PassesTrail, ", "))
	}

	formatted := actualFormatter()
	if def.Nullable && formatted != "" {
		formatted = "?" + formatted
	}

	return formatted + passesTrail
}

func (formatter *typeFormatter) variantInterface(variant string) string {
	return formatter.config.fullNamespaceRef("Cog\\" + formatObjectName(variant))
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

	buffer.WriteString(formatCommentsBlock(comments))

	fieldType := def.Type

	// if the field's type is a reference to a constant,
	// we need to use the constant's type instead.
	// ie: `SomeField string` instead of `SomeField MyStringConstant`
	if def.Type.IsRef() {
		referredType, found := formatter.context.LocateObject(def.Type.AsRef().ReferredPkg, def.Type.AsRef().ReferredType)
		if found && referredType.Type.IsConcreteScalar() {
			fieldType = referredType.Type
		}
	}

	formattedType := formatter.doFormatType(fieldType, false)
	if formattedType != "" {
		formattedType = " " + formattedType
	}

	buffer.WriteString(fmt.Sprintf(
		"public%s $%s;",
		formattedType,
		formatFieldName(def.Name),
	))

	return buffer.String()
}

func (formatter *typeFormatter) formatEnumValue(enumObj ast.Object, val any) string {
	referredPkg := formatPackageName(enumObj.SelfRef.ReferredPkg)
	member, _ := enumObj.Type.Enum.MemberForValue(val)

	return fmt.Sprintf(formatter.config.fullNamespaceRef(referredPkg+"\\"+enumObj.Name)+"::%s()", formatEnumMemberName(member.Name))
}

func (formatter *typeFormatter) formatScalar(def ast.Type) string {
	scalarKind := def.AsScalar().ScalarKind
	/*
		if def.HasHint(ast.HintStringFormatDateTime) {
			scalarKind = "time.Time" // TODO
		}
	*/

	switch scalarKind {
	case ast.KindNull:
		return "null"
	case ast.KindAny:
		return ""

	case ast.KindBytes:
		return "string"
	case ast.KindString:
		return "string"

	case ast.KindFloat32, ast.KindFloat64:
		return "float"
	case ast.KindUint8, ast.KindUint16, ast.KindUint32, ast.KindUint64:
		return "int"
	case ast.KindInt8, ast.KindInt16, ast.KindInt32, ast.KindInt64:
		return "int"

	case ast.KindBool:
		return "bool"
	default:
		return string(scalarKind)
	}
}

func (formatter *typeFormatter) formatRef(def ast.Type, resolveBuilders bool) string {
	referredPkg := formatPackageName(def.AsRef().ReferredPkg)
	typeName := formatter.config.fullNamespaceRef(referredPkg + "\\" + formatObjectName(def.AsRef().ReferredType))

	if resolveBuilders && formatter.context.ResolveToBuilder(def) {
		return formatter.config.fullNamespaceRef("Cog\\Builder")
	}

	return typeName
}

func (formatter *typeFormatter) formatConstantReference(def ast.Type) string {
	ref := def.AsConstantRef()
	referredPkg := formatPackageName(ref.ReferredPkg)

	obj, ok := formatter.context.LocateObject(ref.ReferredPkg, ref.ReferredType)
	if !ok {
		return "unknown"
	}

	if obj.Type.IsEnum() {
		return formatter.config.fullNamespaceRef(referredPkg + "\\" + formatObjectName(ref.ReferredType))
	}

	if obj.Type.IsScalar() {
		return formatter.formatScalar(obj.Type)
	}

	return "unknown"
}

func (formatter *typeFormatter) constantRefValue(def ast.ConstantReferenceType) string {
	obj, ok := formatter.context.LocateObject(def.ReferredPkg, def.ReferredType)
	if !ok {
		return "unknown"
	}

	if obj.Type.IsEnum() {
		return formatter.formatEnumValue(obj, def)
	}
	if obj.Type.IsScalar() {
		return formatter.config.fullNamespaceRef(formatPackageName(def.ReferredPkg) + "\\Constants::" + formatConstantName(def.ReferredType))
	}

	return "unknown"
}
