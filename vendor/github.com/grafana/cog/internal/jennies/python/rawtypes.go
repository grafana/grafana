package python

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/orderedmap"
	"github.com/grafana/cog/internal/tools"
)

type RawTypes struct {
	config          Config
	tmpl            *template.Template
	typeFormatter   *typeFormatter
	importModule    moduleImporter
	importPkg       pkgImporter
	apiRefCollector *common.APIReferenceCollector
}

func (jenny RawTypes) JennyName() string {
	return "PythonRawTypes"
}

func (jenny RawTypes) Generate(context languages.Context) (codejen.Files, error) {
	files := make(codejen.Files, 0, len(context.Schemas))

	for _, schema := range context.Schemas {
		output, err := jenny.generateSchema(context, schema)
		if err != nil {
			return nil, err
		}

		filename := filepath.Join("models", schema.Package+".py")

		files = append(files, *codejen.NewFile(filename, output, jenny))
	}

	return files, nil
}

func (jenny RawTypes) generateSchema(context languages.Context, schema *ast.Schema) ([]byte, error) {
	var buffer strings.Builder
	var err error

	imports := NewImportMap()
	jenny.importModule = func(alias string, pkg string, module string) string {
		if module == schema.Package {
			return ""
		}

		return imports.AddModule(alias, pkg, module)
	}
	jenny.importPkg = func(alias string, pkg string) string {
		if strings.TrimPrefix(pkg, ".") == schema.Package {
			return ""
		}

		return imports.AddPackage(alias, pkg)
	}
	jenny.typeFormatter = defaultTypeFormatter(context, jenny.importPkg, jenny.importModule)

	jenny.tmpl = jenny.tmpl.
		Funcs(common.TypeResolvingTemplateHelpers(context)).
		Funcs(template.FuncMap{
			"importModule": jenny.importModule,
			"importPkg":    jenny.importPkg,
			"formatFullyQualifiedRef": func(typeDef ast.RefType) string {
				return jenny.typeFormatter.formatFullyQualifiedRef(typeDef, false)
			},
			"unmarshalForType": func(typeDef ast.Type, inputVar string, hint string) fromJSONCode {
				return jenny.fromJSONForType(context, typeDef, inputVar, hint)
			},
			"defaultForType": func(typeDef ast.Type) string {
				return formatValue(defaultValueForType(context.Schemas, typeDef, jenny.importModule, nil))
			},
		})

	i := 0
	schema.Objects.Iterate(func(_ string, object ast.Object) {
		objectOutput, innerErr := jenny.typeFormatter.formatObject(object)
		if innerErr != nil {
			err = innerErr
			return
		}
		buffer.WriteString(objectOutput)

		if object.Type.IsStruct() {
			buffer.WriteString("\n\n")
			buffer.WriteString(jenny.generateInitMethod(context.Schemas, object))

			if jenny.config.GenerateJSONMarshaller {
				buffer.WriteString("\n\n")
				buffer.WriteString(jenny.generateToJSONMethod(object))
			}

			if jenny.config.GenerateJSONMarshaller {
				buffer.WriteString("\n\n")
				fromJSON, innerErr := jenny.generateFromJSONMethod(context, object)
				if innerErr != nil {
					err = innerErr
					return
				}
				buffer.WriteString(fromJSON)
			}
		}

		customMethodsBlock := template.CustomObjectMethodsBlock(object)
		if jenny.tmpl.Exists(customMethodsBlock) {
			buffer.WriteString("\n\n")
			rendered, innerErr := jenny.tmpl.Render(customMethodsBlock, map[string]any{
				"Object": object,
			})
			if innerErr != nil {
				err = innerErr
				return
			}

			buffer.WriteString(tools.Indent(rendered, 4))
		}

		customVariantTmpl := template.CustomObjectVariantBlock(object)
		if object.Type.ImplementsVariant() && jenny.tmpl.Exists(customVariantTmpl) {
			buffer.WriteString("\n\n\n")
			if innerErr := jenny.tmpl.RenderInBuffer(&buffer, customVariantTmpl, map[string]any{
				"Object": object,
				"Schema": schema,
			}); innerErr != nil {
				err = innerErr
				return
			}
		}

		// we want two blank lines between objects, except at the end of the file
		if i != schema.Objects.Len()-1 {
			buffer.WriteString("\n\n\n")
		}
	})
	if err != nil {
		return nil, err
	}

	customSchemaVariant := template.CustomSchemaVariantBlock(schema)
	if schema.Metadata.Kind == ast.SchemaKindComposable && jenny.tmpl.Exists(customSchemaVariant) {
		buffer.WriteString("\n\n\n")

		if err := jenny.tmpl.RenderInBuffer(&buffer, customSchemaVariant, map[string]any{
			"Schema": schema,
		}); err != nil {
			return nil, err
		}
	}

	buffer.WriteString("\n")

	importStatements := imports.String()
	if importStatements != "" {
		importStatements += "\n\n\n"
	}

	return []byte(importStatements + buffer.String()), nil
}

