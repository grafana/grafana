package checker

import (
	"fmt"
	"reflect"
	"regexp"
	"time"

	"github.com/expr-lang/expr/ast"
	"github.com/expr-lang/expr/builtin"
	. "github.com/expr-lang/expr/checker/nature"
	"github.com/expr-lang/expr/conf"
	"github.com/expr-lang/expr/file"
	"github.com/expr-lang/expr/parser"
)

var (
	anyType      = reflect.TypeOf(new(any)).Elem()
	boolType     = reflect.TypeOf(true)
	intType      = reflect.TypeOf(0)
	floatType    = reflect.TypeOf(float64(0))
	stringType   = reflect.TypeOf("")
	arrayType    = reflect.TypeOf([]any{})
	mapType      = reflect.TypeOf(map[string]any{})
	timeType     = reflect.TypeOf(time.Time{})
	durationType = reflect.TypeOf(time.Duration(0))

	anyTypeSlice = []reflect.Type{anyType}
)

// ParseCheck parses input expression and checks its types. Also, it applies
// all provided patchers. In case of error, it returns error with a tree.
func ParseCheck(input string, config *conf.Config) (*parser.Tree, error) {
	tree, err := parser.ParseWithConfig(input, config)
	if err != nil {
		return tree, err
	}

	_, err = new(Checker).PatchAndCheck(tree, config)
	if err != nil {
		return tree, err
	}

	return tree, nil
}

// Check calls Check on a disposable Checker.
func Check(tree *parser.Tree, config *conf.Config) (reflect.Type, error) {
	return new(Checker).Check(tree, config)
}

type Checker struct {
	config          *conf.Config
	predicateScopes []predicateScope
	varScopes       []varScope
	err             *file.Error
	needsReset      bool
}

type predicateScope struct {
	collection Nature
	vars       []varScope
}

type varScope struct {
	name   string
	nature Nature
}

// PatchAndCheck applies all patchers and checks the tree.
func (v *Checker) PatchAndCheck(tree *parser.Tree, config *conf.Config) (reflect.Type, error) {
	v.reset(config)
	if len(config.Visitors) > 0 {
		// Run all patchers that dont support being run repeatedly first
		v.runVisitors(tree, false)

		// Run patchers that require multiple passes next (currently only Operator patching)
		v.runVisitors(tree, true)
	}
	return v.Check(tree, config)
}

// Check checks types of the expression tree. It returns type of the expression
// and error if any. If config is nil, then default configuration will be used.
func (v *Checker) Check(tree *parser.Tree, config *conf.Config) (reflect.Type, error) {
	v.reset(config)
	return v.check(tree)
}

// Run visitors in a given config over the given tree
// runRepeatable controls whether to filter for only vistors that require multiple passes or not
func (v *Checker) runVisitors(tree *parser.Tree, runRepeatable bool) {
	for {
		more := false
		for _, visitor := range v.config.Visitors {
			// We need to perform types check, because some visitors may rely on
			// types information available in the tree.
			_, _ = v.Check(tree, v.config)

			r, repeatable := visitor.(interface {
				Reset()
				ShouldRepeat() bool
			})

			if repeatable {
				if runRepeatable {
					r.Reset()
					ast.Walk(&tree.Node, visitor)
					more = more || r.ShouldRepeat()
				}
			} else {
				if !runRepeatable {
					ast.Walk(&tree.Node, visitor)
				}
			}
		}

		if !more {
			break
		}
	}
}

func (v *Checker) check(tree *parser.Tree) (reflect.Type, error) {
	nt := v.visit(tree.Node)

	// To keep compatibility with previous versions, we should return any, if nature is unknown.
	t := nt.Type
	if t == nil {
		t = anyType
	}

	if v.err != nil {
		return t, v.err.Bind(tree.Source)
	}

	if v.config.Expect != reflect.Invalid {
		if v.config.ExpectAny {
			if nt.IsUnknown(&v.config.NtCache) {
				return t, nil
			}
		}

		switch v.config.Expect {
		case reflect.Int, reflect.Int64, reflect.Float64:
			if !nt.IsNumber() {
				return nil, fmt.Errorf("expected %v, but got %s", v.config.Expect, nt.String())
			}
		default:
			if nt.Kind != v.config.Expect {
				return nil, fmt.Errorf("expected %v, but got %s", v.config.Expect, nt.String())
			}
		}
	}

	return t, nil
}

func (v *Checker) reset(config *conf.Config) {
	if v.needsReset {
		clearSlice(v.predicateScopes)
		clearSlice(v.varScopes)
		v.predicateScopes = v.predicateScopes[:0]
		v.varScopes = v.varScopes[:0]
		v.err = nil
	}
	v.needsReset = true

	if config == nil {
		config = conf.New(nil)
	}
	v.config = config
}

func clearSlice[S ~[]E, E any](s S) {
	var zero E
	for i := range s {
		s[i] = zero
	}
}

