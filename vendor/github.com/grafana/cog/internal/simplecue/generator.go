package simplecue

import (
	"fmt"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/format"
	"cuelang.org/go/pkg/strconv"
	"github.com/grafana/cog/internal/ast"
)

const cogAnnotationName = "cog"
const cuetsyAnnotationName = "cuetsy"
const hintKindEnum = "enum"
const annotationKindFieldName = "kind"
const enumMembersAttr = "memberNames"

type LibraryInclude struct {
	FSPath     string // path of the library on the filesystem
	ImportPath string // path used in CUE files to import that library
}

func ParseImports(cueImports []string) ([]LibraryInclude, error) {
	if len(cueImports) == 0 {
		return nil, nil
	}

	imports := make([]LibraryInclude, len(cueImports))
	for i, importDefinition := range cueImports {
		parts := strings.Split(importDefinition, ":")
		if len(parts) != 2 {
			return nil, fmt.Errorf("'%s' is not a valid import definition", importDefinition)
		}

		imports[i] = LibraryInclude{
			FSPath:     parts[0],
			ImportPath: parts[1],
		}
	}

	return imports, nil
}

type NameFunc func(value cue.Value, path cue.Path) string
type externalReferenceFunc func(referredPkg string, referredType string, defaultValue any, value cue.Value) (ast.Type, error)

type Config struct {
	// Package name used to generate code into.
	Package string

	// ForceNamedEnvelope decorates the parsed cue Value with an envelope whose
	// name is given. This is useful for dataqueries for example, where the
	// schema doesn't define any suitable top-level object.
	ForceNamedEnvelope string

	SchemaMetadata ast.SchemaMeta

	Libraries []LibraryInclude

	// NameFunc allows users to specify an alternative naming strategy for
	// objects and references. It is called with the value passed to the top
	// level method or function and the path to the entity being parsed.
	NameFunc NameFunc

	// InlineExternalReference instructs the parser to follow external
	// references (ie: references to objects outside the current schema)
	// and inline them.
	// By default, external references are parsed as actual `ast.Ref` to the
	// external objects.
	InlineExternalReference bool
}

type generator struct {
	schema      *ast.Schema
	refResolver *referenceResolver
	rootVal     cue.Value
	rootPath    cue.Path

	namingFunc            NameFunc
	externalReferenceFunc externalReferenceFunc
}

func GenerateAST(val cue.Value, c Config) (*ast.Schema, error) {
	g := &generator{
		schema: ast.NewSchema(c.Package, c.SchemaMetadata),
		refResolver: newReferenceResolver(val, referenceResolverConfig{
			Libraries:     c.Libraries,
			SchemaPackage: c.Package,
		}),
		rootVal:    val,
		rootPath:   val.Path(),
		namingFunc: c.NameFunc,
	}

	if g.namingFunc == nil {
		g.namingFunc = func(value cue.Value, path cue.Path) string {
			selectors := path.Selectors()
			return selectorLabel(selectors[len(selectors)-1])
		}
	}

	if c.InlineExternalReference {
		g.externalReferenceFunc = g.externalReferenceInlineTarget
	} else {
		g.externalReferenceFunc = g.externalReferenceAsReference
	}

	if c.ForceNamedEnvelope != "" {
		if err := g.walkCueSchemaWithEnvelope(c.ForceNamedEnvelope, val); err != nil {
			return nil, fmt.Errorf("[%s] %w", c.Package, err)
		}
	} else {
		if err := g.walkCueSchema(val); err != nil {
			return nil, fmt.Errorf("[%s] %w", c.Package, err)
		}
	}

	return g.schema, nil
}

