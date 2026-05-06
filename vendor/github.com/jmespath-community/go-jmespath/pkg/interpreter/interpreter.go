package interpreter

import (
	"errors"
	"math"
	"reflect"
	"unicode"
	"unicode/utf8"

	"github.com/jmespath-community/go-jmespath/pkg/binding"
	"github.com/jmespath-community/go-jmespath/pkg/parsing"
	"github.com/jmespath-community/go-jmespath/pkg/util"
)

/*
This is a tree based interpreter.  It walks the AST and directly

	interprets the AST to search through a JSON document.
*/
type Interpreter interface {
	Execute(parsing.ASTNode, interface{}) (interface{}, error)
}

type treeInterpreter struct {
	caller   FunctionCaller
	root     interface{}
	bindings binding.Bindings
}

func NewInterpreter(data interface{}, caller FunctionCaller, bindings binding.Bindings) Interpreter {
	if bindings == nil {
		bindings = binding.NewBindings()
	}
	return &treeInterpreter{
		caller:   caller,
		root:     data,
		bindings: bindings,
	}
}

// Execute takes an ASTNode and input data and interprets the AST directly.
// It will produce the result of applying the JMESPath expression associated
// with the ASTNode to the input data "value".
func (intr *treeInterpreter) Execute(node parsing.ASTNode, value interface{}) (interface{}, error) {
	switch node.NodeType {
	case parsing.ASTArithmeticUnaryExpression:
		expr, err := intr.Execute(node.Children[0], value)
		if err != nil {
			return nil, err
		}
		num, ok := expr.(float64)
		if !ok {
			return nil, nil
		}
		switch node.Value {
		case parsing.TOKPlus:
			return num, nil
		case parsing.TOKMinus:
			return -num, nil
		}
	case parsing.ASTArithmeticExpression:
		left, err := intr.Execute(node.Children[0], value)
		if err != nil {
			return nil, err
		}
		right, err := intr.Execute(node.Children[1], value)
		if err != nil {
			return nil, err
		}
		leftNum, ok := left.(float64)
		if !ok {
			return nil, nil
		}
		rightNum, ok := right.(float64)
		if !ok {
			return nil, nil
		}
		switch node.Value {
		case parsing.TOKPlus:
			return leftNum + rightNum, nil
		case parsing.TOKMinus:
			return leftNum - rightNum, nil
		case parsing.TOKStar:
			return leftNum * rightNum, nil
		case parsing.TOKMultiply:
			return leftNum * rightNum, nil
		case parsing.TOKDivide:
			return leftNum / rightNum, nil
		case parsing.TOKModulo:
			return math.Mod(leftNum, rightNum), nil
		case parsing.TOKDiv:
			return math.Floor(leftNum / rightNum), nil
		}
	case parsing.ASTComparator:
		left, err := intr.Execute(node.Children[0], value)
		if err != nil {
			return nil, err
		}
		right, err := intr.Execute(node.Children[1], value)
		if err != nil {
			return nil, err
		}
		switch node.Value {
		case parsing.TOKEQ:
			return util.ObjsEqual(left, right), nil
		case parsing.TOKNE:
			return !util.ObjsEqual(left, right), nil
		}
		leftNum, ok := left.(float64)
		if !ok {
			return nil, nil
		}
		rightNum, ok := right.(float64)
		if !ok {
			return nil, nil
		}
		switch node.Value {
		case parsing.TOKGT:
			return leftNum > rightNum, nil
		case parsing.TOKGTE:
			return leftNum >= rightNum, nil
		case parsing.TOKLT:
			return leftNum < rightNum, nil
		case parsing.TOKLTE:
			return leftNum <= rightNum, nil
		}
	case parsing.ASTExpRef:
		return func(data interface{}) (interface{}, error) {
			return intr.Execute(node.Children[0], data)
		}, nil
	case parsing.ASTFunctionExpression:
		resolvedArgs := []interface{}{}
		for _, arg := range node.Children {
			current, err := intr.Execute(arg, value)
			if err != nil {
				return nil, err
			}
			resolvedArgs = append(resolvedArgs, current)
		}
		return intr.caller.CallFunction(node.Value.(string), resolvedArgs)
	case parsing.ASTField:
		key := node.Value.(string)
		var result interface{}
		if m, ok := value.(map[string]interface{}); ok {
			result = m[key]
			if result != nil {
				return result, nil
			}
		}
		result = intr.fieldFromStruct(node.Value.(string), value)
		if result != nil {
			return result, nil
		}
		return nil, nil
	case parsing.ASTFilterProjection:
		left, err := intr.Execute(node.Children[0], value)
		if err != nil {
			return nil, nil
		}
		sliceType, ok := left.([]interface{})
		if !ok {
			if util.IsSliceType(left) {
				return intr.filterProjectionWithReflection(node, left)
			}
			return nil, nil
		}
		compareNode := node.Children[2]
		collected := []interface{}{}
		for _, element := range sliceType {
			result, err := intr.Execute(compareNode, element)
			if err != nil {
				return nil, err
			}
			if !util.IsFalse(result) {
				current, err := intr.Execute(node.Children[1], element)
				if err != nil {
					return nil, err
				}
				if current != nil {
					collected = append(collected, current)
				}
			}
		}
		return collected, nil
	case parsing.ASTFlatten:
		left, err := intr.Execute(node.Children[0], value)
		if err != nil {
			return nil, nil
		}
		sliceType, ok := left.([]interface{})
		if !ok {
			// If we can't type convert to []interface{}, there's
			// a chance this could still work via reflection if we're
			// dealing with user provided types.
			if util.IsSliceType(left) {
				return intr.flattenWithReflection(left)
			}
			return nil, nil
		}
		flattened := []interface{}{}
		for _, element := range sliceType {
			if elementSlice, ok := element.([]interface{}); ok {
				flattened = append(flattened, elementSlice...)
			} else if util.IsSliceType(element) {
				reflectFlat := []interface{}{}
				v := reflect.ValueOf(element)
				for i := 0; i < v.Len(); i++ {
					reflectFlat = append(reflectFlat, v.Index(i).Interface())
				}
				flattened = append(flattened, reflectFlat...)
			} else {
				flattened = append(flattened, element)
			}
		}
		return flattened, nil
	case parsing.ASTIdentity, parsing.ASTCurrentNode:
		return value, nil
	case parsing.ASTRootNode:
		return intr.root, nil
	case parsing.ASTBindings:
		bindings := intr.bindings
		for _, child := range node.Children {
			if value, err := intr.Execute(child.Children[1], value); err != nil {
				return nil, err
			} else {
				bindings = bindings.Register(child.Children[0].Value.(string), value)
			}
		}
		intr.bindings = bindings
		// doesn't mutate value
		return value, nil
	case parsing.ASTLetExpression:
		// save bindings state
		bindings := intr.bindings
		// retore bindings state
		defer func() {
			intr.bindings = bindings
		}()
		// evalute bindings first, then evaluate expression
		if _, err := intr.Execute(node.Children[0], value); err != nil {
			return nil, err
		} else if value, err := intr.Execute(node.Children[1], value); err != nil {
			return nil, err
		} else {
			return value, nil
		}
	case parsing.ASTVariable:
		if value, err := intr.bindings.Get(node.Value.(string)); err != nil {
			return nil, err
		} else {
			return value, nil
		}
	case parsing.ASTIndex:
		if sliceType, ok := value.([]interface{}); ok {
			index := node.Value.(int)
			if index < 0 {
				index += len(sliceType)
			}
			if index < len(sliceType) && index >= 0 {
				return sliceType[index], nil
			}
			return nil, nil
		}
		// Otherwise try via reflection.
		rv := reflect.ValueOf(value)
		if rv.Kind() == reflect.Slice {
			index := node.Value.(int)
			if index < 0 {
				index += rv.Len()
			}
			if index < rv.Len() && index >= 0 {
				v := rv.Index(index)
				return v.Interface(), nil
			}
		}
		return nil, nil
	case parsing.ASTKeyValPair:
		return intr.Execute(node.Children[0], value)
	case parsing.ASTLiteral:
		return node.Value, nil
	case parsing.ASTMultiSelectHash:
		collected := make(map[string]interface{})
		for _, child := range node.Children {
			current, err := intr.Execute(child, value)
			if err != nil {
				return nil, err
			}
			key := child.Value.(string)
			collected[key] = current
		}
		return collected, nil
	case parsing.ASTMultiSelectList:
		collected := []interface{}{}
		for _, child := range node.Children {
			current, err := intr.Execute(child, value)
			if err != nil {
				return nil, err
			}
			collected = append(collected, current)
		}
		return collected, nil
	case parsing.ASTOrExpression:
		matched, err := intr.Execute(node.Children[0], value)
		if err != nil {
			return nil, err
		}
		if util.IsFalse(matched) {
			matched, err = intr.Execute(node.Children[1], value)
			if err != nil {
				return nil, err
			}
		}
		return matched, nil
	case parsing.ASTAndExpression:
		matched, err := intr.Execute(node.Children[0], value)
		if err != nil {
			return nil, err
		}
		if util.IsFalse(matched) {
			return matched, nil
		}
		return intr.Execute(node.Children[1], value)
	case parsing.ASTNotExpression:
		matched, err := intr.Execute(node.Children[0], value)
		if err != nil {
			return nil, err
		}
		if util.IsFalse(matched) {
			return true, nil
		}
		return false, nil
	case parsing.ASTPipe:
		result := value
		var err error
		for _, child := range node.Children {
			result, err = intr.Execute(child, result)
			if err != nil {
				return nil, err
			}
		}
		return result, nil
	case parsing.ASTProjection:

		// projections typically operate on array | slices
		// string slicing produces an ASTProjection whose
		// first child is an ASTIndexExpression whose
		// second child is an ASTSlice

		// we allow execution of the left index-expression
		// to return a string only if the AST has this
		// specific shape

		allowString := false
		firstChild := node.Children[0]
		if firstChild.NodeType == parsing.ASTIndexExpression {
			nestedChildren := firstChild.Children
			if len(nestedChildren) > 1 && nestedChildren[1].NodeType == parsing.ASTSlice {
				allowString = true
			}
		}

		left, err := intr.Execute(node.Children[0], value)
		if err != nil {
			return nil, err
		}

		sliceType, ok := left.([]interface{})
		if !ok {
			if util.IsSliceType(left) {
				return intr.projectWithReflection(node, left)
			}
			stringType, ok := left.(string)
			if allowString && ok {
				return stringType, nil
			}
			return nil, nil
		}
		collected := []interface{}{}
		var current interface{}
		for _, element := range sliceType {
			current, err = intr.Execute(node.Children[1], element)
			if err != nil {
				return nil, err
			}
			if current != nil {
				collected = append(collected, current)
			}
		}
		return collected, nil
	case parsing.ASTSubexpression, parsing.ASTIndexExpression:
		left, err := intr.Execute(node.Children[0], value)
		if err != nil {
			return nil, err
		}
		if left == nil {
			return nil, nil
		}
		return intr.Execute(node.Children[1], left)
	case parsing.ASTSlice:
		parts := node.Value.([]*int)
		sliceType, ok := value.([]interface{})
		if !ok {
			if util.IsSliceType(value) {
				return intr.sliceWithReflection(node, value)
			}
			// string slices is implemented by slicing
			// the corresponding array of runes and
			// converting the result back to a string
			if stringType, ok := value.(string); ok {
				runeType := []rune(stringType)
				sliceParams := util.MakeSliceParams(parts)
				runes, err := util.Slice(runeType, sliceParams)
				if err != nil {
					return nil, nil
				}
				return string(runes), nil
			}
			return nil, nil
		}
		sliceParams := util.MakeSliceParams(parts)
		return util.Slice(sliceType, sliceParams)
	case parsing.ASTValueProjection:
		left, err := intr.Execute(node.Children[0], value)
		if err != nil {
			return nil, nil
		}
		mapType, ok := left.(map[string]interface{})
		if !ok {
			return nil, nil
		}
		values := []interface{}{}
		for _, value := range mapType {
			values = append(values, value)
		}
		collected := []interface{}{}
		for _, element := range values {
			current, err := intr.Execute(node.Children[1], element)
			if err != nil {
				return nil, err
			}
			if current != nil {
				collected = append(collected, current)
			}
		}
		return collected, nil
	}
	return nil, errors.New("Unknown AST node: " + node.NodeType.String())
}