func (v *Checker) visit(node ast.Node) Nature {
	var nt Nature
	switch n := node.(type) {
	case *ast.NilNode:
		nt = v.config.NtCache.NatureOf(nil)
	case *ast.IdentifierNode:
		nt = v.identifierNode(n)
	case *ast.IntegerNode:
		nt = v.config.NtCache.FromType(intType)
	case *ast.FloatNode:
		nt = v.config.NtCache.FromType(floatType)
	case *ast.BoolNode:
		nt = v.config.NtCache.FromType(boolType)
	case *ast.StringNode:
		nt = v.config.NtCache.FromType(stringType)
	case *ast.ConstantNode:
		nt = v.config.NtCache.FromType(reflect.TypeOf(n.Value))
	case *ast.UnaryNode:
		nt = v.unaryNode(n)
	case *ast.BinaryNode:
		nt = v.binaryNode(n)
	case *ast.ChainNode:
		nt = v.chainNode(n)
	case *ast.MemberNode:
		nt = v.memberNode(n)
	case *ast.SliceNode:
		nt = v.sliceNode(n)
	case *ast.CallNode:
		nt = v.callNode(n)
	case *ast.BuiltinNode:
		nt = v.builtinNode(n)
	case *ast.PredicateNode:
		nt = v.predicateNode(n)
	case *ast.PointerNode:
		nt = v.pointerNode(n)
	case *ast.VariableDeclaratorNode:
		nt = v.variableDeclaratorNode(n)
	case *ast.SequenceNode:
		nt = v.sequenceNode(n)
	case *ast.ConditionalNode:
		nt = v.conditionalNode(n)
	case *ast.ArrayNode:
		nt = v.arrayNode(n)
	case *ast.MapNode:
		nt = v.mapNode(n)
	case *ast.PairNode:
		nt = v.pairNode(n)
	default:
		panic(fmt.Sprintf("undefined node type (%T)", node))
	}
	node.SetNature(nt)
	return nt
}

func (v *Checker) error(node ast.Node, format string, args ...any) Nature {
	if v.err == nil { // show first error
		v.err = &file.Error{
			Location: node.Location(),
			Message:  fmt.Sprintf(format, args...),
		}
	}
	return Nature{}
}

func (v *Checker) identifierNode(node *ast.IdentifierNode) Nature {
	for i := len(v.varScopes) - 1; i >= 0; i-- {
		if v.varScopes[i].name == node.Value {
			return v.varScopes[i].nature
		}
	}
	if node.Value == "$env" {
		return Nature{}
	}

	return v.ident(node, node.Value, v.config.Strict, true)
}

// ident method returns type of environment variable, builtin or function.
func (v *Checker) ident(node ast.Node, name string, strict, builtins bool) Nature {
	if nt, ok := v.config.Env.Get(&v.config.NtCache, name); ok {
		return nt
	}
	if builtins {
		if fn, ok := v.config.Functions[name]; ok {
			nt := v.config.NtCache.FromType(fn.Type())
			if nt.TypeData == nil {
				nt.TypeData = new(TypeData)
			}
			nt.TypeData.Func = fn
			return nt
		}
		if fn, ok := v.config.Builtins[name]; ok {
			nt := v.config.NtCache.FromType(fn.Type())
			if nt.TypeData == nil {
				nt.TypeData = new(TypeData)
			}
			nt.TypeData.Func = fn
			return nt
		}
	}
	if v.config.Strict && strict {
		return v.error(node, "unknown name %s", name)
	}
	return Nature{}
}

func (v *Checker) unaryNode(node *ast.UnaryNode) Nature {
	nt := v.visit(node.Node)
	nt = nt.Deref(&v.config.NtCache)

	switch node.Operator {

	case "!", "not":
		if nt.IsBool() {
			return v.config.NtCache.FromType(boolType)
		}
		if nt.IsUnknown(&v.config.NtCache) {
			return v.config.NtCache.FromType(boolType)
		}

	case "+", "-":
		if nt.IsNumber() {
			return nt
		}
		if nt.IsUnknown(&v.config.NtCache) {
			return Nature{}
		}

	default:
		return v.error(node, "unknown operator (%s)", node.Operator)
	}

	return v.error(node, `invalid operation: %s (mismatched type %s)`, node.Operator, nt.String())
}

