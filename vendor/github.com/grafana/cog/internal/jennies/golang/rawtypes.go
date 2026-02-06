package golang

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

type RawTypes struct {
	config          Config
	tmpl            *template.Template
	apiRefCollector *common.APIReferenceCollector

	typeFormatter *typeFormatter
	packageMapper func(pkg string) string
}

func (jenny RawTypes) JennyName() string {
	return "GoRawTypes"
}

func (jenny RawTypes) Generate(context languages.Context) (codejen.Files, error) {
	files := make(codejen.Files, 0, len(context.Schemas))

	jenny.tmpl = jenny.tmpl.
		Funcs(common.TypeResolvingTemplateHelpers(context)).
		Funcs(common.TypesTemplateHelpers(context))

	for _, schema := range context.Schemas {
		output, err := jenny.generateSchema(context, schema)
		if err != nil {
			return nil, err
		}

		filename := filepath.Join(
			formatPackageName(schema.Package),
			"types_gen.go",
		)

		files = append(files, *codejen.NewFile(filename, output, jenny))
	}

	return files, nil
}

func (jenny RawTypes) generateSchema(context languages.Context, schema *ast.Schema) ([]byte, error) {
	var buffer strings.Builder
	var err error

	imports := NewImportMap(jenny.config.PackageRoot)
	jenny.packageMapper = func(pkg string) string {
		if imports.IsIdentical(pkg, schema.Package) {
			return ""
		}

		return imports.Add(pkg, jenny.config.importPath(pkg))
	}
	jenny.typeFormatter = defaultTypeFormatter(jenny.config, context, imports, jenny.packageMapper)
	unmarshallerGenerator := newJSONMarshalling(jenny.config, jenny.tmpl, imports, jenny.packageMapper, jenny.typeFormatter, jenny.apiRefCollector)
	strictUnmarshallerGenerator := newStrictJSONUnmarshal(jenny.config, jenny.tmpl, imports, jenny.packageMapper, jenny.typeFormatter, jenny.apiRefCollector)
	equalityMethodsGenerator := newEqualityMethods(jenny.tmpl, jenny.apiRefCollector)
	validationMethodsGenerator := newValidationMethods(jenny.tmpl, jenny.packageMapper, jenny.apiRefCollector)

	schema.Objects.Iterate(func(_ string, object ast.Object) {
		innerErr := jenny.formatObject(&buffer, schema, object)
		if innerErr != nil {
			err = innerErr
			return
		}

		buffer.WriteString("\n")

		jenny.generateConstructor(&buffer, context, object)

		innerErr = unmarshallerGenerator.generateForObject(&buffer, context, object)
		if innerErr != nil {
			err = innerErr
			return
		}

		if !jenny.config.SkipRuntime {
			innerErr = strictUnmarshallerGenerator.generateForObject(&buffer, context, object)
			if innerErr != nil {
				err = innerErr
				return
			}
		}

		if jenny.config.GenerateEqual {
			innerErr = equalityMethodsGenerator.generateForObject(&buffer, context, object, imports)
			if innerErr != nil {
				err = innerErr
				return
			}
		}

		if !jenny.config.SkipRuntime && (jenny.config.generateBuilders || jenny.config.GenerateValidate) {
			innerErr = validationMethodsGenerator.generateForObject(&buffer, context, object, imports)
			if innerErr != nil {
				err = innerErr
				return
			}
		}

		customMethodsBlock := template.CustomObjectMethodsBlock(object)
		if jenny.tmpl.Exists(customMethodsBlock) {
			innerErr = jenny.tmpl.RenderInBuffer(&buffer, customMethodsBlock, map[string]any{
				"Object": object,
			})
			if innerErr != nil {
				err = innerErr
				return
			}
			buffer.WriteString("\n")
		}
	})
	if err != nil {
		return nil, err
	}

	customSchemaVariant := template.CustomSchemaVariantBlock(schema)
	if jenny.tmpl.Exists(customSchemaVariant) {
		if err := jenny.tmpl.RenderInBuffer(&buffer, customSchemaVariant, map[string]any{
			"Schema": schema,
			"Config": jenny.config,
		}); err != nil {
			return nil, err
		}
	}

	importStatements := imports.String()
	if importStatements != "" {
		importStatements += "\n\n"
	}

	return []byte(fmt.Sprintf(`package %[1]s

%[2]s%[3]s`, formatPackageName(schema.Package), importStatements, buffer.String())), nil
}

