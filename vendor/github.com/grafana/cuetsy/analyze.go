package cuetsy

import (
	"bytes"
	"fmt"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/format"
)

func tpv(v cue.Value) {
	fmt.Printf("%s:\n%s\n", v.Path(), exprTree(v))
}

func findInstance(raw cue.Value) *build.Instance {
	// Search, recursively, for cue.Value.BuildInstance() on:
	// - the provided raw node
	// - the first direct conjunct of the raw node, if any
	// - the ReferencePath() result, if different, of either of the above

	bi := raw.BuildInstance()
	if bi != nil {
		return bi
	}

	if ref, path := raw.ReferencePath(); len(path.Selectors()) != 0 && ref != raw {
		if bi = findInstance(ref); bi != nil {
			return bi
		}
	}

	// No instance on anything reachable from the value itself. Try again with any
	// immediate conjuncts.
	if op, dvals := raw.Expr(); op == cue.AndOp {
		// Only try the first value, which will represent the package. Additional values
		// will be constraints specified on the whole package instance.
		bi = findInstance(dvals[0])
	}

	return bi
}

func isReference(v cue.Value) bool {
	// return cue.Dereference(v) == v
	// FIXME the below impl is just wrong, but current behavior somehow relies on it. Above is correct, it's a pointer comparison
	_, path := v.ReferencePath()
	return len(path.Selectors()) > 0
}

func getKindFor(v cue.Value) (TSType, error) {
	// Direct lookup of attributes with Attribute() seems broken-ish, so do our
	// own search as best we can, allowing ValueAttrs, which include both field
	// and decl attributes.
	// TODO write a unit test checking expected attribute output behavior to
	// protect this brittleness against regressions due to language changes
	var found bool
	var attr cue.Attribute
	for _, a := range v.Attributes(cue.ValueAttr) {
		if a.Name() == attrname {
			found = true
			attr = a
		}
	}

	if !found {
		if t, ok := getKindForField(v); ok {
			return t, nil
		}
		return "", valError(v, "value has no \"@%s\" attribute", attrname)
	}

	tt, found, err := attr.Lookup(0, attrKind)
	if err != nil {
		return "", err
	}

	if !found {
		return "", valError(v, "no value for the %q key in @%s attribute", attrKind, attrname)
	}
	return TSType(tt), nil
}

func getKindForField(v cue.Value) (TSType, bool) {
	if field, ok := v.Source().(*ast.Field); ok {
		if s, ok := field.Value.(*ast.StructLit); ok {
			return iterateField(s)
		}
	}
	return "", false
}

func iterateField(s *ast.StructLit) (TSType, bool) {
	for _, el := range s.Elts {
		if field, ok := el.(*ast.Field); ok {
			if len(field.Attrs) > 0 {
				return parseStringAttribute(field.Attrs[0].Text), true
			}
			if s, ok := field.Value.(*ast.StructLit); ok {
				return iterateField(s)
			}
		}
	}
	return "", false
}

func parseStringAttribute(attr string) TSType {
	switch attr {
	case "@cuetsy(kind=\"interface\")":
		return TypeInterface
	case "@cuetsy(kind=\"enum\")":
		return TypeEnum
	case "@cuetsy(kind=\"type\")":
		return TypeAlias
	default:
		return ""
	}
}

func targetsKind(v cue.Value, kinds ...TSType) bool {
	vkind, err := getKindFor(v)
	if err != nil {
		return false
	}

	if len(kinds) == 0 {
		kinds = allKinds[:]
	}
	for _, knd := range kinds {
		if vkind == knd {
			return true
		}
	}
	return false
}

// containsCuetsyReference does the same as containsReference, but returns true
// iff at least one referenced node passes the targetsKind predicate check
func containsCuetsyReference(v cue.Value, kinds ...TSType) bool {
	if isReference(v) && targetsKind(cue.Dereference(v), kinds...) {
		return true
	}
	for _, dv := range flatten(v) {
		if isReference(dv) && targetsKind(cue.Dereference(dv), kinds...) {
			return true
		}
	}

	return hasOverrideValues(v, kinds...)
}

func hasOverrideValues(v cue.Value, kinds ...TSType) bool {
	// When a value overrides the parent, its marked as BottomKind with two elements.
	// It also conflicts with enums with default value, so internally we need to check if
	// the operator of the second element isn't an OrOp
	op, values := v.Expr()
	if op != cue.AndOp || len(values) != 2 {
		return false
	}

	if values[1].Kind() != cue.BottomKind || values[1].IncompleteKind() == cue.TopKind {
		return false
	}

	for _, dv := range flatten(values[0]) {
		if isReference(dv) && targetsKind(cue.Dereference(dv), kinds...) {
			return true
		}
	}

	return false
}