func (jenny RawTypes) generateInitMethod(schemas ast.Schemas, object ast.Object) string {
	var buffer strings.Builder

	var args []string
	var assignments []string

	for _, field := range object.Type.AsStruct().Fields {
		fieldName := formatIdentifier(field.Name)
		fieldType := jenny.typeFormatter.formatType(field.Type)
		defaultValue := (any)(nil)

		if field.Type.IsConstantRef() {
			value := jenny.typeFormatter.formatConstantReference(field.Type.AsConstantRef(), true)
			assignments = append(assignments, fmt.Sprintf("        self.%s = %s", fieldName, value))
			continue
		}

		if !field.Type.Nullable || field.Type.Default != nil {
			var defaultsOverrides map[string]any
			if overrides, ok := field.Type.Default.(map[string]interface{}); ok {
				defaultsOverrides = overrides
			}

			defaultValue = defaultValueForType(schemas, field.Type, jenny.importModule, orderedmap.FromMap(defaultsOverrides))
		}

		if field.Type.IsConcreteScalar() {
			assignments = append(assignments, fmt.Sprintf("        self.%s = %s", fieldName, formatValue(field.Type.AsScalar().Value)))
			continue
		} else if field.Type.IsAnyOf(ast.KindStruct, ast.KindRef, ast.KindEnum, ast.KindMap, ast.KindArray, ast.KindDisjunction) {
			if !field.Type.Nullable {
				typingPkg := jenny.importPkg("typing", "typing")
				fieldType = fmt.Sprintf("%s.Optional[%s]", typingPkg, fieldType)
			}

			args = append(args, fmt.Sprintf("%s: %s = None", fieldName, fieldType))

			if defaultValue == nil {
				assignments = append(assignments, fmt.Sprintf("        self.%[1]s = %[1]s", fieldName))
			} else {
				assignments = append(assignments, fmt.Sprintf("        self.%[1]s = %[1]s if %[1]s is not None else %[2]s", fieldName, formatValue(defaultValue)))
			}
			continue
		}

		args = append(args, fmt.Sprintf("%s: %s = %s", fieldName, fieldType, formatValue(defaultValue)))
		assignments = append(assignments, fmt.Sprintf("        self.%[1]s = %[1]s", fieldName))
	}

	buffer.WriteString(fmt.Sprintf("    def __init__(self, %s):\n", strings.Join(args, ", ")))
	buffer.WriteString(strings.Join(assignments, "\n"))

	return strings.TrimSuffix(buffer.String(), "\n")
}

func (jenny RawTypes) generateToJSONMethod(object ast.Object) string {
	var buffer strings.Builder

	jenny.apiRefCollector.ObjectMethod(object, common.MethodReference{
		Name: "to_json",
		Comments: []string{
			"Converts this object into a representation that can easily be encoded to JSON.",
		},
		Return: "dict[str, object]",
	})

	buffer.WriteString("    def to_json(self) -> dict[str, object]:\n")
	buffer.WriteString("        payload: dict[str, object] = {\n")

	for _, field := range object.Type.AsStruct().Fields {
		if !field.Required {
			continue
		}

		buffer.WriteString(fmt.Sprintf(`            "%s": self.%s,`+"\n", field.Name, formatIdentifier(field.Name)))
	}

	buffer.WriteString("        }\n")

	for _, field := range object.Type.AsStruct().Fields {
		if field.Required {
			continue
		}

		fieldName := formatIdentifier(field.Name)

		buffer.WriteString(fmt.Sprintf("        if self.%s is not None:\n", fieldName))
		buffer.WriteString(fmt.Sprintf(`            payload["%s"] = self.%s`+"\n", field.Name, fieldName))
	}

	buffer.WriteString("        return payload")

	return buffer.String()
}