func (jenny RawTypes) formatObject(buffer *strings.Builder, schema *ast.Schema, object ast.Object) error {
	objectName := formatObjectName(object.Name)

	comments := object.Comments
	if jenny.config.debug {
		passesTrail := tools.Map(object.PassesTrail, func(trail string) string {
			return fmt.Sprintf("Modified by compiler pass '%s'", trail)
		})
		comments = append(comments, passesTrail...)
	}

	for _, commentLine := range comments {
		buffer.WriteString(fmt.Sprintf("// %s\n", commentLine))
	}

	buffer.WriteString(jenny.typeFormatter.formatTypeDeclaration(object))
	buffer.WriteString("\n")

	if object.Type.ImplementsVariant() && !object.Type.IsRef() {
		variant := tools.UpperCamelCase(object.Type.ImplementedVariant())

		buffer.WriteString(fmt.Sprintf("func (resource %s) Implements%sVariant() {}\n", objectName, variant))
		buffer.WriteString("\n")

		customVariantTmpl := template.CustomObjectVariantBlock(object)
		if jenny.tmpl.Exists(customVariantTmpl) {
			if err := jenny.tmpl.RenderInBuffer(buffer, customVariantTmpl, map[string]any{
				"Object": object,
				"Schema": schema,
			}); err != nil {
				return err
			}
		}
	}

	return nil
}

func (jenny RawTypes) generateConstructor(buffer *strings.Builder, context languages.Context, object ast.Object) {
	objectName := formatObjectName(object.Name)
	constructorName := "New" + formatFunctionName(object.Name)

	declareConstructor := func() {
		jenny.apiRefCollector.RegisterFunction(object.SelfRef.ReferredPkg, common.FunctionReference{
			Name: constructorName,
			Comments: []string{
				fmt.Sprintf("%[1]s creates a new %[2]s object.", constructorName, objectName),
			},
			Return: "*" + objectName,
		})
	}

	if object.Type.IsRef() {
		referredObj, found := context.LocateObjectByRef(*object.Type.Ref)
		if !found || !referredObj.Type.IsStruct() {
			return
		}

		declareConstructor()
		buffer.WriteString(fmt.Sprintf("// %[1]s creates a new %[2]s object.\n", constructorName, objectName))
		buffer.WriteString(fmt.Sprintf("func %[1]s() *%[2]s {\n", constructorName, objectName))

		delegatedConstructorName := fmt.Sprintf("New%s", formatObjectName(referredObj.Name))
		referredPkg := jenny.packageMapper(referredObj.SelfRef.ReferredPkg)
		if referredPkg != "" {
			delegatedConstructorName = fmt.Sprintf("%s.%s", referredPkg, delegatedConstructorName)
		}

		buffer.WriteString(fmt.Sprintf("\treturn %s()", delegatedConstructorName))
		buffer.WriteString("\n}\n")
		return
	}

	if !object.Type.IsStruct() {
		return
	}

	declareConstructor()
	buffer.WriteString(fmt.Sprintf("// %[1]s creates a new %[2]s object.\n", constructorName, objectName))
	buffer.WriteString(fmt.Sprintf("func %[1]s() *%[2]s {\n", constructorName, objectName))
	buffer.WriteString(fmt.Sprintf("\treturn &%s", jenny.defaultsForStruct(context, object.SelfRef, object.Type, nil)))
	buffer.WriteString("\n}\n")
}