func (g *generator) walkCueSchemaWithEnvelope(envelopeName string, v cue.Value) error {
	i, err := v.Fields(cue.Definitions(true), cue.Optional(true))
	if err != nil {
		return err
	}

	var rootObjectFields []ast.StructField
	for i.Next() {
		if i.Selector().IsDefinition() {
			name := g.namingFunc(g.rootVal, i.Value().Path())
			if err := g.declareObject(name, i.Value()); err != nil {
				return err
			}
			continue
		}

		nodeType, err := g.declareNode(i.Value())
		if err != nil {
			return err
		}

		name := selectorLabel(i.Selector())
		structField := ast.NewStructField(name, nodeType, ast.Comments(commentsFromCueValue(i.Value())))
		structField.Required = !i.IsOptional()

		rootObjectFields = append(rootObjectFields, structField)
	}

	if len(rootObjectFields) == 0 {
		return nil
	}

	structType := ast.NewStruct(rootObjectFields...)
	if g.schema.Metadata.Variant != "" {
		structType.Hints[ast.HintImplementsVariant] = string(g.schema.Metadata.Variant)
	}

	g.schema.AddObject(ast.Object{
		Name:     envelopeName,
		Comments: commentsFromCueValue(v),
		Type:     structType,
		SelfRef: ast.RefType{
			ReferredPkg:  g.schema.Package,
			ReferredType: envelopeName,
		},
	})

	g.schema.EntryPoint = envelopeName
	g.schema.EntryPointType = g.schema.Objects.Get(envelopeName).SelfRef.AsType()

	return nil
}

func (g *generator) walkCueSchema(v cue.Value) error {
	i, err := v.Fields(cue.Definitions(true))
	if err != nil {
		return err
	}

	for i.Next() {
		name := g.namingFunc(g.rootVal, i.Value().Path())
		if err := g.declareObject(name, i.Value()); err != nil {
			return err
		}
	}

	return nil
}

func (g *generator) declareObject(name string, v cue.Value) error {
	if g.schema.Objects.Has(name) {
		return nil
	}

	objectDef := ast.Object{
		Name:     name,
		Comments: commentsFromCueValue(v),
		SelfRef: ast.RefType{
			ReferredPkg:  g.schema.Package,
			ReferredType: name,
		},
	}

	// declare the object early, to help with recursive definitions
	g.schema.AddObject(objectDef)

	var err error
	var nodeType ast.Type

	// Try to guess if `v` can be represented as an enum
	implicitEnum, err := isImplicitEnum(v)
	if err != nil {
		return err
	}
	if implicitEnum {
		defVal, err := g.extractDefault(v)
		if err != nil {
			return err
		}

		nodeType, err = g.declareAnonymousEnum(v, defVal, hintsFromCueValue(v))
		if err != nil {
			return err
		}
	} else {
		nodeType, err = g.declareNode(v)
		if err != nil {
			return err
		}
	}

	objectDef.Type = nodeType

	g.schema.Objects.Set(name, objectDef)

	return nil
}

func (g *generator) extractEnumValues(v cue.Value) ([]ast.EnumValue, error) {
	_, dvals := v.Expr()
	a := v.Attribute(cogAnnotationName)
	// try to fall-back on the cuetsy annotation
	if a.Err() != nil {
		a = v.Attribute(cuetsyAnnotationName)
	}

	var attrMemberNameExist bool
	var evals []string
	if a.Err() == nil {
		val, found, err := a.Lookup(0, enumMembersAttr)
		if err == nil && found {
			attrMemberNameExist = true
			evals = strings.Split(val, "|")
			if len(evals) != len(dvals) {
				return nil, errorWithCueRef(v, "enums and %s attributes size doesn't match", enumMembersAttr)
			}
		}
	}

	// We only allowed String Enum to be generated without memberName attribute
	if v.IncompleteKind() != cue.StringKind && !attrMemberNameExist {
		return nil, errorWithCueRef(v, "numeric enums may only be generated from memberNames attribute")
	}

	subType := ast.String()
	if v.IncompleteKind() == cue.IntKind {
		subType = ast.NewScalar(ast.KindInt64)
	}

	var fields []ast.EnumValue
	for idx, dv := range dvals {
		var text string
		if attrMemberNameExist {
			text = evals[idx]
		} else {
			text, _ = dv.String()
		}

		if !dv.IsConcrete() {
			return nil, errorWithCueRef(v, "enums may only be generated from a disjunction of concrete strings or numbers")
		}

		val, err := cueConcreteToScalar(dv)
		if err != nil {
			return nil, err
		}

		fields = append(fields, ast.EnumValue{
			Type:  subType,
			Name:  text,
			Value: val,
		})
	}

	return fields, nil
}

