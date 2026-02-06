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

package protobuf

import (
	"bytes"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"text/scanner"
	"unicode"

	"github.com/emicklei/proto"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/ast/astutil"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/parser"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/source"
)

func (s *Extractor) parse(filename string, src interface{}) (p *protoConverter, err error) {
	if filename == "" {
		return nil, errors.Newf(token.NoPos, "empty filename")
	}
	if r, ok := s.fileCache[filename]; ok {
		return r.p, r.err
	}
	defer func() {
		s.fileCache[filename] = result{p, err}
	}()

	b, err := source.Read(filename, src)
	if err != nil {
		return nil, err
	}

	parser := proto.NewParser(bytes.NewReader(b))
	if filename != "" {
		parser.Filename(filename)
	}
	d, err := parser.Parse()
	if err != nil {
		return nil, errors.Newf(token.NoPos, "protobuf: %v", err)
	}

	tfile := token.NewFile(filename, 0, len(b))
	tfile.SetLinesForContent(b)

	p = &protoConverter{
		id:       filename,
		state:    s,
		tfile:    tfile,
		imported: map[string]bool{},
		symbols:  map[string]bool{},
	}

	defer func() {
		switch x := recover().(type) {
		case nil:
		case protoError:
			err = &protobufError{
				path: p.path,
				pos:  p.toCUEPos(x.pos),
				err:  x.error,
			}
		default:
			panic(x)
		}
	}()

	p.file = &ast.File{Filename: filename}

	p.addNames(d.Elements)

	// Parse package definitions.
	for _, e := range d.Elements {
		switch x := e.(type) {
		case *proto.Package:
			p.protoPkg = x.Name
		case *proto.Option:
			if x.Name == "go_package" {
				str, err := strconv.Unquote(x.Constant.SourceRepresentation())
				if err != nil {
					failf(x.Position, "unquoting package filed: %v", err)
				}
				split := strings.Split(str, ";")
				switch {
				case strings.Contains(split[0], "."):
					p.cuePkgPath = split[0]
					switch len(split) {
					case 1:
						p.shortPkgName = path.Base(str)
					case 2:
						p.shortPkgName = split[1]
					default:
						failf(x.Position, "unexpected ';' in %q", str)
					}

				case len(split) == 1:
					p.shortPkgName = split[0]

				default:
					failf(x.Position, "malformed go_package clause %s", str)
				}
				// name.AddComment(comment(x.Comment, true))
				// name.AddComment(comment(x.InlineComment, false))
			}
		}
	}

	if name := p.shortName(); name != "" {
		p.file.Decls = append(p.file.Decls, &ast.Package{Name: ast.NewIdent(name)})
	}

	for _, e := range d.Elements {
		switch x := e.(type) {
		case *proto.Import:
			if err := p.doImport(x); err != nil {
				return nil, err
			}
		}
	}

	for _, e := range d.Elements {
		p.topElement(e)
	}

	err = astutil.Sanitize(p.file)

	return p, err
}

// A protoConverter converts a proto definition to CUE. Proto files map to
// CUE files one to one.
type protoConverter struct {
	state *Extractor
	tfile *token.File

	proto3 bool

	id           string
	protoPkg     string
	shortPkgName string
	cuePkgPath   string

	file    *ast.File
	current *ast.StructLit

	imported map[string]bool

	path    []string
	scope   []map[string]mapping // for symbols resolution within package.
	symbols map[string]bool      // symbols provided by package
}

type mapping struct {
	cue func() ast.Expr // needs to be a new copy as position changes
	pkg *protoConverter
}

func (p *protoConverter) qualifiedImportPath() string {
	s := p.importPath()
	if short := p.shortPkgName; short != "" && short != path.Base(s) {
		s += ":" + short
	}
	return s
}

func (p *protoConverter) importPath() string {
	if p.cuePkgPath == "" && p.protoPkg != "" {
		dir := strings.Replace(p.protoPkg, ".", "/", -1)
		p.cuePkgPath = path.Join("googleapis.com", dir)
	}
	return p.cuePkgPath
}

func (p *protoConverter) shortName() string {
	if p.state.pkgName != "" {
		return p.state.pkgName
	}
	if p.shortPkgName == "" && p.protoPkg != "" {
		split := strings.Split(p.protoPkg, ".")
		p.shortPkgName = split[len(split)-1]
	}
	return p.shortPkgName
}

func (p *protoConverter) toCUEPos(pos scanner.Position) token.Pos {
	return p.tfile.Pos(pos.Offset, 0)
}

