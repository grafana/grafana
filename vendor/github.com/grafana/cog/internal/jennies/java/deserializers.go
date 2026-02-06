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

type Deserializers struct {
	config        Config
	tmpl          *template.Template
	imports       *common.DirectImportMap
	typeFormatter *typeFormatter
	packageMapper func(pkg string, class string) string
}

func (jenny *Deserializers) JennyName() string {
	return "JavaDeserializers"
}

func (jenny *Deserializers) Generate(context languages.Context) (codejen.Files, error) {
	jenny.imports = NewImportMap(jenny.config.PackagePath)
	jenny.typeFormatter = createFormatter(context, jenny.config)
	jenny.tmpl = jenny.tmpl.
		Funcs(common.TypeResolvingTemplateHelpers(context)).
		Funcs(template.FuncMap{
			"importPkg":  jenny.config.formatPackage,
			"formatType": jenny.typeFormatter.formatFieldType,
		})

	deserialisers := make(codejen.Files, 0)
	for _, schema := range context.Schemas {
		var hasErr error
		schema.Objects.Iterate(func(key string, obj ast.Object) {
			jenny.packageMapper = func(pkg string, class string) string {
				if jenny.imports.IsIdentical(pkg, schema.Package) {
					return ""
				}

				return jenny.imports.Add(class, pkg)
			}
			jenny.typeFormatter.withPackageMapper(jenny.packageMapper)
			jenny.tmpl = jenny.tmpl.Funcs(template.FuncMap{
				"importStdPkg": jenny.packageMapper,
			})

			if objectNeedsCustomDeserializer(context, obj, jenny.tmpl) {
				f, err := jenny.genCustomDeserialiser(context, obj)
				if err != nil {
					hasErr = err
				} else {
					deserialisers = append(deserialisers, *f)
				}
			}
		})
		if hasErr != nil {
			return nil, hasErr
		}
	}

	return deserialisers, nil
}

func (jenny *Deserializers) genCustomDeserialiser(context languages.Context, obj ast.Object) (*codejen.File, error) {
	customUnmarshalTmpl := template.CustomObjectUnmarshalBlock(obj)
	if jenny.tmpl.Exists(customUnmarshalTmpl) {
		rendered, err := jenny.tmpl.RenderAsBytes(customUnmarshalTmpl, map[string]any{
			"Object": obj,
		})

		if err != nil {
			return nil, err
		}

		path := filepath.Join(jenny.config.ProjectPath, obj.SelfRef.ReferredPkg, fmt.Sprintf("%sDeserializer.java", tools.UpperCamelCase(obj.SelfRef.ReferredType)))
		return codejen.NewFile(path, rendered, jenny), nil
	}

	if obj.Type.IsStruct() && obj.Type.HasHint(ast.HintDisjunctionOfScalars) {
		return jenny.genDisjunctionsDeserializer(obj, "disjunctions_of_scalars")
	}

	if obj.Type.IsStruct() && obj.Type.HasHint(ast.HintDiscriminatedDisjunctionOfRefs) {
		return jenny.genDisjunctionsDeserializer(obj, "disjunctions_of_refs")
	}

	if obj.Type.IsStruct() && obj.Type.HasHint(ast.HintDisjunctionOfScalarsAndRefs) {
		return jenny.genDisjunctionsDeserializer(obj, "disjunctions_of_scalars_and_refs")
	}

	// TODO(kgz): this shouldn't be done by cog
	return jenny.genDataqueryDeserialiser(context, obj)
}

// TODO(kgz): this shouldn't be done by cog
func (jenny *Deserializers) genDataqueryDeserialiser(context languages.Context, obj ast.Object) (*codejen.File, error) {
	jenny.packageMapper("cog.variants", "Dataquery")
	jenny.packageMapper("cog.variants", "Registry")

	if obj.SelfRef.ReferredPkg == "dashboard" && obj.Name == "Panel" {
		jenny.packageMapper("cog.variants", "PanelConfig")
	}

	rendered, err := jenny.tmpl.Render("marshalling/unmarshalling.tmpl", Unmarshalling{
		Package:                   jenny.config.formatPackage(obj.SelfRef.ReferredPkg),
		Name:                      obj.Name,
		ShouldUnmarshallingPanels: obj.SelfRef.ReferredPkg == "dashboard" && obj.Name == "Panel",
		Imports:                   jenny.imports,
		Fields:                    obj.Type.AsStruct().Fields,
		DataqueryUnmarshalling:    jenny.genDataqueryCode(context, obj),
	})
	if err != nil {
		return nil, err
	}

	path := filepath.Join(jenny.config.ProjectPath, obj.SelfRef.ReferredPkg, fmt.Sprintf("%sDeserializer.java", obj.SelfRef.ReferredType))
	return codejen.NewFile(path, []byte(rendered), jenny), nil
}

// TODO(kgz): this shouldn't be done by cog
func (jenny *Deserializers) genDataqueryCode(context languages.Context, obj ast.Object) []DataqueryUnmarshalling {
	dataqueryUnmarshalling := make([]DataqueryUnmarshalling, 0)
	for _, field := range obj.Type.AsStruct().Fields {
		composableSlotType, resolved := context.ResolveToComposableSlot(field.Type)
		if !resolved {
			continue
		}

		if composableSlotType.AsComposableSlot().Variant == ast.SchemaVariantDataQuery {
			dataqueryUnmarshalling = append(dataqueryUnmarshalling, jenny.renderUnmarshalDataqueryField(obj, field))
		}
	}

	return dataqueryUnmarshalling
}

// TODO(kgz): this shouldn't be done by cog
func (jenny *Deserializers) renderUnmarshalDataqueryField(obj ast.Object, field ast.StructField) DataqueryUnmarshalling {
	var hintField *ast.StructField
	for i, f := range obj.Type.AsStruct().Fields {
		if !f.Type.IsRef() {
			continue
		}

		if f.Type.AsRef().ReferredType != "DataSourceRef" {
			continue
		}

		hintField = &obj.Type.AsStruct().Fields[i]
		if obj.SelfRef.ReferredPkg != f.Type.AsRef().ReferredPkg {
			jenny.packageMapper(f.Type.AsRef().ReferredPkg, "DataSourceRef")
		}
	}

	dataqueryHint := `""`
	hintFieldName := ""
	if hintField != nil {
		hintFieldName = hintField.Name
		dataqueryHint = fmt.Sprintf("%s.datasource.type", tools.LowerCamelCase(obj.Name))
	}

	return DataqueryUnmarshalling{
		DataqueryHint:   dataqueryHint,
		IsArray:         field.Type.IsArray(),
		FieldName:       field.Name,
		DatasourceField: hintFieldName,
	}
}

func (jenny *Deserializers) genDisjunctionsDeserializer(obj ast.Object, tmpl string) (*codejen.File, error) {
	rendered, err := jenny.tmpl.Render(fmt.Sprintf("marshalling/%s.json_unmarshall.tmpl", tmpl), Unmarshalling{
		Package: jenny.config.formatPackage(obj.SelfRef.ReferredPkg),
		Imports: jenny.imports,
		Name:    tools.UpperCamelCase(obj.Name),
		Fields:  obj.Type.AsStruct().Fields,
		Hint:    obj.Type.Hints[ast.HintDiscriminatedDisjunctionOfRefs],
	})
	if err != nil {
		return nil, err
	}

	path := filepath.Join(jenny.config.ProjectPath, obj.SelfRef.ReferredPkg, fmt.Sprintf("%sDeserializer.java", tools.UpperCamelCase(obj.SelfRef.ReferredType)))
	return codejen.NewFile(path, []byte(rendered), jenny), nil
}
