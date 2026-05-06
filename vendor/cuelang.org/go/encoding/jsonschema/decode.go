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

package jsonschema

// TODO:
// - replace converter from YAML to CUE to CUE (schema) to CUE.
// - define OpenAPI definitions als CUE.

import (
	"fmt"
	"net/url"
	"sort"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/ast/astutil"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
)

// rootDefs defines the top-level name of the map of definitions that do not
// have a valid identifier name.
//
// TODO: find something more principled, like allowing #."a-b" or `#a-b`.
const rootDefs = "#"

// A decoder converts JSON schema to CUE.
type decoder struct {
	cfg   *Config
	errs  errors.Error
	numID int // for creating unique numbers: increment on each use
}

// addImport registers
func (d *decoder) addImport(n cue.Value, pkg string) *ast.Ident {
	spec := ast.NewImport(nil, pkg)
	info, err := astutil.ParseImportSpec(spec)
	if err != nil {
		d.errf(cue.Value{}, "invalid import %q", pkg)
	}
	ident := ast.NewIdent(info.Ident)
	ident.Node = spec
	ast.SetPos(ident, n.Pos())

	return ident
}

func (d *decoder) decode(v cue.Value) *ast.File {
	f := &ast.File{}

	if pkgName := d.cfg.PkgName; pkgName != "" {
		pkg := &ast.Package{Name: ast.NewIdent(pkgName)}
		f.Decls = append(f.Decls, pkg)
	}

	var a []ast.Decl

	if d.cfg.Root == "" {
		a = append(a, d.schema(nil, v)...)
	} else {
		ref := d.parseRef(token.NoPos, d.cfg.Root)
		if ref == nil {
			return f
		}
		i, err := v.Lookup(ref...).Fields()
		if err != nil {
			d.errs = errors.Append(d.errs, errors.Promote(err, ""))
			return nil
		}
		for i.Next() {
			ref := append(ref, i.Label())
			lab := d.mapRef(i.Value().Pos(), "", ref)
			if len(lab) == 0 {
				return nil
			}
			decls := d.schema(lab, i.Value())
			a = append(a, decls...)
		}
	}

	f.Decls = append(f.Decls, a...)

	_ = astutil.Sanitize(f)

	return f
}

func (d *decoder) schema(ref []ast.Label, v cue.Value) (a []ast.Decl) {
	root := state{decoder: d}

	var name ast.Label
	inner := len(ref) - 1

	if inner >= 0 {
		name = ref[inner]
		root.isSchema = true
	}

	expr, state := root.schemaState(v, allTypes, nil, false)

	tags := []string{}
	if state.jsonschema != "" {
		tags = append(tags, fmt.Sprintf("schema=%q", state.jsonschema))
	}

	if name == nil {
		if len(tags) > 0 {
			body := strings.Join(tags, ",")
			a = append(a, &ast.Attribute{
				Text: fmt.Sprintf("@jsonschema(%s)", body)})
		}

		if state.deprecated {
			a = append(a, &ast.Attribute{Text: "@deprecated()"})
		}
	} else {
		if len(tags) > 0 {
			a = append(a, addTag(name, "jsonschema", strings.Join(tags, ",")))
		}

		if state.deprecated {
			a = append(a, addTag(name, "deprecated", ""))
		}
	}

	if name != nil {
		f := &ast.Field{
			Label: name,
			Value: expr,
		}

		a = append(a, f)
	} else if st, ok := expr.(*ast.StructLit); ok {
		a = append(a, st.Elts...)
	} else {
		a = append(a, &ast.EmbedDecl{Expr: expr})
	}

	state.doc(a[0])

	for i := inner - 1; i >= 0; i-- {
		a = []ast.Decl{&ast.Field{
			Label: ref[i],
			Value: &ast.StructLit{Elts: a},
		}}
		expr = ast.NewStruct(ref[i], expr)
	}

	if root.hasSelfReference {
		return []ast.Decl{
			&ast.EmbedDecl{Expr: ast.NewIdent(topSchema)},
			&ast.Field{
				Label: ast.NewIdent(topSchema),
				Value: &ast.StructLit{Elts: a},
			},
		}
	}

	return a
}

func (d *decoder) errf(n cue.Value, format string, args ...interface{}) ast.Expr {
	d.warnf(n.Pos(), format, args...)
	return &ast.BadExpr{From: n.Pos()}
}

func (d *decoder) warnf(p token.Pos, format string, args ...interface{}) {
	d.addErr(errors.Newf(p, format, args...))
}

func (d *decoder) addErr(err errors.Error) {
	d.errs = errors.Append(d.errs, err)
}