func (p *protoConverter) addRef(pos scanner.Position, name string, cue func() ast.Expr) {
	top := p.scope[len(p.scope)-1]
	if _, ok := top[name]; ok {
		failf(pos, "entity %q already defined", name)
	}
	top[name] = mapping{cue: cue}
}

func (p *protoConverter) addNames(elems []proto.Visitee) {
	p.scope = append(p.scope, map[string]mapping{})
	for _, e := range elems {
		var pos scanner.Position
		var name string
		switch x := e.(type) {
		case *proto.Message:
			if x.IsExtend {
				continue
			}
			name = x.Name
			pos = x.Position
		case *proto.Enum:
			name = x.Name
			pos = x.Position
		case *proto.NormalField:
			name = x.Name
			pos = x.Position
		case *proto.MapField:
			name = x.Name
			pos = x.Position
		case *proto.Oneof:
			name = x.Name
			pos = x.Position
		default:
			continue
		}
		sym := strings.Join(append(p.path, name), ".")
		p.symbols[sym] = true
		p.addRef(pos, name, func() ast.Expr { return ast.NewIdent("#" + name) })
	}
}

func (p *protoConverter) popNames() {
	p.scope = p.scope[:len(p.scope)-1]
}

func (p *protoConverter) resolve(pos scanner.Position, name string, options []*proto.Option) ast.Expr {
	if expr := protoToCUE(name, options); expr != nil {
		ast.SetPos(expr, p.toCUEPos(pos))
		return expr
	}
	if strings.HasPrefix(name, ".") {
		return p.resolveTopScope(pos, name[1:], options)
	}
	for i := len(p.scope) - 1; i > 0; i-- {
		if m, ok := p.scope[i][name]; ok {
			return m.cue()
		}
	}
	expr := p.resolveTopScope(pos, name, options)
	return expr
}

func (p *protoConverter) resolveTopScope(pos scanner.Position, name string, options []*proto.Option) ast.Expr {
	for i := 0; i < len(name); i++ {
		k := strings.IndexByte(name[i:], '.')
		i += k
		if k == -1 {
			i = len(name)
		}
		if m, ok := p.scope[0][name[:i]]; ok {
			if m.pkg != nil {
				p.imported[m.pkg.qualifiedImportPath()] = true
			}
			expr := m.cue()
			for i < len(name) {
				name = name[i+1:]
				if i = strings.IndexByte(name, '.'); i == -1 {
					i = len(name)
				}
				expr = ast.NewSel(expr, "#"+name[:i])
			}
			ast.SetPos(expr, p.toCUEPos(pos))
			return expr
		}
	}
	failf(pos, "name %q not found", name)
	return nil
}

func (p *protoConverter) doImport(v *proto.Import) error {
	if v.Filename == "cue/cue.proto" {
		return nil
	}

	filename := ""
	for _, p := range p.state.paths {
		name := filepath.Join(p, v.Filename)
		_, err := os.Stat(name)
		if err != nil {
			continue
		}
		filename = name
		break
	}

	if filename == "" {
		err := errors.Newf(p.toCUEPos(v.Position), "could not find import %q", v.Filename)
		p.state.addErr(err)
		return err
	}

	if !p.mapBuiltinPackage(v.Position, v.Filename, filename == "") {
		return nil
	}

	imp, err := p.state.parse(filename, nil)
	if err != nil {
		fail(v.Position, err)
	}

	pkgNamespace := strings.Split(imp.protoPkg, ".")
	curNamespace := strings.Split(p.protoPkg, ".")
	for {
		for k := range imp.symbols {
			ref := k
			if len(pkgNamespace) > 0 {
				ref = strings.Join(append(pkgNamespace, k), ".")
			}
			if _, ok := p.scope[0][ref]; !ok {
				pkg := imp
				a := toCue(k)

				var f func() ast.Expr

				if imp.qualifiedImportPath() == p.qualifiedImportPath() {
					pkg = nil
					f = func() ast.Expr { return ast.NewIdent(a[0]) }
				} else {
					f = func() ast.Expr {
						ident := &ast.Ident{
							Name: imp.shortName(),
							Node: ast.NewImport(nil, imp.qualifiedImportPath()),
						}
						return ast.NewSel(ident, a[0])
					}
				}
				p.scope[0][ref] = mapping{f, pkg}
			}
		}
		if len(pkgNamespace) == 0 {
			break
		}
		if len(curNamespace) == 0 || pkgNamespace[0] != curNamespace[0] {
			break
		}
		pkgNamespace = pkgNamespace[1:]
		curNamespace = curNamespace[1:]
	}
	return nil
}

