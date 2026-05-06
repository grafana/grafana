// Copyright 2018 The CUE Authors
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

package load

import (
	"io"
	"os"
	"path/filepath"
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
)

const (
	cueSuffix  = ".cue"
	modDir     = "cue.mod"
	moduleFile = "module.cue"
	pkgDir     = "pkg"
)

// FromArgsUsage is a partial usage message that applications calling
// FromArgs may wish to include in their -help output.
//
// Some of the aspects of this documentation, like flags and handling '--' need
// to be implemented by the tools.
const FromArgsUsage = `
<args> is a list of arguments denoting a set of instances of the form:

   <package>* <file_args>*

1. A list of source files

   CUE files are parsed, loaded and unified into a single instance. All files
   must have the same package name.

   Data files, like YAML or JSON, are handled in one of two ways:

   a. Explicitly mapped into a single CUE namespace, using the --path, --files
      and --list flags. In this case these are unified into a single instance
      along with any other CUE files.

   b. Treated as a stream of data elements that each is optionally unified with
      a single instance, which either consists of the other CUE files specified
       on the command line or a single package.

   By default, the format of files is derived from the file extension.
   This behavior may be modified with file arguments of the form <qualifiers>:
   For instance,

      cue eval foo.cue json: bar.data

   indicates that the bar.data file should be interpreted as a JSON file.
   A qualifier applies to all files following it until the next qualifier.

   The following qualifiers are available:

      encodings
      cue           CUE definitions and data
      json          JSON data, one value only
      jsonl         newline-separated JSON values
      yaml          a YAML file, may contain a stream
      proto         Protobuf definitions

      interpretations
      jsonschema   data encoding describes JSON Schema
      openapi      data encoding describes Open API

      formats
      data         output as -- or only accept -- data
      graph        data allowing references or anchors
      schema       output as schema; defaults JSON files to JSON Schema
      def          full definitions, including documentation

2. A list of relative directories to denote a package instance.

   Each directory matching the pattern is loaded as a separate instance.
   The instance contains all files in this directory and ancestor directories,
   up to the module root, with the same package name. The package name must
   be either uniquely determined by the files in the given directory, or
   explicitly defined using a package name qualifier. For instance, ./...:foo
   selects all packages named foo in the any subdirectory of the current
   working directory.

3. An import path referring to a directory within the current module

   All CUE files in that directory, and all the ancestor directories up to the
   module root (if applicable), with a package name corresponding to the base
   name of the directory or the optional explicit package name are loaded into
   a single instance.

   Examples, assume a module name of acme.org/root:
      mod.test/foo   package in cue.mod
      ./foo             package corresponding to foo directory
      .:bar             package in current directory with package name bar
`

// GenPath reports the directory in which to store generated
// files.
func GenPath(root string) string {
	return internal.GenPath(root)
}

