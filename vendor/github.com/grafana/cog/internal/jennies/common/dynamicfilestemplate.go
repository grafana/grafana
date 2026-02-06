package common

import (
	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/jennies/template"
	"github.com/grafana/cog/internal/languages"
)

func DynamicFilesTemplateHelpers() template.FuncMap {
	return template.FuncMap{
		"declareFile": func(filePath string, content string) bool {
			panic("declareFile() needs to be overridden")
		},
	}
}

type DynamicFiles struct {
	Tmpl          *template.Template
	Data          map[string]any
	FuncsProvider func(context languages.Context) template.FuncMap
}

func (jenny DynamicFiles) JennyName() string {
	return "DynamicFiles"
}

func (jenny DynamicFiles) Generate(context languages.Context) (codejen.Files, error) {
	tmpl := jenny.Tmpl

	blockName := template.DynamicFilesBlock()
	if !jenny.Tmpl.Exists(blockName) {
		return nil, nil
	}

	if jenny.FuncsProvider != nil {
		tmpl = tmpl.Funcs(jenny.FuncsProvider(context))
	}

	var files codejen.Files
	tmpl = tmpl.Funcs(template.FuncMap{
		"declareFile": func(filePath string, content string) bool {
			files = append(files, codejen.File{
				RelativePath: filePath,
				Data:         []byte(content),
				From:         []codejen.NamedJenny{jenny},
			})
			return true
		},
	})

	for _, schema := range context.Schemas {
		data := map[string]any{
			"Schema": schema,
		}
		for k, v := range jenny.Data {
			data[k] = v
		}

		_, err := tmpl.Render(blockName, data)
		if err != nil {
			return nil, err
		}
	}

	return files, nil
}
