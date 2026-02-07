package golang

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/jennies/common"
)

func NewImportMap(packageRoot string) *common.DirectImportMap {
	return common.NewDirectImportMap(
		common.WithAliasSanitizer[common.DirectImportMap](formatPackageName),
		common.WithImportPathSanitizer[common.DirectImportMap](strings.ToLower),
		common.WithFormatter(func(importMap common.DirectImportMap) string {
			if importMap.Imports.Len() == 0 {
				return ""
			}

			statements := make([]string, 0, importMap.Imports.Len())
			importMap.Imports.Iterate(func(alias string, importPath string) {
				if strings.HasPrefix(importPath, packageRoot) {
					statements = append(statements, fmt.Sprintf(`	%s "%s"`, alias, importPath))
				} else { // stdlib import
					statements = append(statements, fmt.Sprintf(`	"%s"`, importPath))
				}
			})

			return fmt.Sprintf(`import (
%[1]s
)`, strings.Join(statements, "\n"))
		}),
	)
}