func (intr *treeInterpreter) fieldFromStruct(key string, value interface{}) interface{} {
	rv := reflect.ValueOf(value)
	first, n := utf8.DecodeRuneInString(key)
	fieldName := string(unicode.ToUpper(first)) + key[n:]
	if rv.Kind() == reflect.Struct {
		v := rv.FieldByName(fieldName)
		if !v.IsValid() {
			return nil
		}
		return v.Interface()
	} else if rv.Kind() == reflect.Ptr {
		// Handle multiple levels of indirection?
		if rv.IsNil() {
			return nil
		}
		rv = rv.Elem()
		v := rv.FieldByName(fieldName)
		if !v.IsValid() {
			return nil
		}
		return v.Interface()
	}
	return nil
}

func (intr *treeInterpreter) flattenWithReflection(value interface{}) (interface{}, error) {
	v := reflect.ValueOf(value)
	flattened := []interface{}{}
	for i := 0; i < v.Len(); i++ {
		element := v.Index(i).Interface()
		if reflect.TypeOf(element).Kind() == reflect.Slice {
			// Then insert the contents of the element
			// slice into the flattened slice,
			// i.e flattened = append(flattened, mySlice...)
			elementV := reflect.ValueOf(element)
			for j := 0; j < elementV.Len(); j++ {
				flattened = append(
					flattened, elementV.Index(j).Interface())
			}
		} else {
			flattened = append(flattened, element)
		}
	}
	return flattened, nil
}

