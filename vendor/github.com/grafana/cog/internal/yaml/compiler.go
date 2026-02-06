package yaml

import (
	"io"
	"os"

	"github.com/grafana/cog/internal/ast/compiler"
	"gopkg.in/yaml.v3"
)

type Compiler struct {
	Passes []CompilerPass `yaml:"passes"`
}

type CompilerLoader struct {
}

func NewCompilerLoader() *CompilerLoader {
	return &CompilerLoader{}
}

func (loader *CompilerLoader) PassesFrom(filenames []string) (compiler.Passes, error) {
	readers := make([]io.Reader, 0, len(filenames))
	for _, filename := range filenames {
		reader, err := os.Open(filename)
		if err != nil {
			return nil, err
		}

		readers = append(readers, reader)
	}

	return loader.LoadAll(readers)
}

func (loader *CompilerLoader) LoadAll(readers []io.Reader) (compiler.Passes, error) {
	allPasses := make(compiler.Passes, 0, len(readers))

	for _, reader := range readers {
		passes, err := loader.Load(reader)
		if err != nil {
			return nil, err
		}

		allPasses = append(allPasses, passes...)
	}

	return allPasses, nil
}

func (loader *CompilerLoader) Load(reader io.Reader) (compiler.Passes, error) {
	compilerConfig := &Compiler{}

	decoder := yaml.NewDecoder(reader)
	decoder.KnownFields(true)

	if err := decoder.Decode(&compilerConfig); err != nil {
		return nil, err
	}

	passes := make(compiler.Passes, 0, len(compilerConfig.Passes))

	// convert compiler passes
	for _, passConfig := range compilerConfig.Passes {
		pass, err := passConfig.AsCompilerPass()
		if err != nil {
			return nil, err
		}

		passes = append(passes, pass)
	}

	return passes, nil
}