func (jenny RawTypes) generateFromJSONMethod(context languages.Context, object ast.Object) (string, error) {
	jenny.apiRefCollector.ObjectMethod(object, common.MethodReference{
		Name: "from_json",
		Comments: []string{
			"Builds this object from a JSON-decoded dict.",
		},
		Arguments: []common.ArgumentReference{
			{Name: "data", Type: "dict[str, typing.Any]"},
		},
		Return: "typing.Self",
		Static: true,
	})

	customUnmarshalTmpl := template.CustomObjectUnmarshalBlock(object)
	if jenny.tmpl.Exists(customUnmarshalTmpl) {
		rendered, err := jenny.tmpl.Render(customUnmarshalTmpl, map[string]any{
			"Object": object,
		})

		return tools.Indent(rendered, 4), err
	}

	var buffer strings.Builder
	var err error

	typingPkg := jenny.importPkg("typing", "typing")

	buffer.WriteString("    @classmethod\n")
	buffer.WriteString(fmt.Sprintf("    def from_json(cls, data: dict[str, %[1]s.Any]) -> %[1]s.Self:\n", typingPkg))

	buffer.WriteString(fmt.Sprintf("        args: dict[str, %s.Any] = {}\n", typingPkg))
	var assignments []string
	for _, field := range object.Type.AsStruct().Fields {
		value := fmt.Sprintf(`data["%s"]`, field.Name)
		setup := ""

		// No need to unmarshal constant scalar fields since they're set in
		// the object's constructor
		if field.Type.IsConcreteScalar() {
			continue
		}

		if field.Type.IsConstantRef() {
			continue
		}

		if _, ok := context.ResolveToComposableSlot(field.Type); ok {
			value, err = jenny.composableSlotFromJSON(context, object, field)
			if err != nil {
				return "", err
			}
		} else {
			fromJSON := jenny.fromJSONForType(context, field.Type, value, field.Name)
			if fromJSON.Setup != "" {
				setup += fromJSON.Setup + "\n            "
			}

			value = fromJSON.DecodingCall
		}

		assignment := fmt.Sprintf(`        if "%s" in data:
            %sargs["%s"] = %s`, field.Name, setup, formatIdentifier(field.Name), value)
		assignments = append(assignments, assignment)
	}

	if len(assignments) != 0 {
		buffer.WriteString("        \n")
		buffer.WriteString(strings.Join(assignments, "\n"))
		buffer.WriteString("        \n\n")
	}

	buffer.WriteString("        return cls(**args)")

	return buffer.String(), nil
}

func (jenny RawTypes) fromJSONForType(context languages.Context, typeDef ast.Type, inputVar string, hint string) fromJSONCode {
	if typeDef.IsRef() { //nolint:gocritic
		resolvedType := context.ResolveRefs(typeDef)
		if resolvedType.IsStruct() {
			formattedRef := jenny.typeFormatter.formatFullyQualifiedRef(typeDef.AsRef(), false)

			return fromJSONCode{
				DecodingCall: fmt.Sprintf(`%s.from_json(%s)`, formattedRef, inputVar),
			}
		}

		return jenny.fromJSONForType(context, resolvedType, inputVar, hint+"_ref")
	} else if typeDef.IsArray() {
		if typeDef.Array.IsArrayOf(ast.KindScalar) {
			return fromJSONCode{DecodingCall: inputVar}
		}

		valueType := typeDef.Array.ValueType
		valueTypeFromJSON := jenny.fromJSONForType(context, valueType, "item", hint+"_array")

		return fromJSONCode{
			Setup:        valueTypeFromJSON.Setup,
			DecodingCall: fmt.Sprintf(`[%[2]s for item in %[1]s]`, inputVar, valueTypeFromJSON.DecodingCall),
		}
	} else if typeDef.IsMap() {
		if typeDef.Map.IsMapOf(ast.KindScalar) {
			return fromJSONCode{DecodingCall: inputVar}
		}

		valueType := typeDef.Map.ValueType
		valueTypeFromJSON := jenny.fromJSONForType(context, valueType, inputVar+"[key]", hint+"_map")

		return fromJSONCode{
			Setup:        valueTypeFromJSON.Setup,
			DecodingCall: fmt.Sprintf(`{key: %[2]s for key in %[1]s.keys()}`, inputVar, valueTypeFromJSON.DecodingCall),
		}
	} else if typeDef.IsDisjunction() {
		return jenny.disjunctionFromJSON(context, typeDef, inputVar, hint+"_union")
	}

	return fromJSONCode{DecodingCall: inputVar}
}

