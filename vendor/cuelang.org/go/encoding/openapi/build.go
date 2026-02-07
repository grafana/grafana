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

package openapi

import (
	"fmt"
	"math"
	"path"
	"regexp"
	"sort"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/core/adt"
	internalvalue "cuelang.org/go/internal/value"
)

type buildContext struct {
	inst      cue.Value
	instExt   cue.Value
	refPrefix string
	path      []cue.Selector
	errs      errors.Error

	expandRefs    bool
	structural    bool
	exclusiveBool bool
	nameFunc      func(inst cue.Value, path cue.Path) string
	descFunc      func(v cue.Value) string
	fieldFilter   *regexp.Regexp
	evalDepth     int // detect cycles when resolving references
	maxCycleDepth int

	schemas *OrderedMap

	// Track external schemas.
	externalRefs map[string]*externalType

	// Used for cycle detection in case of using ExpandReferences. At the
	// moment, CUE does not detect cycles when a user forcefully steps into a
	// pattern constraint.
	//
	// TODO: consider an option in the CUE API where optional fields are
	// recursively evaluated.
	cycleNodes []*adt.Vertex

	// imports caches values as returned by cue.Value.ReferencePath
	// for use by ReferenceFunc. It's only initialised when ReferenceFunc
	// is non-nil.
	imports map[cue.Value]*cue.Instance
}

type externalType struct {
	ref   string
	inst  cue.Value
	path  cue.Path
	value cue.Value
}

type oaSchema = OrderedMap

type typeFunc func(b *builder, a cue.Value)

func schemas(g *Generator, inst cue.InstanceOrValue) (schemas *ast.StructLit, err error) {
	val := inst.Value()
	_, isInstance := inst.(*cue.Instance)
	var fieldFilter *regexp.Regexp
	if g.FieldFilter != "" {
		fieldFilter, err = regexp.Compile(g.FieldFilter)
		if err != nil {
			return nil, errors.Newf(token.NoPos, "invalid field filter: %v", err)
		}

		// verify that certain elements are still passed.
		for _, f := range strings.Split(
			"version,title,allOf,anyOf,not,enum,Schema/properties,Schema/items"+
				"nullable,type", ",") {
			if fieldFilter.MatchString(f) {
				return nil, errors.Newf(token.NoPos, "field filter may not exclude %q", f)
			}
		}
	}

	if g.Version == "" {
		g.Version = "3.0.0"
	}

	c := &buildContext{
		inst:          val,
		instExt:       val,
		refPrefix:     "components/schemas",
		expandRefs:    g.ExpandReferences,
		structural:    g.ExpandReferences,
		nameFunc:      g.NameFunc,
		descFunc:      g.DescriptionFunc,
		schemas:       &OrderedMap{},
		externalRefs:  map[string]*externalType{},
		fieldFilter:   fieldFilter,
		maxCycleDepth: g.MaxCycleDepth,
	}
	if g.ReferenceFunc != nil {
		if !isInstance {
			panic("cannot use ReferenceFunc along with cue.Value")
		}
		if g.NameFunc != nil {
			panic("cannot specify both ReferenceFunc and NameFunc")
		}

		c.nameFunc = func(val cue.Value, path cue.Path) string {
			sels := path.Selectors()
			labels := make([]string, len(sels))
			for i, sel := range sels {
				labels[i] = selectorLabel(sel) // TODO this is arguably incorrect.
			}
			inst, ok := c.imports[val]
			if !ok {
				r, n := internalvalue.ToInternal(val)
				buildInst := r.GetInstanceFromNode(n)
				var err error
				inst, err = (*cue.Runtime)(r).Build(buildInst)
				if err != nil {
					panic("cannot build instance from value")
				}
				if c.imports == nil {
					c.imports = make(map[cue.Value]*cue.Instance)
				}
				c.imports[val] = inst
			}
			return g.ReferenceFunc(inst, labels)
		}
	}

	switch g.Version {
	case "3.0.0":
		c.exclusiveBool = true
	case "3.1.0":
	default:
		return nil, errors.Newf(token.NoPos, "unsupported version %s", g.Version)
	}

	defer func() {
		switch x := recover().(type) {
		case nil:
		case *openapiError:
			err = x
		default:
			panic(x)
		}
	}()

	// Although paths is empty for now, it makes it valid OpenAPI spec.

	i, err := inst.Value().Fields(cue.Definitions(true))
	if err != nil {
		return nil, err
	}
	for i.Next() {
		sel := i.Selector()
		if !sel.IsDefinition() {
			continue
		}
		// message, enum, or constant.
		if c.isInternal(sel) {
			continue
		}
		ref := c.makeRef(val, cue.MakePath(sel))
		if ref == "" {
			continue
		}
		c.schemas.Set(ref, c.build(sel, i.Value()))
	}

	// keep looping until a fixed point is reached.
	for done := 0; len(c.externalRefs) != done; {
		done = len(c.externalRefs)

		// From now on, all references need to be expanded
		external := []string{}
		for k := range c.externalRefs {
			external = append(external, k)
		}
		sort.Strings(external)

		for _, k := range external {
			ext := c.externalRefs[k]
			c.instExt = ext.inst
			sels := ext.path.Selectors()
			last := len(sels) - 1
			c.path = sels[:last]
			name := sels[last]
			c.schemas.Set(ext.ref, c.build(name, cue.Dereference(ext.value)))
		}
	}

	a := c.schemas.Elts
	sort.Slice(a, func(i, j int) bool {
		x, _, _ := ast.LabelName(a[i].(*ast.Field).Label)
		y, _, _ := ast.LabelName(a[j].(*ast.Field).Label)
		return x < y
	})

	return (*ast.StructLit)(c.schemas), c.errs
}

