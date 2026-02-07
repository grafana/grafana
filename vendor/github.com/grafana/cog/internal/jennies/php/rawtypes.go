package php

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
	apiRefCollector *common.APIReferenceCollector

	typeFormatter *typeFormatter
	shaper        *shape
}

func (jenny RawTypes) JennyName() string {
	return "PHPRawTypes"
}

func (jenny RawTypes) Generate(context languages.Context) (codejen.Files, error) {
	var err error
	files := make(codejen.Files, 0, len(context.Schemas))

	jenny.shaper = &shape{context: context}
	jenny.tmpl = jenny.tmpl.
		Funcs(templateHelpers(templateDeps{
			config:  jenny.config,
			context: context,
		})).
		Funcs(common.TypesTemplateHelpers(context))

	// generate typehints with a compiler pass
	context.Schemas, err = (&AddTypehintsComments{config: jenny.config}).Process(context.Schemas)
	if err != nil {
		return nil, err
	}

	for _, schema := range context.Schemas {
		schemaFiles, err := jenny.generateSchema(context, schema)
		if err != nil {
			return nil, err
		}

		files = append(files, schemaFiles...)
	}

	return files, nil
}

func (jenny RawTypes) generateSchema(context languages.Context, schema *ast.Schema) (codejen.Files, error) {
	var err error

	files := make(codejen.Files, 0, schema.Objects.Len())
	schema.Objects.Iterate(func(_ string, object ast.Object) {
		// Constants are handled separately
		if object.Type.IsConcreteScalar() {
			return
		}

		file, innerErr := jenny.formatObject(context, schema, object)
		if innerErr != nil {
			err = innerErr
			return
		}

		files = append(files, file)
	})
	if err != nil {
		return nil, err
	}

	constants := schema.Objects.Filter(func(_ string, object ast.Object) bool {
		return object.Type.IsConcreteScalar()
	})
	if constants.Len() != 0 {
		files = append(files, jenny.generateConstants(schema, constants))
	}
	return files, nil
}

func (jenny RawTypes) generateConstants(schema *ast.Schema, objects *orderedmap.Map[string, ast.Object]) codejen.File {
	constants := make([]string, 0, objects.Len())

	objects.Iterate(func(_ string, object ast.Object) {
		name := formatConstantName(object.Name)
		value := formatValue(object.Type.Scalar.Value)

		constant := fmt.Sprintf("const %s = %s;", name, value)
		if len(object.Comments) != 0 {
			constant = formatCommentsBlock(object.Comments) + constant
		}

		constants = append(constants, tools.Indent(constant, 4))
	})

	content := fmt.Sprintf(`<?php

namespace %[1]s;

final class Constants
{
%[2]s
}`, jenny.config.fullNamespace(formatPackageName(schema.Package)), strings.Join(constants, "\n"))

	filename := filepath.Join(
		"src",
		formatPackageName(schema.Package),
		"Constants.php",
	)

	return *codejen.NewFile(filename, []byte(content), jenny)
}

func (jenny RawTypes) formatObject(context languages.Context, schema *ast.Schema, def ast.Object) (codejen.File, error) {
	var buffer strings.Builder

	jenny.typeFormatter = defaultTypeFormatter(jenny.config, context)

	defName := formatObjectName(def.Name)

	comments := def.Comments
	if jenny.config.debug {
		passesTrail := tools.Map(def.PassesTrail, func(trail string) string {
			return fmt.Sprintf("Modified by compiler pass '%s'", trail)
		})
		comments = append(comments, passesTrail...)
	}

	buffer.WriteString(formatCommentsBlock(comments))

	switch def.Type.Kind {
	case ast.KindEnum:
		enum, err := jenny.typeFormatter.formatEnumDeclaration(jenny.tmpl, context, def)
		if err != nil {
			return codejen.File{}, err
		}

		buffer.WriteString(enum)
	case ast.KindRef:
		buffer.WriteString(fmt.Sprintf("class %s extends %s {}", defName, jenny.typeFormatter.formatType(def.Type)))
	case ast.KindStruct:
		structDef, err := jenny.formatStructDef(context, schema, def)
		if err != nil {
			return codejen.File{}, err
		}

		buffer.WriteString(structDef)
	default:
		return codejen.File{}, fmt.Errorf("unhandled type def kind: %s", def.Type.Kind)
	}

	buffer.WriteString("\n")

	filename := filepath.Join(
		"src",
		formatPackageName(schema.Package),
		fmt.Sprintf("%s.php", defName),
	)

	output := fmt.Sprintf("<?php\n\nnamespace %s;\n\n", jenny.config.fullNamespace(formatPackageName(schema.Package)))
	output += buffer.String()

	return *codejen.NewFile(filename, []byte(output), jenny), nil
}

