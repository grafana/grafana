package typescript

import (
	"github.com/grafana/codejen"
	"github.com/grafana/cog/internal/languages"
)

type Runtime struct {
	config Config
}

func (jenny Runtime) JennyName() string {
	return "TypescriptRuntime"
}

func (jenny Runtime) Generate(_ languages.Context) (codejen.Files, error) {
	return codejen.Files{
		*codejen.NewFile(jenny.config.pathWithPrefix("cog/variants_gen.ts"), []byte(jenny.generateVariantsFile()), jenny),
		*codejen.NewFile(jenny.config.pathWithPrefix("cog/builder_gen.ts"), []byte(jenny.generateOptionsBuilderFile()), jenny),
		*codejen.NewFile(jenny.config.pathWithPrefix("cog/index.ts"), []byte(jenny.generateIndexFile()), jenny),
	}, nil
}

func (jenny Runtime) generateIndexFile() string {
	return `export * from './variants_gen';
export * from './builder_gen';
`
}

func (jenny Runtime) generateVariantsFile() string {
	return `export interface Dataquery {
	_implementsDataqueryVariant(): void;
}

`
}

func (jenny Runtime) generateOptionsBuilderFile() string {
	return `export interface Builder<T> {
  build: () => T;
}

export function isBuilder<T>(input: Builder<T> | any): input is Builder<T> {
  if (input === null) {
    return false;
  }
  if (!input?.build) {
    return false;
  }

  return typeof input.build === "function";
}
`
}
