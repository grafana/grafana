package python

import (
	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
)

type Runtime struct {
	tmpl *template.Template
}

func (jenny Runtime) JennyName() string {
	return "PythonRuntime"
}

func (jenny Runtime) Generate(_ languages.Context) (codejen.Files, error) {
	builder, err := jenny.tmpl.RenderAsBytes("runtime/builder.tmpl", map[string]any{})
	if err != nil {
		return nil, err
	}

	encoder, err := jenny.tmpl.RenderAsBytes("runtime/encoder.tmpl", map[string]any{})
	if err != nil {
		return nil, err
	}

	return codejen.Files{
		*codejen.NewFile("cog/builder.py", builder, jenny),
		*codejen.NewFile("cog/encoder.py", encoder, jenny),
	}, nil
}