func (b *buildContext) build(name cue.Selector, v cue.Value) *ast.StructLit {
	return newCoreBuilder(b).schema(nil, name, v)
}

// isInternal reports whether or not to include this type.
func (b *buildContext) isInternal(sel cue.Selector) bool {
	// TODO: allow a regexp filter in Config. If we have closed structs and
	// definitions, this will likely be unnecessary.
	return sel.Type().LabelType() == cue.DefinitionLabel &&
		strings.HasSuffix(sel.String(), "_value")
}

func (b *builder) failf(v cue.Value, format string, args ...interface{}) {
	panic(&openapiError{
		errors.NewMessage(format, args),
		cue.MakePath(b.ctx.path...),
		v.Pos(),
	})
}

func (b *builder) unsupported(v cue.Value) {
	if b.format == "" {
		// Not strictly an error, but consider listing it as a warning
		// in strict mode.
	}
}

func (b *builder) checkArgs(a []cue.Value, n int) {
	if len(a)-1 != n {
		b.failf(a[0], "%v must be used with %d arguments", a[0], len(a)-1)
	}
}

func (b *builder) schema(core *builder, name cue.Selector, v cue.Value) *ast.StructLit {
	oldPath := b.ctx.path
	b.ctx.path = append(b.ctx.path, name)
	defer func() { b.ctx.path = oldPath }()

	var c *builder
	if core == nil && b.ctx.structural {
		c = newCoreBuilder(b.ctx)
		c.buildCore(v) // initialize core structure
		c.coreSchema()
	} else {
		c = newRootBuilder(b.ctx)
		c.core = core
	}

	return c.fillSchema(v)
}

func (b *builder) getDoc(v cue.Value) {
	doc := []string{}
	if b.ctx.descFunc != nil {
		if str := b.ctx.descFunc(v); str != "" {
			doc = append(doc, str)
		}
	} else {
		for _, d := range v.Doc() {
			doc = append(doc, d.Text())
		}
	}
	if len(doc) > 0 {
		str := strings.TrimSpace(strings.Join(doc, "\n\n"))
		b.setSingle("description", ast.NewString(str), true)
	}
}

func (b *builder) fillSchema(v cue.Value) *ast.StructLit {
	if b.filled != nil {
		return b.filled
	}

	b.setValueType(v)
	b.format = extractFormat(v)
	b.deprecated = getDeprecated(v)

	if b.core == nil || len(b.core.values) > 1 {
		isRef := b.value(v, nil)
		if isRef {
			b.typ = ""
		}

		if !isRef && !b.ctx.structural {
			b.getDoc(v)
		}
	}

	schema := b.finish()
	s := (*ast.StructLit)(schema)

	simplify(b, s)

	sortSchema(s)

	b.filled = s
	return s
}

func label(d ast.Decl) string {
	f := d.(*ast.Field)
	s, _, _ := ast.LabelName(f.Label)
	return s
}

func value(d ast.Decl) ast.Expr {
	return d.(*ast.Field).Value
}

func sortSchema(s *ast.StructLit) {
	sort.Slice(s.Elts, func(i, j int) bool {
		iName := label(s.Elts[i])
		jName := label(s.Elts[j])
		pi := fieldOrder[iName]
		pj := fieldOrder[jName]
		if pi != pj {
			return pi > pj
		}
		return iName < jName
	})
}

var fieldOrder = map[string]int{
	"description":      31,
	"type":             30,
	"format":           29,
	"required":         28,
	"properties":       27,
	"minProperties":    26,
	"maxProperties":    25,
	"minimum":          24,
	"exclusiveMinimum": 23,
	"maximum":          22,
	"exclusiveMaximum": 21,
	"minItems":         18,
	"maxItems":         17,
	"minLength":        16,
	"maxLength":        15,
	"items":            14,
	"enum":             13,
	"default":          12,
}