func (v *Checker) binaryNode(node *ast.BinaryNode) Nature {
	l := v.visit(node.Left)
	r := v.visit(node.Right)

	l = l.Deref(&v.config.NtCache)
	r = r.Deref(&v.config.NtCache)

	switch node.Operator {
	case "==", "!=":
		if l.ComparableTo(&v.config.NtCache, r) {
			return v.config.NtCache.FromType(boolType)
		}

	case "or", "||", "and", "&&":
		if l.IsBool() && r.IsBool() {
			return v.config.NtCache.FromType(boolType)
		}
		if l.MaybeCompatible(&v.config.NtCache, r, BoolCheck) {
			return v.config.NtCache.FromType(boolType)
		}

	case "<", ">", ">=", "<=":
		if l.IsNumber() && r.IsNumber() {
			return v.config.NtCache.FromType(boolType)
		}
		if l.IsString() && r.IsString() {
			return v.config.NtCache.FromType(boolType)
		}
		if l.IsTime() && r.IsTime() {
			return v.config.NtCache.FromType(boolType)
		}
		if l.IsDuration() && r.IsDuration() {
			return v.config.NtCache.FromType(boolType)
		}
		if l.MaybeCompatible(&v.config.NtCache, r, NumberCheck, StringCheck, TimeCheck, DurationCheck) {
			return v.config.NtCache.FromType(boolType)
		}

	case "-":
		if l.IsNumber() && r.IsNumber() {
			return l.PromoteNumericNature(&v.config.NtCache, r)
		}
		if l.IsTime() && r.IsTime() {
			return v.config.NtCache.FromType(durationType)
		}
		if l.IsTime() && r.IsDuration() {
			return v.config.NtCache.FromType(timeType)
		}
		if l.IsDuration() && r.IsDuration() {
			return v.config.NtCache.FromType(durationType)
		}
		if l.MaybeCompatible(&v.config.NtCache, r, NumberCheck, TimeCheck, DurationCheck) {
			return Nature{}
		}

	case "*":
		if l.IsNumber() && r.IsNumber() {
			return l.PromoteNumericNature(&v.config.NtCache, r)
		}
		if l.IsNumber() && r.IsDuration() {
			return v.config.NtCache.FromType(durationType)
		}
		if l.IsDuration() && r.IsNumber() {
			return v.config.NtCache.FromType(durationType)
		}
		if l.IsDuration() && r.IsDuration() {
			return v.config.NtCache.FromType(durationType)
		}
		if l.MaybeCompatible(&v.config.NtCache, r, NumberCheck, DurationCheck) {
			return Nature{}
		}

	case "/":
		if l.IsNumber() && r.IsNumber() {
			return v.config.NtCache.FromType(floatType)
		}
		if l.MaybeCompatible(&v.config.NtCache, r, NumberCheck) {
			return v.config.NtCache.FromType(floatType)
		}

	case "**", "^":
		if l.IsNumber() && r.IsNumber() {
			return v.config.NtCache.FromType(floatType)
		}
		if l.MaybeCompatible(&v.config.NtCache, r, NumberCheck) {
			return v.config.NtCache.FromType(floatType)
		}

	case "%":
		if l.IsInteger && r.IsInteger {
			return v.config.NtCache.FromType(intType)
		}
		if l.MaybeCompatible(&v.config.NtCache, r, IntegerCheck) {
			return v.config.NtCache.FromType(intType)
		}

	case "+":
		if l.IsNumber() && r.IsNumber() {
			return l.PromoteNumericNature(&v.config.NtCache, r)
		}
		if l.IsString() && r.IsString() {
			return v.config.NtCache.FromType(stringType)
		}
		if l.IsTime() && r.IsDuration() {
			return v.config.NtCache.FromType(timeType)
		}
		if l.IsDuration() && r.IsTime() {
			return v.config.NtCache.FromType(timeType)
		}
		if l.IsDuration() && r.IsDuration() {
			return v.config.NtCache.FromType(durationType)
		}
		if l.MaybeCompatible(&v.config.NtCache, r, NumberCheck, StringCheck, TimeCheck, DurationCheck) {
			return Nature{}
		}

	case "in":
		if (l.IsString() || l.IsUnknown(&v.config.NtCache)) && r.IsStruct() {
			return v.config.NtCache.FromType(boolType)
		}
		if r.IsMap() {
			rKey := r.Key(&v.config.NtCache)
			if !l.IsUnknown(&v.config.NtCache) && !l.AssignableTo(rKey) {
				return v.error(node, "cannot use %s as type %s in map key", l.String(), rKey.String())
			}
			return v.config.NtCache.FromType(boolType)
		}
		if r.IsArray() {
			rElem := r.Elem(&v.config.NtCache)
			if !l.ComparableTo(&v.config.NtCache, rElem) {
				return v.error(node, "cannot use %s as type %s in array", l.String(), rElem.String())
			}
			return v.config.NtCache.FromType(boolType)
		}
		if l.IsUnknown(&v.config.NtCache) && r.IsAnyOf(StringCheck, ArrayCheck, MapCheck) {
			return v.config.NtCache.FromType(boolType)
		}
		if r.IsUnknown(&v.config.NtCache) {
			return v.config.NtCache.FromType(boolType)
		}

	case "matches":
		if s, ok := node.Right.(*ast.StringNode); ok {
			_, err := regexp.Compile(s.Value)
			if err != nil {
				return v.error(node, err.Error())
			}
		}
		if (l.IsString() || l.IsByteSlice()) && r.IsString() {
			return v.config.NtCache.FromType(boolType)
		}
		if l.MaybeCompatible(&v.config.NtCache, r, StringCheck) {
			return v.config.NtCache.FromType(boolType)
		}

	case "contains", "startsWith", "endsWith":
		if l.IsString() && r.IsString() {
			return v.config.NtCache.FromType(boolType)
		}
		if l.MaybeCompatible(&v.config.NtCache, r, StringCheck) {
			return v.config.NtCache.FromType(boolType)
		}

	case "..":
		if l.IsInteger && r.IsInteger || l.MaybeCompatible(&v.config.NtCache, r, IntegerCheck) {
			return ArrayFromType(&v.config.NtCache, intType)
		}

	case "??":
		if l.Nil && !r.Nil {
			return r
		}
		if !l.Nil && r.Nil {
			return l
		}
		if l.Nil && r.Nil {
			return v.config.NtCache.NatureOf(nil)
		}
		if r.AssignableTo(l) {
			return l
		}
		return Nature{}

	default:
		return v.error(node, "unknown operator (%s)", node.Operator)

	}

	return v.error(node, `invalid operation: %s (mismatched types %s and %s)`, node.Operator, l.String(), r.String())
}

func (v *Checker) chainNode(node *ast.ChainNode) Nature {
	return v.visit(node.Node)
}