func (jenny RawTypes) formatStructDef(context languages.Context, schema *ast.Schema, object ast.Object) (string, error) {
	var buffer strings.Builder

	variant := ""
	if object.Type.ImplementsVariant() {
		variant = ", " + jenny.config.fullNamespaceRef("Cog\\"+formatObjectName(object.Type.ImplementedVariant()))
	}

	buffer.WriteString(fmt.Sprintf("class %s", formatObjectName(object.Name)))
	if jenny.config.GenerateJSONMarshaller {
		buffer.WriteString(" implements \\JsonSerializable")
	}
	buffer.WriteString(fmt.Sprintf("%s\n{\n", variant))

	for _, fieldDef := range object.Type.Struct.Fields {
		buffer.WriteString(tools.Indent(jenny.typeFormatter.formatField(fieldDef), 4))
		buffer.WriteString("\n\n")
	}

	buffer.WriteString(tools.Indent(jenny.generateConstructor(context, object), 4))

	if jenny.config.GenerateJSONMarshaller {
		fromJSON, err := jenny.generateFromJSON(context, object)
		if err != nil {
			return "", err
		}

		buffer.WriteString("\n\n")
		buffer.WriteString(tools.Indent(fromJSON, 4))
		buffer.WriteString("\n\n")

		buffer.WriteString(tools.Indent(jenny.generateJSONSerialize(object), 4))
	}

	if object.Type.ImplementsVariant() {
		customVariantTmpl := template.CustomObjectVariantBlock(object)
		if jenny.tmpl.Exists(customVariantTmpl) {
			var customVariantBlock strings.Builder
			if err := jenny.tmpl.RenderInBuffer(&customVariantBlock, customVariantTmpl, map[string]any{
				"Object": object,
				"Schema": schema,
			}); err != nil {
				return "", err
			}

			buffer.WriteString("\n\n")
			buffer.WriteString(tools.Indent(customVariantBlock.String(), 4))
		}
	}

	customMethodsBlock := template.CustomObjectMethodsBlock(object)
	if jenny.tmpl.Exists(customMethodsBlock) {
		rendered, err := jenny.tmpl.Render(customMethodsBlock, map[string]any{
			"Object": object,
		})
		if err != nil {
			return "", err
		}

		buffer.WriteString("\n\n")
		buffer.WriteString(tools.Indent(rendered, 4))
	}

	buffer.WriteString("\n}")

	return buffer.String(), nil
}

func (jenny RawTypes) convertDisjunctionFunc(disjunction ast.DisjunctionType) string {
	decodingSwitch := "switch (true) {\n"
	discriminators := tools.Keys(disjunction.DiscriminatorMapping)
	sort.Strings(discriminators) // to ensure a deterministic output
	for _, discriminator := range discriminators {
		if discriminator == ast.DiscriminatorCatchAll {
			continue
		}

		objectRef := disjunction.DiscriminatorMapping[discriminator]
		decodingSwitch += fmt.Sprintf(`    case $input instanceof %[1]s:
        return %[1]sConverter::convert($input);
`, objectRef)
	}

	if defaultBranchType, ok := disjunction.DiscriminatorMapping[ast.DiscriminatorCatchAll]; ok {
		decodingSwitch += fmt.Sprintf(`    default:
        return %[1]sConverter::convert($input);
`, defaultBranchType)
	} else {
		decodingSwitch += `    default:
        throw new \ValueError('can not convert unknown disjunction branch');
`
	}

	decodingSwitch += "}"

	dataqueryRef := jenny.config.fullNamespaceRef("Cog\\Dataquery")

	return fmt.Sprintf(`(function(%s $input) {

    %s
})`, dataqueryRef, decodingSwitch)
}