func (b *builder) value(v cue.Value, f typeFunc) (isRef bool) {
	b.pushNode(v)
	defer b.popNode()

	count := 0
	disallowDefault := false
	var values cue.Value
	if b.ctx.expandRefs || b.format != "" {
		values = cue.Dereference(v)
		count = 1
	} else {
		dedup := map[string]bool{}
		hasNoRef := false
		accept := v
		conjuncts := appendSplit(nil, cue.AndOp, v)
		for _, v := range conjuncts {
			// This may be a reference to an enum. So we need to check references before
			// dissecting them.

			switch v1, path := v.ReferencePath(); {
			case len(path.Selectors()) > 0:
				ref := b.ctx.makeRef(v1, path)
				if ref == "" {
					v = cue.Dereference(v)
					break
				}
				if dedup[ref] {
					continue
				}
				dedup[ref] = true

				b.addRef(v, v1, path)
				disallowDefault = true
				continue
			}
			hasNoRef = true
			count++
			values = values.UnifyAccept(v, accept)
		}
		isRef = !hasNoRef && len(dedup) == 1
	}

	if count > 0 { // TODO: implement IsAny.
		// TODO: perhaps find optimal representation. For now we assume the
		// representation as is is already optimized for human consumption.
		if values.IncompleteKind()&cue.StructKind != cue.StructKind && !isRef {
			values = values.Eval()
		}

		conjuncts := appendSplit(nil, cue.AndOp, values)
		for i, v := range conjuncts {
			switch {
			case isConcrete(v):
				b.dispatch(f, v)
				if !b.isNonCore() {
					b.set("enum", ast.NewList(b.decode(v)))
				}
			default:
				a := appendSplit(nil, cue.OrOp, v)
				for i, v := range a {
					if _, r := v.Reference(); len(r) == 0 {
						a[i] = v.Eval()
					}
				}

				_ = i
				// TODO: it matters here whether a conjunct is obtained
				// from embedding or normal unification. Fix this at some
				// point.
				//
				// if len(a) > 1 {
				// 	// Filter disjuncts that cannot unify with other conjuncts,
				// 	// and thus can never be satisfied.
				// 	// TODO: there should be generalized simplification logic
				// 	// in CUE (outside of the usual implicit simplifications).
				// 	k := 0
				// outer:
				// 	for _, d := range a {
				// 		for j, w := range conjuncts {
				// 			if i == j {
				// 				continue
				// 			}
				// 			if d.Unify(w).Err() != nil {
				// 				continue outer
				// 			}
				// 		}
				// 		a[k] = d
				// 		k++
				// 	}
				// 	a = a[:k]
				// }
				switch len(a) {
				case 0:
					// Conjunct entirely eliminated.
				case 1:
					v = a[0]
					if err := v.Err(); err != nil {
						b.failf(v, "openapi: %v", err)
						return
					}
					b.dispatch(f, v)
				default:
					b.disjunction(a, f)
				}
			}
		}
	}

	if v, ok := v.Default(); ok && v.IsConcrete() && !disallowDefault {
		// TODO: should we show the empty list default? This would be correct
		// but perhaps a bit too pedantic and noisy.
		switch {
		case v.Kind() == cue.ListKind:
			iter, _ := v.List()
			if !iter.Next() {
				// Don't show default for empty list.
				break
			}
			fallthrough
		default:
			if !b.isNonCore() {
				e := v.Syntax(cue.Concrete(true)).(ast.Expr)
				b.setFilter("Schema", "default", e)
			}
		}
	}
	return isRef
}

func appendSplit(a []cue.Value, splitBy cue.Op, v cue.Value) []cue.Value {
	op, args := v.Expr()
	// dedup elements.
	k := 1
outer:
	for i := 1; i < len(args); i++ {
		for j := 0; j < k; j++ {
			if args[i].Subsume(args[j], cue.Raw()) == nil &&
				args[j].Subsume(args[i], cue.Raw()) == nil {
				continue outer
			}
		}
		args[k] = args[i]
		k++
	}
	args = args[:k]

	if op == cue.NoOp && len(args) == 1 {
		// TODO: this is to deal with default value removal. This may change
		// when we completely separate default values from values.
		a = append(a, args...)
	} else if op != splitBy {
		a = append(a, v)
	} else {
		for _, v := range args {
			a = appendSplit(a, splitBy, v)
		}
	}
	return a
}

func countNodes(v cue.Value) (n int) {
	switch op, a := v.Expr(); op {
	case cue.OrOp, cue.AndOp:
		for _, v := range a {
			n += countNodes(v)
		}
		n += len(a) - 1
	default:
		switch v.Kind() {
		case cue.ListKind:
			for i, _ := v.List(); i.Next(); {
				n += countNodes(i.Value())
			}
		case cue.StructKind:
			for i, _ := v.Fields(); i.Next(); {
				n += countNodes(i.Value()) + 1
			}
		}
	}
	return n + 1
}

// isConcrete reports whether v is concrete and not a struct (recursively).
// structs are not supported as the result of a struct enum depends on how
// conjunctions and disjunctions are distributed. We could consider still doing
// this if we define a normal form.
func isConcrete(v cue.Value) bool {
	if !v.IsConcrete() {
		return false
	}
	if v.Kind() == cue.StructKind {
		return false // TODO: handle struct kinds
	}
	for list, _ := v.List(); list.Next(); {
		if !isConcrete(list.Value()) {
			return false
		}
	}
	return true
}

