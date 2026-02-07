package typescript

import (
	"fmt"
	"strings"

	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/languages"
	"github.com/grafana/cog/internal/tools"
)

type Index struct {
	config  Config
	Targets languages.Config
}

func (jenny Index) JennyName() string {
	return "TypescriptIndex"
}

func (jenny Index) Generate(context languages.Context) (codejen.Files, error) {
	packages := make(map[string][]string, len(context.Schemas))
	files := codejen.Files{}

	if jenny.Targets.Types {
		for _, schema := range context.Schemas {
			packages[schema.Package] = []string{"types.gen"}
		}
	}

	if jenny.Targets.Builders {
		for _, builder := range context.Builders {
			packages[builder.Package] = append(packages[builder.Package], fmt.Sprintf("%sBuilder.gen", tools.LowerCamelCase(builder.Name)))
		}
	}

	for pkg, refs := range packages {
		filename := jenny.config.pathWithPrefix(formatPackageName(pkg), "index.ts")
		files = append(files, *codejen.NewFile(filename, jenny.generateIndex(refs), jenny))
	}

	return files, nil
}

func (jenny Index) generateIndex(refs []string) []byte {
	output := strings.Builder{}

	for _, ref := range refs {
		output.WriteString(fmt.Sprintf("export * from './%s';\n", ref))
		output.WriteString(fmt.Sprintf("export type * from './%s';\n", ref))
	}

	return []byte(output.String())
}