func (jenny RawTypes) generateConstructor(context languages.Context, def ast.Object) string {
	var buffer strings.Builder
	hinter := typehints{config: jenny.config, context: context}

	var typeAnnotations []string
	var args []string
	var assignments []string

	for _, field := range def.Type.AsStruct().Fields {
		fieldName := formatFieldName(field.Name)
		defaultValue := (any)(nil)

		// values with enums that we don't want to add in the constructor
		if field.Type.IsConstantRef() {
			val := jenny.typeFormatter.constantRefValue(field.Type.AsConstantRef())
			assignments = append(assignments, fmt.Sprintf("    $this->%s = %s;", fieldName, val))
			continue
		}

		// set for default values for fields that need one or have one
		if !field.Type.Nullable || field.Type.Default != nil {
			var defaultsOverrides map[string]any
			if overrides, ok := field.Type.Default.(map[string]interface{}); ok {
				defaultsOverrides = overrides
			}

			defaultValue = defaultValueForType(jenny.config, context.Schemas, field.Type, orderedmap.FromMap(defaultsOverrides))
		}

		// initialize constant fields
		if field.Type.IsConcreteScalar() {
			assignments = append(assignments, fmt.Sprintf("    $this->%s = %s;\n", fieldName, formatValue(field.Type.AsScalar().Value)))
			continue
		}

		argType := field.Type.DeepCopy()
		argType.Nullable = true

		args = append(args, fmt.Sprintf("%s $%s = null", jenny.typeFormatter.formatType(argType), fieldName))
		typeAnnotation := hinter.paramAnnotationForType(fieldName, argType)
		if typeAnnotation != "" {
			typeAnnotations = append(typeAnnotations, typeAnnotation)
		}

		if field.Type.Nullable {
			assignments = append(assignments, fmt.Sprintf("    $this->%[1]s = $%[1]s;", fieldName))
		} else {
			assignments = append(assignments, fmt.Sprintf("    $this->%[1]s = $%[1]s ?: %[2]s;", fieldName, formatValue(defaultValue)))
		}
	}

	if len(typeAnnotations) != 0 {
		buffer.WriteString(formatCommentsBlock(typeAnnotations))
	}

	buffer.WriteString(fmt.Sprintf("public function __construct(%s)\n", strings.Join(args, ", ")))
	buffer.WriteString("{\n")

	buffer.WriteString(strings.Join(assignments, "\n"))

	buffer.WriteString("\n}")

	return buffer.String()
}

func (jenny RawTypes) generateFromJSON(context languages.Context, def ast.Object) (string, error) {
	jenny.tmpl = jenny.tmpl.Funcs(template.FuncMap{
		"unmarshalForType": func(typeDef ast.Type, inputVar string) string {
			return jenny.unmarshalForType(context, def, typeDef, inputVar)
		},
	})

	customUnmarshalTmpl := template.CustomObjectUnmarshalBlock(def)
	if jenny.tmpl.Exists(customUnmarshalTmpl) {
		return jenny.tmpl.Render(customUnmarshalTmpl, map[string]any{
			"Object": def,
		})
	}

	var buffer strings.Builder
	var constructorArgs []string

	for _, field := range def.Type.AsStruct().Fields {
		// No need to unmarshal constant scalar fields since they're set in
		// the object's constructor
		if field.Type.IsConcreteScalar() || field.Type.IsConstantRef() {
			continue
		}

		inputVar := fmt.Sprintf(`$data["%[1]s"]`, field.Name)
		value := jenny.unmarshalForType(context, def, field.Type, inputVar)

		constructorArgs = append(constructorArgs, fmt.Sprintf("        %s: %s,\n", formatFieldName(field.Name), value))
	}

	buffer.WriteString("/**\n")
	buffer.WriteString(" * @param array<string, mixed> $inputData\n")
	buffer.WriteString(" */\n")
	buffer.WriteString("public static function fromArray(array $inputData): self\n")
	buffer.WriteString("{\n")
	if len(constructorArgs) != 0 {
		buffer.WriteString(fmt.Sprintf("    /** @var %s $inputData */\n", jenny.shaper.typeShape(def.Type)))
		buffer.WriteString("    $data = $inputData;\n")
	}
	buffer.WriteString("    return new self(\n")
	buffer.WriteString(strings.Join(constructorArgs, ""))
	buffer.WriteString("    );\n")
	buffer.WriteString("}")

	jenny.apiRefCollector.ObjectMethod(def, common.MethodReference{
		Name: "fromArray",
		Comments: []string{
			"Builds this object from an array.",
			"This function is meant to be used with the return value of `json_decode($json, true)`.",
		},
		Arguments: []common.ArgumentReference{{
			Name: "inputData",
			Type: "array",
		}},
		Return: "self",
		Static: true,
	})

	return buffer.String(), nil
}