func (b *builder) disjunction(a []cue.Value, f typeFunc) {
	disjuncts := []cue.Value{}
	enums := []ast.Expr{} // TODO: unique the enums
	nullable := false     // Only supported in OpenAPI, not JSON schema

	for _, v := range a {
		switch {
		case v.Null() == nil:
			// TODO: for JSON schema, we need to fall through.
			nullable = true

		case isConcrete(v):
			enums = append(enums, b.decode(v))

		default:
			disjuncts = append(disjuncts, v)
		}
	}

	// Only one conjunct?
	if len(disjuncts) == 0 || (len(disjuncts) == 1 && len(enums) == 0) {
		if len(disjuncts) == 1 {
			b.value(disjuncts[0], f)
		}
		if len(enums) > 0 && !b.isNonCore() {
			b.set("enum", ast.NewList(enums...))
		}
		if nullable {
			b.setSingle("nullable", ast.NewBool(true), true) // allowed in Structural
		}
		return
	}

	anyOf := []ast.Expr{}
	if len(enums) > 0 {
		anyOf = append(anyOf, b.kv("enum", ast.NewList(enums...)))
	}

	if nullable {
		b.setSingle("nullable", ast.NewBool(true), true)
	}

	schemas := make([]*ast.StructLit, len(disjuncts))
	for i, v := range disjuncts {
		c := newOASBuilder(b)
		c.value(v, f)
		t := c.finish()
		schemas[i] = (*ast.StructLit)(t)
		if len(t.Elts) == 0 {
			if c.typ == "" {
				return
			}
		}
	}

	for i, v := range disjuncts {
		// In OpenAPI schema are open by default. To ensure forward compatibility,
		// we do not represent closed structs with additionalProperties: false
		// (this is discouraged and often disallowed by implementions), but
		// rather enforce this by ensuring uniqueness of the disjuncts.
		//
		// TODO: subsumption may currently give false negatives. We are extra
		// conservative in these instances.
		subsumed := []ast.Expr{}
		for j, w := range disjuncts {
			if i == j {
				continue
			}
			err := v.Subsume(w, cue.Schema())
			if err == nil || errors.Is(err, internal.ErrInexact) {
				subsumed = append(subsumed, schemas[j])
			}
		}

		t := schemas[i]
		if len(subsumed) > 0 {
			// TODO: elide anyOf if there is only one element. This should be
			// rare if originating from oneOf.
			exclude := ast.NewStruct("not",
				ast.NewStruct("anyOf", ast.NewList(subsumed...)))
			if len(t.Elts) == 0 {
				t = exclude
			} else {
				t = ast.NewStruct("allOf", ast.NewList(t, exclude))
			}
		}
		anyOf = append(anyOf, t)
	}

	b.set("oneOf", ast.NewList(anyOf...))
}

func (b *builder) setValueType(v cue.Value) {
	if b.core != nil {
		return
	}

	k := v.IncompleteKind() &^ adt.NullKind
	switch k {
	case cue.BoolKind:
		b.typ = "boolean"
	case cue.FloatKind, cue.NumberKind:
		b.typ = "number"
	case cue.IntKind:
		b.typ = "integer"
	case cue.BytesKind:
		b.typ = "string"
	case cue.StringKind:
		b.typ = "string"
	case cue.StructKind:
		b.typ = "object"
	case cue.ListKind:
		b.typ = "array"
	}
}

func (b *builder) dispatch(f typeFunc, v cue.Value) {
	if f != nil {
		f(b, v)
		return
	}

	switch v.IncompleteKind() {
	case cue.NullKind:
		// TODO: for JSON schema we would set the type here. For OpenAPI,
		// it must be nullable.
		b.setSingle("nullable", ast.NewBool(true), true)

	case cue.BoolKind:
		b.setType("boolean", "")
		// No need to call.

	case cue.FloatKind, cue.NumberKind:
		// TODO:
		// Common   Name	type	format	Comments
		// float	number	float
		// double	number	double
		b.setType("number", "") // may be overridden to integer
		b.number(v)

	case cue.IntKind:
		// integer	integer	int32	signed 	32 bits
		// long		integer	int64	signed 	64 bits
		b.setType("integer", "") // may be overridden to integer
		b.number(v)

		// TODO: for JSON schema, consider adding multipleOf: 1.

	case cue.BytesKind:
		// byte		string	byte	base64 	encoded characters
		// binary	string	binary	any 	sequence of octets
		b.setType("string", "byte")
		b.bytes(v)
	case cue.StringKind:
		// date		string			date	   As defined by full-date - RFC3339
		// dateTime	string			date-time  As defined by date-time - RFC3339
		// password	string			password   A hint to UIs to obscure input
		b.setType("string", "")
		b.string(v)
	case cue.StructKind:
		b.setType("object", "")
		b.object(v)
	case cue.ListKind:
		b.setType("array", "")
		b.array(v)
	}
}

