package simplecue

import (
	"fmt"
	"strings"

	"cuelang.org/go/cue"
	cueast "cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/format"
	"github.com/grafana/cog/internal/ast"
)

//nolint:unused
func mustDumpsyn(v cue.Value) string {
	dump, err := dumpsyn(v)
	if err != nil {
		panic(err)
	}

	return dump
}

//nolint:unused
func dumpsyn(v cue.Value) (string, error) {
	syn := v.Syntax(
		cue.Concrete(false), // allow incomplete values
		cue.Definitions(false),
		cue.Optional(true),
		cue.Attributes(true),
		cue.Docs(true),
	)

	byt, err := format.Node(syn, format.TabIndent(true))

	return string(byt), err
}

func errorWithCueRef(v cue.Value, format string, args ...interface{}) error {
	return fmt.Errorf(v.Pos().String() + ": " + fmt.Sprintf(format, args...))
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

// from https://github.com/cue-lang/cue/blob/99e8578ac45e5e7e6ebf25794303bc916744c0d3/encoding/openapi/build.go#L490
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

	// nolint: gocritic
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

func hintsFromCueValue(v cue.Value) ast.JenniesHints {
	hints := make(ast.JenniesHints)

	for _, a := range v.Attributes(cue.ValueAttr) {
		if a.Name() != cogAnnotationName && a.Name() != cuetsyAnnotationName {
			continue
		}

		i := 0
		for i < a.NumArgs() {
			key, value := a.Arg(i)
			hints[key] = value

			i++
		}
	}

	return hints
}

func getTypeHint(v cue.Value) (string, error) {
	// Direct lookup of attributes with Attribute() seems broken-ish, so do our
	// own search as best we can, allowing ValueAttrs, which include both field
	// and decl attributes.
	var found bool
	var attr cue.Attribute
	for _, a := range v.Attributes(cue.ValueAttr) {
		if a.Name() == cogAnnotationName || a.Name() == cuetsyAnnotationName {
			found = true
			attr = a
		}
	}

	if !found {
		return "", nil
	}

	tt, found, err := attr.Lookup(0, annotationKindFieldName)
	if err != nil {
		return "", err
	}

	if !found {
		return "", errorWithCueRef(v, "no value for the %q key in @%s attribute", annotationKindFieldName, cogAnnotationName)
	}

	return tt, nil
}

// ONLY call this function if it has been established that the provided Value is
// Concrete.
func cueConcreteToScalar(v cue.Value) (interface{}, error) {
	switch v.Kind() {
	case cue.NullKind:
		return nil, nil // nolint: nilnil
	case cue.StringKind:
		return v.String()
	case cue.NumberKind, cue.FloatKind:
		return v.Float64()
	case cue.IntKind:
		return v.Int64()
	case cue.BoolKind:
		return v.Bool()
	case cue.BytesKind:
		return v.Bytes()
	case cue.ListKind:
		var values []any
		it, err := v.List()
		if err != nil {
			return nil, errorWithCueRef(v, "can create list iterator: %s", v.Kind())
		}

		for it.Next() {
			current := it.Value()

			val, err := cueConcreteToScalar(current)
			if err != nil {
				return nil, err
			}

			values = append(values, val)
		}

		if len(values) == 0 {
			// nolint: nilnil
			return nil, nil
		}

		return values, nil
	case cue.StructKind:
		newMap := make(map[string]interface{})
		iter, _ := v.Fields(cue.Optional(true), cue.Definitions(true))
		for iter.Next() {
			fieldLabel := selectorLabel(iter.Selector())
			value, err := cueConcreteToScalar(iter.Value())
			if err != nil {
				return nil, err
			}
			newMap[fieldLabel] = value
		}

		if len(newMap) == 0 {
			// nolint: nilnil
			return nil, nil
		}

		return newMap, nil
	case cue.BottomKind:
		// We could reach here when we have an enum default inside a default struct.
		if defVal, ok := v.Default(); ok {
			return cueConcreteToScalar(defVal)
		}
		// nolint: nilnil
		return nil, nil
	default:
		return nil, errorWithCueRef(v, "can not convert kind to scalar: %s", v.Kind())
	}
}

func commentsFromCueValue(v cue.Value) []string {
	docs := v.Doc()
	if s, ok := v.Source().(*cueast.Field); ok {
		for _, c := range s.Comments() {
			if !c.Doc && c.Line {
				docs = append(docs, c)
			}
		}
	}

	if len(docs) == 0 {
		return nil
	}

	ret := make([]string, 0, len(docs))
	for _, cg := range docs {
		ret = append(ret, strings.Split(strings.Trim(cg.Text(), "\n "), "\n")...)
	}

	return ret
}

func isImplicitEnum(v cue.Value) (bool, error) {
	typeHint, err := getTypeHint(v)
	if err != nil {
		return false, err
	}

	// Hinted as an enum
	if typeHint == hintKindEnum {
		return true, nil
	}

	// Is `v` a disjunction that we can turn into an enum?
	disjunctionBranches := appendSplit(nil, cue.OrOp, v)

	// only one disjunction branch means no disjunction
	if len(disjunctionBranches) == 1 {
		return false, nil
	}

	allowedKindsForEnum := cue.StringKind | cue.IntKind
	ik := v.IncompleteKind()

	// we can't handle the type
	if ik&allowedKindsForEnum != ik {
		return false, nil
	}

	// are all the values concrete?
	for _, branch := range disjunctionBranches {
		if !branch.IsConcrete() {
			return false, nil
		}
	}

	return true, nil
}

func hasStructFields(v cue.Value) bool {
	if v.IncompleteKind() != cue.StructKind {
		return false
	}

	for i, _ := v.Fields(cue.Optional(true), cue.Definitions(true)); i.Next(); {
		return true
	}

	return false
}

func areCuePathsFromSameRoot(a cue.Path, b cue.Path) bool {
	selectorsA := a.Selectors()
	selectorsB := b.Selectors()

	if len(selectorsA) == 0 || len(selectorsB) == 0 {
		return false
	}

	return selectorsA[0].String() == selectorsB[0].String()
}

func cuePathIsChildOf(root cue.Path, maybeChild cue.Path) bool {
	selectorsRoot := root.Selectors()
	selectorsChild := maybeChild.Selectors()

	if len(selectorsRoot) > len(selectorsChild) {
		return false
	}

	for i, rootSelector := range selectorsRoot {
		if rootSelector.String() != selectorsChild[i].String() {
			return false
		}
	}

	return true
}
