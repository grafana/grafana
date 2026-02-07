// Copyright 2019 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package protobuf defines functionality for parsing protocol buffer
// definitions and instances.
//
// Proto definition mapping follows the guidelines of mapping Proto to JSON as
// discussed in https://developers.google.com/protocol-buffers/docs/proto3, and
// carries some of the mapping further when possible with CUE.
//
// # Package Paths
//
// If a .proto file contains a go_package directive, it will be used as the
// destination package fo the generated .cue files. A common use case is to
// generate the CUE in the same directory as the .proto definition. If a
// destination package is not within the current CUE module, it will be written
// relative to the pkg directory.
//
// If a .proto file does not specify go_package, it will convert a proto package
// "google.parent.sub" to the import path "googleapis.com/google/parent/sub".
// It is safe to mix package with and without a go_package within the same
// project.
//
// # Type Mappings
//
// The following type mappings of definitions apply:
//
//	Proto type     CUE type/def     Comments
//	message        struct           Message fields become CUE fields, whereby
//	                                names are mapped to lowerCamelCase.
//	enum           e1 | e2 | ...    Where ex are strings. A separate mapping is
//	                                generated to obtain the numeric values.
//	map<K, V>      { <>: V }        All keys are converted to strings.
//	repeated V     [...V]           null is accepted as the empty list [].
//	bool           bool
//	string         string
//	bytes          bytes            A base64-encoded string when converted to JSON.
//	int32, fixed32 int32            An integer with bounds as defined by int32.
//	uint32         uint32           An integer with bounds as defined by uint32.
//	int64, fixed64 int64            An integer with bounds as defined by int64.
//	uint64         uint64           An integer with bounds as defined by uint64.
//	float          float32          A number with bounds as defined by float32.
//	double         float64          A number with bounds as defined by float64.
//	Struct         struct           See struct.proto.
//	Value          _                See struct.proto.
//	ListValue      [...]            See struct.proto.
//	NullValue      null             See struct.proto.
//	BoolValue      bool             See struct.proto.
//	StringValue    string           See struct.proto.
//	NumberValue    number           See struct.proto.
//	StringValue    string           See struct.proto.
//	Empty          close({})
//	Timestamp      time.Time        See struct.proto.
//	Duration       time.Duration    See struct.proto.
//
// Protobuf definitions can be annotated with CUE constraints that are included
// in the generated CUE:
//
//	(cue.val)     string        CUE expression defining a constraint for this
//	                            field. The string may refer to other fields
//	                            in a message definition using their JSON name.
//
//	(cue.opt)     FieldOptions
//	   required   bool          Defines the field is required. Use with
//	                            caution.
package protobuf

// TODO mappings:
//
// Wrapper types	various types	2, "2", "foo", true, "true", null, 0, …	Wrappers use the same representation in JSON as the wrapped primitive type, except that null is allowed and preserved during data conversion and transfer.
// FieldMask	string	"f.fooBar,h"	See field_mask.proto.
//   Any            {"@type":"url",  See struct.proto.
//                   f1: value,
//                   ...}

import (
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/mpvl/unique"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/format"
	"cuelang.org/go/cue/parser"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"

	// Generated protobuf CUE may use builtins. Ensure that these can always be
	// found, even if the user does not use cue/load or another package that
	// triggers its loading.
	//
	// TODO: consider whether just linking in the necessary packages suffices.
	// It probably does, but this may reorder some of the imports, which may,
	// in turn, change the numbering, which can be confusing while debugging.
	_ "cuelang.org/go/pkg"
)

// Config specifies the environment into which to parse a proto definition file.
type Config struct {
	// Root specifies the root of the CUE project, which typically coincides
	// with, for example, a version control repository root or the Go module.
	// Any imports of proto files within the directory tree of this of this root
	// are considered to be "project files" and are generated at the
	// corresponding location with this hierarchy. Any other imports are
	// considered to be external. Files for such imports are rooted under the
	// $Root/pkg/, using the Go package path specified in the .proto file.
	Root string

	// Module is the Go package import path of the module root. It is the value
	// as after "module" in a cue.mod/modules.cue file, if a module file is
	// present.
	Module string // TODO: determine automatically if unspecified.

	// Paths defines the include directory in which to search for imports.
	Paths []string

	// PkgName specifies the package name for a generated CUE file. A value
	// will be derived from the Go package name if undefined.
	PkgName string

	// EnumMode defines whether enums should be set as integer values, instead
	// of strings.
	//
	//    json    value is a string, corresponding to the standard JSON mapping
	//            of Protobuf. The value is associated with a #enumValue
	//            to allow the json+pb interpretation to interpret integers
	//            as well.
	//
	//    int     value is an integer associated with an #enumValue definition
	//            The json+pb interpreter uses the definition names in the
	//            disjunction of the enum to interpret strings.
	//
	EnumMode string
}