// TODO: this doesn't work. Do something more principled.
func toCue(name string) []string {
	a := strings.Split(name, ".")
	for i, s := range a {
		a[i] = "#" + s
	}
	return a
}

func (p *protoConverter) stringLit(pos scanner.Position, s string) *ast.BasicLit {
	return &ast.BasicLit{
		ValuePos: p.toCUEPos(pos),
		Kind:     token.STRING,
		Value:    literal.String.Quote(s)}
}

func (p *protoConverter) ident(pos scanner.Position, name string) *ast.Ident {
	return &ast.Ident{NamePos: p.toCUEPos(pos), Name: labelName(name)}
}

func (p *protoConverter) ref(pos scanner.Position) *ast.Ident {
	name := "#" + p.path[len(p.path)-1]
	return &ast.Ident{NamePos: p.toCUEPos(pos), Name: name}
}

func (p *protoConverter) subref(pos scanner.Position, name string) *ast.Ident {
	return &ast.Ident{
		NamePos: p.toCUEPos(pos),
		Name:    "#" + name,
	}
}

func (p *protoConverter) addTag(f *ast.Field, body string) {
	tag := "@protobuf(" + body + ")"
	f.Attrs = append(f.Attrs, &ast.Attribute{Text: tag})
}

func (p *protoConverter) topElement(v proto.Visitee) {
	switch x := v.(type) {
	case *proto.Syntax:
		p.proto3 = x.Value == "proto3"

	case *proto.Comment:
		addComments(p.file, 0, x, nil)

	case *proto.Enum:
		p.enum(x)

	case *proto.Package:
		if doc := x.Doc(); doc != nil {
			addComments(p.file, 0, doc, nil)
		}

	case *proto.Message:
		p.message(x)

	case *proto.Option:
	case *proto.Import:
		// already handled.

	case *proto.Service:
		// TODO: handle services.

	case *proto.Extensions, *proto.Reserved:
		// no need to handle

	default:
		failf(scanner.Position{}, "unsupported type %T", x)
	}
}

func (p *protoConverter) message(v *proto.Message) {
	if v.IsExtend {
		// TODO: we are not handling extensions as for now.
		return
	}

	defer func(saved []string) { p.path = saved }(p.path)
	p.path = append(p.path, v.Name)

	p.addNames(v.Elements)
	defer p.popNames()

	// TODO: handle IsExtend/ proto2

	s := &ast.StructLit{
		Lbrace: p.toCUEPos(v.Position),
		// TODO: set proto file position.
		Rbrace: token.Newline.Pos(),
	}

	ref := p.ref(v.Position)
	if v.Comment == nil {
		ref.NamePos = newSection
	}
	f := &ast.Field{Label: ref, Value: s}
	addComments(f, 1, v.Comment, nil)

	p.addDecl(f)
	defer func(current *ast.StructLit) {
		p.current = current
	}(p.current)
	p.current = s

	for i, e := range v.Elements {
		p.messageField(s, i, e)
	}
}

func (p *protoConverter) addDecl(d ast.Decl) {
	if p.current == nil {
		p.file.Decls = append(p.file.Decls, d)
	} else {
		p.current.Elts = append(p.current.Elts, d)
	}
}

func (p *protoConverter) messageField(s *ast.StructLit, i int, v proto.Visitee) {
	switch x := v.(type) {
	case *proto.Comment:
		s.Elts = append(s.Elts, comment(x, true))

	case *proto.NormalField:
		f := p.parseField(s, i, x.Field)

		if x.Repeated {
			f.Value = &ast.ListLit{
				Lbrack: p.toCUEPos(x.Position),
				Elts:   []ast.Expr{&ast.Ellipsis{Type: f.Value}},
			}
		}

	case *proto.MapField:
		defer func(saved []string) { p.path = saved }(p.path)
		p.path = append(p.path, x.Name)

		f := &ast.Field{}

		// All keys are converted to strings.
		// TODO: support integer keys.
		f.Label = ast.NewList(ast.NewIdent("string"))
		f.Value = p.resolve(x.Position, x.Type, x.Options)

		name := p.ident(x.Position, x.Name)
		f = &ast.Field{
			Label: name,
			Value: ast.NewStruct(f),
		}
		addComments(f, i, x.Comment, x.InlineComment)

		o := optionParser{message: s, field: f}
		o.tags = fmt.Sprintf(`%d,map[%s]%s`, x.Sequence, x.KeyType, x.Type)
		if x.Name != name.Name {
			o.tags += "," + x.Name
		}
		s.Elts = append(s.Elts, f)
		o.parse(x.Options)
		p.addTag(f, o.tags)

		if !o.required {
			f.Optional = token.NoSpace.Pos()
		}

	case *proto.Enum:
		p.enum(x)

	case *proto.Message:
		p.message(x)

	case *proto.Oneof:
		p.oneOf(x)

	case *proto.Extensions, *proto.Reserved:
		// no need to handle

	case *proto.Option:
		opt := fmt.Sprintf("@protobuf(option %s=%s)", x.Name, x.Constant.Source)
		attr := &ast.Attribute{
			At:   p.toCUEPos(x.Position),
			Text: opt,
		}
		addComments(attr, i, x.Doc(), x.InlineComment)
		s.Elts = append(s.Elts, attr)

	default:
		failf(scanner.Position{}, "unsupported field type %T", v)
	}
}