func (g *generator) structFields(v cue.Value) ([]ast.StructField, error) {
	// This check might be too restrictive
	if v.IncompleteKind() != cue.StructKind {
		return nil, errorWithCueRef(v, "top-level type definitions may only be generated from structs")
	}

	var fields []ast.StructField

	// explore struct fields
	for i, _ := v.Fields(cue.Optional(true), cue.Definitions(true)); i.Next(); {
		fieldLabel := selectorLabel(i.Selector())

		// inline object definition
		if i.Selector().IsDefinition() {
			if err := g.declareObject(fieldLabel, i.Value()); err != nil {
				return nil, err
			}
			continue
		}

		// "normal" field
		node, err := g.declareNode(i.Value())
		if err != nil {
			return nil, err
		}

		field := ast.NewStructField(fieldLabel, node, ast.Comments(commentsFromCueValue(i.Value())))
		field.Required = !i.IsOptional()

		fields = append(fields, field)
	}

	return fields, nil
}

func (g *generator) declareNode(v cue.Value) (ast.Type, error) {
	v = g.removeTautologicalUnification(v)

	// This node is referring to another definition
	if ok, v, def := getReference(v); ok {
		return g.declareReference(v, def)
	}

	defVal, err := g.extractDefault(v)
	if err != nil {
		return ast.Type{}, err
	}

	hints := hintsFromCueValue(v)

	op, disjunctionBranches := v.Expr()
	if op == cue.OrOp && len(disjunctionBranches) > 1 {
		return g.declareDisjunction(v, hints, defVal)
	}

	switch v.IncompleteKind() {
	case cue.TopKind:
		return ast.Any(), nil
	case cue.NullKind:
		return ast.Null(), nil
	case cue.BoolKind:
		opts, err := g.scalarTypeOptions(v, defVal, hints)
		if err != nil {
			return ast.Type{}, err
		}

		return ast.Bool(opts...), nil
	case cue.BytesKind:
		opts, err := g.scalarTypeOptions(v, defVal, hints)
		if err != nil {
			return ast.Type{}, err
		}

		return ast.Bytes(opts...), nil
	case cue.StringKind:
		return g.declareString(v, defVal, hints)
	case cue.FloatKind, cue.NumberKind, cue.IntKind:
		return g.declareNumber(v, defVal, hints)
	case cue.ListKind:
		return g.declareList(v, defVal, hints)
	case cue.StructKind:
		// to make sure that we look at the actual OP
		evaluated := v.Eval()

		// in cue: {...}, {[string]: type}, or inline struct
		if op, _ := evaluated.Expr(); op == cue.NoOp {
			anyString := evaluated.LookupPath(cue.MakePath(cue.AnyString))
			if anyString.Exists() && !hasStructFields(evaluated) {
				typeDef, err := g.declareNode(anyString)
				if err != nil {
					return ast.Type{}, err
				}

				return ast.NewMap(ast.String(), typeDef, ast.Hints(hints), ast.Default(defVal)), nil
			}
		}

		fields, err := g.structFields(v)
		if err != nil {
			return ast.Type{}, err
		}

		// {...}
		if len(fields) == 0 {
			return ast.Any(), nil
		}

		def := ast.NewStruct(fields...)
		// Add the hints since we can't supply them in the constructor
		def.Hints = hints
		def.Default = defVal

		return def, nil
	default:
		return ast.Type{}, errorWithCueRef(v, "unexpected node with kind '%s'", v.IncompleteKind().String())
	}
}

