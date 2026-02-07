package typescript

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/jennies/common"
	"github.com/grafana/cog/internal/tools"
)

func NewImportMap(packagesImportMap map[string]string) *common.DirectImportMap {
	return common.NewDirectImportMap(
		common.WithPackagesImportMap[common.DirectImportMap](packagesImportMap),
		common.WithAliasSanitizer[common.DirectImportMap](formatPackageName),
		common.WithImportPathSanitizer[common.DirectImportMap](func(importPath string) string {
			parts := strings.Split(importPath, "/")

			return strings.Join(tools.Map(parts, func(input string) string {
				if input == ".." {
					return input
				}

				return formatPackageName(input)
			}), "/")
		}),
		common.WithFormatter(func(importMap common.DirectImportMap) string {
			if importMap.Imports.Len() == 0 {
				return ""
			}

			statements := make([]string, 0, importMap.Imports.Len())
			importMap.Imports.Iterate(func(alias string, importPath string) {
				statements = append(statements, fmt.Sprintf(`import * as %s from '%s';`, alias, importPath))
			})

			return strings.Join(statements, "\n") + "\n"
		}),
	)
}
