// Copyright 2023 CUE Authors
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

package runtime

import (
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/format"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/core/walk"
)

// SetInterpreter sets the interpreter for interpretation of files marked with
// @extern(kind).
func (r *Runtime) SetInterpreter(i Interpreter) {
	if r.interpreters == nil {
		r.interpreters = map[string]Interpreter{}
	}
	r.interpreters[i.Kind()] = i
}

// TODO: consider also passing the top-level attribute to NewCompiler to allow
// passing default values.

// Interpreter defines an entrypoint for creating per-package interpreters.
type Interpreter interface {
	// NewCompiler creates a compiler for b and reports any errors.
	NewCompiler(b *build.Instance) (Compiler, errors.Error)

	// Kind returns the string to be used in the file-level @extern attribute.
	Kind() string
}

// A Compiler composes an adt.Builtin for an external function implementation.
type Compiler interface {
	// Compile creates a builtin for the given function name and attribute.
	// funcName is the name of the function to compile, taken from altName in
	// @extern(name=altName), or from the field name if that's not defined.
	// Other than "name", the fields in a are implementation specific.
	Compile(funcName string, a *internal.Attr) (*adt.Builtin, errors.Error)
}

// injectImplementations modifies v to include implementations of functions
// for fields associated with the @extern attributes.
func (r *Runtime) injectImplementations(b *build.Instance, v *adt.Vertex) (errs errors.Error) {
	if r.interpreters == nil {
		return nil
	}

	d := &externDecorator{
		runtime: r,
		pkg:     b,
	}

	for _, f := range b.Files {
		d.errs = errors.Append(d.errs, d.addFile(f))
	}

	for _, c := range v.Conjuncts {
		d.decorateConjunct(c.Elem())
	}

	return d.errs
}

// externDecorator locates extern attributes and calls the relevant interpreters
// to inject builtins.
//
// This is a two-pass algorithm: in the first pass, all ast.Files are processed
// to build an index from *ast.Fields to attributes. In the second phase, the
// corresponding adt.Fields are located in the ADT and decorated with the
// builtins.
type externDecorator struct {
	runtime *Runtime
	pkg     *build.Instance

	compilers map[string]Compiler
	fields    map[*ast.Field]fieldInfo

	errs errors.Error
}

type fieldInfo struct {
	file     *ast.File
	extern   string
	funcName string
	attrBody string
	attr     *ast.Attribute
}

// addFile finds injection points in the given ast.File for external
// implementations of Builtins.
func (d *externDecorator) addFile(f *ast.File) (errs errors.Error) {
	kind, pos, decls, err := findExternFileAttr(f)
	if len(decls) == 0 {
		return err
	}

	ok, err := d.initCompiler(kind, pos)
	if !ok {
		return err
	}

	return d.markExternFieldAttr(kind, decls)
}

// findExternFileAttr reports the extern kind of a file-level @extern(kind)
// attribute in f, the position of the corresponding attribute, and f's
// declarations from the package directive onwards. It's an error if more than
// one @extern attribute is found. decls == nil signals that this file should be
// skipped.
func findExternFileAttr(f *ast.File) (kind string, pos token.Pos, decls []ast.Decl, err errors.Error) {
	var (
		hasPkg   bool
		p        int
		fileAttr *ast.Attribute
	)

loop:
	for ; p < len(f.Decls); p++ {
		switch a := f.Decls[p].(type) {
		case *ast.Package:
			hasPkg = true
			break loop

		case *ast.Attribute:
			pos = a.Pos()
			key, body := a.Split()
			if key != "extern" {
				continue
			}
			fileAttr = a

			attr := internal.ParseAttrBody(a.Pos(), body)
			if attr.Err != nil {
				return "", pos, nil, attr.Err
			}
			k, err := attr.String(0)
			if err != nil {
				// Unreachable.
				return "", pos, nil, errors.Newf(a.Pos(), "%s", err)
			}

			if k == "" {
				return "", pos, nil, errors.Newf(a.Pos(),
					"interpreter name must be non-empty")
			}

			if kind != "" {
				return "", pos, nil, errors.Newf(a.Pos(),
					"only one file-level extern attribute allowed per file")

			}
			kind = k
		}
	}

	switch {
	case fileAttr == nil && !hasPkg:
		// Nothing to see here.
		return "", pos, nil, nil

	case fileAttr != nil && !hasPkg:
		return "", pos, nil, errors.Newf(fileAttr.Pos(),
			"extern attribute without package clause")

	case fileAttr == nil && hasPkg:
		// Check that there are no top-level extern attributes.
		for p++; p < len(f.Decls); p++ {
			x, ok := f.Decls[p].(*ast.Attribute)
			if !ok {
				continue
			}
			if key, _ := x.Split(); key == "extern" {
				err = errors.Append(err, errors.Newf(x.Pos(),
					"extern attribute must appear before package clause"))
			}
		}
		return "", pos, nil, err
	}

	return kind, pos, f.Decls[p:], nil
}