func (d *decoder) number(n cue.Value) ast.Expr {
	return n.Syntax(cue.Final()).(ast.Expr)
}

func (d *decoder) uint(n cue.Value) ast.Expr {
	_, err := n.Uint64()
	if err != nil {
		d.errf(n, "invalid uint")
	}
	return n.Syntax(cue.Final()).(ast.Expr)
}

func (d *decoder) bool(n cue.Value) ast.Expr {
	return n.Syntax(cue.Final()).(ast.Expr)
}

func (d *decoder) boolValue(n cue.Value) bool {
	x, err := n.Bool()
	if err != nil {
		d.errf(n, "invalid bool")
	}
	return x
}

func (d *decoder) string(n cue.Value) ast.Expr {
	return n.Syntax(cue.Final()).(ast.Expr)
}

func (d *decoder) strValue(n cue.Value) (s string, ok bool) {
	s, err := n.String()
	if err != nil {
		d.errf(n, "invalid string")
		return "", false
	}
	return s, true
}

// const draftCutoff = 5

type coreType int

const (
	nullType coreType = iota
	boolType
	numType
	stringType
	arrayType
	objectType

	numCoreTypes
)

var coreToCUE = []cue.Kind{
	nullType:   cue.NullKind,
	boolType:   cue.BoolKind,
	numType:    cue.FloatKind,
	stringType: cue.StringKind,
	arrayType:  cue.ListKind,
	objectType: cue.StructKind,
}

func kindToAST(k cue.Kind) ast.Expr {
	switch k {
	case cue.NullKind:
		// TODO: handle OpenAPI restrictions.
		return ast.NewNull()
	case cue.BoolKind:
		return ast.NewIdent("bool")
	case cue.FloatKind:
		return ast.NewIdent("number")
	case cue.StringKind:
		return ast.NewIdent("string")
	case cue.ListKind:
		return ast.NewList(&ast.Ellipsis{})
	case cue.StructKind:
		return ast.NewStruct(&ast.Ellipsis{})
	}
	return nil
}

var coreTypeName = []string{
	nullType:   "null",
	boolType:   "bool",
	numType:    "number",
	stringType: "string",
	arrayType:  "array",
	objectType: "object",
}

type constraintInfo struct {
	// typ is an identifier for the root type, if present.
	// This can be omitted if there are constraints.
	typ         ast.Expr
	constraints []ast.Expr
}

func (c *constraintInfo) setTypeUsed(n cue.Value, t coreType) {
	c.typ = kindToAST(coreToCUE[t])
	setPos(c.typ, n)
	ast.SetRelPos(c.typ, token.NoRelPos)
}

func (c *constraintInfo) add(n cue.Value, x ast.Expr) {
	if !isAny(x) {
		setPos(x, n)
		ast.SetRelPos(x, token.NoRelPos)
		c.constraints = append(c.constraints, x)
	}
}

func (s *state) add(n cue.Value, t coreType, x ast.Expr) {
	s.types[t].add(n, x)
}

func (s *state) setTypeUsed(n cue.Value, t coreType) {
	s.types[t].setTypeUsed(n, t)
}

type state struct {
	*decoder

	isSchema bool // for omitting ellipsis in an ast.File

	up     *state
	parent *state

	path []string

	// idRef is used to refer to this schema in case it defines an $id.
	idRef []label

	pos cue.Value

	// The constraints in types represent disjunctions per type.
	types    [numCoreTypes]constraintInfo
	all      constraintInfo // values and oneOf etc.
	nullable *ast.BasicLit  // nullable

	usedTypes    cue.Kind
	allowedTypes cue.Kind

	default_     ast.Expr
	examples     []ast.Expr
	title        string
	description  string
	deprecated   bool
	exclusiveMin bool // For OpenAPI and legacy support.
	exclusiveMax bool // For OpenAPI and legacy support.
	jsonschema   string
	id           *url.URL // base URI for $ref

	definitions []ast.Decl

	// Used for inserting definitions, properties, etc.
	hasSelfReference bool
	obj              *ast.StructLit
	// Complete at finalize.
	fieldRefs map[label]refs

	closeStruct bool
	patterns    []ast.Expr

	list *ast.ListLit
}

type label struct {
	name  string
	isDef bool
}

type refs struct {
	field *ast.Field
	ident string
	refs  []*ast.Ident
}

func (s *state) object(n cue.Value) *ast.StructLit {
	if s.obj == nil {
		s.obj = &ast.StructLit{}
		s.add(n, objectType, s.obj)
	}
	return s.obj
}

