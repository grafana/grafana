package java

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

const fasterXMLPackageName = "com.fasterxml.jackson"
const javaNullableField = "@JsonInclude(JsonInclude.Include.NON_NULL)"
const javaDefaultEmptyField = "@JsonSetter(nulls = Nulls.AS_EMPTY)"
const javaEmptyField = "@JsonInclude(JsonInclude.Include.NON_EMPTY)"

type typeFormatter struct {
	config        Config
	packageMapper func(pkg string, class string) string
	context       languages.Context
}

func createFormatter(ctx languages.Context, config Config) *typeFormatter {
	return &typeFormatter{context: ctx, config: config}
}

func (tf *typeFormatter) withPackageMapper(packageMapper func(pkg string, class string) string) *typeFormatter {
	tf.packageMapper = packageMapper
	return tf
}

func (tf *typeFormatter) formatFieldType(def ast.Type) string {
	switch def.Kind {
	case ast.KindScalar:
		return formatScalarType(def.AsScalar())
	case ast.KindRef:
		return tf.formatReference(def.AsRef())
	case ast.KindArray:
		return tf.formatArray(def.AsArray())
	case ast.KindComposableSlot:
		return tf.formatComposable(def.AsComposableSlot())
	case ast.KindMap:
		return tf.formatMap(def.AsMap())
	case ast.KindStruct:
		// TODO: Manage anonymous structs
		return "Object"
	case ast.KindConstantRef:
		return tf.formatConstantReference(def.AsConstantRef())
	}

	return "unknown"
}

func (tf *typeFormatter) typeHasBuilder(def ast.Type) bool {
	return tf.context.ResolveToBuilder(def)
}

func (tf *typeFormatter) resolvesToComposableSlot(typeDef ast.Type) bool {
	_, found := tf.context.ResolveToComposableSlot(typeDef)
	return found
}

func (tf *typeFormatter) formatBuilderFieldType(def ast.Type) string {
	if tf.resolvesToComposableSlot(def) || tf.typeHasBuilder(def) {
		switch def.Kind {
		case ast.KindArray:
			return tf.formatArrayOrMapFields(def.AsArray().ValueType, "List", "List<")
		case ast.KindMap:
			return tf.formatArrayOrMapFields(def.AsMap().ValueType, "Map", "Map<String, ")
		default:
			return fmt.Sprintf("%s.Builder<%s>", tf.config.formatPackage("cog"), tf.formatFieldType(def))
		}
	}

	return tf.formatFieldType(def)
}

func (tf *typeFormatter) formatArrayOrMapFields(def ast.Type, importValue string, prefix string) string {
	tf.packageMapper("java.util", importValue)
	if def.Kind == ast.KindArray || def.Kind == ast.KindMap {
		return fmt.Sprintf("%s%s>", prefix, tf.formatBuilderFieldType(def))
	}

	return fmt.Sprintf("%s%s.Builder<%s>>", prefix, tf.config.formatPackage("cog"), tf.formatFieldType(def))
}

func (tf *typeFormatter) formatReference(def ast.RefType) string {
	object, _ := tf.context.LocateObjectByRef(def)
	switch object.Type.Kind {
	case ast.KindScalar:
		return formatScalarType(object.Type.AsScalar())
	case ast.KindMap:
		return tf.formatMap(object.Type.AsMap())
	case ast.KindArray:
		return tf.formatArray(object.Type.AsArray())
	default:
		tf.packageMapper(def.ReferredPkg, def.ReferredType)
		return formatObjectName(def.ReferredType)
	}
}

func (tf *typeFormatter) formatConstantReference(def ast.ConstantReferenceType) string {
	object, _ := tf.context.LocateObject(def.ReferredPkg, def.ReferredType)
	if object.Type.IsEnum() {
		return formatObjectName(def.ReferredType)
	}

	if object.Type.IsScalar() {
		return formatScalarType(object.Type.AsScalar())
	}

	return "unknown"
}