// initCompiler initializes the runtime for kind, if applicable. The pos
// argument represents the position of the file-level @extern attribute.
func (d *externDecorator) initCompiler(kind string, pos token.Pos) (ok bool, err errors.Error) {
	if c, ok := d.compilers[kind]; ok {
		return c != nil, nil
	}

	// initialize the compiler.
	if d.compilers == nil {
		d.compilers = map[string]Compiler{}
		d.fields = map[*ast.Field]fieldInfo{}
	}

	x := d.runtime.interpreters[kind]
	if x == nil {
		return false, errors.Newf(pos, "no interpreter defined for %q", kind)
	}

	c, err := x.NewCompiler(d.pkg)
	if err != nil {
		return false, err
	}

	d.compilers[kind] = c

	return c != nil, nil
}

// markExternFieldAttr collects all *ast.Fields with extern attributes into
// d.fields. Both of the following forms are allowed:
//
//	a: _ @extern(...)
//	a: { _, @extern(...) }
//
// consistent with attribute implementation recommendations.
func (d *externDecorator) markExternFieldAttr(kind string, decls []ast.Decl) (errs errors.Error) {
	var fieldStack []*ast.Field

	ast.Walk(&ast.File{Decls: decls}, func(n ast.Node) bool {
		switch x := n.(type) {
		case *ast.Field:
			fieldStack = append(fieldStack, x)

		case *ast.Attribute:
			key, body := x.Split()
			if key != "extern" {
				break
			}

			lastField := len(fieldStack) - 1
			if lastField < 0 {
				errs = errors.Append(errs, errors.Newf(x.Pos(),
					"extern attribute not associated with field"))
				return true
			}

			f := fieldStack[lastField]

			if _, ok := d.fields[f]; ok {
				errs = errors.Append(errs, errors.Newf(x.Pos(),
					"duplicate extern attributes"))
				return true
			}

			name, isIdent, err := ast.LabelName(f.Label)
			if err != nil || !isIdent {
				b, _ := format.Node(f.Label)
				errs = errors.Append(errs, errors.Newf(x.Pos(),
					"can only define functions for fields with identifier names, found %v", string(b)))
				return true
			}

			d.fields[f] = fieldInfo{
				extern:   kind,
				funcName: name,
				attrBody: body,
				attr:     x,
			}
		}

		return true

	}, func(n ast.Node) {
		switch n.(type) {
		case *ast.Field:
			fieldStack = fieldStack[:len(fieldStack)-1]
		}
	})

	return errs
}

func (d *externDecorator) decorateConjunct(e adt.Elem) {
	w := walk.Visitor{Before: d.processADTNode}
	w.Elem(e)
}

// processADTNode injects a builtin conjunct into n if n is an adt.Field and
// has a marked ast.Field associated with it.
func (d *externDecorator) processADTNode(n adt.Node) bool {
	f, ok := n.(*adt.Field)
	if !ok {
		return true
	}

	info, ok := d.fields[f.Src]
	if !ok {
		return true
	}

	c, ok := d.compilers[info.extern]
	if !ok {
		// An error for a missing runtime was already reported earlier,
		// if applicable.
		return true
	}

	attr := internal.ParseAttrBody(info.attr.Pos(), info.attrBody)
	if attr.Err != nil {
		d.errs = errors.Append(d.errs, attr.Err)
		return true
	}
	name := info.funcName
	if str, ok, _ := attr.Lookup(1, "name"); ok {
		name = str
	}

	b, err := c.Compile(name, &attr)
	if err != nil {
		d.errs = errors.Append(d.errs, err)
		return true
	}

	f.Value = &adt.BinaryExpr{
		Op: adt.AndOp,
		X:  f.Value,
		Y:  b,
	}

	return true
}