func getReference(v cue.Value) (bool, cue.Value, cue.Value) {
	_, path := v.ReferencePath()
	if path.String() != "" {
		return true, v, v
	}

	op, exprs := v.Expr()

	if len(exprs) != 2 {
		return false, v, v
	}

	_, path = exprs[0].ReferencePath()
	if v.Kind() == cue.BottomKind && v.IncompleteKind() == cue.StructKind && path.String() != "" {
		// When a struct with defaults is completely filled, it usually has a NoOp op.
		if op == cue.NoOp {
			return true, exprs[0], v
		}

		// Accepts [AStruct | *{ ... }] and skips [AStruct | BStruct]
		if _, ok := v.Default(); ok {
			return true, exprs[0], v
		}
	}

	if op == cue.AndOp && exprs[0].Subsume(exprs[1]) == nil && exprs[1].Subsume(exprs[0]) == nil {
		return true, exprs[0], exprs[1]
	}
	return false, v, v
}

func (g *generator) declareReference(v cue.Value, defV cue.Value) (ast.Type, error) {
	referenceRootValue, path := v.ReferencePath()

	// The reference might point to a value defined "outside" of the original root cue value, but still in the same
	// schema/cue file.
	// Ex:
	// ```cue
	// #Origin: { creator: string }
	// spec: { // ← in this hypothetical scenario, the generator receives a cue value pointing here
	//   title: string
	//   origin: #Origin // `#Origin` refers to a value outside our original root
	// }
	// ```
	if areCuePathsFromSameRoot(g.rootPath, path) && !cuePathIsChildOf(g.rootPath, path) {
		refType := g.namingFunc(g.rootVal, path)
		if !g.schema.Objects.Has(refType) {
			if err := g.declareObject(refType, referenceRootValue.LookupPath(path)); err != nil {
				return ast.Type{}, err
			}
		}

		defValue, err := g.extractDefault(defV)
		if err != nil {
			return ast.Type{}, err
		}

		return ast.NewRef(g.schema.Package, refType, ast.Default(defValue)), nil
	}

	if path.String() != "" {
		refPkg, err := g.refResolver.PackageForNode(v.Source(), g.schema.Package)
		if err != nil {
			return ast.Type{}, errorWithCueRef(v, err.Error())
		}

		defValue, err := g.extractDefault(defV)
		if err != nil {
			return ast.Type{}, err
		}

		refType := g.namingFunc(g.rootVal, path)

		if refPkg == "time" && refType == "Time" {
			return ast.String(ast.Default(defValue), ast.Hints(ast.JenniesHints{
				ast.HintStringFormatDateTime: true,
			})), nil
		}

		// ensure that referenced objects are explored (in case they're not
		// defined within the "root" cue value given to cog as parsing input)
		if refPkg == g.schema.Package && !g.schema.Objects.Has(refType) {
			if err := g.declareObject(refType, referenceRootValue.LookupPath(path)); err != nil {
				return ast.Type{}, err
			}
		}

		if v.Kind() == cue.StringKind || v.Kind() == cue.NumberKind {
			var referenceValue any
			referenceValue, err = v.String()
			if err != nil {
				referenceValue, err = v.Int64()
				if err != nil {
					return ast.Type{}, errorWithCueRef(v, err.Error())
				}
			}

			// Sometimes the object isn't added because the scope
			if !g.schema.Objects.Has(refType) {
				if err := g.declareObject(refType, referenceRootValue.LookupPath(path)); err != nil {
					return ast.Type{}, err
				}
			}

			return ast.NewConstantReferenceType(refPkg, refType, referenceValue), nil
		}

		// Reference to another package
		if refPkg != g.schema.Package {
			return g.externalReferenceFunc(refPkg, refType, defValue, v)
		}

		return ast.NewRef(refPkg, refType, ast.Default(defValue)), nil
	}

	return ast.Type{}, nil
}