// object supports the following
//   - maxProperties: maximum allowed fields in this struct.
//   - minProperties: minimum required fields in this struct.
//   - patternProperties: [regexp]: schema
//     TODO: we can support this once .kv(key, value) allow
//     foo [=~"pattern"]: type
//     An instance field must match all schemas for which a regexp matches.
//     Even though it is not supported in OpenAPI, we should still accept it
//     when receiving from OpenAPI. We could possibly use disjunctions to encode
//     this.
//   - dependencies: what?
//   - propertyNames: schema
//     every property name in the enclosed schema matches that of
func (b *builder) object(v cue.Value) {
	// TODO: discriminator objects: we could theoretically derive discriminator
	// objects automatically: for every object in a oneOf/allOf/anyOf, or any
	// object composed of the same type, if a property is required and set to a
	// constant value for each type, it is a discriminator.

	switch op, a := v.Expr(); op {
	case cue.CallOp:
		name := fmt.Sprint(a[0])
		switch name {
		case "struct.MinFields":
			b.checkArgs(a, 1)
			b.setFilter("Schema", "minProperties", b.int(a[1]))
			return

		case "struct.MaxFields":
			b.checkArgs(a, 1)
			b.setFilter("Schema", "maxProperties", b.int(a[1]))
			return

		default:
			b.unsupported(a[0])
			return
		}

	case cue.NoOp, cue.SelectorOp:
		// TODO: extract format from specific type.

	default:
		b.failf(v, "unsupported op %v for object type (%v)", op, v)
		return
	}

	required := []ast.Expr{}
	for i, _ := v.Fields(); i.Next(); {
		required = append(required, ast.NewString(i.Label()))
	}
	if len(required) > 0 {
		b.setFilter("Schema", "required", ast.NewList(required...))
	}

	var properties *OrderedMap
	if b.singleFields != nil {
		properties = b.singleFields.getMap("properties")
	}
	hasProps := properties != nil
	if !hasProps {
		properties = &OrderedMap{}
	}

	for i, _ := v.Fields(cue.Optional(true), cue.Definitions(true)); i.Next(); {
		sel := i.Selector()
		if b.ctx.isInternal(sel) {
			continue
		}
		label := selectorLabel(sel)
		var core *builder
		if b.core != nil {
			core = b.core.properties[label]
		}
		schema := b.schema(core, sel, i.Value())
		switch {
		case sel.IsDefinition():
			ref := b.ctx.makeRef(b.ctx.instExt, cue.MakePath(append(b.ctx.path, sel)...))
			if ref == "" {
				continue
			}
			b.ctx.schemas.Set(ref, schema)
		case !b.isNonCore() || len(schema.Elts) > 0:
			properties.Set(label, schema)
		}
	}

	if !hasProps && properties.len() > 0 {
		b.setSingle("properties", (*ast.StructLit)(properties), false)
	}

	if t, ok := v.Elem(); ok &&
		(b.core == nil || b.core.items == nil) && b.checkCycle(t) {
		schema := b.schema(nil, cue.AnyString, t)
		if len(schema.Elts) > 0 {
			b.setSingle("additionalProperties", schema, true) // Not allowed in structural.
		}
	}

	// TODO: maxProperties, minProperties: can be done once we allow cap to
	// unify with structs.
}