type valuePredicate func(cue.Value) bool

type valuePredicates []valuePredicate

func (pl valuePredicates) And(v cue.Value) bool {
	for _, p := range pl {
		if !p(v) {
			return false
		}
	}
	return true
}

func (pl valuePredicates) Or(v cue.Value) bool {
	for _, p := range pl {
		if p(v) {
			return true
		}
	}
	return len(pl) == 0
}

func containsPred(v cue.Value, depth int, pl ...valuePredicate) bool {
	vpl := valuePredicates(pl)
	if vpl.And(v) {
		return true
	}
	if depth != -1 {
		op, args := v.Expr()
		_, has := v.Default()
		if op != cue.NoOp || has {
			for _, dv := range args {
				if containsPred(dv, depth-1, vpl...) {
					return true
				}
			}
		}
	}
	return false
}

func flatten(v cue.Value) []cue.Value {
	all := []cue.Value{v}

	op, dvals := v.Expr()
	defv, has := v.Default()
	// if (op != cue.NoOp || has) &&
	// 	v.Subsume(defv, cue.Raw()) != nil &&
	// 	defv.Subsume(v, cue.Raw()) != nil {
	// FIXME clearly wrong for using Equals(), but referencesValueAs currently depends on its wrong-ness
	if !v.Equals(defv) && (op != cue.NoOp || has) {
		all = append(all, dvals...)
		for _, dv := range dvals {
			all = append(all, flatten(dv)...)
		}
	}
	return all
}

func findRefWithKind(v cue.Value, kinds ...TSType) (ref, referrer cue.Value, has bool) {
	xt := exprTree(v)
	xt.Walk(func(n *exprNode) bool {
		// don't explore defaults paths
		if n.isdefault {
			return false
		}

		if !has && targetsKind(n.self, kinds...) {
			ref = n.self
			if n.parent != nil {
				referrer = n.parent.self
			}
			has = true
		}
		return !has
	})
	return ref, referrer, has
}

// appendSplit splits a cue.Value into the
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
		a = append(a, args...)
	} else if op != splitBy {
		a = append(a, v)
	} else {
		for _, v := range args {
			a = appendSplit(a, splitBy, v)
		}
	}

	if defaultValue, is := v.Default(); is {
		if o, _ := v.Expr(); o == cue.NoOp {
			a = append(a, defaultValue)
		}
	}
	return a
}

func dumpsyn(v cue.Value) (string, error) {
	syn := v.Syntax(
		cue.Concrete(false), // allow incomplete values
		cue.Definitions(false),
		cue.Optional(true),
		cue.Attributes(true),
		cue.Docs(true),
		cue.ResolveReferences(false),
	)

	byt, err := format.Node(syn, format.Simplify(), format.TabIndent(true))
	return string(byt), err
}

func dumpsynP(v cue.Value) string {
	str, err := dumpsyn(v)
	if err != nil {
		panic(err)
	}
	return str
}

type listProps struct {
	isOpen           bool
	divergentTypes   bool
	noDefault        bool
	differentDefault bool
	emptyDefault     bool
	bottomKinded     bool
	argBottomKinded  bool
}

type listField struct {
	v        cue.Value
	lenElems int
	anyType  cue.Value
	defv     cue.Value
	props    listProps
}

func (l *listField) eq(oli *listField) bool {
	if l.props.isOpen == oli.props.isOpen && l.props.divergentTypes == oli.props.divergentTypes && l.lenElems == oli.lenElems {
		if !l.props.isOpen {
			if l.lenElems == 0 {
				return true
			}
			p := cue.MakePath(cue.Index(0))
			// Sloppy, but enough to cover all but really complicated cases that
			// are likely unsupportable anyway
			return l.v.LookupPath(p).Equals(oli.v.LookupPath(p))
		}

		return l.anyType.Subsume(oli.anyType, cue.Raw(), cue.Schema()) == nil && oli.anyType.Subsume(l.anyType, cue.Raw(), cue.Schema()) == nil
	}

	return false
}