// externalReferenceAsReference represents external references as actual references.
func (g *generator) externalReferenceAsReference(referredPkg string, referredType string, defaultValue any, _ cue.Value) (ast.Type, error) {
	return ast.NewRef(referredPkg, referredType, ast.Default(defaultValue)), nil
}

// externalReferenceInlineTarget inlines external references into the current schema.
func (g *generator) externalReferenceInlineTarget(_ string, referredType string, defaultValue any, value cue.Value) (ast.Type, error) {
	if g.schema.Objects.Has(referredType) {
		return ast.NewRef(g.schema.Package, referredType, ast.Default(defaultValue)), nil
	}

	// Follow the reference
	refRoot, refPath := value.ReferencePath()
	referredValue := refRoot.LookupPath(refPath)

	// Declare the object into the current schema
	if err := g.declareObject(referredType, referredValue); err != nil {
		return ast.Type{}, err
	}

	// And return a local reference to it
	return ast.NewRef(g.schema.Package, referredType, ast.Default(defaultValue)), nil
}

func (g *generator) declareDisjunction(v cue.Value, hints ast.JenniesHints, defaultValue any) (ast.Type, error) {
	// Possible cases:
	// 1. "value" | "other_value" | "concrete_value" → we want to parse that as an "enum" type
	// 2. SomeType | SomeOtherType | string → we want to parse that as a disjunction

	// Try to guess if `v` can be represented as an enum (includes checking for a type hint) (1)
	implicitEnum, err := isImplicitEnum(v)
	if err != nil {
		return ast.Type{}, err
	}
	if implicitEnum {
		return g.declareAnonymousEnum(v, defaultValue, hints)
	}

	_, disjunctionBranchesWithPossibleDefault := v.Expr()
	defaultAsCueValue, hasDefault := v.Default()

	disjunctionBranches := make([]cue.Value, 0, len(disjunctionBranchesWithPossibleDefault))
	for _, branch := range disjunctionBranchesWithPossibleDefault {
		if hasDefault && branch.Equals(defaultAsCueValue) {
			_, bPath := branch.ReferencePath()
			_, dPath := defaultAsCueValue.ReferencePath()

			if bPath.String() == dPath.String() {
				continue
			}
		}

		disjunctionBranches = append(disjunctionBranches, branch)
	}

	// not a disjunction anymore
	if len(disjunctionBranchesWithPossibleDefault) != len(disjunctionBranches) && len(disjunctionBranches) == 1 {
		return g.declareNode(disjunctionBranches[0])
	}

	// We must be looking at a disjunction then (2)
	branches := make([]ast.Type, 0, len(disjunctionBranches))
	for _, subTypeValue := range disjunctionBranches {
		subType, err := g.declareNode(subTypeValue)
		if err != nil {
			return ast.Type{}, err
		}

		branches = append(branches, subType)
	}

	return ast.NewDisjunction(branches, ast.Default(defaultValue), ast.Hints(hints)), nil
}

func (g *generator) declareAnonymousEnum(v cue.Value, defValue any, hints ast.JenniesHints) (ast.Type, error) {
	allowed := cue.StringKind | cue.IntKind
	ik := v.IncompleteKind()
	if ik&allowed != ik {
		return ast.Type{}, errorWithCueRef(v, "enums may only be generated from concrete strings, or ints")
	}

	values, err := g.extractEnumValues(v)
	if err != nil {
		return ast.Type{}, err
	}

	return ast.NewEnum(values, ast.Default(defValue), ast.Hints(hints)), nil
}

func (g *generator) scalarTypeOptions(v cue.Value, defVal any, hints ast.JenniesHints) ([]ast.TypeOption, error) {
	opts := []ast.TypeOption{
		ast.Default(defVal),
		ast.Hints(hints),
	}

	if v.IsConcrete() {
		val, err := cueConcreteToScalar(v)
		if err != nil {
			return nil, err
		}

		opts = append(opts, ast.Value(val))
	}

	return opts, nil
}