// List constraints:
//
// Max and min items.
//   - maxItems: int (inclusive)
//   - minItems: int (inclusive)
//   - items (item type)
//     schema: applies to all items
//     array of schemas:
//     schema at pos must match if both value and items are defined.
//   - additional items:
//     schema: where items must be an array of schemas, intstance elements
//     succeed for if they match this value for any value at a position
//     greater than that covered by items.
//   - uniqueItems: bool
//     TODO: support with list.Unique() unique() or comprehensions.
//     For the latter, we need equality for all values, which is doable,
//     but not done yet.
//
// NOT SUPPORTED IN OpenAPI:
//   - contains:
//     schema: an array instance is valid if at least one element matches
//     this schema.
func (b *builder) array(v cue.Value) {

	switch op, a := v.Expr(); op {
	case cue.CallOp:
		name := fmt.Sprint(a[0])
		switch name {
		case "list.UniqueItems", "list.UniqueItems()":
			b.checkArgs(a, 0)
			b.setFilter("Schema", "uniqueItems", ast.NewBool(true))
			return

		case "list.MinItems":
			b.checkArgs(a, 1)
			b.setFilter("Schema", "minItems", b.int(a[1]))
			return

		case "list.MaxItems":
			b.checkArgs(a, 1)
			b.setFilter("Schema", "maxItems", b.int(a[1]))
			return

		default:
			b.unsupported(a[0])
			return
		}

	case cue.NoOp:
		// TODO: extract format from specific type.

	default:
		b.failf(v, "unsupported op %v for array type", op)
		return
	}

	// Possible conjuncts:
	//   - one list (CUE guarantees merging all conjuncts)
	//   - no cap: is unified with list
	//   - unique items: at most one, but idempotent if multiple.
	// There is never a need for allOf or anyOf. Note that a CUE list
	// corresponds almost one-to-one to OpenAPI lists.
	items := []ast.Expr{}
	count := 0
	for i, _ := v.List(); i.Next(); count++ {
		items = append(items, b.schema(nil, cue.Index(count), i.Value()))
	}
	if len(items) > 0 {
		// TODO: per-item schema are not allowed in OpenAPI, only in JSON Schema.
		// Perhaps we should turn this into an OR after first normalizing
		// the entries.
		b.set("items", ast.NewList(items...))
		// panic("per-item types not supported in OpenAPI")
	}

	// TODO:
	// A CUE cap can be a set of discontinuous ranges. If we encounter this,
	// we can create an allOf(list type, anyOf(ranges)).
	cap := v.Len()
	hasMax := false
	maxLength := int64(math.MaxInt64)

	if n, capErr := cap.Int64(); capErr == nil {
		maxLength = n
		hasMax = true
	} else {
		b.value(cap, (*builder).listCap)
	}

	if !hasMax || int64(len(items)) < maxLength {
		if typ, ok := v.Elem(); ok && b.checkCycle(typ) {
			var core *builder
			if b.core != nil {
				core = b.core.items
			}
			t := b.schema(core, cue.AnyString, typ)
			if len(items) > 0 {
				b.setFilter("Schema", "additionalItems", t) // Not allowed in structural.
			} else if !b.isNonCore() || len(t.Elts) > 0 {
				b.setSingle("items", t, true)
			}
		}
	}
}

func (b *builder) listCap(v cue.Value) {
	switch op, a := v.Expr(); op {
	case cue.LessThanOp:
		b.setFilter("Schema", "maxItems", b.inta(a[0], -1))
	case cue.LessThanEqualOp:
		b.setFilter("Schema", "maxItems", b.inta(a[0], 0))
	case cue.GreaterThanOp:
		b.setFilter("Schema", "minItems", b.inta(a[0], 1))
	case cue.GreaterThanEqualOp:
		if b.int64(a[0]) > 0 {
			b.setFilter("Schema", "minItems", b.inta(a[0], 0))
		}
	case cue.NoOp:
		// must be type, so okay.
	case cue.NotEqualOp:
		i := b.int(a[0])
		b.setNot("allOff", ast.NewList(
			b.kv("minItems", i),
			b.kv("maxItems", i),
		))

	default:
		b.failf(v, "unsupported op for list capacity %v", op)
		return
	}
}

func (b *builder) number(v cue.Value) {
	// Multiple conjuncts mostly means just additive constraints.
	// Type may be number of float.

	switch op, a := v.Expr(); op {
	case cue.LessThanOp:
		if b.ctx.exclusiveBool {
			b.setFilter("Schema", "exclusiveMaximum", ast.NewBool(true))
			b.setFilter("Schema", "maximum", b.big(a[0]))
		} else {
			b.setFilter("Schema", "exclusiveMaximum", b.big(a[0]))
		}

	case cue.LessThanEqualOp:
		b.setFilter("Schema", "maximum", b.big(a[0]))

	case cue.GreaterThanOp:
		if b.ctx.exclusiveBool {
			b.setFilter("Schema", "exclusiveMinimum", ast.NewBool(true))
			b.setFilter("Schema", "minimum", b.big(a[0]))
		} else {
			b.setFilter("Schema", "exclusiveMinimum", b.big(a[0]))
		}

	case cue.GreaterThanEqualOp:
		b.setFilter("Schema", "minimum", b.big(a[0]))

	case cue.NotEqualOp:
		i := b.big(a[0])
		b.setNot("allOff", ast.NewList(
			b.kv("minimum", i),
			b.kv("maximum", i),
		))

	case cue.CallOp:
		name := fmt.Sprint(a[0])
		switch name {
		case "math.MultipleOf":
			b.checkArgs(a, 1)
			b.setFilter("Schema", "multipleOf", b.int(a[1]))

		default:
			b.unsupported(a[0])
			return
		}

	case cue.NoOp:
		// TODO: extract format from specific type.

	default:
		b.failf(v, "unsupported op for number %v", op)
	}
}

// Multiple Regexp conjuncts are represented as allOf all other
// constraints can be combined unless in the even of discontinuous
// lengths.

