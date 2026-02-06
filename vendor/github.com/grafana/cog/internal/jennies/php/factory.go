package php

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

type builderAndFactory struct {
	Builder ast.Builder
	Factory ast.BuilderFactory
}

type Factory struct {
	config          Config
	tmpl            *template.Template
	typeFormatter   *typeFormatter
	apiRefCollector *common.APIReferenceCollector
}

func (jenny *Factory) JennyName() string {
	return "PHPFactory"
}

func (jenny *Factory) Generate(context languages.Context) (codejen.Files, error) {
	jenny.typeFormatter = builderTypeFormatter(jenny.config, context)

	factoryByPackage := map[string][]builderAndFactory{}
	for _, builder := range context.Builders {
		for _, factory := range builder.Factories {
			factoryByPackage[builder.Package] = append(factoryByPackage[builder.Package], builderAndFactory{
				Builder: builder,
				Factory: factory,
			})

			factoriesClassName := jenny.config.builderFactoryClassForPackage(builder.Package)
			fakeFactoryObject := ast.Object{
				Name: factoriesClassName,
				Type: ast.NewStruct(),
				SelfRef: ast.RefType{
					ReferredPkg:  builder.Package,
					ReferredType: factoriesClassName,
				},
			}
			jenny.apiRefCollector.VirtualObjectMethod(fakeFactoryObject, common.MethodReference{
				Name:     factory.Name,
				Comments: factory.Comments,
				Static:   true,
				Arguments: tools.Map(factory.Args, func(arg ast.Argument) common.ArgumentReference {
					return common.ArgumentReference{
						Name: arg.Name,
						Type: jenny.typeFormatter.formatType(arg.Type),
					}
				}),
				Return: builder.Name,
			})
		}
	}

	var files []codejen.File
	for pkg, factories := range factoryByPackage {
		factoriesClassName := jenny.config.builderFactoryClassForPackage(pkg)

		output, err := jenny.generateFactories(context, pkg, factoriesClassName, factories)
		if err != nil {
			return nil, err
		}

		filename := filepath.Join(
			"src",
			formatPackageName(pkg),
			fmt.Sprintf("%s.php", formatObjectName(factoriesClassName)),
		)
		files = append(files, *codejen.NewFile(filename, output, jenny))
	}

	return files, nil
}

func (jenny *Factory) generateFactories(context languages.Context, pkg string, className string, factories []builderAndFactory) ([]byte, error) {
	return jenny.tmpl.
		Funcs(templateHelpers(templateDeps{
			config:  jenny.config,
			context: context,
		})).
		RenderAsBytes("builders/factories.tmpl", map[string]any{
			"NamespaceRoot": jenny.config.NamespaceRoot,
			"Package":       pkg,
			"ClassName":     className,
			"Factories":     factories,
		})
}