func (v *Checker) memberNode(node *ast.MemberNode) Nature {
	// $env variable
	if an, ok := node.Node.(*ast.IdentifierNode); ok && an.Value == "$env" {
		if name, ok := node.Property.(*ast.StringNode); ok {
			strict := v.config.Strict
			if node.Optional {
				// If user explicitly set optional flag, then we should not
				// throw error if field is not found (as user trying to handle
				// this case). But if user did not set optional flag, then we
				// should throw error if field is not found & v.config.Strict.
				strict = false
			}
			return v.ident(node, name.Value, strict, false /* no builtins and no functions */)
		}
		return Nature{}
	}

	base := v.visit(node.Node)
	prop := v.visit(node.Property)

	if base.IsUnknown(&v.config.NtCache) {
		return Nature{}
	}

	if name, ok := node.Property.(*ast.StringNode); ok {
		if base.Nil {
			return v.error(node, "type nil has no field %s", name.Value)
		}

		// First, check methods defined on base type itself,
		// independent of which type it is. Without dereferencing.
		if m, ok := base.MethodByName(&v.config.NtCache, name.Value); ok {
			return m
		}
	}

	base = base.Deref(&v.config.NtCache)

	switch base.Kind {
	case reflect.Map:
		// If the map key is a pointer, we should not dereference the property.
		if !prop.AssignableTo(base.Key(&v.config.NtCache)) {
			propDeref := prop.Deref(&v.config.NtCache)
			if propDeref.AssignableTo(base.Key(&v.config.NtCache)) {
				prop = propDeref
			}
		}
		if !prop.AssignableTo(base.Key(&v.config.NtCache)) && !prop.IsUnknown(&v.config.NtCache) {
			return v.error(node.Property, "cannot use %s to get an element from %s", prop.String(), base.String())
		}
		if prop, ok := node.Property.(*ast.StringNode); ok && base.TypeData != nil {
			if field, ok := base.Fields[prop.Value]; ok {
				return field
			} else if base.Strict {
				return v.error(node.Property, "unknown field %s", prop.Value)
			}
		}
		return base.Elem(&v.config.NtCache)

	case reflect.Array, reflect.Slice:
		prop = prop.Deref(&v.config.NtCache)
		if !prop.IsInteger && !prop.IsUnknown(&v.config.NtCache) {
			return v.error(node.Property, "array elements can only be selected using an integer (got %s)", prop.String())
		}
		return base.Elem(&v.config.NtCache)

	case reflect.Struct:
		if name, ok := node.Property.(*ast.StringNode); ok {
			propertyName := name.Value
			if field, ok := base.FieldByName(&v.config.NtCache, propertyName); ok {
				return v.config.NtCache.FromType(field.Type)
			}
			if node.Method {
				return v.error(node, "type %v has no method %v", base.String(), propertyName)
			}
			return v.error(node, "type %v has no field %v", base.String(), propertyName)
		}
	}

	// Not found.

	if name, ok := node.Property.(*ast.StringNode); ok {
		if node.Method {
			return v.error(node, "type %v has no method %v", base.String(), name.Value)
		}
		return v.error(node, "type %v has no field %v", base.String(), name.Value)
	}
	return v.error(node, "type %v[%v] is undefined", base.String(), prop.String())
}

func (v *Checker) sliceNode(node *ast.SliceNode) Nature {
	nt := v.visit(node.Node)

	if nt.IsUnknown(&v.config.NtCache) {
		return Nature{}
	}

	switch nt.Kind {
	case reflect.String, reflect.Array, reflect.Slice:
		// ok
	default:
		return v.error(node, "cannot slice %s", nt.String())
	}

	if node.From != nil {
		from := v.visit(node.From)
		from = from.Deref(&v.config.NtCache)
		if !from.IsInteger && !from.IsUnknown(&v.config.NtCache) {
			return v.error(node.From, "non-integer slice index %v", from.String())
		}
	}

	if node.To != nil {
		to := v.visit(node.To)
		to = to.Deref(&v.config.NtCache)
		if !to.IsInteger && !to.IsUnknown(&v.config.NtCache) {
			return v.error(node.To, "non-integer slice index %v", to.String())
		}
	}

	return nt
}

func (v *Checker) callNode(node *ast.CallNode) Nature {
	// Check if type was set on node (for example, by patcher)
	// and use node type instead of function return type.
	//
	// If node type is anyType, then we should use function
	// return type. For example, on error we return anyType
	// for a call `errCall().Method()` and method will be
	// evaluated on `anyType.Method()`, so return type will
	// be anyType `anyType.Method(): anyType`. Patcher can
	// fix `errCall()` to return proper type, so on second
	// checker pass we should replace anyType on method node
	// with new correct function return type.
	if typ := node.Type(); typ != nil && typ != anyType {
		return *node.Nature()
	}

	nt := v.visit(node.Callee)
	if nt.IsUnknown(&v.config.NtCache) {
		return Nature{}
	}

	if nt.TypeData != nil && nt.TypeData.Func != nil {
		return v.checkFunction(nt.TypeData.Func, node, node.Arguments)
	}

	fnName := "function"
	if identifier, ok := node.Callee.(*ast.IdentifierNode); ok {
		fnName = identifier.Value
	}
	if member, ok := node.Callee.(*ast.MemberNode); ok {
		if name, ok := member.Property.(*ast.StringNode); ok {
			fnName = name.Value
		}
	}

	if nt.Nil {
		return v.error(node, "%v is nil; cannot call nil as function", fnName)
	}

	if nt.Kind == reflect.Func {
		outType, err := v.checkArguments(fnName, nt, node.Arguments, node)
		if err != nil {
			if v.err == nil {
				v.err = err
			}
			return Nature{}
		}
		return outType
	}
	return v.error(node, "%s is not callable", nt.String())
}