func (jenny RawTypes) unmarshalForType(context languages.Context, object ast.Object, def ast.Type, inputVar string) string {
	if _, ok := context.ResolveToComposableSlot(def); ok {
		return jenny.unmarshalComposableSlot(context, object, def, inputVar)
	}

	switch {
	case def.IsRef():
		return fmt.Sprintf(`isset(%[2]s) ? %[1]s(%[2]s) : null`, jenny.unmarshalRefFunc(context, def), inputVar)
	case def.IsArray() && def.Array.ValueType.IsRef():
		return fmt.Sprintf(`array_filter(array_map(%s, %s ?? []))`, jenny.unmarshalRefFunc(context, def.Array.ValueType), inputVar)
	case def.IsArray() && def.Array.ValueType.IsDisjunction():
		disjunctionType := def.Array.ValueType.AsDisjunction()
		decodingFunc := jenny.unmarshalDisjunctionFunc(context, disjunctionType)

		return fmt.Sprintf(`!empty(%[1]s) ? array_map(%[2]s, %[1]s) : null`, inputVar, decodingFunc)
	case def.IsDisjunction():
		decodingFunc := jenny.unmarshalDisjunctionFunc(context, def.AsDisjunction())

		return fmt.Sprintf(`isset(%[1]s) ? %[2]s(%[1]s) : null`, inputVar, decodingFunc)
	case def.IsMap():
		return jenny.unmarshalMap(context, object, def.AsMap(), inputVar)
	default:
		return fmt.Sprintf(`%[1]s ?? null`, inputVar)
	}
}

func (jenny RawTypes) unmarshalMap(context languages.Context, object ast.Object, mapDef ast.MapType, inputVar string) string {
	if mapDef.IsMapOf(ast.KindScalar, ast.KindMap, ast.KindArray) {
		return fmt.Sprintf("%s ?? null", inputVar)
	}

	mapType := ast.Type{
		Kind:     ast.KindMap,
		Map:      &mapDef,
		Nullable: false,
	}
	hinter := typehints{config: jenny.config, context: context}
	tmpl := `(function($input) {
    /** @var %[2]s $results */
    $results = [];
    foreach ($input as $key => $val) {
        $results[$key] = %[1]s;
    }
    return array_filter($results);
})`

	valueUnmarshal := jenny.unmarshalForType(context, object, mapDef.ValueType, "$val")
	unmarshaller := fmt.Sprintf(tmpl, valueUnmarshal, hinter.forType(mapType, false))

	return fmt.Sprintf(`isset(%[1]s) ? %[2]s(%[1]s) : null`, inputVar, unmarshaller)
}

func (jenny RawTypes) unmarshalRefFunc(context languages.Context, refDef ast.Type) string {
	referredObject, found := context.LocateObjectByRef(refDef.AsRef())
	formattedRef := jenny.typeFormatter.formatRef(refDef, false)

	if found && referredObject.Type.IsStruct() {
		assignment := fmt.Sprintf("/** @var %s */\n", jenny.shaper.typeShape(referredObject.Type))
		assignment += "$val = $input;"

		return fmt.Sprintf(`(function($input) {
	%[2]s
	return %[1]s::fromArray($val);
})`, formattedRef, assignment)
	} else if found && referredObject.Type.IsEnum() {
		return fmt.Sprintf(`(function($input) { return %[1]s::fromValue($input); })`, formattedRef)
	}

	// TODO: should not happen?
	return `/* ref to a non-struct, non-enum, this should have been inlined */ (function(array $input) { return $input; })`
}

func (jenny RawTypes) unmarshalComposableSlot(context languages.Context, parentObject ast.Object, def ast.Type, inputVar string) string {
	slotType, _ := context.ResolveToComposableSlot(def)
	variant := string(slotType.ComposableSlot.Variant)

	unmarshalVariantBlock := template.VariantFieldUnmarshalBlock(variant)
	if !jenny.tmpl.Exists(unmarshalVariantBlock) {
		return fmt.Sprintf("can not generate custom unmarshal function for composable slot with variant '%s': template block %s not found", variant, unmarshalVariantBlock)
	}

	rendered, err := jenny.tmpl.Render(unmarshalVariantBlock, map[string]any{
		"Object":   parentObject,
		"Type":     def,
		"InputVar": inputVar,
	})
	if err != nil {
		return err.Error()
	}

	return rendered
}

