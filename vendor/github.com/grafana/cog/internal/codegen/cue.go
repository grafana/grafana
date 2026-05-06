package codegen

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"testing/fstest"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/cue/load"
	"github.com/grafana/cog/internal/ast"
	"github.com/grafana/cog/internal/simplecue"
	"github.com/grafana/cog/internal/tools"
	"github.com/yalue/merged_fs"
)

type genericCueLoader struct {
	*CueInput
	loader func(input CueInput) (ast.Schemas, error)
}

func (loader *genericCueLoader) LoadSchemas(_ context.Context) (ast.Schemas, error) {
	return loader.loader(*loader.CueInput)
}

type CueInput struct {
	InputBase `yaml:",inline"`

	// Entrypoint refers to a directory containing CUE files.
	Entrypoint string `yaml:"entrypoint"`

	// Value represents the CUE value to use as an input. If specified, it
	// supersedes the Entrypoint option.
	Value *cue.Value `yaml:"-"`

	// ForcedEnvelope decorates the parsed cue Value with an envelope whose
	// name is given. This is useful for dataqueries for example, where the
	// schema doesn't define any suitable top-level object.
	ForcedEnvelope string `yaml:"forced_envelope"`

	// Package name to use for the input schema. If empty, it will be guessed
	// from the entrypoint.
	Package string `yaml:"package"`

	// CueImports allows importing additional libraries.
	// Format: [path]:[import]. Example: '../grafana/common-library:github.com/grafana/grafana/packages/grafana-schema/src/common
	CueImports []string `yaml:"cue_imports"`

	// NameFunc allows users to specify an alternative naming strategy for
	// objects and references. It is called with the value passed to the top
	// level method or function and the path to the entity being parsed.
	NameFunc simplecue.NameFunc `yaml:"-"`

	// InlineExternalReference instructs the parser to follow external
	// references (ie: references to objects outside the current schema)
	// and inline them.
	// By default, external references are parsed as actual `ast.Ref` to the
	// external objects.
	InlineExternalReference bool `yaml:"-"`
}

func (input *CueInput) packageName() string {
	if input.Package != "" {
		return input.Package
	}

	return filepath.Base(input.Entrypoint)
}

func (input *CueInput) schemaRootValue(cuePkgName string) (cue.Value, []simplecue.LibraryInclude, error) {
	if input.Value != nil {
		return *input.Value, nil, nil
	}

	libraries, err := simplecue.ParseImports(input.CueImports)
	if err != nil {
		return cue.Value{}, nil, err
	}

	if cuePkgName == "" {
		cuePkgName = filepath.Base(input.Entrypoint)
	}

	value, err := parseCueEntrypoint(input.Entrypoint, libraries, cuePkgName)
	if err != nil {
		return cue.Value{}, nil, err
	}

	return value, libraries, nil
}

func (input *CueInput) interpolateParameters(interpolator ParametersInterpolator) {
	input.InputBase.interpolateParameters(interpolator)

	input.Entrypoint = interpolator(input.Entrypoint)
	input.CueImports = tools.Map(input.CueImports, interpolator)
}

func cueLoader(input CueInput) (ast.Schemas, error) {
	schemaRootValue, libraries, err := input.schemaRootValue("")
	if err != nil {
		return nil, err
	}

	schema, err := simplecue.GenerateAST(schemaRootValue, simplecue.Config{
		Package:                 input.packageName(),
		ForceNamedEnvelope:      input.ForcedEnvelope,
		SchemaMetadata:          input.schemaMetadata(),
		Libraries:               libraries,
		NameFunc:                input.NameFunc,
		InlineExternalReference: input.InlineExternalReference,
	})
	if err != nil {
		return nil, err
	}

	return input.filterSchema(schema)
}