// string supports the following options:
//
// - maxLength (Unicode codepoints)
// - minLength (Unicode codepoints)
// - pattern (a regexp)
//
// The regexp pattern is as follows, and is limited to be a  strict subset of RE2:
// Ref: https://tools.ietf.org/html/draft-wright-json-schema-validation-01#section-3.3
//
// JSON schema requires ECMA 262 regular expressions, but
// limited to the following constructs:
//   - simple character classes: [abc]
//   - range character classes: [a-z]
//   - complement character classes: [^abc], [^a-z]
//   - simple quantifiers: +, *, ?, and lazy versions +? *? ??
//   - range quantifiers: {x}, {x,y}, {x,}, {x}?, {x,y}?, {x,}?
//   - begin and end anchors: ^ and $
//   - simple grouping: (...)
//   - alteration: |
//
// This is a subset of RE2 used by CUE.
//
// Most notably absent:
//   - the '.' for any character (not sure if that is a doc bug)
//   - character classes \d \D [[::]] \pN \p{Name} \PN \P{Name}
//   - word boundaries
//   - capturing directives.
//   - flag setting
//   - comments
//
// The capturing directives and comments can be removed without
// compromising the meaning of the regexp (TODO). Removing
// flag setting will be tricky. Unicode character classes,
// boundaries, etc can be compiled into simple character classes,
// although the resulting regexp will look cumbersome.
func (b *builder) string(v cue.Value) {
	switch op, a := v.Expr(); op {

	case cue.RegexMatchOp, cue.NotRegexMatchOp:
		s, err := a[0].String()
		if err != nil {
			// TODO: this may be an unresolved interpolation or expression. Consider
			// whether it is reasonable to treat unevaluated operands as wholes and
			// generate a compound regular expression.
			b.failf(v, "regexp value must be a string: %v", err)
			return
		}
		if op == cue.RegexMatchOp {
			b.setFilter("Schema", "pattern", ast.NewString(s))
		} else {
			b.setNot("pattern", ast.NewString(s))
		}

	case cue.NoOp, cue.SelectorOp:

	case cue.CallOp:
		name := fmt.Sprint(a[0])
		switch name {
		case "strings.MinRunes":
			b.checkArgs(a, 1)
			b.setFilter("Schema", "minLength", b.int(a[1]))
			return

		case "strings.MaxRunes":
			b.checkArgs(a, 1)
			b.setFilter("Schema", "maxLength", b.int(a[1]))
			return

		default:
			b.unsupported(a[0])
			return
		}

	default:
		b.failf(v, "unsupported op %v for string type", op)
	}
}

func (b *builder) bytes(v cue.Value) {
	switch op, a := v.Expr(); op {

	case cue.RegexMatchOp, cue.NotRegexMatchOp:
		s, err := a[0].Bytes()
		if err != nil {
			// TODO: this may be an unresolved interpolation or expression. Consider
			// whether it is reasonable to treat unevaluated operands as wholes and
			// generate a compound regular expression.
			b.failf(v, "regexp value must be of type bytes: %v", err)
			return
		}

		e := ast.NewString(string(s))
		if op == cue.RegexMatchOp {
			b.setFilter("Schema", "pattern", e)
		} else {
			b.setNot("pattern", e)
		}

		// TODO: support the following JSON schema constraints
		// - maxLength
		// - minLength

	case cue.NoOp, cue.SelectorOp:

	default:
		b.failf(v, "unsupported op %v for bytes type", op)
	}
}

type builder struct {
	ctx          *buildContext
	typ          string
	format       string
	singleFields *oaSchema
	current      *oaSchema
	allOf        []*ast.StructLit
	deprecated   bool

	// Building structural schema
	core       *builder
	kind       cue.Kind
	filled     *ast.StructLit
	values     []cue.Value // in structural mode, all values of not and *Of.
	keys       []string
	properties map[string]*builder
	items      *builder
}

func newRootBuilder(c *buildContext) *builder {
	return &builder{ctx: c}
}

func newOASBuilder(parent *builder) *builder {
	core := parent
	if parent.core != nil {
		core = parent.core
	}
	b := &builder{
		core:   core,
		ctx:    parent.ctx,
		typ:    parent.typ,
		format: parent.format,
	}
	return b
}

func (b *builder) isNonCore() bool {
	return b.core != nil
}

func (b *builder) setType(t, format string) {
	if b.typ == "" {
		b.typ = t
		if format != "" {
			b.format = format
		}
	}
}

func setType(t *oaSchema, b *builder) {
	if b.typ != "" {
		if b.core == nil || (b.core.typ != b.typ && !b.ctx.structural) {
			if !t.exists("type") {
				t.Set("type", ast.NewString(b.typ))
			}
		}
	}
	if b.format != "" {
		if b.core == nil || b.core.format != b.format {
			t.Set("format", ast.NewString(b.format))
		}
	}
}

// setFilter is like set, but allows the key-value pair to be filtered.
func (b *builder) setFilter(schema, key string, v ast.Expr) {
	if re := b.ctx.fieldFilter; re != nil && re.MatchString(path.Join(schema, key)) {
		return
	}
	b.set(key, v)
}

