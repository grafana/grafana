package java

import (
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

type builderAndFactory struct {
	Builder ast.Builder
	Factory ast.BuilderFactory
}

type Factory struct {
	config Config
	tmpl   *template.Template
}

func (jenny *Factory) JennyName() string {
	return "JavaFactory"
}

func (jenny *Factory) Generate(context languages.Context) (codejen.Files, error) {
	factoryByPackage := map[string][]builderAndFactory{}
	for _, builder := range context.Builders {
		for _, factory := range builder.Factories {
			factoryByPackage[builder.Package] = append(factoryByPackage[builder.Package], builderAndFactory{
				Builder: builder,
				Factory: factory,
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

		filename := filepath.Join(jenny.config.ProjectPath, formatPackageName(pkg), fmt.Sprintf("%s.java", tools.UpperCamelCase(factoriesClassName)))
		files = append(files, *codejen.NewFile(filename, output, jenny))
	}

	return files, nil
}

func (jenny *Factory) generateFactories(context languages.Context, factoriesPkg string, className string, factories []builderAndFactory) ([]byte, error) {
	imports := NewImportMap(jenny.config.PackagePath)

	packageMapper := func(pkg string, class string) string {
		if imports.IsIdentical(pkg, factoriesPkg) {
			return ""
		}

		return imports.Add(class, pkg)
	}

	typesFormatter := createFormatter(context, jenny.config).withPackageMapper(packageMapper)

	return jenny.tmpl.
		Funcs(template.FuncMap{
			"formatRawRef": func(pkg string, referredType string) string {
				return typesFormatter.formatFieldType(ast.NewRef(pkg, referredType))
			},
			"factoryClassForPkg": func(pkg string) string {
				return jenny.config.builderFactoryClassForPackage(pkg)
			},
		}).
		RenderAsBytes("builders/factories.tmpl", map[string]any{
			"Package":   jenny.config.formatPackage(factoriesPkg),
			"ClassName": className,
			"Factories": factories,
			"Imports":   imports,
		})
}
