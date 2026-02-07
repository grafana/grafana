package java

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
	config        Config
	tmpl          *template.Template
	imports       *common.DirectImportMap
	typeFormatter *typeFormatter

	apiRefCollector *common.APIReferenceCollector
}

func (jenny Builder) JennyName() string {
	return "Builder"
}

func (jenny Builder) Generate(context languages.Context) (codejen.Files, error) {
	files := make(codejen.Files, 0)

	for _, builder := range context.Builders {
		output, err := jenny.genBuilder(context, builder)
		if err != nil {
			return nil, err
		}

		filename := filepath.Join(jenny.config.ProjectPath, formatPackageName(builder.Package), fmt.Sprintf("%sBuilder.java", jenny.getBuilderName(builder)))
		files = append(files, *codejen.NewFile(filename, output, jenny))
	}

	return files, nil
}

func (jenny Builder) genBuilder(context languages.Context, builder ast.Builder) ([]byte, error) {
	jenny.imports = NewImportMap(jenny.config.PackagePath)

	packageMapper := func(pkg string, class string) string {
		if jenny.imports.IsIdentical(pkg, builder.Package) {
			return ""
		}

		return jenny.imports.Add(class, pkg)
	}

	jenny.typeFormatter = createFormatter(context, jenny.config).withPackageMapper(packageMapper)

	object, _ := context.LocateObject(builder.For.SelfRef.ReferredPkg, builder.For.SelfRef.ReferredType)
	tmpl := BuilderTemplate{
		Package:              jenny.config.formatPackage(builder.Package),
		RawPackage:           builder.Package,
		Imports:              jenny.imports,
		ObjectName:           tools.UpperCamelCase(object.Name),
		BuilderName:          jenny.getBuilderName(builder),
		BuilderSignatureType: jenny.getBuilderSignature(builder.Package, object),
		Constructor:          builder.Constructor,
		Options:              builder.Options,
		Properties:           builder.Properties,
		ImportAlias:          jenny.config.PackagePath,
		IsGenericPanel:       jenny.isGenericPanel(builder),
	}

	jenny.apiRefCollector.BuilderMethod(builder, common.MethodReference{
		Name: "build",
		Comments: []string{
			"Builds the object.",
		},
		Return: tools.UpperCamelCase(builder.Name),
	})

	return jenny.tmpl.Funcs(map[string]any{
		"formatBuilderFieldType": jenny.typeFormatter.formatBuilderFieldType,
		"emptyValueForType": func(def ast.Type) string {
			return jenny.typeFormatter.emptyValueForType(def, true)
		},
		"typeHasBuilder":           jenny.typeFormatter.typeHasBuilder,
		"resolvesToComposableSlot": jenny.typeFormatter.resolvesToComposableSlot,
		"formatAssignmentPath":     jenny.typeFormatter.formatAssignmentPath,
		"formatPath":               jenny.typeFormatter.formatFieldPath,
		"formatRefType":            jenny.typeFormatter.formatRefType,
		"formatType":               jenny.typeFormatter.formatFieldType,
		"formatPathIndex":          jenny.typeFormatter.formatPathIndex,
	}).RenderAsBytes("builders/builder.tmpl", tmpl)
}

func (jenny Builder) getBuilderName(builder ast.Builder) string {
	if builder.For.SelfRef.ReferredPkg != builder.Package {
		return fmt.Sprintf("%s%s", tools.UpperCamelCase(builder.Package), tools.UpperCamelCase(builder.For.SelfRef.ReferredType))
	}

	return tools.UpperCamelCase(builder.Name)
}

func (jenny Builder) getBuilderSignature(pkg string, obj ast.Object) string {
	if pkg != obj.SelfRef.ReferredPkg {
		jenny.imports.Add(obj.SelfRef.ReferredType, obj.SelfRef.ReferredPkg)
	}

	if !obj.Type.IsDataqueryVariant() {
		return obj.Name
	}

	return fmt.Sprintf("%s.%s", jenny.config.formatPackage("cog.variants"), tools.UpperCamelCase(obj.Type.ImplementedVariant()))
}

func (jenny Builder) isGenericPanel(builder ast.Builder) bool {
	if builder.Package != builder.For.SelfRef.ReferredPkg {
		return false
	}

	// TODO: remove this once we have a better way to identify generic builders
	dashboardLegacy := builder.Package == "dashboard" && builder.Name == "Panel"
	dashboardv2VizConfig := builder.Package == "dashboardv2beta1" && builder.Name == "VizConfigKind"
	dashboardv2DataQueryKind := builder.Package == "dashboardv2beta1" && builder.Name == "DataQueryKind"
	return dashboardLegacy || dashboardv2VizConfig || dashboardv2DataQueryKind
}