// A Config configures load behavior.
type Config struct {
	// TODO: allow passing a cuecontext to be able to lookup and verify builtin
	// packages at loading time.

	// Context specifies the context for the load operation.
	// If the context is cancelled, the loader may stop early
	// and return an ErrCancelled error.
	// If Context is nil, the load cannot be cancelled.
	Context *build.Context

	// A Module is a collection of packages and instances that are within the
	// directory hierarchy rooted at the module root. The module root can be
	// marked with a cue.mod file.
	ModuleRoot string

	// Module specifies the module prefix. If not empty, this value must match
	// the module field of an existing cue.mod file.
	Module string

	// modFile holds the contents of the module file, or nil
	// if no module file was present. If non-nil, then
	// after calling Config.complete, modFile.Module will be
	// equal to Module.
	modFile *modFile

	// Package defines the name of the package to be loaded. If this is not set,
	// the package must be uniquely defined from its context. Special values:
	//    _    load files without a package
	//    *    load all packages. Files without packages are loaded
	//         in the _ package.
	Package string

	// Dir is the base directory for import path resolution.
	// For example, it is used to determine the main module,
	// and rooted import paths starting with "./" are relative to it.
	// If Dir is empty, the current directory is used.
	Dir string

	// Tags defines boolean tags or key-value pairs to select files to build
	// or be injected as values in fields.
	//
	// Each string is of the form
	//
	//     key [ "=" value ]
	//
	// where key is a valid CUE identifier and value valid CUE scalar.
	//
	// The Tags values are used to both select which files get included in a
	// build and to inject values into the AST.
	//
	//
	// File selection
	//
	// Files with an attribute of the form @if(expr) before a package clause
	// are conditionally included if expr resolves to true, where expr refers to
	// boolean values in Tags.
	//
	// It is an error for a file to have more than one @if attribute or to
	// have a @if attribute without or after a package clause.
	//
	//
	// Value injection
	//
	// The Tags values are also used to inject values into fields with a
	// @tag attribute.
	//
	// For any field of the form
	//
	//    field: x @tag(key)
	//
	// and Tags value for which the name matches key, the field will be
	// modified to
	//
	//   field: x & "value"
	//
	// By default, the injected value is treated as a string. Alternatively, a
	// "type" option of the @tag attribute allows a value to be interpreted as
	// an int, number, or bool. For instance, for a field
	//
	//    field: x @tag(key,type=int)
	//
	// an entry "key=2" modifies the field to
	//
	//    field: x & 2
	//
	// Valid values for type are "int", "number", "bool", and "string".
	//
	// A @tag attribute can also define shorthand values, which can be injected
	// into the fields without having to specify the key. For instance, for
	//
	//    environment: string @tag(env,short=prod|staging)
	//
	// the Tags entry "prod" sets the environment field to the value "prod".
	// This is equivalent to a Tags entry of "env=prod".
	//
	// The use of @tag does not preclude using any of the usual CUE constraints
	// to limit the possible values of a field. For instance
	//
	//    environment: "prod" | "staging" @tag(env,short=prod|staging)
	//
	// ensures the user may only specify "prod" or "staging".
	Tags []string

	// TagVars defines a set of key value pair the values of which may be
	// referenced by tags.
	//
	// Use DefaultTagVars to get a pre-loaded map with supported values.
	TagVars map[string]TagVar

	// Include all files, regardless of tags.
	AllCUEFiles bool

	// Deprecated: use Tags
	BuildTags   []string
	releaseTags []string

	// If Tests is set, the loader includes not just the packages
	// matching a particular pattern but also any related test packages.
	Tests bool

	// If Tools is set, the loader includes tool files associated with
	// a package.
	Tools bool

	// filesMode indicates that files are specified
	// explicitly on the command line.
	filesMode bool

	// If DataFiles is set, the loader includes entries for directories that
	// have no CUE files, but have recognized data files that could be converted
	// to CUE.
	DataFiles bool

	// StdRoot specifies an alternative directory for standard libaries.
	// This is mostly used for bootstrapping.
	StdRoot string

	// ParseFile is called to read and parse each file when preparing a
	// package's syntax tree. It must be safe to call ParseFile simultaneously
	// from multiple goroutines. If ParseFile is nil, the loader will uses
	// parser.ParseFile.
	//
	// ParseFile should parse the source from src and use filename only for
	// recording position information.
	//
	// An application may supply a custom implementation of ParseFile to change
	// the effective file contents or the behavior of the parser, or to modify
	// the syntax tree.
	ParseFile func(name string, src interface{}) (*ast.File, error)

	// Overlay provides a mapping of absolute file paths to file contents.  If
	// the file with the given path already exists, the parser will use the
	// alternative file contents provided by the map.
	Overlay map[string]Source

	// Stdin defines an alternative for os.Stdin for the file "-". When used,
	// the corresponding build.File will be associated with the full buffer.
	Stdin io.Reader

	fileSystem
}

func (c *Config) stdin() io.Reader {
	if c.Stdin == nil {
		return os.Stdin
	}
	return c.Stdin
}

func toImportPath(dir string) importPath {
	return importPath(filepath.ToSlash(dir))
}

type importPath string

type fsPath string

func addImportQualifier(pkg importPath, name string) (importPath, errors.Error) {
	if name != "" {
		s := string(pkg)
		if i := strings.LastIndexByte(s, '/'); i >= 0 {
			s = s[i+1:]
		}
		if i := strings.LastIndexByte(s, ':'); i >= 0 {
			// should never happen, but just in case.
			s = s[i+1:]
			if s != name {
				return "", errors.Newf(token.NoPos,
					"non-matching package names (%s != %s)", s, name)
			}
		} else if s != name {
			pkg += importPath(":" + name)
		}
	}

	return pkg, nil
}

