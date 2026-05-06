package golang

import (
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

type Builder struct {
	Config          Config
	Tmpl            *template.Template
	apiRefCollector *common.APIReferenceCollector

	typeImportMapper func(pkg string) string
	pathFormatter    func(path ast.Path) string
	typeFormatter    *typeFormatter
}

func (jenny *Builder) JennyName() string {
	return "GoBuilder"
}

func (jenny *Builder) Generate(context languages.Context) (codejen.Files, error) {
	files := codejen.Files{}

	for _, builder := range context.Builders {
		output, err := jenny.generateBuilder(context, builder)
		if err != nil {
			return nil, err
		}

		filename := filepath.Join(
			formatPackageName(builder.Package),
			fmt.Sprintf("%s_builder_gen.go", formatFileName(builder.Name)),
		)

		files = append(files, *codejen.NewFile(filename, output, jenny))
	}

	return files, nil
}

func (jenny *Builder) generateBuilder(context languages.Context, builder ast.Builder) ([]byte, error) {
	imports := NewImportMap(jenny.Config.PackageRoot)
	jenny.typeImportMapper = func(pkg string) string {
		if imports.IsIdentical(pkg, builder.Package) {
			return ""
		}

		return imports.Add(pkg, jenny.Config.importPath(pkg))
	}
	jenny.typeFormatter = builderTypeFormatter(jenny.Config, context, imports, jenny.typeImportMapper)
	jenny.pathFormatter = makePathFormatter(jenny.typeFormatter)

	// every builder has a dependency on cog's runtime, so let's make sure it's declared.
	jenny.typeImportMapper("cog")

	fullObjectName := jenny.importType(builder.For.SelfRef)
	buildObjectSignature := fullObjectName
	if builder.For.Type.ImplementsVariant() {
		buildObjectSignature = jenny.typeFormatter.variantInterface(builder.For.Type.ImplementedVariant())
	}

	constructorName := "New" + formatObjectName(builder.For.SelfRef.ReferredType)
	constructorPkg := jenny.typeImportMapper(builder.For.SelfRef.ReferredPkg)
	if constructorPkg != "" {
		constructorName = constructorPkg + "." + constructorName
	}

	jenny.apiRefCollector.BuilderMethod(builder, common.MethodReference{
		Name: "Build",
		Comments: []string{
			"Builds the object.",
		},
		Return: fmt.Sprintf("(%s, error)", buildObjectSignature),
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
			Return: "*" + builder.Name + "Builder",
		})
	}

	return jenny.Tmpl.
		Funcs(common.TypeResolvingTemplateHelpers(context)).
		Funcs(map[string]any{
			"importPkg": jenny.typeImportMapper,
			"importStdPkg": func(pkg string) string {
				return imports.Add(pkg, pkg)
			},
			"formatPath": jenny.pathFormatter,
			"formatType": jenny.typeFormatter.formatType,
			"formatTypeNoBuilder": func(typeDef ast.Type) string {
				return jenny.typeFormatter.doFormatType(typeDef, false)
			},
			"typeHasBuilder": context.ResolveToBuilder,
			"emptyValueForGuard": func(guard ast.AssignmentNilCheck) string {
				return jenny.emptyValueForGuard(context, guard.EmptyValueType)
			},
			"formatValue": func(destinationType ast.Type, value any) string {
				resolved := context.ResolveRefs(destinationType)

				if !destinationType.IsRef() || !resolved.IsEnum() {
					return formatScalar(value)
				}

				member, _ := resolved.Enum.MemberForValue(value)
				formatted := member.Name

				referredPkg := jenny.typeImportMapper(destinationType.Ref.ReferredPkg)
				if referredPkg != "" {
					formatted = referredPkg + "." + formatted
				}

				return formatted
			},
		}).
		RenderAsBytes("builders/builder.tmpl", map[string]any{
			"Builder":              builder,
			"BuilderSignatureType": buildObjectSignature,
			"Imports":              imports,
			"ObjectName":           fullObjectName,
			"ConstructorName":      constructorName,
		})
}

func (jenny *Builder) emptyValueForGuard(context languages.Context, typeDef ast.Type) string {
	typeDef = typeDef.DeepCopy()
	typeDef.Nullable = false

	switch typeDef.Kind {
	case ast.KindRef:
		resolvedType := context.ResolveRefs(typeDef)
		if resolvedType.IsStruct() {
			constructor := "New" + formatFunctionName(typeDef.Ref.ReferredType) + "()"

			referredPkg := jenny.typeImportMapper(typeDef.Ref.ReferredPkg)
			if referredPkg != "" {
				constructor = referredPkg + "." + constructor
			}

			return constructor
		}

		return jenny.emptyValueForGuard(context, resolvedType)
	case ast.KindArray, ast.KindMap:
		return jenny.typeFormatter.doFormatType(typeDef, false) + "{}"
	case ast.KindStruct:
		return "&" + jenny.typeFormatter.doFormatType(typeDef, false) + "{}"
	case ast.KindEnum:
		jenny.typeImportMapper("cog")
		typeHint := jenny.typeFormatter.formatType(typeDef)

		return fmt.Sprintf("cog.ToPtr[%s](%s)", typeHint, formatScalar(typeDef.AsEnum().Values[0].Value))
	case ast.KindScalar:
		return "" // no need to do anything here

	default:
		return "unknown"
	}
}

// importType declares an import statement for the type definition of
// the given object and returns a fully qualified type name for it.
func (jenny *Builder) importType(typeRef ast.RefType) string {
	pkg := jenny.typeImportMapper(typeRef.ReferredPkg)
	typeName := formatObjectName(typeRef.ReferredType)
	if pkg == "" {
		return typeName
	}

	return fmt.Sprintf("%s.%s", pkg, typeName)
}