func (jenny RawTypes) defaultsForStruct(context languages.Context, objectRef ast.RefType, objectType ast.Type, maybeExtraDefaults any) string {
	var buffer strings.Builder

	objectName := formatObjectName(objectRef.ReferredType)
	referredPkg := jenny.packageMapper(objectRef.ReferredPkg)
	if referredPkg != "" {
		objectName = referredPkg + "." + objectName
	}

	buffer.WriteString(objectName + "{\n")

	extraDefaults := map[string]any{}
	if val, ok := maybeExtraDefaults.(map[string]any); ok {
		extraDefaults = val
	}

	for _, field := range objectType.Struct.Fields {
		resolvedFieldType := context.ResolveRefs(field.Type)

		needsExplicitDefault := field.Type.Default != nil ||
			extraDefaults[field.Name] != nil ||
			(field.Required && field.Type.IsRef() && resolvedFieldType.IsStruct()) ||
			(field.Required && field.Type.IsArray()) ||
			(field.Required && field.Type.IsMap()) ||
			field.Type.IsConcreteScalar() ||
			field.Type.IsConstantRef()
		if !needsExplicitDefault {
			continue
		}

		fieldName := formatFieldName(field.Name)
		defaultValue := ""

		// nolint:gocritic
		if extraDefault, ok := extraDefaults[field.Name]; ok {
			defaultValue = formatScalar(extraDefault)

			if field.Type.IsRef() && resolvedFieldType.IsStructGeneratedFromDisjunction() {
				disjunctionBranchName := formatFieldName(anyToDisjunctionBranchName(extraDefault))
				disjunctionBranch, found := resolvedFieldType.Struct.FieldByName(disjunctionBranchName)
				if !found {
					disjunctionBranchName = "Any"
					disjunctionBranch, _ = resolvedFieldType.Struct.FieldByName(disjunctionBranchName)
				}

				actualDefault := jenny.maybeValueAsPointer(defaultValue, true, disjunctionBranch.Type)

				nonNullableRefType := field.Type.DeepCopy()
				nonNullableRefType.Nullable = false

				defaultValue = jenny.typeFormatter.formatRef(nonNullableRefType, false) + "{\n"
				defaultValue += fmt.Sprintf("\t%s: %s,\n", formatFieldName(disjunctionBranchName), actualDefault)
				defaultValue += "}"

				if field.Type.Nullable {
					defaultValue = "&" + defaultValue
				}
			} else {
				defaultValue = jenny.maybeValueAsPointer(defaultValue, field.Type.Nullable, resolvedFieldType)
			}
		} else if field.Type.IsConcreteScalar() {
			defaultValue = formatScalar(field.Type.Scalar.Value)

			defaultValue = jenny.maybeValueAsPointer(defaultValue, field.Type.Nullable, resolvedFieldType)
		} else if resolvedFieldType.IsAnyOf(ast.KindScalar, ast.KindMap, ast.KindArray) && field.Type.Default != nil {
			defaultValue = formatScalar(field.Type.Default)

			defaultValue = jenny.maybeValueAsPointer(defaultValue, field.Type.Nullable, resolvedFieldType)
		} else if field.Type.IsRef() && resolvedFieldType.IsStruct() && field.Type.Default != nil {
			defaultValue = jenny.defaultsForStruct(context, *field.Type.Ref, resolvedFieldType, field.Type.Default)
			if field.Type.Nullable {
				defaultValue = "&" + defaultValue
			}
		} else if field.Type.IsRef() && resolvedFieldType.IsStruct() {
			defaultValue = "New" + formatObjectName(field.Type.Ref.ReferredType) + "()"

			referredPkg = jenny.packageMapper(field.Type.Ref.ReferredPkg)
			if referredPkg != "" {
				defaultValue = referredPkg + "." + defaultValue
			}

			if !field.Type.Nullable {
				defaultValue = "*" + defaultValue
			}
		} else if field.Type.IsRef() && resolvedFieldType.IsEnum() {
			memberName := resolvedFieldType.Enum.Values[0].Name
			for _, member := range resolvedFieldType.Enum.Values {
				if member.Value == field.Type.Default {
					memberName = member.Name
					break
				}
			}

			defaultValue = memberName

			referredPkg = jenny.packageMapper(field.Type.Ref.ReferredPkg)
			if referredPkg != "" {
				defaultValue = referredPkg + "." + defaultValue
			}

			defaultValue = jenny.maybeValueAsPointer(defaultValue, field.Type.Nullable, field.Type)
		} else if field.Type.IsConstantRef() {
			constRef := field.Type.AsConstantRef()
			t := context.ResolveRefs(ast.NewRef(constRef.ReferredPkg, constRef.ReferredType))

			if !t.IsEnum() && !t.IsScalar() {
				break
			}

			if t.IsScalar() && t.AsScalar().ScalarKind == ast.KindString {
				defaultValue = constRef.ReferredType
			}

			if t.IsEnum() {
				for _, member := range t.AsEnum().Values {
					if member.Value == constRef.ReferenceValue {
						defaultValue = member.Name
						break
					}
				}
			}

			referredPkg = jenny.packageMapper(constRef.ReferredPkg)
			if referredPkg != "" {
				defaultValue = referredPkg + "." + defaultValue
			}

			defaultValue = jenny.maybeValueAsPointer(defaultValue, field.Type.Nullable, field.Type)
		} else if field.Type.IsArray() {
			defaultValue = "[]" + jenny.typeFormatter.formatType(field.Type.Array.ValueType) + "{}"
		} else if field.Type.IsMap() {
			defaultValue = "map[" + jenny.typeFormatter.formatType(field.Type.Map.IndexType) + "]" + jenny.typeFormatter.formatType(field.Type.Map.ValueType) + "{}"
		} else {
			defaultValue = "\"unsupported default value case: this is likely a bug in cog\""
		}

		buffer.WriteString(fmt.Sprintf("\t\t%s: %s,\n", fieldName, defaultValue))
	}

	buffer.WriteString("}")

	return buffer.String()
}

func (jenny RawTypes) maybeValueAsPointer(value string, nullable bool, typeDef ast.Type) string {
	if !nullable {
		return value
	}

	if typeDef.IsAnyOf(ast.KindArray, ast.KindMap) {
		return value
	}

	if typeDef.IsScalar() && typeDef.AsScalar().ScalarKind == ast.KindBytes {
		return value
	}

	nonNullableField := typeDef.DeepCopy()
	nonNullableField.Nullable = false
	typeHint := jenny.typeFormatter.formatType(nonNullableField)

	// we don't use cog.ToPtr() to avoid a dependency on cog's runtime
	return fmt.Sprintf("(func (input %[1]s) *%[1]s { return &input })(%[2]s)", typeHint, value)
}