func (tf *typeFormatter) formatArray(def ast.ArrayType) string {
	tf.packageMapper("java.util", "List")
	return fmt.Sprintf("List<%s>", tf.formatFieldType(def.ValueType))
}

func (tf *typeFormatter) formatMap(def ast.MapType) string {
	tf.packageMapper("java.util", "Map")
	mapType := "unknown"
	switch def.ValueType.Kind {
	case ast.KindRef:
		mapType = tf.formatReference(def.ValueType.AsRef())
	case ast.KindScalar:
		mapType = formatScalarType(def.ValueType.AsScalar())
	case ast.KindMap:
		mapType = tf.formatMap(def.ValueType.AsMap())
	case ast.KindArray:
		mapType = tf.formatArray(def.ValueType.AsArray())
	case ast.KindConstantRef:
		mapType = tf.formatConstantReference(def.ValueType.AsConstantRef())
	}

	return fmt.Sprintf("Map<String, %s>", mapType)
}

func (tf *typeFormatter) formatComposable(def ast.ComposableSlotType) string {
	variant := tools.UpperCamelCase(string(def.Variant))
	tf.packageMapper("cog.variants", variant)
	return variant
}

func formatScalarType(def ast.ScalarType) string {
	scalarType := "unknown"

	switch def.ScalarKind {
	case ast.KindString:
		scalarType = "String"
	case ast.KindBytes:
		scalarType = "Byte"
	case ast.KindInt16, ast.KindUint16:
		scalarType = "Short"
	case ast.KindInt8, ast.KindUint8, ast.KindInt32, ast.KindUint32:
		scalarType = "Integer"
	case ast.KindInt64, ast.KindUint64:
		scalarType = "Long"
	case ast.KindFloat32:
		scalarType = "Float"
	case ast.KindFloat64:
		scalarType = "Double"
	case ast.KindBool:
		scalarType = "Boolean"
	case ast.KindAny:
		scalarType = "Object"
	}

	return scalarType
}

func (tf *typeFormatter) emptyValueForType(def ast.Type, useBuilders bool) string {
	switch def.Kind {
	case ast.KindArray:
		tf.packageMapper("java.util", "LinkedList")
		return "new LinkedList<>()"
	case ast.KindMap:
		tf.packageMapper("java.util", "HashMap")
		return "new HashMap<>()"
	case ast.KindRef:
		refDef := fmt.Sprintf("%s.%s", formatPackageName(def.AsRef().ReferredPkg), formatObjectName(def.AsRef().ReferredType))
		if useBuilders && tf.typeHasBuilder(def) {
			return fmt.Sprintf("new %sBuilder().build()", tf.config.formatPackage(refDef))
		}

		referredObj, found := tf.context.LocateObjectByRef(def.AsRef())
		if found && referredObj.Type.IsEnum() {
			defaultMember := referredObj.Type.AsEnum().Values[0]

			return fmt.Sprintf("%s.%s", referredObj.Name, tools.UpperSnakeCase(defaultMember.Name))
		}

		return fmt.Sprintf("new %s()", tf.config.formatPackage(refDef))
	case ast.KindStruct:
		return "new Object()"
	case ast.KindScalar:
		switch def.AsScalar().ScalarKind {
		case ast.KindBool:
			return "false"
		case ast.KindFloat32:
			return "0.0f"
		case ast.KindFloat64:
			return "0.0"
		case ast.KindInt8, ast.KindUint8, ast.KindInt16, ast.KindUint16, ast.KindInt32, ast.KindUint32:
			return "0"
		case ast.KindInt64, ast.KindUint64:
			return "0L"
		case ast.KindString:
			return `""`
		case ast.KindBytes:
			return "(byte) 0"
		case ast.KindAny:
			return "new Object()"
		default:
			return "unknown"
		}
	default:
		return "unknown"
	}
}

