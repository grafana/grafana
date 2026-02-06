package typescript

import (
	"fmt"

	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

type Builder struct {
	config          Config
	tmpl            *template.Template
	apiRefCollector *common.APIReferenceCollector

	imports          *common.DirectImportMap
	typeImportMapper func(string) string
	typeFormatter    *typeFormatter
	rawTypes         RawTypes
}

func (jenny *Builder) JennyName() string {
	return "TypescriptBuilder"
}

func (jenny *Builder) Generate(context languages.Context) (codejen.Files, error) {
	files := codejen.Files{}
	jenny.rawTypes = RawTypes{
		schemas: context.Schemas,
	}

	for _, builder := range context.Builders {
		output, err := jenny.generateBuilder(context, builder)
		if err != nil {
			return nil, err
		}

		filename := jenny.config.pathWithPrefix(
			formatPackageName(builder.Package),
			fmt.Sprintf("%sBuilder.gen.ts", tools.LowerCamelCase(builder.Name)),
		)

		files = append(files, *codejen.NewFile(filename, output, jenny))
	}

	return files, nil
}

func (jenny *Builder) generateBuilder(context languages.Context, builder ast.Builder) ([]byte, error) {
	jenny.imports = NewImportMap(jenny.config.PackagesImportMap)
	jenny.imports.Add("cog", "../cog")
	jenny.typeImportMapper = func(pkg string) string {
		return jenny.imports.Add(pkg, fmt.Sprintf("../%s", pkg))
	}
	jenny.typeFormatter = builderTypeFormatter(jenny.config, context, jenny.typeImportMapper)

	buildObjectSignature := formatPackageName(builder.For.SelfRef.ReferredPkg) + "." + tools.CleanupNames(builder.For.Name)
	if builder.For.Type.ImplementsVariant() {
		buildObjectSignature = jenny.typeFormatter.variantInterface(builder.For.Type.ImplementedVariant())
	}

	jenny.apiRefCollector.BuilderMethod(builder, common.MethodReference{
		Name: "build",
		Comments: []string{
			"Builds the object.",
		},
		Return: fmt.Sprintf("%s.%s", jenny.importType(builder.For.SelfRef), tools.CleanupNames(builder.For.Name)),
	})

	for _, factory := range builder.Factories {
		jenny.apiRefCollector.RegisterFunction(builder.Package, common.FunctionReference{
			Name:     factory.Name,
			Comments: factory.Comments,
			Arguments: tools.Map(factory.Args, func(arg ast.Argument) common.ArgumentReference {
				return common.ArgumentReference{
					Name: arg.Name,
					Type: jenny.typeFormatter.formatType(arg.Type),
				}
			}),
			Return: builder.Name + "Builder",
		})
	}

	return jenny.tmpl.
		Funcs(map[string]any{
			"importPkg":                   jenny.typeImportMapper,
			"typeHasBuilder":              context.ResolveToBuilder,
			"typeIsDisjunctionOfBuilders": context.IsDisjunctionOfBuilders,
			"formatType":                  jenny.typeFormatter.formatType,
			"resolvesToComposableSlot": func(typeDef ast.Type) bool {
				_, found := context.ResolveToComposableSlot(typeDef)
				return found
			},
			"defaultValueForType": func(typeDef ast.Type) string {
				return formatValue(jenny.rawTypes.defaultValueForType(typeDef, jenny.typeImportMapper))
			},
			"formatValue": func(destinationType ast.Type, value any) string {
				if destinationType.IsRef() {
					referredObj, found := context.LocateObject(destinationType.AsRef().ReferredPkg, destinationType.AsRef().ReferredType)
					if found && referredObj.Type.IsEnum() {
						return jenny.typeFormatter.enums.formatValue(referredObj, value)
					}
				}

				return formatValue(value)
			},
			"formatPath": jenny.formatFieldPath,
			"emptyValueForGuard": func(guard ast.AssignmentNilCheck) string {
				return formatValue(jenny.rawTypes.defaultValueForType(guard.EmptyValueType, jenny.typeImportMapper))
			},
		}).
		RenderAsBytes("builder.tmpl", map[string]any{
			"Builder":              builder,
			"ObjectName":           tools.CleanupNames(builder.For.Name),
			"BuilderSignatureType": buildObjectSignature,
			"Imports":              jenny.imports,
			"ImportAlias":          jenny.importType(builder.For.SelfRef),
		})
}

// importType declares an import statement for the type definition of
// the given object and returns an alias to it.
func (jenny *Builder) importType(typeRef ast.RefType) string {
	return jenny.typeImportMapper(typeRef.ReferredPkg)
}

func (jenny *Builder) formatFieldPath(fieldPath ast.Path) string {
	path := ""

	for i, chunk := range fieldPath {
		last := i == len(fieldPath)-1
		output := chunk.Identifier

		if chunk.Index != nil {
			output += "["
			if chunk.Index.Constant != nil {
				output += formatValue(chunk.Index.Constant)
			} else {
				output += formatIdentifier(chunk.Index.Argument.Name)
			}
			output += "]"
		}

		path += output
		if !last && fieldPath[i+1].Index == nil {
			path += "."
		}
	}

	return path
}