// setSingle sets a value of which there should only be one.
func (b *builder) setSingle(key string, v ast.Expr, drop bool) {
	if b.singleFields == nil {
		b.singleFields = &OrderedMap{}
	}
	if b.singleFields.exists(key) {
		if !drop {
			b.failf(cue.Value{}, "more than one value added for key %q", key)
		}
	}
	b.singleFields.Set(key, v)
}

func (b *builder) set(key string, v ast.Expr) {
	if b.current == nil {
		b.current = &OrderedMap{}
		b.allOf = append(b.allOf, (*ast.StructLit)(b.current))
	} else if b.current.exists(key) {
		b.current = &OrderedMap{}
		b.allOf = append(b.allOf, (*ast.StructLit)(b.current))
	}
	b.current.Set(key, v)
}

func (b *builder) kv(key string, value ast.Expr) *ast.StructLit {
	return ast.NewStruct(key, value)
}

func (b *builder) setNot(key string, value ast.Expr) {
	b.add(ast.NewStruct("not", b.kv(key, value)))
}

func (b *builder) finish() *ast.StructLit {
	var t *OrderedMap

	if b.filled != nil {
		return b.filled
	}
	switch len(b.allOf) {
	case 0:
		t = &OrderedMap{}

	case 1:
		hasRef := false
		for _, e := range b.allOf[0].Elts {
			if f, ok := e.(*ast.Field); ok {
				name, _, _ := ast.LabelName(f.Label)
				hasRef = hasRef || name == "$ref"
			}
		}
		if !hasRef || b.singleFields == nil {
			t = (*OrderedMap)(b.allOf[0])
			break
		}
		fallthrough

	default:
		exprs := []ast.Expr{}
		if t != nil {
			exprs = append(exprs, (*ast.StructLit)(t))
		}
		for _, s := range b.allOf {
			exprs = append(exprs, s)
		}
		t = &OrderedMap{}
		t.Set("allOf", ast.NewList(exprs...))
	}
	if b.singleFields != nil {
		b.singleFields.Elts = append(b.singleFields.Elts, t.Elts...)
		t = b.singleFields
	}
	if b.deprecated {
		t.Set("deprecated", ast.NewBool(true))
	}
	setType(t, b)
	sortSchema((*ast.StructLit)(t))
	return (*ast.StructLit)(t)
}

func (b *builder) add(t *ast.StructLit) {
	b.allOf = append(b.allOf, t)
}

func (b *builder) addConjunct(f func(*builder)) {
	c := newOASBuilder(b)
	f(c)
	b.add((*ast.StructLit)(c.finish()))
}

func (b *builder) addRef(v cue.Value, inst cue.Value, ref cue.Path) {
	name := b.ctx.makeRef(inst, ref)
	b.addConjunct(func(b *builder) {
		b.allOf = append(b.allOf, ast.NewStruct(
			"$ref",
			ast.NewString(path.Join("#", b.ctx.refPrefix, name)),
		))
	})

	if b.ctx.inst != inst {
		b.ctx.externalRefs[name] = &externalType{
			ref:   name,
			inst:  inst,
			path:  ref,
			value: v,
		}
	}
}

func (b *buildContext) makeRef(inst cue.Value, ref cue.Path) string {
	if b.nameFunc != nil {
		return b.nameFunc(inst, ref)
	}
	var buf strings.Builder
	for i, sel := range ref.Selectors() {
		if i > 0 {
			buf.WriteByte('.')
		}
		// TODO what should this do when it's not a valid identifier?
		buf.WriteString(selectorLabel(sel))
	}
	return buf.String()
}

func (b *builder) int64(v cue.Value) int64 {
	v, _ = v.Default()
	i, err := v.Int64()
	if err != nil {
		b.failf(v, "could not retrieve int: %v", err)
	}
	return i
}

func (b *builder) intExpr(i int64) ast.Expr {
	return &ast.BasicLit{
		Kind:  token.INT,
		Value: fmt.Sprint(i),
	}
}

func (b *builder) int(v cue.Value) ast.Expr {
	return b.intExpr(b.int64(v))
}

func (b *builder) inta(v cue.Value, offset int64) ast.Expr {
	return b.intExpr(b.int64(v) + offset)
}

func (b *builder) decode(v cue.Value) ast.Expr {
	v, _ = v.Default()
	return v.Syntax(cue.Final()).(ast.Expr)
}

func (b *builder) big(v cue.Value) ast.Expr {
	v, _ = v.Default()
	return v.Syntax(cue.Final()).(ast.Expr)
}

func selectorLabel(sel cue.Selector) string {
	if sel.Type().ConstraintType() == cue.PatternConstraint {
		return "*"
	}
	switch sel.LabelType() {
	case cue.StringLabel:
		return sel.Unquoted()
	case cue.DefinitionLabel:
		return sel.String()[1:]
	}
	// We shouldn't get anything other than non-hidden
	// fields and definitions because we've not asked the
	// Fields iterator for those or created them explicitly.
	panic(fmt.Sprintf("unreachable %v", sel.Type()))
}