// enum converts a proto enum definition to CUE.
//
// An enum will generate two top-level definitions:
//
//	Enum:
//	  "Value1" |
//	  "Value2" |
//	  "Value3"
//
// and
//
//	Enum_value: {
//	    "Value1": 0
//	    "Value2": 1
//	}
//
// Enums are always defined at the top level. The name of a nested enum
// will be prefixed with the name of its parent and an underscore.
func (p *protoConverter) enum(x *proto.Enum) {

	if len(x.Elements) == 0 {
		failf(x.Position, "empty enum")
	}

	name := p.subref(x.Position, x.Name)

	defer func(saved []string) { p.path = saved }(p.path)
	p.path = append(p.path, x.Name)

	p.addNames(x.Elements)

	if len(p.path) == 0 {
		defer func() { p.path = p.path[:0] }()
		p.path = append(p.path, x.Name)
	}

	// Top-level enum entry.
	enum := &ast.Field{Label: name}
	addComments(enum, 1, x.Comment, nil)
	if p.current != nil && len(p.current.Elts) > 0 {
		ast.SetRelPos(enum, token.NewSection)
	}

	// Top-level enum values entry.
	valueName := ast.NewIdent(name.Name + "_value")
	valueName.NamePos = newSection
	valueMap := &ast.StructLit{}
	d := &ast.Field{Label: valueName, Value: valueMap}
	// addComments(valueMap, 1, x.Comment, nil)

	if strings.Contains(name.Name, "google") {
		panic(name.Name)
	}
	p.addDecl(enum)

	numEnums := 0
	for _, v := range x.Elements {
		if _, ok := v.(*proto.EnumField); ok {
			numEnums++
		}
	}

	lastSingle := false

	firstSpace := token.NewSection

	// The line comments for an enum field need to attach after the '|', which
	// is only known at the next iteration.
	var lastComment *proto.Comment
	for i, v := range x.Elements {
		switch y := v.(type) {
		case *proto.EnumField:
			// Add enum value to map
			intValue := ast.NewLit(token.INT, strconv.Itoa(y.Integer))
			f := &ast.Field{
				Label: p.stringLit(y.Position, y.Name),
				Value: intValue,
			}
			valueMap.Elts = append(valueMap.Elts, f)

			var e ast.Expr
			switch p.state.enumMode {
			case "int":
				e = ast.NewIdent("#" + y.Name)
				ast.SetRelPos(e, token.Newline)

				f := &ast.Field{
					Label: ast.NewIdent("#" + y.Name),
					Value: intValue,
				}
				ast.SetRelPos(f, firstSpace)
				firstSpace = token.Newline
				addComments(f, 0, y.Comment, y.InlineComment)
				p.addDecl(f)

			case "", "json":
				// add to enum disjunction
				value := p.stringLit(y.Position, y.Name)
				embed := &ast.EmbedDecl{Expr: value}
				ast.SetRelPos(embed, token.Blank)
				field := &ast.Field{Label: ast.NewIdent("#enumValue"), Value: intValue}
				st := &ast.StructLit{
					Lbrace: token.Blank.Pos(),
					Elts:   []ast.Decl{embed, field},
				}

				addComments(embed, 0, y.Comment, y.InlineComment)
				if y.Comment == nil && y.InlineComment == nil {
					ast.SetRelPos(field, token.Blank)
					ast.SetRelPos(field.Label, token.Blank)
					st.Rbrace = token.Blank.Pos()
					if i > 0 && lastSingle {
						st.Lbrace = token.Newline.Pos()
					}
					lastSingle = true
				} else {
					lastSingle = false
				}
				e = st

			default:
				p.state.errs = errors.Append(p.state.errs,
					errors.Newf(token.NoPos, "unknown enum mode %q", p.state.enumMode))
				return
			}

			if enum.Value != nil {
				e = &ast.BinaryExpr{X: enum.Value, Op: token.OR, Y: e}
			}
			enum.Value = e

			// a := fmt.Sprintf("@protobuf(enum,name=%s)", y.Name)
			// f.Attrs = append(f.Attrs, &ast.Attribute{Text: a})
		}
	}
	p.addDecl(d)
	addComments(enum.Value, 1, nil, lastComment)
}