func (v *Checker) builtinNode(node *ast.BuiltinNode) Nature {
	switch node.Name {
	case "all", "none", "any", "one":
		collection := v.visit(node.Arguments[0])
		collection = collection.Deref(&v.config.NtCache)
		if !collection.IsArray() && !collection.IsUnknown(&v.config.NtCache) {
			return v.error(node.Arguments[0], "builtin %v takes only array (got %v)", node.Name, collection.String())
		}

		v.begin(collection)
		predicate := v.visit(node.Arguments[1])
		v.end()

		if predicate.IsFunc() &&
			predicate.NumOut() == 1 &&
			predicate.NumIn() == 1 && predicate.IsFirstArgUnknown(&v.config.NtCache) {

			predicateOut := predicate.Out(&v.config.NtCache, 0)
			if !predicateOut.IsBool() && !predicateOut.IsUnknown(&v.config.NtCache) {
				return v.error(node.Arguments[1], "predicate should return boolean (got %s)", predicateOut.String())
			}
			return v.config.NtCache.FromType(boolType)
		}
		return v.error(node.Arguments[1], "predicate should has one input and one output param")

	case "filter":
		collection := v.visit(node.Arguments[0])
		collection = collection.Deref(&v.config.NtCache)
		if !collection.IsArray() && !collection.IsUnknown(&v.config.NtCache) {
			return v.error(node.Arguments[0], "builtin %v takes only array (got %v)", node.Name, collection.String())
		}

		v.begin(collection)
		predicate := v.visit(node.Arguments[1])
		v.end()

		if predicate.IsFunc() &&
			predicate.NumOut() == 1 &&
			predicate.NumIn() == 1 && predicate.IsFirstArgUnknown(&v.config.NtCache) {

			predicateOut := predicate.Out(&v.config.NtCache, 0)
			if !predicateOut.IsBool() && !predicateOut.IsUnknown(&v.config.NtCache) {
				return v.error(node.Arguments[1], "predicate should return boolean (got %s)", predicateOut.String())
			}
			if collection.IsUnknown(&v.config.NtCache) {
				return v.config.NtCache.FromType(arrayType)
			}
			collection = collection.Elem(&v.config.NtCache)
			return collection.MakeArrayOf(&v.config.NtCache)
		}
		return v.error(node.Arguments[1], "predicate should has one input and one output param")

	case "map":
		collection := v.visit(node.Arguments[0])
		collection = collection.Deref(&v.config.NtCache)
		if !collection.IsArray() && !collection.IsUnknown(&v.config.NtCache) {
			return v.error(node.Arguments[0], "builtin %v takes only array (got %v)", node.Name, collection.String())
		}

		v.begin(collection, varScope{"index", v.config.NtCache.FromType(intType)})
		predicate := v.visit(node.Arguments[1])
		v.end()

		if predicate.IsFunc() &&
			predicate.NumOut() == 1 &&
			predicate.NumIn() == 1 && predicate.IsFirstArgUnknown(&v.config.NtCache) {

			return predicate.Ref.MakeArrayOf(&v.config.NtCache)
		}
		return v.error(node.Arguments[1], "predicate should has one input and one output param")

	case "count":
		collection := v.visit(node.Arguments[0])
		collection = collection.Deref(&v.config.NtCache)
		if !collection.IsArray() && !collection.IsUnknown(&v.config.NtCache) {
			return v.error(node.Arguments[0], "builtin %v takes only array (got %v)", node.Name, collection.String())
		}

		if len(node.Arguments) == 1 {
			return v.config.NtCache.FromType(intType)
		}

		v.begin(collection)
		predicate := v.visit(node.Arguments[1])
		v.end()

		if predicate.IsFunc() &&
			predicate.NumOut() == 1 &&
			predicate.NumIn() == 1 && predicate.IsFirstArgUnknown(&v.config.NtCache) {
			predicateOut := predicate.Out(&v.config.NtCache, 0)
			if !predicateOut.IsBool() && !predicateOut.IsUnknown(&v.config.NtCache) {
				return v.error(node.Arguments[1], "predicate should return boolean (got %s)", predicateOut.String())
			}

			return v.config.NtCache.FromType(intType)
		}
		return v.error(node.Arguments[1], "predicate should has one input and one output param")

	case "sum":
		collection := v.visit(node.Arguments[0])
		collection = collection.Deref(&v.config.NtCache)
		if !collection.IsArray() && !collection.IsUnknown(&v.config.NtCache) {
			return v.error(node.Arguments[0], "builtin %v takes only array (got %v)", node.Name, collection.String())
		}

		if len(node.Arguments) == 2 {
			v.begin(collection)
			predicate := v.visit(node.Arguments[1])
			v.end()

			if predicate.IsFunc() &&
				predicate.NumOut() == 1 &&
				predicate.NumIn() == 1 && predicate.IsFirstArgUnknown(&v.config.NtCache) {
				return predicate.Out(&v.config.NtCache, 0)
			}
		} else {
			if collection.IsUnknown(&v.config.NtCache) {
				return Nature{}
			}
			return collection.Elem(&v.config.NtCache)
		}

	case "find", "findLast":
		collection := v.visit(node.Arguments[0])
		collection = collection.Deref(&v.config.NtCache)
		if !collection.IsArray() && !collection.IsUnknown(&v.config.NtCache) {
			return v.error(node.Arguments[0], "builtin %v takes only array (got %v)", node.Name, collection.String())
		}

		v.begin(collection)
		predicate := v.visit(node.Arguments[1])
		v.end()

		if predicate.IsFunc() &&
			predicate.NumOut() == 1 &&
			predicate.NumIn() == 1 && predicate.IsFirstArgUnknown(&v.config.NtCache) {

			predicateOut := predicate.Out(&v.config.NtCache, 0)
			if !predicateOut.IsBool() && !predicateOut.IsUnknown(&v.config.NtCache) {
				return v.error(node.Arguments[1], "predicate should return boolean (got %s)", predicateOut.String())
			}
			if collection.IsUnknown(&v.config.NtCache) {
				return Nature{}
			}
			return collection.Elem(&v.config.NtCache)
		}
		return v.error(node.Arguments[1], "predicate should has one input and one output param")

	case "findIndex", "findLastIndex":
		collection := v.visit(node.Arguments[0])
		collection = collection.Deref(&v.config.NtCache)
		if !collection.IsArray() && !collection.IsUnknown(&v.config.NtCache) {
			return v.error(node.Arguments[0], "builtin %v takes only array (got %v)", node.Name, collection.String())
		}

		v.begin(collection)
		predicate := v.visit(node.Arguments[1])
		v.end()

		if predicate.IsFunc() &&
			predicate.NumOut() == 1 &&
			predicate.NumIn() == 1 && predicate.IsFirstArgUnknown(&v.config.NtCache) {

			predicateOut := predicate.Out(&v.config.NtCache, 0)
			if !predicateOut.IsBool() && !predicateOut.IsUnknown(&v.config.NtCache) {
				return v.error(node.Arguments[1], "predicate should return boolean (got %s)", predicateOut.String())
			}
			return v.config.NtCache.FromType(intType)
		}
		return v.error(node.Arguments[1], "predicate should has one input and one output param")

	case "groupBy":
		collection := v.visit(node.Arguments[0])
		collection = collection.Deref(&v.config.NtCache)
		if !collection.IsArray() && !collection.IsUnknown(&v.config.NtCache) {
			return v.error(node.Arguments[0], "builtin %v takes only array (got %v)", node.Name, collection.String())
		}

		v.begin(collection)
		predicate := v.visit(node.Arguments[1])
		v.end()

		if predicate.IsFunc() &&
			predicate.NumOut() == 1 &&
			predicate.NumIn() == 1 && predicate.IsFirstArgUnknown(&v.config.NtCache) {

			collection = collection.Elem(&v.config.NtCache)
			collection = collection.MakeArrayOf(&v.config.NtCache)
			nt := v.config.NtCache.NatureOf(map[any][]any{})
			nt.Ref = &collection
			return nt
		}
		return v.error(node.Arguments[1], "predicate should has one input and one output param")

	case "sortBy":
		collection := v.visit(node.Arguments[0])
		collection = collection.Deref(&v.config.NtCache)
		if !collection.IsArray() && !collection.IsUnknown(&v.config.NtCache) {
			return v.error(node.Arguments[0], "builtin %v takes only array (got %v)", node.Name, collection.String())
		}

		v.begin(collection)
		predicate := v.visit(node.Arguments[1])
		v.end()

		if len(node.Arguments) == 3 {
			_ = v.visit(node.Arguments[2])
		}

		if predicate.IsFunc() &&
			predicate.NumOut() == 1 &&
			predicate.NumIn() == 1 && predicate.IsFirstArgUnknown(&v.config.NtCache) {

			return collection
		}
		return v.error(node.Arguments[1], "predicate should has one input and one output param")

	case "reduce":
		collection := v.visit(node.Arguments[0])
		collection = collection.Deref(&v.config.NtCache)
		if !collection.IsArray() && !collection.IsUnknown(&v.config.NtCache) {
			return v.error(node.Arguments[0], "builtin %v takes only array (got %v)", node.Name, collection.String())
		}

		v.begin(collection, varScope{"index", v.config.NtCache.FromType(intType)}, varScope{"acc", Nature{}})
		predicate := v.visit(node.Arguments[1])
		v.end()

		if len(node.Arguments) == 3 {
			_ = v.visit(node.Arguments[2])
		}

		if predicate.IsFunc() && predicate.NumOut() == 1 {
			return *predicate.Ref
		}
		return v.error(node.Arguments[1], "predicate should has two input and one output param")

	}

	if id, ok := builtin.Index[node.Name]; ok {
		switch node.Name {
		case "get":
			return v.checkBuiltinGet(node)
		}
		return v.checkFunction(builtin.Builtins[id], node, node.Arguments)
	}

	return v.error(node, "unknown builtin %v", node.Name)
}

