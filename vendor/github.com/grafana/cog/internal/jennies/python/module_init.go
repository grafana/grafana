package python

import (
	"fmt"

	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/languages"
)

type ModuleInit struct {
}

func (jenny ModuleInit) JennyName() string {
	return "PythonModuleInit"
}

func (jenny ModuleInit) Generate(context languages.Context) (codejen.Files, error) {
	files := make(codejen.Files, 0, len(context.Schemas)+2)

	files = append(files, *codejen.NewFile("__init__.py", jenny.module("root"), jenny))
	files = append(files, *codejen.NewFile("builders/__init__.py", jenny.module("builders"), jenny))
	files = append(files, *codejen.NewFile("models/__init__.py", jenny.module("models"), jenny))
	files = append(files, *codejen.NewFile("cog/__init__.py", jenny.module("runtime"), jenny))

	return files, nil
}

func (jenny ModuleInit) module(name string) []byte {
	return []byte(fmt.Sprintf(`"""%s module"""
`, name))
}