func (jenny RawTypes) unmarshalDisjunctionFunc(context languages.Context, disjunction ast.DisjunctionType) string {
	// this potentially generates incorrect code, but there isn't much we can do without more information.
	if disjunction.Discriminator == "" || disjunction.DiscriminatorMapping == nil {
		decodingSwitch := "switch (true) {\n"

		var ignoredBranches []ast.Type
		for _, branch := range disjunction.Branches {
			if branch.IsScalar() {
				testMap := map[ast.ScalarKind]string{
					ast.KindBytes:   "is_string",
					ast.KindString:  "is_string",
					ast.KindFloat32: "is_float",
					ast.KindFloat64: "is_float",
					ast.KindUint8:   "is_int",
					ast.KindUint16:  "is_int",
					ast.KindUint32:  "is_int",
					ast.KindUint64:  "is_int",
					ast.KindInt8:    "is_int",
					ast.KindInt16:   "is_int",
					ast.KindInt32:   "is_int",
					ast.KindInt64:   "is_int",
					ast.KindBool:    "is_bool",
				}

				testFunc := testMap[branch.Scalar.ScalarKind]
				if testFunc == "" {
					ignoredBranches = append(ignoredBranches, branch)
					continue
				}

				decodingSwitch += fmt.Sprintf(`    case %[1]s($input):
        return $input;
`, testFunc)
				continue
			}

			ignoredBranches = append(ignoredBranches, branch)
		}

		//nolint:gocritic
		if len(ignoredBranches) == 1 && ignoredBranches[0].IsRef() {
			ref := ignoredBranches[0].AsRef()
			referredObject, found := context.LocateObjectByRef(ref)
			formattedRef := jenny.typeFormatter.formatRef(ignoredBranches[0], false)

			value := "$input"
			if found && referredObject.Type.IsStruct() {
				value = fmt.Sprintf(`%[1]s::fromArray($input)`, formattedRef)
			} else if found && referredObject.Type.IsEnum() {
				value = fmt.Sprintf(`%[1]s::fromValue($input)`, formattedRef)
			}

			decodingSwitch += fmt.Sprintf(`    default:
        /** @var %[2]s $input */
        return %[1]s;
`, value, jenny.shaper.typeShape(referredObject.Type))
		} else if len(ignoredBranches) >= 1 {
			decodingSwitch += `    default:
        return $input;
`
		} else if len(ignoredBranches) == 0 {
			decodingSwitch += `    default:
        throw new \ValueError('incorrect value for disjunction');
`
		}

		decodingSwitch += "}"

		return fmt.Sprintf(`(function($input) {
    %s
})`, decodingSwitch)
	}

	decodingSwitch := fmt.Sprintf("switch ($input[\"%s\"]) {\n", disjunction.Discriminator)
	discriminators := tools.Keys(disjunction.DiscriminatorMapping)
	sort.Strings(discriminators) // to ensure a deterministic output
	for _, discriminator := range discriminators {
		if discriminator == ast.DiscriminatorCatchAll {
			continue
		}

		objectRef := disjunction.DiscriminatorMapping[discriminator]
		decodingSwitch += fmt.Sprintf(`    case "%[1]s":
        return %[2]s::fromArray($input);
`, discriminator, objectRef)
	}

	if defaultBranchType, ok := disjunction.DiscriminatorMapping[ast.DiscriminatorCatchAll]; ok {
		decodingSwitch += fmt.Sprintf(`    default:
        return %[1]s::fromArray($input);
`, defaultBranchType)
	} else {
		decodingSwitch += `    default:
        throw new \ValueError('can not parse disjunction from array');
`
	}

	decodingSwitch += "}"

	return fmt.Sprintf(`(function($input) {
    \assert(is_array($input), 'expected disjunction value to be an array');
    /** @var array<string, mixed> $input */
    %s
})`, decodingSwitch)
}

func (jenny RawTypes) generateJSONSerialize(def ast.Object) string {
	var buffer strings.Builder

	buffer.WriteString("/**\n")
	buffer.WriteString(" * @return mixed\n")
	buffer.WriteString(" */\n")
	buffer.WriteString("public function jsonSerialize(): mixed\n")
	buffer.WriteString("{\n")

	buffer.WriteString("    $data = new \\stdClass;\n")

	for _, field := range def.Type.AsStruct().Fields {
		if field.Type.Nullable {
			continue
		}

		buffer.WriteString(fmt.Sprintf(`    $data->%s = $this->%s;`+"\n", field.Name, formatFieldName(field.Name)))
	}

	for _, field := range def.Type.AsStruct().Fields {
		if !field.Type.Nullable {
			continue
		}

		fieldName := formatFieldName(field.Name)

		buffer.WriteString(fmt.Sprintf("    if (isset($this->%s)) {\n", fieldName))
		buffer.WriteString(fmt.Sprintf(`        $data->%s = $this->%s;`+"\n", field.Name, fieldName))
		buffer.WriteString("    }\n")
	}

	buffer.WriteString("    return $data;\n")

	buffer.WriteString("}")

	jenny.apiRefCollector.ObjectMethod(def, common.MethodReference{
		Name: "jsonSerialize",
		Comments: []string{
			"Returns the data representing this object, preparing it for JSON serialization with `json_encode()`.",
		},
		Return: "array",
	})

	return buffer.String()
}