func (s *state) hasConstraints() bool {
	if len(s.all.constraints) > 0 {
		return true
	}
	for _, t := range s.types {
		if len(t.constraints) > 0 {
			return true
		}
	}
	return len(s.patterns) > 0 ||
		s.title != "" ||
		s.description != "" ||
		s.obj != nil
}

const allTypes = cue.NullKind | cue.BoolKind | cue.NumberKind | cue.IntKind |
	cue.StringKind | cue.ListKind | cue.StructKind

// finalize constructs a CUE type from the collected constraints.
func (s *state) finalize() (e ast.Expr) {
	conjuncts := []ast.Expr{}
	disjuncts := []ast.Expr{}

	types := s.allowedTypes &^ s.usedTypes
	if types == allTypes {
		disjuncts = append(disjuncts, ast.NewIdent("_"))
		types = 0
	}

	// Sort literal structs and list last for nicer formatting.
	sort.SliceStable(s.types[arrayType].constraints, func(i, j int) bool {
		_, ok := s.types[arrayType].constraints[i].(*ast.ListLit)
		return !ok
	})
	sort.SliceStable(s.types[objectType].constraints, func(i, j int) bool {
		_, ok := s.types[objectType].constraints[i].(*ast.StructLit)
		return !ok
	})

	for i, t := range s.types {
		k := coreToCUE[i]
		isAllowed := s.allowedTypes&k != 0
		if len(t.constraints) > 0 {
			if t.typ == nil && !isAllowed {
				for _, c := range t.constraints {
					s.addErr(errors.Newf(c.Pos(),
						"constraint not allowed because type %s is excluded",
						coreTypeName[i],
					))
				}
				continue
			}
			x := ast.NewBinExpr(token.AND, t.constraints...)
			disjuncts = append(disjuncts, x)
		} else if s.usedTypes&k != 0 {
			continue
		} else if t.typ != nil {
			if !isAllowed {
				s.addErr(errors.Newf(t.typ.Pos(),
					"constraint not allowed because type %s is excluded",
					coreTypeName[i],
				))
				continue
			}
			disjuncts = append(disjuncts, t.typ)
		} else if types&k != 0 {
			x := kindToAST(k)
			if x != nil {
				disjuncts = append(disjuncts, x)
			}
		}
	}

	conjuncts = append(conjuncts, s.all.constraints...)

	obj := s.obj
	if obj == nil {
		obj, _ = s.types[objectType].typ.(*ast.StructLit)
	}
	if obj != nil {
		// TODO: may need to explicitly close.
		if !s.closeStruct {
			obj.Elts = append(obj.Elts, &ast.Ellipsis{})
		}
	}

	if len(disjuncts) > 0 {
		conjuncts = append(conjuncts, ast.NewBinExpr(token.OR, disjuncts...))
	}

	if len(conjuncts) == 0 {
		e = &ast.BottomLit{}
	} else {
		e = ast.NewBinExpr(token.AND, conjuncts...)
	}

	a := []ast.Expr{e}
	if s.nullable != nil {
		a = []ast.Expr{s.nullable, e}
	}

outer:
	switch {
	case s.default_ != nil:
		// check conditions where default can be skipped.
		switch x := s.default_.(type) {
		case *ast.ListLit:
			if s.usedTypes == cue.ListKind && len(x.Elts) == 0 {
				break outer
			}
		}
		a = append(a, &ast.UnaryExpr{Op: token.MUL, X: s.default_})
	}

	e = ast.NewBinExpr(token.OR, a...)

	if len(s.definitions) > 0 {
		if st, ok := e.(*ast.StructLit); ok {
			st.Elts = append(st.Elts, s.definitions...)
		} else {
			st = ast.NewStruct()
			st.Elts = append(st.Elts, &ast.EmbedDecl{Expr: e})
			st.Elts = append(st.Elts, s.definitions...)
			e = st
		}
	}

	s.linkReferences()

	return e
}

func isAny(s ast.Expr) bool {
	i, ok := s.(*ast.Ident)
	return ok && i.Name == "_"
}

func (s *state) comment() *ast.CommentGroup {
	// Create documentation.
	doc := strings.TrimSpace(s.title)
	if s.description != "" {
		if doc != "" {
			doc += "\n\n"
		}
		doc += s.description
		doc = strings.TrimSpace(doc)
	}
	// TODO: add examples as well?
	if doc == "" {
		return nil
	}
	return internal.NewComment(true, doc)
}

func (s *state) doc(n ast.Node) {
	doc := s.comment()
	if doc != nil {
		ast.SetComments(n, []*ast.CommentGroup{doc})
	}
}