// absDirFromImportPath converts a giving import path to an absolute directory
// and a package name. The root directory must be set.
//
// The returned directory may not exist.
func (c *Config) absDirFromImportPath(pos token.Pos, p importPath) (absDir, name string, err errors.Error) {
	if c.ModuleRoot == "" {
		return "", "", errors.Newf(pos, "cannot import %q (root undefined)", p)
	}

	// Extract the package name.

	name = string(p)
	switch i := strings.LastIndexAny(name, "/:"); {
	case i < 0:
	case p[i] == ':':
		name = string(p[i+1:])
		p = p[:i]

	default: // p[i] == '/'
		name = string(p[i+1:])
	}

	// TODO: fully test that name is a valid identifier.
	if name == "" {
		err = errors.Newf(pos, "empty package name in import path %q", p)
	} else if strings.IndexByte(name, '.') >= 0 {
		err = errors.Newf(pos,
			"cannot determine package name for %q (set explicitly with ':')", p)
	}

	// Determine the directory.

	sub := filepath.FromSlash(string(p))
	switch hasPrefix := strings.HasPrefix(string(p), c.Module); {
	case hasPrefix && len(sub) == len(c.Module):
		absDir = c.ModuleRoot

	case hasPrefix && p[len(c.Module)] == '/':
		absDir = filepath.Join(c.ModuleRoot, sub[len(c.Module)+1:])

	default:
		absDir = filepath.Join(GenPath(c.ModuleRoot), sub)
	}

	return absDir, name, err
}

// Complete updates the configuration information. After calling complete,
// the following invariants hold:
//   - c.Dir is an absolute path.
//   - c.ModuleRoot is an absolute path
//   - c.Module is set to the module import prefix if there is a cue.mod file
//     with the module property.
//   - c.loader != nil
//   - c.cache != ""
//
// It does not initialize c.Context, because that requires the
// loader in order to use for build.Loader.
func (c Config) complete() (cfg *Config, err error) {
	// Each major CUE release should add a tag here.
	// Old tags should not be removed. That is, the cue1.x tag is present
	// in all releases >= CUE 1.x. Code that requires CUE 1.x or later should
	// say "+build cue1.x", and code that should only be built before CUE 1.x
	// (perhaps it is the stub to use in that case) should say "+build !cue1.x".
	c.releaseTags = []string{"cue0.1"}

	if c.Dir == "" {
		c.Dir, err = os.Getwd()
		if err != nil {
			return nil, err
		}
	} else if c.Dir, err = filepath.Abs(c.Dir); err != nil {
		return nil, err
	}

	// TODO: we could populate this already with absolute file paths,
	// but relative paths cannot be added. Consider what is reasonable.
	if err := c.fileSystem.init(&c); err != nil {
		return nil, err
	}

	// TODO: determine root on a package basis. Maybe we even need a
	// pkgname.cue.mod
	// Look to see if there is a cue.mod.
	if c.ModuleRoot == "" {
		// Only consider the current directory by default
		c.ModuleRoot = c.Dir
		if root := c.findRoot(c.Dir); root != "" {
			c.ModuleRoot = root
		}
	} else if !filepath.IsAbs(c.ModuleRoot) {
		c.ModuleRoot = filepath.Join(c.Dir, c.ModuleRoot)
	}
	if err := c.loadModule(); err != nil {
		return nil, err
	}
	return &c, nil
}

func (c Config) isRoot(dir string) bool {
	fs := &c.fileSystem
	// Note: cue.mod used to be a file. We still allow both to match.
	_, err := fs.stat(filepath.Join(dir, modDir))
	return err == nil
}

// findRoot returns the module root that's ancestor
// of the given absolute directory path, or "" if none was found.
func (c Config) findRoot(absDir string) string {
	fs := &c.fileSystem

	abs := absDir
	for {
		if c.isRoot(abs) {
			return abs
		}
		d := filepath.Dir(abs)
		if filepath.Base(filepath.Dir(abs)) == modDir {
			// The package was located within a "cue.mod" dir and there was
			// not cue.mod found until now. So there is no root.
			return ""
		}
		if len(d) >= len(abs) {
			break // reached top of file system, no cue.mod
		}
		abs = d
	}
	abs = absDir

	// TODO(legacy): remove this capability at some point.
	for {
		info, err := fs.stat(filepath.Join(abs, pkgDir))
		if err == nil && info.IsDir() {
			return abs
		}
		d := filepath.Dir(abs)
		if len(d) >= len(abs) {
			return "" // reached top of file system, no pkg dir.
		}
		abs = d
	}
}

func (c *Config) newErrInstance(err error) *build.Instance {
	i := c.Context.NewInstance("", nil)
	i.Root = c.ModuleRoot
	i.Module = c.Module
	i.Err = errors.Promote(err, "instance")
	return i
}
