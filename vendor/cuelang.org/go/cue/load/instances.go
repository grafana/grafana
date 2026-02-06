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

// Files in package are to a large extent based on Go files from the following
// Go packages:
//    - cmd/go/internal/load
//    - go/build

import (
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/build"
	"cuelang.org/go/internal/filetypes"

	// Trigger the unconditional loading of all core builtin packages if load
	// is used. This was deemed the simplest way to avoid having to import
	// this line explicitly, and thus breaking existing code, for the majority
	// of cases, while not introducing an import cycle.
	_ "cuelang.org/go/pkg"
)

// Instances returns the instances named by the command line arguments 'args'.
// If errors occur trying to load an instance it is returned with Incomplete
// set. Errors directly related to loading the instance are recorded in this
// instance, but errors that occur loading dependencies are recorded in these
// dependencies.
func Instances(args []string, c *Config) []*build.Instance {
	if c == nil {
		c = &Config{}
	}
	newC, err := c.complete()
	if err != nil {
		return []*build.Instance{c.newErrInstance(err)}
	}
	c = newC
	tg := newTagger(c)
	l := newLoader(c, tg)

	if c.Context == nil {
		c.Context = build.NewContext(
			build.Loader(l.buildLoadFunc()),
			build.ParseFile(c.ParseFile),
		)
	}

	// TODO: require packages to be placed before files. At some point this
	// could be relaxed.
	i := 0
	for ; i < len(args) && filetypes.IsPackage(args[i]); i++ {
	}

	a := []*build.Instance{}

	if len(args) == 0 || i > 0 {
		for _, m := range l.importPaths(args[:i]) {
			if m.Err != nil {
				inst := c.newErrInstance(m.Err)
				a = append(a, inst)
				continue
			}
			a = append(a, m.Pkgs...)
		}
	}

	if args = args[i:]; len(args) > 0 {
		files, err := filetypes.ParseArgs(args)
		if err != nil {
			return []*build.Instance{c.newErrInstance(err)}
		}
		a = append(a, l.cueFilesPackage(files))
	}

	for _, p := range a {
		tags, err := findTags(p)
		if err != nil {
			p.ReportError(err)
		}
		tg.tags = append(tg.tags, tags...)
	}

	// TODO(api): have API call that returns an error which is the aggregate
	// of all build errors. Certain errors, like these, hold across builds.
	if err := tg.injectTags(c.Tags); err != nil {
		for _, p := range a {
			p.ReportError(err)
		}
		return a
	}

	if tg.replacements == nil {
		return a
	}

	for _, p := range a {
		for _, f := range p.Files {
			ast.Walk(f, nil, func(n ast.Node) {
				if ident, ok := n.(*ast.Ident); ok {
					if v, ok := tg.replacements[ident.Node]; ok {
						ident.Node = v
					}
				}
			})
		}
	}

	return a
}