func (s *state) schema(n cue.Value, idRef ...label) ast.Expr {
	expr, _ := s.schemaState(n, allTypes, idRef, false)
	// TODO: report unused doc.
	return expr
}

// schemaState is a low-level API for schema. isLogical specifies whether the
// caller is a logical operator like anyOf, allOf, oneOf, or not.
func (s *state) schemaState(n cue.Value, types cue.Kind, idRef []label, isLogical bool) (ast.Expr, *state) {
	state := &state{
		up:           s,
		isSchema:     s.isSchema,
		decoder:      s.decoder,
		allowedTypes: types,
		path:         s.path,
		idRef:        idRef,
		pos:          n,
	}
	if isLogical {
		state.parent = s
	}

	if n.Kind() != cue.StructKind {
		return s.errf(n, "schema expects mapping node, found %s", n.Kind()), state
	}

	// do multiple passes over the constraints to ensure they are done in order.
	for pass := 0; pass < 4; pass++ {
		state.processMap(n, func(key string, value cue.Value) {
			// Convert each constraint into a either a value or a functor.
			c := constraintMap[key]
			if c == nil {
				if pass == 0 && s.cfg.Strict {
					// TODO: value is not the correct position, albeit close. Fix this.
					s.warnf(value.Pos(), "unsupported constraint %q", key)
				}
				return
			}
			if c.phase == pass {
				c.fn(value, state)
			}
		})
	}

	return state.finalize(), state
}

func (s *state) value(n cue.Value) ast.Expr {
	k := n.Kind()
	s.usedTypes |= k
	s.allowedTypes &= k
	switch k {
	case cue.ListKind:
		a := []ast.Expr{}
		for i, _ := n.List(); i.Next(); {
			a = append(a, s.value(i.Value()))
		}
		return setPos(ast.NewList(a...), n)

	case cue.StructKind:
		a := []ast.Decl{}
		s.processMap(n, func(key string, n cue.Value) {
			a = append(a, &ast.Field{
				Label: ast.NewString(key),
				Value: s.value(n),
			})
		})
		// TODO: only open when s.isSchema?
		a = append(a, &ast.Ellipsis{})
		return setPos(&ast.StructLit{Elts: a}, n)

	default:
		if !n.IsConcrete() {
			s.errf(n, "invalid non-concrete value")
		}
		return n.Syntax(cue.Final()).(ast.Expr)
	}
}

// processMap processes a yaml node, expanding merges.
//
// TODO: in some cases we can translate merges into CUE embeddings.
// This may also prevent exponential blow-up (as may happen when
// converting YAML to JSON).
func (s *state) processMap(n cue.Value, f func(key string, n cue.Value)) {
	saved := s.path
	defer func() { s.path = saved }()

	// TODO: intercept references to allow for optimized performance.
	for i, _ := n.Fields(); i.Next(); {
		key := i.Label()
		s.path = append(saved, key)
		f(key, i.Value())
	}
}

func (s *state) listItems(name string, n cue.Value, allowEmpty bool) (a []cue.Value) {
	if n.Kind() != cue.ListKind {
		s.errf(n, `value of %q must be an array, found %v`, name, n.Kind())
	}
	for i, _ := n.List(); i.Next(); {
		a = append(a, i.Value())
	}
	if !allowEmpty && len(a) == 0 {
		s.errf(n, `array for %q must be non-empty`, name)
	}
	return a
}

// excludeFields returns a CUE expression that can be used to exclude the
// fields of the given declaration in a label expression. For instance, for
//
//	{ foo: 1, bar: int }
//
// it creates
//
//	"^(foo|bar)$"
//
// which can be used in a label expression to define types for all fields but
// those existing:
//
//	[!~"^(foo|bar)$"]: string
func excludeFields(decls []ast.Decl) ast.Expr {
	var a []string
	for _, d := range decls {
		f, ok := d.(*ast.Field)
		if !ok {
			continue
		}
		str, _, _ := ast.LabelName(f.Label)
		if str != "" {
			a = append(a, str)
		}
	}
	re := fmt.Sprintf("^(%s)$", strings.Join(a, "|"))
	return &ast.UnaryExpr{Op: token.NMAT, X: ast.NewString(re)}
}

func addTag(field ast.Label, tag, value string) *ast.Field {
	return &ast.Field{
		Label: field,
		Value: ast.NewIdent("_"),
		Attrs: []*ast.Attribute{
			{Text: fmt.Sprintf("@%s(%s)", tag, value)},
		},
	}
}

func setPos(e ast.Expr, v cue.Value) ast.Expr {
	ast.SetPos(e, v.Pos())
	return e
}