func (g *generator) declareString(v cue.Value, defVal any, hints ast.JenniesHints) (ast.Type, error) {
	opts, err := g.scalarTypeOptions(v, defVal, hints)
	if err != nil {
		return ast.Type{}, err
	}

	ok, t, err := g.stringOrIntegerFromEnum(v, defVal, opts)
	if err != nil {
		return ast.Type{}, err
	}
	if ok {
		return t, nil
	}

	typeDef := ast.String(opts...)

	// Extract constraints
	constraints, err := g.declareStringConstraints(v)
	if err != nil {
		return typeDef, err
	}

	typeDef.Scalar.Constraints = constraints

	conjuncts := appendSplit(nil, cue.AndOp, v)
	for _, conjunct := range conjuncts {
		_, path := conjunct.ReferencePath()
		// the string was declared as string & time.Time
		if path.String() == "Time" {
			typeDef.Hints[ast.HintStringFormatDateTime] = true
		}
	}

	return typeDef, nil
}

func (g *generator) extractDefault(v cue.Value) (any, error) {
	defaultVal, ok := v.Default()
	if !ok {
		// nolint: nilnil
		return nil, nil
	}

	def, err := cueConcreteToScalar(defaultVal)
	if err != nil {
		return nil, err
	}

	return def, nil
}

func (g *generator) declareStringConstraints(v cue.Value) ([]ast.TypeConstraint, error) {
	typeAndConstraints := appendSplit(nil, cue.AndOp, v)

	// nothing to do
	if len(typeAndConstraints) == 1 {
		return nil, nil
	}

	// the constraint allows cue to infer a concrete value
	// ex: #SomeEnumType & "some value from the enum"
	if v.IsConcrete() {
		stringVal, err := v.String()
		if err != nil {
			return nil, errorWithCueRef(v, "could not convert concrete value to string")
		}

		return []ast.TypeConstraint{
			{
				Op:   ast.EqualOp,
				Args: []any{stringVal},
			},
		}, nil
	}

	constraints := make([]ast.TypeConstraint, 0, len(typeAndConstraints))

	for _, andExpr := range typeAndConstraints {
		op, args := andExpr.Expr()

		// TODO: support more OPs?
		if op != cue.CallOp {
			continue
		}

		// TODO: support more constraints?
		switch fmt.Sprint(args[0]) {
		case "strings.MinRunes":
			scalar, err := cueConcreteToScalar(args[1])
			if err != nil {
				return nil, err
			}

			constraints = append(constraints, ast.TypeConstraint{
				Op:   ast.MinLengthOp,
				Args: []any{scalar},
			})

		case "strings.MaxRunes":
			scalar, err := cueConcreteToScalar(args[1])
			if err != nil {
				return nil, err
			}

			constraints = append(constraints, ast.TypeConstraint{
				Op:   ast.MaxLengthOp,
				Args: []any{scalar},
			})
		}
	}

	return constraints, nil
}