// analyzeList extracts useful characteristics of pure lists (i.e. no disjuncts
// with other kinds) into shorthand. The analysis walks down logic structures,
// but does NOT traverse references.
//
// The return value is a slice of listFields. An empty slice indicates the
// input was not a list. If the kind is mixed (i.e. disjunct over soem list and
// non-list types), this peels out
func analyzeList(v cue.Value) []*listField {
	// Start by checking incomplete kind and expr. We can bail early if there's no
	// ListKind at all. The recursion in this function relies on that behavior.
	ik := v.IncompleteKind()
	if ik&cue.ListKind != cue.ListKind {
		return nil
	}

	li := &listField{
		v: v,
	}
	all := []*listField{li}

	// There's at least _some_ non-empty lists in the value. Next, tease out
	// expressions and defaults.
	op, args := v.Expr()
	switch op {
	case cue.NoOp:
		// This branch hits whether there's an explicit default or not. e.g.,
		// - `[...string] | *[]`
		// - `[...string]`

		// Open lists are guaranteed to have a default: the empty list. And the default of
		// the empty list is itself (the empty list), recursively. This is annoying,
		// even if reasonable.
		defv, has := v.Default()
		li.props.noDefault = !has
		if has {
			li.props.differentDefault = !v.Equals(defv)
			li.props.emptyDefault = v.Context().NewList().Equals(defv)
		}

		li.props.bottomKinded = v.Kind() == cue.BottomKind

		li.props.isOpen = v.Allows(cue.AnyIndex)
		// li.props.isOpen = !v.IsClosed()
		v = args[0]
		li.props.argBottomKinded = v.Kind() == cue.BottomKind

		// if !li.props.differentDefault && li.props.emptyDefault {
		// 	// Input v is `[] | *[]`. Bail out to avoid infinite recursion.
		// 	break
		// }

		iter, _ := v.List()
		var first cue.Value
		var nonempty bool
		var ct int
		if nonempty = iter.Next(); nonempty {
			ct++
			first = iter.Value()
		}

		for iter.Next() {
			ct++
			iv := iter.Value()
			lerr, rerr := first.Subsume(iv, cue.Schema()), iv.Subsume(first, cue.Schema())
			if lerr != nil || rerr != nil {
				li.props.divergentTypes = true
			}
		}
		li.lenElems = ct

		if li.props.isOpen && nonempty {
			li.anyType = v.LookupPath(cue.MakePath(cue.AnyIndex))
			lerr, rerr := first.Subsume(li.anyType, cue.Schema()), li.anyType.Subsume(first, cue.Schema())
			if lerr != nil || rerr != nil {
				li.props.divergentTypes = true
			}
		}
	case cue.AndOp, cue.OrOp:
		// not sure this is a good idea but whatever
		for _, arg := range args {
			all = append(all, analyzeList(arg)...)
		}
	default:
		panic("wat")
	}

	return all
}

type listpred func(props listProps) bool

func groupBy(lfs []*listField, f listpred) (has, not []*listField) {
	for _, lf := range lfs {
		if f(lf.props) {
			has = append(has, lf)
		} else {
			not = append(not, lf)
		}
	}
	return
}

func (l *listField) String() string {
	var buf bytes.Buffer
	synstr, err := dumpsyn(l.v)
	if err != nil {
		synstr = l.v.Path().String()
	}
	fmt.Fprintf(&buf, "`%s`:\n", synstr)
	fmt.Fprintf(&buf, "\tisOpen: %v\n", l.props.isOpen)
	fmt.Fprintf(&buf, "\tdivergentTypes: %v\n", l.props.divergentTypes)
	fmt.Fprintf(&buf, "\tnoDefault: %v\n", l.props.noDefault)
	fmt.Fprintf(&buf, "\temptyDefault: %v\n", l.props.emptyDefault)
	fmt.Fprintf(&buf, "\tdifferentDefault: %v\n", l.props.differentDefault)
	fmt.Fprintf(&buf, "\tbottomKinded: %v\n", l.props.bottomKinded)
	fmt.Fprintf(&buf, "\targBottomKinded: %v\n", l.props.argBottomKinded)

	return buf.String()
}

func veq(a, b cue.Value) bool {
	// Theoretically, lattice equality can be defined as mutual subsumption. In
	// practice, Subsume() seems to ignore optional fields, and Equals() doesn't.
	//
	// But, Equals has false positives on cases involving incomplete values. It does
	// not seem to have any false negatives. So, use both and cross fingers.
	return a.Exists() &&
		b.Exists() &&
		a.Equals(b) &&
		a.Subsume(b, cue.Raw()) == nil &&
		b.Subsume(a, cue.Raw()) == nil
}