func (v *Checker) begin(collectionNature Nature, vars ...varScope) {
	v.predicateScopes = append(v.predicateScopes, predicateScope{
		collection: collectionNature,
		vars:       vars,
	})
}

func (v *Checker) end() {
	v.predicateScopes = v.predicateScopes[:len(v.predicateScopes)-1]
}

func (v *Checker) checkBuiltinGet(node *ast.BuiltinNode) Nature {
	if len(node.Arguments) != 2 {
		return v.error(node, "invalid number of arguments (expected 2, got %d)", len(node.Arguments))
	}

	base := v.visit(node.Arguments[0])
	prop := v.visit(node.Arguments[1])
	prop = prop.Deref(&v.config.NtCache)

	if id, ok := node.Arguments[0].(*ast.IdentifierNode); ok && id.Value == "$env" {
		if s, ok := node.Arguments[1].(*ast.StringNode); ok {
			if nt, ok := v.config.Env.Get(&v.config.NtCache, s.Value); ok {
				return nt
			}
		}
		return Nature{}
	}

	if base.IsUnknown(&v.config.NtCache) {
		return Nature{}
	}

	switch base.Kind {
	case reflect.Slice, reflect.Array:
		if !prop.IsInteger && !prop.IsUnknown(&v.config.NtCache) {
			return v.error(node.Arguments[1], "non-integer slice index %s", prop.String())
		}
		return base.Elem(&v.config.NtCache)
	case reflect.Map:
		if !prop.AssignableTo(base.Key(&v.config.NtCache)) && !prop.IsUnknown(&v.config.NtCache) {
			return v.error(node.Arguments[1], "cannot use %s to get an element from %s", prop.String(), base.String())
		}
		return base.Elem(&v.config.NtCache)
	}
	return v.error(node.Arguments[0], "type %v does not support indexing", base.String())
}