type fromJSONCode struct {
	Setup        string
	DecodingCall string
}

func (jenny RawTypes) disjunctionFromJSON(context languages.Context, typeDef ast.Type, inputVar string, hint string) fromJSONCode {
	disjunction := context.ResolveRefs(typeDef).AsDisjunction()

	// this potentially generates incorrect code, but there isn't much we can do without more information.
	if disjunction.Discriminator == "" || disjunction.DiscriminatorMapping == nil {
		return fromJSONCode{DecodingCall: inputVar}
	}

	typingPkg := jenny.importPkg("typing", "typing")

	decodingMap := "{"
	branchTypes := make([]string, 0, len(disjunction.Branches))
	defaultBranch := ""
	discriminators := tools.Keys(disjunction.DiscriminatorMapping)
	sort.Strings(discriminators) // to ensure a deterministic output
	for _, discriminator := range discriminators {
		if discriminator == ast.DiscriminatorCatchAll {
			continue
		}

		objectRef := disjunction.DiscriminatorMapping[discriminator]
		decodingMap += fmt.Sprintf(`"%s": %s, `, discriminator, objectRef)
		branchTypes = append(branchTypes, fmt.Sprintf("%s.Type[%s]", typingPkg, objectRef))
	}

	decodingMap = strings.TrimSuffix(decodingMap, ", ") + "}"

	typeDecl := fmt.Sprintf("dict[str, %s.Union[%s]]", typingPkg, strings.Join(branchTypes, ", "))

	decodingMapName := "decoding_map_" + hint
	decodingMap = fmt.Sprintf("%s: %s = %s", decodingMapName, typeDecl, decodingMap)
	decodingCall := fmt.Sprintf(`%[3]s[%[2]s["%[1]s"]].from_json(%[2]s)`, disjunction.Discriminator, inputVar, decodingMapName)

	if defaultBranchType, ok := disjunction.DiscriminatorMapping[ast.DiscriminatorCatchAll]; ok {
		defaultBranch = fmt.Sprintf(`, %s`, defaultBranchType)

		decodingCall = fmt.Sprintf(`%[4]s.get(%[3]s["%[1]s"]%[2]s).from_json(%[3]s)`, disjunction.Discriminator, defaultBranch, inputVar, decodingMapName)
	}

	return fromJSONCode{
		Setup:        decodingMap,
		DecodingCall: decodingCall,
	}
}

func (jenny RawTypes) composableSlotFromJSON(context languages.Context, parentObject ast.Object, field ast.StructField) (string, error) {
	slot, _ := context.ResolveToComposableSlot(field.Type)
	variant := string(slot.AsComposableSlot().Variant)
	unmarshalVariantBlock := template.VariantFieldUnmarshalBlock(variant)
	if !jenny.tmpl.Exists(unmarshalVariantBlock) {
		return "", fmt.Errorf("can not generate custom unmarshal function for composable slot with variant '%s': template block %s not found", variant, unmarshalVariantBlock)
	}

	return jenny.tmpl.Render(unmarshalVariantBlock, map[string]any{
		"Object": parentObject,
		"Field":  field,
	})
}