func (tf *typeFormatter) formatFieldPath(fieldPath ast.Path) string {
	parts := make([]string, 0)
	for i, part := range fieldPath {
		output := tools.LowerCamelCase(part.Identifier)

		if i > 0 && fieldPath[i-1].Type.IsAny() {
			return output
		}

		parts = append(parts, output)
	}

	return strings.Join(parts, ".")
}

func (tf *typeFormatter) formatPathIndex(pathIndex *ast.PathIndex) string {
	if pathIndex.Constant != nil {
		return fmt.Sprintf("%#v", pathIndex.Constant)
	}

	return formatArgName(pathIndex.Argument.Name)
}

// formatAssignmentPath generates the pad to assign the value. When the value is a generic one (Object) like Custom or FieldConfig
// we should return until this pad to set the object to it.
func (tf *typeFormatter) formatAssignmentPath(resourceRoot string, fieldPath ast.Path) string {
	path := resourceRoot

	for i := range fieldPath {
		output := fieldPath[i].Identifier
		if !fieldPath[i].Root {
			output = formatFieldName(output)
		}

		if fieldPath[i].Index != nil {
			path += output + "[" + tf.formatPathIndex(fieldPath[i].Index) + "]"
			continue
		}

		// don't generate type hints if:
		// * there isn't one defined
		// * the type isn't "any"
		// * as a trailing element in the path
		if !fieldPath[i].Type.IsAny() || fieldPath[i].TypeHint == nil || i == len(fieldPath)-1 {
			path += "." + output
			continue
		}

		path = fmt.Sprintf("((%s) %s.%s)", tf.formatReference(fieldPath[i].TypeHint.AsRef()), path, output)
	}

	return path
}

func (tf *typeFormatter) formatRefType(destinationType ast.Type, value any) string {
	if !destinationType.IsRef() {
		return fmt.Sprintf("%#v", value)
	}

	referredObj, found := tf.context.LocateObjectByRef(destinationType.AsRef())
	if !found {
		return fmt.Sprintf("%#v", value)
	}

	if referredObj.Type.IsEnum() {
		return tf.formatEnumValue(referredObj, value)
	}

	if referredObj.Type.IsStructGeneratedFromDisjunction() {
		return tf.formatDisjunctionValue(referredObj, value)
	}

	return fmt.Sprintf("%#v", value)
}

func (tf *typeFormatter) formatDisjunctionValue(object ast.Object, value any) string {
	var field ast.StructField
	for _, candidate := range object.Type.Struct.Fields {
		if candidate.Type.AcceptsValue(value) {
			field = candidate
			break
		}
	}

	if field.Name == "" {
		return fmt.Sprintf("%#v", value)
	}

	tf.packageMapper(object.SelfRef.ReferredPkg, object.SelfRef.ReferredType)
	return fmt.Sprintf("%s.create%s(%#v)", object.SelfRef.ReferredType, tools.UpperCamelCase(field.Name), value)
}

func (tf *typeFormatter) formatEnumValue(obj ast.Object, val any) string {
	member, _ := obj.Type.AsEnum().MemberForValue(val)

	return fmt.Sprintf("%s.%s", obj.Name, tools.UpperSnakeCase(member.Name))
}

func (tf *typeFormatter) objectNeedsCustomSerializer(obj ast.Object) bool {
	if !tf.config.GenerateBuilders || tf.config.SkipRuntime {
		return false
	}
	if obj.Type.HasHint(ast.HintDisjunctionOfScalars) {
		tf.packageMapper(fasterXMLPackageName, "databind.annotation.JsonSerialize")
		return true
	}

	return false
}

func (tf *typeFormatter) objectNeedsCustomDeserializer(obj ast.Object, tmpl *template.Template) bool {
	if !tf.config.GenerateBuilders || tf.config.SkipRuntime {
		return false
	}
	if objectNeedsCustomDeserializer(tf.context, obj, tmpl) {
		tf.packageMapper(fasterXMLPackageName, "databind.annotation.JsonDeserialize")
		return true
	}

	return false
}