func parseCueEntrypoint(entrypoint string, imports []simplecue.LibraryInclude, expectedCuePkgName string) (cue.Value, error) {
	cueFsOverlay, err := buildCueOverlay(imports, entrypoint, expectedCuePkgName)
	if err != nil {
		return cue.Value{}, fmt.Errorf("could not build cue overlay: %w", err)
	}

	// Load Cue files into Cue build.Instances slice
	bis := load.Instances([]string{"github.com/cog-vfs/" + expectedCuePkgName}, &load.Config{
		Overlay: cueFsOverlay,
		// Point cue to a directory defined by the cueFsOverlay as base directory
		// for import path resolution instead of using the current working directory.
		// This ensures that only files/schemas defined in the vfs will be parsed.
		Dir: "/cog/vfs",
	})

	value := cuecontext.New().BuildInstance(bis[0])
	if err := value.Err(); err != nil {
		return cue.Value{}, fmt.Errorf("could not build cue instance: %w", err)
	}

	return value, nil
}

func buildCueOverlay(imports []simplecue.LibraryInclude, entrypoint string, expectedCuePkgName string) (map[string]load.Source, error) {
	libFs, err := buildBaseFSWithLibraries(imports)
	if err != nil {
		return nil, err
	}

	entrypointFS, err := dirToPrefixedFS(entrypoint, "cog/vfs/cue.mod/pkg/github.com/cog-vfs/"+expectedCuePkgName)
	if err != nil {
		return nil, err
	}

	return toCueOverlay("/", merged_fs.MergeMultiple(
		libFs,
		buildMockKindsysFS(),
		entrypointFS,
	))
}

func buildMockKindsysFS() fs.FS {
	return fstest.MapFS{
		"cog/vfs/cue.mod/pkg/github.com/grafana/kindsys/composable.cue": &fstest.MapFile{
			Data: []byte(`package kindsys
Composable: {
	...
}`),
		},
		"cog/vfs/cue.mod/pkg/github.com/grafana/kindsys/core.cue": &fstest.MapFile{
			Data: []byte(`package kindsys
Core: {
	...
}`),
		},
		"cog/vfs/cue.mod/pkg/github.com/grafana/kindsys/custom.cue": &fstest.MapFile{
			Data: []byte(`package kindsys
Custom: {
	...
}`),
		},
		"cog/vfs/cue.mod/module.cue": &fstest.MapFile{
			Data: []byte(`language: {
	version: "v0.10.1"
}
module: "cog.vfs"
`),
		},
	}
}

func buildBaseFSWithLibraries(imports []simplecue.LibraryInclude) (fs.FS, error) {
	var librariesFS []fs.FS
	for _, importDefinition := range imports {
		absPath, err := filepath.Abs(importDefinition.FSPath)
		if err != nil {
			return nil, err
		}

		libraryFS, err := dirToPrefixedFS(absPath, "cog/vfs/cue.mod/pkg/"+importDefinition.ImportPath)
		if err != nil {
			return nil, err
		}

		librariesFS = append(librariesFS, libraryFS)
	}

	return merged_fs.MergeMultiple(librariesFS...), nil
}

func dirToPrefixedFS(directory string, prefix string) (fs.FS, error) {
	dirHandle, err := os.ReadDir(directory)
	if err != nil {
		return nil, err
	}

	prefixedFS := fstest.MapFS{}
	for _, file := range dirHandle {
		if file.IsDir() {
			continue
		}

		content, err := os.ReadFile(filepath.Join(directory, file.Name()))
		if err != nil {
			return nil, err
		}

		prefixedFS[filepath.Join(prefix, file.Name())] = &fstest.MapFile{Data: content}
	}

	return prefixedFS, nil
}

// ToOverlay converts a fs.FS into a CUE loader overlay.
func toCueOverlay(prefix string, vfs fs.FS) (map[string]load.Source, error) {
	// TODO why not just stick the prefix on automatically...?
	if !filepath.IsAbs(prefix) {
		return nil, fmt.Errorf("must provide absolute path prefix when generating cue overlay, got %q", prefix)
	}

	overlay := make(map[string]load.Source)
	err := fs.WalkDir(vfs, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		b, err := fs.ReadFile(vfs, path)
		if err != nil {
			return err
		}

		overlay[filepath.Join(prefix, path)] = load.FromBytes(b)

		return nil
	})

	return overlay, err
}