// An Extractor converts a collection of proto files, typically belonging to one
// repo or module, to CUE. It thereby observes the CUE package layout.
//
// CUE observes the same package layout as Go and requires .proto files to have
// the go_package directive. Generated CUE files are put in the same directory
// as their corresponding .proto files if the .proto files are located in the
// specified Root (or current working directory if none is specified).
// All other imported files are assigned to the CUE pkg dir ($Root/pkg)
// according to their Go package import path.
type Extractor struct {
	root     string
	cwd      string
	module   string
	paths    []string
	pkgName  string
	enumMode string

	fileCache map[string]result
	imports   map[string]*build.Instance

	errs errors.Error
	done bool
}

type result struct {
	p   *protoConverter
	err error
}

// NewExtractor creates an Extractor. If the configuration contained any errors
// it will be observable by the Err method fo the Extractor. It is safe,
// however, to only check errors after building the output.
func NewExtractor(c *Config) *Extractor {
	cwd, _ := os.Getwd()
	b := &Extractor{
		root:      c.Root,
		cwd:       cwd,
		paths:     c.Paths,
		pkgName:   c.PkgName,
		module:    c.Module,
		enumMode:  c.EnumMode,
		fileCache: map[string]result{},
		imports:   map[string]*build.Instance{},
	}

	if b.root == "" {
		b.root = b.cwd
	}

	return b
}

// Err returns the errors accumulated during testing. The returned error may be
// of type cuelang.org/go/cue/errors.List.
func (b *Extractor) Err() error {
	return b.errs
}

func (b *Extractor) addErr(err error) {
	b.errs = errors.Append(b.errs, errors.Promote(err, "unknown error"))
}

// AddFile adds a proto definition file to be converted into CUE by the builder.
// Relatives paths are always taken relative to the Root with which the b is
// configured.
//
// AddFile assumes that the proto file compiles with protoc and may not report
// an error if it does not. Imports are resolved using the paths defined in
// Config.
func (b *Extractor) AddFile(filename string, src interface{}) error {
	if b.done {
		err := errors.Newf(token.NoPos,
			"protobuf: cannot call AddFile: Instances was already called")
		b.errs = errors.Append(b.errs, err)
		return err
	}
	if b.root != b.cwd && !filepath.IsAbs(filename) {
		filename = filepath.Join(b.root, filename)
	}
	_, err := b.parse(filename, src)
	return err
}

// TODO: some way of (recursively) adding multiple proto files with filter.

// Files returns a File for each proto file that was added or imported,
// recursively.
func (b *Extractor) Files() (files []*ast.File, err error) {
	defer func() { err = b.Err() }()
	b.done = true

	instances, err := b.Instances()
	if err != nil {
		return nil, err
	}

	for _, p := range instances {
		files = append(files, p.Files...)
	}
	return files, nil
}