func (g *generator) declareNumber(v cue.Value, defVal any, hints ast.JenniesHints) (ast.Type, error) {
	numberTypeWithConstraintsAsString, err := format.Node(v.Syntax())
	if err != nil {
		return ast.Type{}, err
	}
	parts := strings.Split(string(numberTypeWithConstraintsAsString), " ")
	if len(parts) == 0 {
		return ast.Type{}, errorWithCueRef(v, "something went very wrong while formatting a number expression into a string")
	}

	// dirty way of preserving the actual type from cue
	// note that CUE has predefined "types": https://cuelang.org/docs/tutorials/tour/types/bounddef/
	var numberType ast.ScalarKind
	for _, numberTypeCandidate := range parts {
		switch ast.ScalarKind(numberTypeCandidate) {
		case ast.KindFloat32, ast.KindFloat64:
			numberType = ast.ScalarKind(numberTypeCandidate)
		case ast.KindUint8, ast.KindUint16, ast.KindUint32, ast.KindUint64:
			numberType = ast.ScalarKind(numberTypeCandidate)
		case ast.KindInt8, ast.KindInt16, ast.KindInt32, ast.KindInt64:
			numberType = ast.ScalarKind(numberTypeCandidate)
		case "uint":
			numberType = ast.KindUint64
		case "int":
			numberType = ast.KindInt64
		case "float":
			numberType = ast.KindFloat64
		case "number":
			numberType = ast.KindFloat64
		}
	}

	// the heuristic above will likely fail for concrete numbers, so let's handle them explicitly
	if numberType == "" && v.IsConcrete() {
		switch v.Kind() {
		case cue.FloatKind:
			numberType = ast.KindFloat64
		case cue.IntKind:
			numberType = ast.KindInt64
		case cue.NumberKind:
			numberType = ast.KindFloat64
		}
	}

	if numberType == "" {
		return ast.Type{}, errorWithCueRef(v, "could not infer number type from expression '%s'", numberTypeWithConstraintsAsString)
	}

	typeDef := ast.NewScalar(numberType, ast.Default(defVal), ast.Hints(hints))

	// v.IsConcrete() being true means we're looking at a constant/known value
	if v.IsConcrete() {
		val, err := cueConcreteToScalar(v)
		if err != nil {
			return typeDef, err
		}

		typeDef.Scalar.Value = val
	}

	// If the default (all lists have a default, usually self, ugh) differs from the
	// input list, peel it off. Otherwise, our AnyIndex lookup may end up getting
	// sent on the wrong path.

	// extract constraints
	constraints, err := g.declareNumberConstraints(v)
	if err != nil {
		return ast.Type{}, err
	}

	typeDef.Scalar.Constraints = constraints

	return typeDef, nil
}

// having written this makes my soul hurt.
func (g *generator) declareNumberConstraints(v cue.Value) ([]ast.TypeConstraint, error) {
	// if the number has a default value, strip it from `v` before trying to extract constraints.
	_, hasDefault := v.Default()
	if hasDefault {
		_, dvals := v.Expr()
		v = dvals[0]
	}

	numberTypeWithConstraintsAsString, err := format.Node(v.Syntax())
	if err != nil {
		return nil, err
	}

	parts := strings.Split(string(numberTypeWithConstraintsAsString), " & ")

	extractOperatorAndArg := func(input string, numberKind cue.Kind) (ast.Op, any, error) {
		argStartIndex := -1

		var op ast.Op

		if input[0] == '>' {
			op = ast.GreaterThanOp
			argStartIndex = 1

			if input[1] == '=' {
				op = ast.GreaterThanEqualOp
				argStartIndex = 2
			}
		}
		if input[0] == '<' {
			op = ast.LessThanOp
			argStartIndex = 1

			if input[1] == '=' {
				op = ast.LessThanEqualOp
				argStartIndex = 2
			}
		}
		if input[0] == '=' && input[1] == '=' {
			op = ast.EqualOp
			argStartIndex = 2
		}
		if input[0] == '!' && input[1] == '=' {
			op = ast.NotEqualOp
			argStartIndex = 2
		}

		if op == "" {
			return op, nil, fmt.Errorf("could not infer operator from '%s'", input)
		}

		if numberKind.IsAnyOf(cue.FloatKind) {
			arg, err := strconv.ParseFloat(input[argStartIndex:], 64)
			return op, arg, err
		}

		arg, err := strconv.ParseInt(input[argStartIndex:], 10, 64)
		return op, arg, err
	}

	var constraints []ast.TypeConstraint
	for _, part := range parts {
		if part[0] != '<' && part[0] != '>' {
			continue
		}

		op, arg, err := extractOperatorAndArg(part, v.IncompleteKind())
		if err != nil {
			return nil, errorWithCueRef(v, err.Error())
		}

		constraints = append(constraints, ast.TypeConstraint{
			Op:   op,
			Args: []any{arg},
		})
	}

	return constraints, nil
}