func (tf *typeFormatter) fillNullableAnnotationPattern(t ast.Type) string {
	if t.Nullable {
		tf.packageMapper(fasterXMLPackageName, "annotation.JsonInclude")
		return javaNullableField
	}

	if t.IsArray() || t.IsMap() {
		tf.packageMapper(fasterXMLPackageName, "annotation.JsonSetter")
		tf.packageMapper(fasterXMLPackageName, "annotation.Nulls")
		return javaDefaultEmptyField
	}

	if t.IsAny() || t.IsStruct() || t.IsRef() {
		tf.packageMapper(fasterXMLPackageName, "annotation.JsonInclude")
		return javaEmptyField
	}

	return ""
}

func (tf *typeFormatter) formatGuardPath(fieldPath ast.Path) string {
	parts := make([]string, 0)
	var castedPath string

	for i := range fieldPath {
		output := fieldPath[i].Identifier
		if !fieldPath[i].Root {
			output = escapeVarName(tools.LowerCamelCase(output))
		}

		// don't generate type hints if:
		// * there isn't one defined
		// * the type isn't "any"
		// * as a trailing element in the path
		if !fieldPath[i].Type.IsAny() || fieldPath[i].TypeHint == nil || i == len(fieldPath)-1 {
			parts = append(parts, output)
			continue
		}

		castedPath = fmt.Sprintf("((%s) %s.%s).", tf.formatFieldType(*fieldPath[i].TypeHint), strings.Join(parts, "."), output)
		parts = nil
	}

	return castedPath + strings.Join(parts, ".")
}

func (tf *typeFormatter) constantRefValue(def ast.ConstantReferenceType) string {
	obj, ok := tf.context.LocateObject(def.ReferredPkg, def.ReferredType)
	if !ok {
		return "unknown"
	}

	refPkg := tf.packageMapper(def.ReferredPkg, def.ReferredType)

	if obj.Type.IsScalar() {
		if refPkg != "" {
			return fmt.Sprintf("%s.%s", refPkg, def.ReferredType)
		}

		return fmt.Sprintf("Constants.%s", def.ReferredType)
	}

	if obj.Type.IsEnum() {
		enumVale, ok := obj.Type.AsEnum().MemberForValue(def.ReferenceValue)
		if !ok {
			return "unknown"
		}

		if refPkg != "" {
			return fmt.Sprintf("%s.%s.%s", refPkg, def.ReferredType, enumVale.Name)
		}

		return fmt.Sprintf("%s.%s", def.ReferredType, tools.UpperSnakeCase(enumVale.Name))
	}

	return "unknown"
}

func formatEnum(pkg string, object ast.Object, tmpl *template.Template) ([]byte, error) {
	enum := object.Type.AsEnum()
	values := make([]EnumValue, 0)
	for _, value := range enum.Values {
		if value.Name == "" {
			value.Name = "None"
		}
		values = append(values, EnumValue{
			Name:  tools.UpperSnakeCase(value.Name),
			Value: value.Value,
		})
	}

	enumType := "Integer"
	if enum.Values[0].Type.AsScalar().ScalarKind == ast.KindString {
		enumType = "String"
	}

	// Adds empty value if it doesn't exist to avoid
	// to break in deserialization.
	if enumType == "String" {
		hasEmptyValue := false
		for _, value := range values {
			if value.Value == "" {
				hasEmptyValue = true
			}
		}

		if !hasEmptyValue {
			values = append(values, EnumValue{
				Name:  "_EMPTY",
				Value: "",
			})
		}
	}

	return tmpl.RenderAsBytes("types/enum.tmpl", EnumTemplate{
		Package:  pkg,
		Name:     object.Name,
		Values:   values,
		Type:     enumType,
		Comments: object.Comments,
	})
}