// oneOf converts a Proto OneOf field to CUE. Note that Protobuf defines
// a oneOf to be at most one of the fields. Rather than making each field
// optional, we define oneOfs as all required fields, but add one more
// disjunction allowing no fields. This makes it easier to constrain the
// result to include at least one of the values.
func (p *protoConverter) oneOf(x *proto.Oneof) {
	s := ast.NewStruct()
	ast.SetRelPos(s, token.Newline)
	embed := &ast.EmbedDecl{Expr: s}
	embed.AddComment(comment(x.Comment, true))

	p.addDecl(embed)

	newStruct := func() {
		s = &ast.StructLit{
			// TODO: make this the default in the formatter.
			Rbrace: token.Newline.Pos(),
		}
		embed.Expr = ast.NewBinExpr(token.OR, embed.Expr, s)
	}
	for _, v := range x.Elements {
		switch x := v.(type) {
		case *proto.OneOfField:
			newStruct()
			oneOf := p.parseField(s, 0, x.Field)
			oneOf.Optional = token.NoPos

		case *proto.Comment:
			cg := comment(x, false)
			ast.SetRelPos(cg, token.NewSection)
			s.Elts = append(s.Elts, cg)

		default:
			newStruct()
			p.messageField(s, 1, v)
		}

	}
}

func (p *protoConverter) parseField(s *ast.StructLit, i int, x *proto.Field) *ast.Field {
	defer func(saved []string) { p.path = saved }(p.path)
	p.path = append(p.path, x.Name)

	f := &ast.Field{}
	addComments(f, i, x.Comment, x.InlineComment)

	name := p.ident(x.Position, x.Name)
	f.Label = name
	typ := p.resolve(x.Position, x.Type, x.Options)
	f.Value = typ
	s.Elts = append(s.Elts, f)

	o := optionParser{message: s, field: f}

	// body of @protobuf tag: sequence,type[,name=<name>][,...]
	o.tags += fmt.Sprintf("%v,%s", x.Sequence, x.Type)
	if x.Name != name.Name {
		o.tags += ",name=" + x.Name
	}
	o.parse(x.Options)
	p.addTag(f, o.tags)

	if !o.required {
		f.Optional = token.NoSpace.Pos()
	}
	return f
}

type optionParser struct {
	message  *ast.StructLit
	field    *ast.Field
	required bool
	tags     string
}

func (p *optionParser) parse(options []*proto.Option) {

	// TODO: handle options
	// - translate options to tags
	// - interpret CUE options.
	for _, o := range options {
		switch o.Name {
		case "(cue.opt).required":
			p.required = true
			// TODO: Dropping comments. Maybe add a dummy tag?

		case "(cue.val)":
			// TODO: set filename and base offset.
			expr, err := parser.ParseExpr("", o.Constant.Source)
			if err != nil {
				failf(o.Position, "invalid cue.val value: %v", err)
			}
			// Any further checks will be done at the end.
			constraint := &ast.Field{Label: p.field.Label, Value: expr}
			addComments(constraint, 1, o.Comment, o.InlineComment)
			p.message.Elts = append(p.message.Elts, constraint)
			if !p.required {
				constraint.Optional = token.NoSpace.Pos()
			}

		default:
			// TODO: dropping comments. Maybe add dummy tag?

			// TODO: should CUE support nested attributes?
			source := o.Constant.SourceRepresentation()
			p.tags += ","
			switch source {
			case "true":
				p.tags += quoteOption(o.Name)
			default:
				p.tags += quoteOption(o.Name + "=" + source)
			}
		}
	}
}

func quoteOption(s string) string {
	needQuote := false
	for _, r := range s {
		if !unicode.In(r, unicode.L, unicode.N) {
			needQuote = true
			break
		}
	}
	if !needQuote {
		return s
	}
	if !strings.ContainsAny(s, `"\`) {
		return literal.String.Quote(s)
	}
	esc := `\#`
	for strings.Contains(s, esc) {
		esc += "#"
	}
	return esc[1:] + `"` + s + `"` + esc[1:]
}
