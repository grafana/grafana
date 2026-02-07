package golang

import (
	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
)

type Runtime struct {
	Tmpl   *template.Template
	Config Config
}

func (jenny Runtime) JennyName() string {
	return "GoRuntime"
}

func (jenny Runtime) Generate(_ languages.Context) (codejen.Files, error) {
	tools, err := jenny.tools()
	if err != nil {
		return nil, err
	}

	files := []codejen.File{
		*codejen.NewFile("cog/errors.go", tools, jenny),
	}

	if jenny.Config.generateBuilders {
		files = append(files,
			*codejen.NewFile("cog/builder.go", jenny.builderInterface(), jenny),
		)
	}

	return files, nil
}

func (jenny Runtime) builderInterface() []byte {
	return []byte(`package cog

type Builder[ResourceT any] interface {
  Build() (ResourceT, error)
}

`)
}

func (jenny Runtime) tools() ([]byte, error) {
	return jenny.Tmpl.RenderAsBytes("runtime/tools.tmpl", map[string]any{})
}