func (intr *treeInterpreter) sliceWithReflection(node parsing.ASTNode, value interface{}) (interface{}, error) {
	v := reflect.ValueOf(value)
	parts := node.Value.([]*int)
	sliceParams := make([]util.SliceParam, 3)
	for i, part := range parts {
		if part != nil {
			sliceParams[i].Specified = true
			sliceParams[i].N = *part
		}
	}
	final := []interface{}{}
	for i := 0; i < v.Len(); i++ {
		element := v.Index(i).Interface()
		final = append(final, element)
	}
	return util.Slice(final, sliceParams)
}

func (intr *treeInterpreter) filterProjectionWithReflection(node parsing.ASTNode, value interface{}) (interface{}, error) {
	compareNode := node.Children[2]
	collected := []interface{}{}
	v := reflect.ValueOf(value)
	for i := 0; i < v.Len(); i++ {
		element := v.Index(i).Interface()
		result, err := intr.Execute(compareNode, element)
		if err != nil {
			return nil, err
		}
		if !util.IsFalse(result) {
			current, err := intr.Execute(node.Children[1], element)
			if err != nil {
				return nil, err
			}
			if current != nil {
				collected = append(collected, current)
			}
		}
	}
	return collected, nil
}

func (intr *treeInterpreter) projectWithReflection(node parsing.ASTNode, value interface{}) (interface{}, error) {
	collected := []interface{}{}
	v := reflect.ValueOf(value)
	for i := 0; i < v.Len(); i++ {
		element := v.Index(i).Interface()
		result, err := intr.Execute(node.Children[1], element)
		if err != nil {
			return nil, err
		}
		if result != nil {
			collected = append(collected, result)
		}
	}
	return collected, nil
}