// Instances creates a build.Instances for every package for which a proto file
// was added to the builder. This includes transitive dependencies. It does not
// write the generated files to disk.
//
// The returned instances can be passed to cue.Build to generated the
// corresponding CUE instances.
//
// All import paths are located within the specified Root, where external
// packages are located under $Root/pkg. Instances for builtin (like time)
// packages may be omitted, and if not will have no associated files.
func (b *Extractor) Instances() (instances []*build.Instance, err error) {
	defer func() { err = b.Err() }()
	b.done = true

	for _, r := range b.fileCache {
		if r.err != nil {
			b.addErr(r.err)
			continue
		}
		inst := b.getInst(r.p)
		if inst == nil {
			continue
		}

		// Set canonical CUE path for generated file.
		f := r.p.file
		base := filepath.Base(f.Filename)
		base = base[:len(base)-len(".proto")] + "_proto_gen.cue"
		f.Filename = filepath.Join(inst.Dir, base)
		buf, err := format.Node(f)
		if err != nil {
			b.addErr(err)
			// return nil, err
			continue
		}
		f, err = parser.ParseFile(f.Filename, buf, parser.ParseComments)
		if err != nil {
			b.addErr(err)
			continue
		}

		inst.Files = append(inst.Files, f)

		for pkg := range r.p.imported {
			inst.ImportPaths = append(inst.ImportPaths, pkg)
		}
	}

	for _, p := range b.imports {
		instances = append(instances, p)
		sort.Strings(p.ImportPaths)
		unique.Strings(&p.ImportPaths)
		for _, i := range p.ImportPaths {
			if imp := b.imports[i]; imp != nil {
				p.Imports = append(p.Imports, imp)
			}
		}

		sort.Slice(p.Files, func(i, j int) bool {
			return p.Files[i].Filename < p.Files[j].Filename
		})
	}
	sort.Slice(instances, func(i, j int) bool {
		return instances[i].ImportPath < instances[j].ImportPath
	})

	if err != nil {
		return instances, err
	}
	return instances, nil
}

func (b *Extractor) getInst(p *protoConverter) *build.Instance {
	if b.errs != nil {
		return nil
	}
	importPath := p.qualifiedImportPath()
	if importPath == "" {
		err := errors.Newf(token.NoPos,
			"no package clause for proto package %q in file %s", p.id, p.file.Filename)
		b.errs = errors.Append(b.errs, err)
		// TODO: find an alternative. Is proto package good enough?
		return nil
	}

	dir := b.root
	path := p.importPath()
	file := p.file.Filename
	if !filepath.IsAbs(file) {
		file = filepath.Join(b.root, p.file.Filename)
	}
	// Determine whether the generated file should be included in place, or
	// within cue.mod.
	inPlace := strings.HasPrefix(file, b.root)
	if !strings.HasPrefix(path, b.module) {
		// b.module is either "", in which case we assume the setting for
		// inPlace, or not, in which case the module in the protobuf must
		// correspond with that of the proto package.
		inPlace = false
	}
	if !inPlace {
		dir = filepath.Join(internal.GenPath(dir), path)
	} else {
		dir = filepath.Dir(p.file.Filename)
	}

	// TODO: verify module name from go_package option against that of actual
	// CUE module. Maybe keep this old code for some strict mode?
	// want := filepath.Dir(p.file.Filename)
	// dir = filepath.Join(dir, path[len(b.module)+1:])
	// if !filepath.IsAbs(want) {
	// 	want = filepath.Join(b.root, want)
	// }
	// if dir != want {
	// 	err := errors.Newf(token.NoPos,
	// 		"file %s mapped to inconsistent path %s; module name %q may be inconsistent with root dir %s",
	// 		want, dir, b.module, b.root,
	// 	)
	// 	b.errs = errors.Append(b.errs, err)
	// }

	inst := b.imports[importPath]
	if inst == nil {
		inst = &build.Instance{
			Root:        b.root,
			Dir:         dir,
			ImportPath:  importPath,
			PkgName:     p.shortPkgName,
			DisplayPath: p.protoPkg,
		}
		b.imports[importPath] = inst
	}
	return inst
}

// Extract parses a single proto file and returns its contents translated to a CUE
// file. If src is not nil, it will use this as the contents of the file. It may
// be a string, []byte or io.Reader. Otherwise Extract will open the given file
// name at the fully qualified path.
//
// Extract assumes the proto file compiles with protoc and may not report an error
// if it does not. Imports are resolved using the paths defined in Config.
func Extract(filename string, src interface{}, c *Config) (f *ast.File, err error) {
	if c == nil {
		c = &Config{}
	}
	b := NewExtractor(c)

	p, err := b.parse(filename, src)
	if err != nil {
		return nil, err
	}
	p.file.Filename = filename[:len(filename)-len(".proto")] + "_gen.cue"
	return p.file, b.Err()
}

// TODO
// func GenDefinition

// func MarshalText(cue.Value) (string, error) {
// 	return "", nil
// }

// func MarshalBytes(cue.Value) ([]byte, error) {
// 	return nil, nil
// }

// func UnmarshalText(descriptor cue.Value, b string) (ast.Expr, error) {
// 	return nil, nil
// }

// func UnmarshalBytes(descriptor cue.Value, b []byte) (ast.Expr, error) {
// 	return nil, nil
// }