func (g *generator) declareList(v cue.Value, defVal any, hints ast.JenniesHints) (ast.Type, error) {
	typeDef := ast.NewArray(ast.Any(), ast.Hints(hints), ast.Default(defVal))

	// closed list are not supported: our IR can't represent them :/
	// example of closed list:
	// ```cue
	// someList: [string, string] // a list with exactly two strings
	// ```
	if !v.Allows(cue.AnyIndex) {
		return ast.Type{}, errorWithCueRef(v, "closed lists are not supported")
	}

	// If the default (all lists have a default, usually self, ugh) differs from the
	// input list, peel it off. Otherwise, our AnyIndex lookup may end up getting
	// sent on the wrong path.
	defv, _ := v.Default()
	if !defv.Equals(v) {
		_, dvals := v.Expr()
		v = dvals[0]
	}

	e := v.LookupPath(cue.MakePath(cue.AnyIndex))
	if !e.Exists() {
		// unreachable?
		return ast.Type{}, errorWithCueRef(v, "open list must have a type")
	}

	expr, err := g.declareNode(e)
	if err != nil {
		return ast.Type{}, err
	}

	typeDef.Array.ValueType = expr

	return typeDef, nil
}

// removeTautologicalUnification simplifies CUE unifications
// that unify identical branches.
// Ex: SomeType & SomeType → SomeType
func (g *generator) removeTautologicalUnification(v cue.Value) cue.Value {
	op, branches := v.Expr()

	// not a unification
	if op != cue.AndOp {
		return v
	}

	// for now, we only simplify purely binary operations
	if len(branches) != 2 {
		return v
	}

	// If the branches mutually subsume each other, then they should be the same.
	// In which case we pick only one and return it.
	if branches[0].Equals(branches[1]) && branches[1].Subsume(branches[0]) == nil && branches[0].Subsume(branches[1]) == nil {
		return branches[0]
	}

	return v
}

// stringOrIntegerFromEnum detects the case when the string is defined with an enum value.
// When a definition extends from other and override a field defined as enum with a specific value,
// it detected as its type instead as a reference. Ex: MyEnum & "value"
func (g *generator) stringOrIntegerFromEnum(v cue.Value, defVal any, opts []ast.TypeOption) (bool, ast.Type, error) {
	if defVal != nil {
		return false, ast.Type{}, nil
	}

	conjuncts := appendSplit(nil, cue.AndOp, v)

	if len(conjuncts) == 1 {
		return false, ast.Type{}, nil
	}

	// When a reference extends from other, and it appends a new value, but it does not
	// override anything
	if conjuncts[0].IsConcrete() {
		return false, ast.Type{}, nil
	}

	// When an element is overriding a field and/or a value, the last element is the value that we want and
	// the rest of them are similar.
	if len(conjuncts) > 2 {
		conjuncts[1] = conjuncts[len(conjuncts)-1]
	}

	val, err := cueConcreteToScalar(conjuncts[1])
	if err != nil {
		return false, ast.Type{}, err
	}

	if val == nil {
		return false, ast.Type{}, nil
	}

	refPkg, err := g.refResolver.PackageForNode(conjuncts[0].Source(), g.schema.Package)
	if err != nil {
		return false, ast.Type{}, err
	}

	_, path := conjuncts[0].ReferencePath()
	if path.String() != "" {
		// ensure that the type referenced in the conjunction is discovered by
		// the parser and added into the IR
		if _, err = g.declareNode(conjuncts[0]); err != nil {
			return false, ast.Type{}, err
		}

		refType := g.namingFunc(g.rootVal, path)
		return true, ast.NewConstantReferenceType(refPkg, refType, val, opts...), nil
	}

	return false, ast.Type{}, nil
}
