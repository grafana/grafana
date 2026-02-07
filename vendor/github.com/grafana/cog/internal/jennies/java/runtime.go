package java

import (
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
)

type Runtime struct {
	config Config
	tmpl   *template.Template
}

func (jenny Runtime) JennyName() string {
	return "JavaRuntime"
}

func (jenny Runtime) Generate(_ languages.Context) (codejen.Files, error) {
	builder, err := jenny.renderBuilderInterface()
	if err != nil {
		return nil, err
	}

	files := codejen.Files{
		*codejen.NewFile(filepath.Join(jenny.config.ProjectPath, "cog/Builder.java"), []byte(builder), jenny),
	}

	if jenny.config.GenerateConverters {
		converter, err := jenny.renderConverterInterface()
		if err != nil {
			return nil, err
		}

		runtime, err := jenny.renderRuntime()
		if err != nil {
			return nil, err
		}

		files = append(files, *codejen.NewFile(filepath.Join(jenny.config.ProjectPath, "cog/Converter.java"), []byte(converter), jenny))
		files = append(files, *codejen.NewFile(filepath.Join(jenny.config.ProjectPath, "cog/Runtime.java"), []byte(runtime), jenny))
	}

	return files, nil
}

func (jenny Runtime) renderBuilderInterface() (string, error) {
	return jenny.tmpl.Render("runtime/builder.tmpl", map[string]any{
		"Package": jenny.config.formatPackage("cog"),
	})
}

func (jenny Runtime) renderConverterInterface() (string, error) {
	return jenny.tmpl.Render("runtime/converter_interface.tmpl", map[string]any{
		"Package": jenny.config.formatPackage("cog"),
	})
}

func (jenny Runtime) renderRuntime() (string, error) {
	return jenny.tmpl.Render("converters/converter_runtime.tmpl", map[string]any{
		"Package": jenny.config.formatPackage("cog"),
	})
}