func (v *Checker) checkFunction(f *builtin.Function, node ast.Node, arguments []ast.Node) Nature {
	if f.Validate != nil {
		args := make([]reflect.Type, len(arguments))
		for i, arg := range arguments {
			argNature := v.visit(arg)
			if argNature.IsUnknown(&v.config.NtCache) {
				args[i] = anyType
			} else {
				args[i] = argNature.Type
			}
		}
		t, err := f.Validate(args)
		if err != nil {
			return v.error(node, "%v", err)
		}
		return v.config.NtCache.FromType(t)
	} else if len(f.Types) == 0 {
		nt, err := v.checkArguments(f.Name, v.config.NtCache.FromType(f.Type()), arguments, node)
		if err != nil {
			if v.err == nil {
				v.err = err
			}
			return Nature{}
		}
		// No type was specified, so we assume the function returns any.
		return nt
	}
	var lastErr *file.Error
	for _, t := range f.Types {
		outNature, err := v.checkArguments(f.Name, v.config.NtCache.FromType(t), arguments, node)
		if err != nil {
			lastErr = err
			continue
		}

		// As we found the correct function overload, we can stop the loop.
		// Also, we need to set the correct nature of the callee so compiler,
		// can correctly handle OpDeref opcode.
		if callNode, ok := node.(*ast.CallNode); ok {
			callNode.Callee.SetType(t)
		}

		return outNature
	}
	if lastErr != nil {
		if v.err == nil {
			v.err = lastErr
		}
		return Nature{}
	}

	return v.error(node, "no matching overload for %v", f.Name)
}

func (v *Checker) checkArguments(
	name string,
	fn Nature,
	arguments []ast.Node,
	node ast.Node,
) (Nature, *file.Error) {
	if fn.IsUnknown(&v.config.NtCache) {
		return Nature{}, nil
	}

	numOut := fn.NumOut()
	if numOut == 0 {
		return Nature{}, &file.Error{
			Location: node.Location(),
			Message:  fmt.Sprintf("func %v doesn't return value", name),
		}
	}
	if numOut > 2 {
		return Nature{}, &file.Error{
			Location: node.Location(),
			Message:  fmt.Sprintf("func %v returns more then two values", name),
		}
	}

	// If func is method on an env, first argument should be a receiver,
	// and actual arguments less than fnNumIn by one.
	fnNumIn := fn.NumIn()
	if fn.Method { // TODO: Move subtraction to the Nature.NumIn() and Nature.In() methods.
		fnNumIn--
	}
	// Skip first argument in case of the receiver.
	fnInOffset := 0
	if fn.Method {
		fnInOffset = 1
	}

	var err *file.Error
	isVariadic := fn.IsVariadic()
	if isVariadic {
		if len(arguments) < fnNumIn-1 {
			err = &file.Error{
				Location: node.Location(),
				Message:  fmt.Sprintf("not enough arguments to call %v", name),
			}
		}
	} else {
		if len(arguments) > fnNumIn {
			err = &file.Error{
				Location: node.Location(),
				Message:  fmt.Sprintf("too many arguments to call %v", name),
			}
		}
		if len(arguments) < fnNumIn {
			err = &file.Error{
				Location: node.Location(),
				Message:  fmt.Sprintf("not enough arguments to call %v", name),
			}
		}
	}

	if err != nil {
		// If we have an error, we should still visit all arguments to
		// type check them, as a patch can fix the error later.
		for _, arg := range arguments {
			_ = v.visit(arg)
		}
		return fn.Out(&v.config.NtCache, 0), err
	}

	for i, arg := range arguments {
		argNature := v.visit(arg)

		var in Nature
		if isVariadic && i >= fnNumIn-1 {
			// For variadic arguments fn(xs ...int), go replaces type of xs (int) with ([]int).
			// As we compare arguments one by one, we need underling type.
			in = fn.InElem(&v.config.NtCache, fnNumIn-1)
		} else {
			in = fn.In(&v.config.NtCache, i+fnInOffset)
		}

		if in.IsFloat && argNature.IsInteger {
			traverseAndReplaceIntegerNodesWithFloatNodes(&arguments[i], in)
			continue
		}

		if in.IsInteger && argNature.IsInteger && argNature.Kind != in.Kind {
			traverseAndReplaceIntegerNodesWithIntegerNodes(&arguments[i], in)
			continue
		}

		if argNature.Nil {
			if in.Kind == reflect.Ptr || in.Kind == reflect.Interface {
				continue
			}
			return Nature{}, &file.Error{
				Location: arg.Location(),
				Message:  fmt.Sprintf("cannot use nil as argument (type %s) to call %v", in.String(), name),
			}
		}

		// Check if argument is assignable to the function input type.
		// We check original type (like *time.Time), not dereferenced type,
		// as function input type can be pointer to a struct.
		assignable := argNature.AssignableTo(in)

		// We also need to check if dereference arg type is assignable to the function input type.
		// For example, func(int) and argument *int. In this case we will add OpDeref to the argument,
		// so we can call the function with *int argument.
		if !assignable && argNature.IsPointer() {
			nt := argNature.Deref(&v.config.NtCache)
			assignable = nt.AssignableTo(in)
		}

		if !assignable && !argNature.IsUnknown(&v.config.NtCache) {
			return Nature{}, &file.Error{
				Location: arg.Location(),
				Message:  fmt.Sprintf("cannot use %s as argument (type %s) to call %v ", argNature.String(), in.String(), name),
			}
		}
	}

	return fn.Out(&v.config.NtCache, 0), nil
}

func traverseAndReplaceIntegerNodesWithFloatNodes(node *ast.Node, newNature Nature) {
	switch (*node).(type) {
	case *ast.IntegerNode:
		*node = &ast.FloatNode{Value: float64((*node).(*ast.IntegerNode).Value)}
		(*node).SetType(newNature.Type)
	case *ast.UnaryNode:
		unaryNode := (*node).(*ast.UnaryNode)
		traverseAndReplaceIntegerNodesWithFloatNodes(&unaryNode.Node, newNature)
	case *ast.BinaryNode:
		binaryNode := (*node).(*ast.BinaryNode)
		switch binaryNode.Operator {
		case "+", "-", "*":
			traverseAndReplaceIntegerNodesWithFloatNodes(&binaryNode.Left, newNature)
			traverseAndReplaceIntegerNodesWithFloatNodes(&binaryNode.Right, newNature)
		}
	}
}

