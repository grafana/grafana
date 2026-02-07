package php

import (
	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
)

type Runtime struct {
	config Config
	tmpl   *template.Template
}

func (jenny Runtime) JennyName() string {
	return "PHPRuntime"
}

func (jenny Runtime) Generate(_ languages.Context) (codejen.Files, error) {
	builderInterface, err := jenny.builderInterface()
	if err != nil {
		return nil, err
	}

	return codejen.Files{
		builderInterface,
	}, nil
}

func (jenny Runtime) builderInterface() (codejen.File, error) {
	rendered, err := jenny.tmpl.RenderAsBytes("runtime/builder.tmpl", map[string]any{
		"NamespaceRoot": jenny.config.NamespaceRoot,
	})
	if err != nil {
		return codejen.File{}, err
	}

	return *codejen.NewFile("src/Cog/Builder.php", rendered, jenny), nil
}
