package codegen

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/cog/internal/ast"
)

type KindRegistryInput struct {
	InputBase `yaml:",inline"`

	Path    string `yaml:"path"`
	Version string `yaml:"version"`
}

func (input *KindRegistryInput) interpolateParameters(interpolator ParametersInterpolator) {
	input.InputBase.interpolateParameters(interpolator)

	input.Path = interpolator(input.Path)
	input.Version = interpolator(input.Version)
}

func (input *KindRegistryInput) LoadSchemas(_ context.Context) (ast.Schemas, error) {
	var allSchemas ast.Schemas
	var cueImports []string
	var cueEntrypoints []string

	if input.Path == "" {
		return nil, nil
	}

	coreKindEntrypoints, err := locateEntrypoints(input, "core")
	if err != nil {
		return nil, fmt.Errorf("could not locate core kind entrypoints: %w", err)
	}

	composableKindEntrypoints, err := locateEntrypoints(input, "composable")
	if err != nil {
		return nil, fmt.Errorf("could not locate composable kind entrypoints: %w", err)
	}

	commonPkgPath := kindRegistryKindPath(input, "common")
	commonPkgExists, err := dirExists(commonPkgPath)
	if err != nil {
		return nil, fmt.Errorf("could not locate common package: %w", err)
	}
	if commonPkgExists {
		cueEntrypoints = append(cueEntrypoints, commonPkgPath)
		cueImports = append(cueImports, fmt.Sprintf("%s:%s", commonPkgPath, "github.com/grafana/grafana/packages/grafana-schema/src/common"))
	}

	kindLoader := func(loader func(input CueInput) (ast.Schemas, error), entrypoints []string) error {
		for _, entrypoint := range entrypoints {
			schemas, err := loader(CueInput{
				InputBase:  input.InputBase,
				Entrypoint: entrypoint,
				CueImports: cueImports,
			})
			if err != nil {
				return err
			}
			allSchemas = append(allSchemas, schemas...)
		}

		return nil
	}

	// CUE entrypoints
	if err := kindLoader(cueLoader, cueEntrypoints); err != nil {
		return nil, err
	}

	// Core kinds
	if err := kindLoader(kindsysCoreLoader, coreKindEntrypoints); err != nil {
		return nil, err
	}

	// Composable kinds
	if err := kindLoader(kindsysComposableLoader, composableKindEntrypoints); err != nil {
		return nil, err
	}

	return allSchemas, nil
}

func kindRegistryRoot(input *KindRegistryInput) string {
	return filepath.Join(input.Path, "grafana")
}

func kindRegistryKindPath(input *KindRegistryInput, kind string) string {
	return filepath.Join(kindRegistryRoot(input), input.Version, kind)
}

func locateEntrypoints(input *KindRegistryInput, kind string) ([]string, error) {
	directory := kindRegistryKindPath(input, kind)
	files, err := os.ReadDir(directory)
	if err != nil {
		return nil, fmt.Errorf("could not open directory '%s': %w", directory, err)
	}

	results := make([]string, 0, len(files))
	for _, file := range files {
		if !file.IsDir() {
			continue
		}

		results = append(results, filepath.Join(directory, file.Name()))
	}

	return results, nil
}