func traverseAndReplaceIntegerNodesWithIntegerNodes(node *ast.Node, newNature Nature) {
	switch (*node).(type) {
	case *ast.IntegerNode:
		(*node).SetType(newNature.Type)
	case *ast.UnaryNode:
		(*node).SetType(newNature.Type)
		unaryNode := (*node).(*ast.UnaryNode)
		traverseAndReplaceIntegerNodesWithIntegerNodes(&unaryNode.Node, newNature)
	case *ast.BinaryNode:
		// TODO: Binary node return type is dependent on the type of the operands. We can't just change the type of the node.
		binaryNode := (*node).(*ast.BinaryNode)
		switch binaryNode.Operator {
		case "+", "-", "*":
			traverseAndReplaceIntegerNodesWithIntegerNodes(&binaryNode.Left, newNature)
			traverseAndReplaceIntegerNodesWithIntegerNodes(&binaryNode.Right, newNature)
		}
	}
}

func (v *Checker) predicateNode(node *ast.PredicateNode) Nature {
	nt := v.visit(node.Node)
	var out []reflect.Type
	if nt.IsUnknown(&v.config.NtCache) {
		out = append(out, anyType)
	} else if !nt.Nil {
		out = append(out, nt.Type)
	}
	n := v.config.NtCache.FromType(reflect.FuncOf(anyTypeSlice, out, false))
	n.Ref = &nt
	return n
}

func (v *Checker) pointerNode(node *ast.PointerNode) Nature {
	if len(v.predicateScopes) == 0 {
		return v.error(node, "cannot use pointer accessor outside predicate")
	}
	scope := v.predicateScopes[len(v.predicateScopes)-1]
	if node.Name == "" {
		if scope.collection.IsUnknown(&v.config.NtCache) {
			return Nature{}
		}
		switch scope.collection.Kind {
		case reflect.Array, reflect.Slice:
			return scope.collection.Elem(&v.config.NtCache)
		}
		return v.error(node, "cannot use %v as array", scope)
	}
	if scope.vars != nil {
		for i := range scope.vars {
			if node.Name == scope.vars[i].name {
				return scope.vars[i].nature
			}
		}
	}
	return v.error(node, "unknown pointer #%v", node.Name)
}

func (v *Checker) variableDeclaratorNode(node *ast.VariableDeclaratorNode) Nature {
	if _, ok := v.config.Env.Get(&v.config.NtCache, node.Name); ok {
		return v.error(node, "cannot redeclare %v", node.Name)
	}
	if _, ok := v.config.Functions[node.Name]; ok {
		return v.error(node, "cannot redeclare function %v", node.Name)
	}
	if _, ok := v.config.Builtins[node.Name]; ok {
		return v.error(node, "cannot redeclare builtin %v", node.Name)
	}
	for i := len(v.varScopes) - 1; i >= 0; i-- {
		if v.varScopes[i].name == node.Name {
			return v.error(node, "cannot redeclare variable %v", node.Name)
		}
	}
	varNature := v.visit(node.Value)
	v.varScopes = append(v.varScopes, varScope{node.Name, varNature})
	exprNature := v.visit(node.Expr)
	v.varScopes = v.varScopes[:len(v.varScopes)-1]
	return exprNature
}

func (v *Checker) sequenceNode(node *ast.SequenceNode) Nature {
	if len(node.Nodes) == 0 {
		return v.error(node, "empty sequence expression")
	}
	var last Nature
	for _, node := range node.Nodes {
		last = v.visit(node)
	}
	return last
}

func (v *Checker) conditionalNode(node *ast.ConditionalNode) Nature {
	c := v.visit(node.Cond)
	c = c.Deref(&v.config.NtCache)
	if !c.IsBool() && !c.IsUnknown(&v.config.NtCache) {
		return v.error(node.Cond, "non-bool expression (type %v) used as condition", c.String())
	}

	t1 := v.visit(node.Exp1)
	t2 := v.visit(node.Exp2)

	if t1.Nil && !t2.Nil {
		return t2
	}
	if !t1.Nil && t2.Nil {
		return t1
	}
	if t1.Nil && t2.Nil {
		return v.config.NtCache.NatureOf(nil)
	}
	if t1.AssignableTo(t2) {
		if t1.IsArray() && t2.IsArray() {
			e1 := t1.Elem(&v.config.NtCache)
			e2 := t2.Elem(&v.config.NtCache)
			if !e1.AssignableTo(e2) || !e2.AssignableTo(e1) {
				return v.config.NtCache.FromType(arrayType)
			}
		}
		return t1
	}
	return Nature{}
}

func (v *Checker) arrayNode(node *ast.ArrayNode) Nature {
	var prev Nature
	allElementsAreSameType := true
	for i, node := range node.Nodes {
		curr := v.visit(node)
		if i > 0 {
			if curr.Kind != prev.Kind {
				allElementsAreSameType = false
			}
		}
		prev = curr
	}
	if allElementsAreSameType {
		return prev.MakeArrayOf(&v.config.NtCache)
	}
	return v.config.NtCache.FromType(arrayType)
}

func (v *Checker) mapNode(node *ast.MapNode) Nature {
	for _, pair := range node.Pairs {
		v.visit(pair)
	}
	return v.config.NtCache.FromType(mapType)
}

func (v *Checker) pairNode(node *ast.PairNode) Nature {
	v.visit(node.Key)
	v.visit(node.Value)
	return v.config.NtCache.NatureOf(nil)
}
