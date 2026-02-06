package ajson

import (
	"encoding/base64"
	"math"
	"math/rand"
	"regexp"
	"sort"
	"strings"
)

// Function - internal left function of JSONPath
type Function func(node *Node) (result *Node, err error)

// Operation - internal script operation of JSONPath
type Operation func(left *Node, right *Node) (result *Node, err error)

var (
	// Operator precedence
	// From https://golang.org/ref/spec#Operator_precedence
	//
	//	Precedence    Operator
	//	    5             *  /  %  <<  >>  &  &^
	//	    4             +  -  |  ^
	//	    3             ==  !=  <  <=  >  >= =~
	//	    2             &&
	//	    1             ||
	//
	// Arithmetic operators
	// From https://golang.org/ref/spec#Arithmetic_operators
	//
	//	+    sum                    integers, floats, complex values, strings
	//	-    difference             integers, floats, complex values
	//	*    product                integers, floats, complex values
	//	/    quotient               integers, floats, complex values
	//	%    remainder              integers
	//
	//	&    bitwise AND            integers
	//	|    bitwise OR             integers
	//	^    bitwise XOR            integers
	//	&^   bit clear (AND NOT)    integers
	//
	//	<<   left shift             integer << unsigned integer
	//	>>   right shift            integer >> unsigned integer
	//
	//	==  equals                  any
	//	!=  not equals              any
	//	<   less                    any
	//	<=  less or equals          any
	//	>   larger                  any
	//	>=  larger or equals        any
	//	=~  equals regex string     strings
	//
	priority = map[string]uint8{
		"**": 6, // additional: power
		"*":  5,
		"/":  5,
		"%":  5,
		"<<": 5,
		">>": 5,
		"&":  5,
		"&^": 5,
		"+":  4,
		"-":  4,
		"|":  4,
		"^":  4,
		"==": 3,
		"!=": 3,
		"<":  3,
		"<=": 3,
		">":  3,
		">=": 3,
		"=~": 3,
		"&&": 2,
		"||": 1,
	}
	priorityChar = map[byte]bool{
		'*': true,
		'/': true,
		'%': true,
		'<': true,
		'>': true,
		'&': true,
		'|': true,
		'^': true,
		'+': true,
		'-': true,
		'=': true,
		'!': true,
	}

	rightOp = map[string]bool{
		"**": true,
	}

	operations = map[string]Operation{
		"**": func(left *Node, right *Node) (result *Node, err error) {
			lnum, rnum, err := _floats(left, right)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "power", Numeric, math.Pow(lnum, rnum)), nil
		},
		"*": func(left *Node, right *Node) (result *Node, err error) {
			lnum, rnum, err := _floats(left, right)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "multiply", Numeric, float64(lnum*rnum)), nil
		},
		"/": func(left *Node, right *Node) (result *Node, err error) {
			lnum, rnum, err := _floats(left, right)
			if err != nil {
				return nil, err
			}
			if rnum == 0 {
				return nil, errorRequest("division by zero")
			}
			return valueNode(nil, "division", Numeric, float64(lnum/rnum)), nil
		},
		"%": func(left *Node, right *Node) (result *Node, err error) {
			lnum, err := left.getInteger()
			if err != nil {
				return nil, err
			}
			rnum, err := right.getInteger()
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "remainder", Numeric, float64(lnum%rnum)), nil
		},
		"<<": func(left *Node, right *Node) (result *Node, err error) {
			lnum, err := left.getInteger()
			if err != nil {
				return nil, err
			}
			rnum, err := right.getUInteger()
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "left shift", Numeric, float64(lnum<<rnum)), nil
		},
		">>": func(left *Node, right *Node) (result *Node, err error) {
			lnum, err := left.getInteger()
			if err != nil {
				return nil, err
			}
			rnum, err := right.getUInteger()
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "right shift", Numeric, float64(lnum>>rnum)), nil
		},
		"&": func(left *Node, right *Node) (result *Node, err error) {
			lnum, rnum, err := _ints(left, right)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "bitwise AND", Numeric, float64(lnum&rnum)), nil
		},
		"&^": func(left *Node, right *Node) (result *Node, err error) {
			lnum, rnum, err := _ints(left, right)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "bit clear (AND NOT)", Numeric, float64(lnum&^rnum)), nil
		},
		"+": func(left *Node, right *Node) (result *Node, err error) {
			if left.IsString() {
				lnum, rnum, err := _strings(left, right)
				if err != nil {
					return nil, err
				}
				return valueNode(nil, "sum", String, lnum+rnum), nil
			}
			lnum, rnum, err := _floats(left, right)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "sum", Numeric, float64(lnum+rnum)), nil
		},
		"-": func(left *Node, right *Node) (result *Node, err error) {
			lnum, rnum, err := _floats(left, right)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "sub", Numeric, float64(lnum-rnum)), nil
		},
		"|": func(left *Node, right *Node) (result *Node, err error) {
			lnum, rnum, err := _ints(left, right)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "bitwise OR", Numeric, float64(lnum|rnum)), nil
		},
		"^": func(left *Node, right *Node) (result *Node, err error) {
			lnum, rnum, err := _ints(left, right)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "bitwise XOR", Numeric, float64(lnum^rnum)), nil
		},
		"==": func(left *Node, right *Node) (result *Node, err error) {
			if left == nil || right == nil {
				return valueNode(nil, "eq", Bool, false), nil
			}
			res, err := left.Eq(right)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "eq", Bool, res), nil
		},
		"!=": func(left *Node, right *Node) (result *Node, err error) {
			if left == nil || right == nil {
				return valueNode(nil, "neq", Bool, false), nil
			}
			res, err := left.Eq(right)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "neq", Bool, !res), nil
		},
		"=~": func(left *Node, right *Node) (node *Node, err error) {
			pattern, err := right.GetString()
			if err != nil {
				return nil, err
			}
			val, err := left.GetString()
			if err != nil {
				return nil, err
			}
			res, err := regexp.MatchString(pattern, val)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "eq", Bool, res), nil
		},
		"<": func(left *Node, right *Node) (result *Node, err error) {
			if left == nil || right == nil {
				return valueNode(nil, "le", Bool, false), nil
			}
			res, err := left.Le(right)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "le", Bool, bool(res)), nil
		},
		"<=": func(left *Node, right *Node) (result *Node, err error) {
			if left == nil || right == nil {
				return valueNode(nil, "leq", Bool, false), nil
			}
			res, err := left.Leq(right)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "leq", Bool, bool(res)), nil
		},
		">": func(left *Node, right *Node) (result *Node, err error) {
			if left == nil || right == nil {
				return valueNode(nil, "ge", Bool, false), nil
			}
			res, err := left.Ge(right)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "ge", Bool, bool(res)), nil
		},
		">=": func(left *Node, right *Node) (result *Node, err error) {
			if left == nil || right == nil {
				return valueNode(nil, "geq", Bool, false), nil
			}
			res, err := left.Geq(right)
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "geq", Bool, bool(res)), nil
		},
		"&&": func(left *Node, right *Node) (result *Node, err error) {
			res := false
			lval, err := boolean(left)
			if err != nil {
				return nil, err
			}
			if lval {
				rval, err := boolean(right)
				if err != nil {
					return nil, err
				}
				res = rval
			}
			return valueNode(nil, "AND", Bool, bool(res)), nil
		},
		"||": func(left *Node, right *Node) (result *Node, err error) {
			res := true
			lval, err := boolean(left)
			if err != nil {
				return nil, err
			}
			if !lval {
				rval, err := boolean(right)
				if err != nil {
					return nil, err
				}
				res = rval
			}
			return valueNode(nil, "OR", Bool, bool(res)), nil
		},
	}

	randFunc    = rand.Float64
	randIntFunc = rand.Intn

	functions = map[string]Function{
		"abs":         numericFunction("Abs", math.Abs),
		"acos":        numericFunction("Acos", math.Acos),
		"acosh":       numericFunction("Acosh", math.Acosh),
		"asin":        numericFunction("Asin", math.Asin),
		"asinh":       numericFunction("Asinh", math.Asinh),
		"atan":        numericFunction("Atan", math.Atan),
		"atanh":       numericFunction("Atanh", math.Atanh),
		"cbrt":        numericFunction("Cbrt", math.Cbrt),
		"ceil":        numericFunction("Ceil", math.Ceil),
		"cos":         numericFunction("Cos", math.Cos),
		"cosh":        numericFunction("Cosh", math.Cosh),
		"erf":         numericFunction("Erf", math.Erf),
		"erfc":        numericFunction("Erfc", math.Erfc),
		"erfcinv":     numericFunction("Erfcinv", math.Erfcinv),
		"erfinv":      numericFunction("Erfinv", math.Erfinv),
		"exp":         numericFunction("Exp", math.Exp),
		"exp2":        numericFunction("Exp2", math.Exp2),
		"expm1":       numericFunction("Expm1", math.Expm1),
		"floor":       numericFunction("Floor", math.Floor),
		"gamma":       numericFunction("Gamma", math.Gamma),
		"j0":          numericFunction("J0", math.J0),
		"j1":          numericFunction("J1", math.J1),
		"log":         numericFunction("Log", math.Log),
		"log10":       numericFunction("Log10", math.Log10),
		"log1p":       numericFunction("Log1p", math.Log1p),
		"log2":        numericFunction("Log2", math.Log2),
		"logb":        numericFunction("Logb", math.Logb),
		"round":       numericFunction("Round", math.Round),
		"roundtoeven": numericFunction("RoundToEven", math.RoundToEven),
		"sin":         numericFunction("Sin", math.Sin),
		"sinh":        numericFunction("Sinh", math.Sinh),
		"sqrt":        numericFunction("Sqrt", math.Sqrt),
		"tan":         numericFunction("Tan", math.Tan),
		"tanh":        numericFunction("Tanh", math.Tanh),
		"trunc":       numericFunction("Trunc", math.Trunc),
		"y0":          numericFunction("Y0", math.Y0),
		"y1":          numericFunction("Y1", math.Y1),

		"pow10": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "Pow10", Numeric, 0), nil
			}
			num, err := node.getInteger()
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "Pow10", Numeric, float64(math.Pow10(num))), nil
		},
		"length": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "length", Numeric, float64(0)), nil
			}
			if node.IsArray() {
				return valueNode(nil, "length", Numeric, float64(node.Size())), nil
			}
			if node.IsString() {
				if res, err := node.GetString(); err != nil {
					return nil, err
				} else {
					return valueNode(nil, "length", Numeric, float64(len(res))), nil
				}
			}
			return valueNode(nil, "length", Numeric, float64(1)), nil
		},
		"size": func(node *Node) (result *Node, err error) {
			return valueNode(nil, "size", Numeric, float64(node.Size())), nil
		},
		"factorial": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "factorial", Numeric, 0), nil
			}
			num, err := node.getUInteger()
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "factorial", Numeric, float64(mathFactorial(num))), nil
		},
		"avg": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "avg", Null, nil), nil
			}
			if node.isContainer() {
				sum := float64(0)
				if node.Size() == 0 {
					return valueNode(nil, "avg", Numeric, sum), nil
				}
				var value float64
				for _, temp := range node.Inheritors() {
					value, err = temp.GetNumeric()
					if err != nil {
						return nil, err
					}
					sum += value
				}
				return valueNode(nil, "avg", Numeric, sum/float64(node.Size())), nil
			}
			if node.IsNumeric() {
				value, err := node.GetNumeric()
				if err != nil {
					return nil, err
				}
				return valueNode(nil, "avg", Numeric, value), nil
			}
			return valueNode(nil, "avg", Null, nil), nil
		},
		"b64decode": func(node *Node) (result *Node, err error) {
			if node.IsString() {
				if sourceString, err := node.GetString(); err != nil {
					return nil, err
				} else {
					var result []byte
					result, err = base64.StdEncoding.WithPadding(base64.StdPadding).DecodeString(sourceString)
					if err != nil {
						// then for NO_PAD encoded strings, if the first result with error
						result, err = base64.StdEncoding.WithPadding(base64.NoPadding).DecodeString(sourceString)
					}
					if err != nil {
						return nil, err
					}
					return valueNode(nil, "b64decode", String, string(result)), nil
				}
			}
			return valueNode(nil, "b64decode", Null, nil), nil
		},
		"b64encoden": func(node *Node) (result *Node, err error) {
			if node.IsString() {
				if sourceString, err := node.GetString(); err != nil {
					return nil, err
				} else {
					remainder := len(sourceString) % 3
					size := len(sourceString) / 3 * 4
					if remainder != 0 {
						size += 1 + remainder
					}
					var bytes = make([]byte, size)
					base64.StdEncoding.WithPadding(base64.NoPadding).Encode(bytes, []byte(sourceString))
					return valueNode(nil, "b64encoden", String, string(bytes)), nil
				}
			}
			return valueNode(nil, "b64encoden", Null, nil), nil
		},
		"b64encode": func(node *Node) (result *Node, err error) {
			if node.IsString() {
				if sourceString, err := node.GetString(); err != nil {
					return nil, err
				} else {
					remainder := len(sourceString) % 3
					size := len(sourceString) / 3 * 4
					if remainder != 0 {
						size += 4
					}
					var bytes = make([]byte, size)
					base64.StdEncoding.WithPadding(base64.StdPadding).Encode(bytes, []byte(sourceString))
					return valueNode(nil, "b64encode", String, string(bytes)), nil
				}
			}
			return valueNode(nil, "b64encode", Null, nil), nil
		},
		"sum": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "sum", Null, nil), nil
			}
			if node.isContainer() {
				sum := float64(0)
				if node.Size() == 0 {
					return valueNode(nil, "sum", Numeric, sum), nil
				}
				var value float64
				for _, temp := range node.Inheritors() {
					value, err = temp.GetNumeric()
					if err != nil {
						return nil, err
					}
					sum += value
				}
				return valueNode(nil, "sum", Numeric, sum), nil
			}
			if node.IsNumeric() {
				value, err := node.GetNumeric()
				if err != nil {
					return nil, err
				}
				return valueNode(nil, "sum", Numeric, value), nil
			}
			return valueNode(nil, "sum", Null, nil), nil
		},
		"not": func(node *Node) (result *Node, err error) {
			if value, err := boolean(node); err != nil {
				return nil, err
			} else {
				return valueNode(nil, "not", Bool, !value), nil
			}
		},
		"rand": func(node *Node) (result *Node, err error) {
			if node == nil {
				return nil, errorType()
			}
			num, err := node.GetNumeric()
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "Rand", Numeric, randFunc()*num), nil
		},
		"randint": func(node *Node) (result *Node, err error) {
			if node == nil {
				return nil, errorType()
			}
			num, err := node.getInteger()
			if err != nil {
				return nil, err
			}
			return valueNode(nil, "RandInt", Numeric, float64(randIntFunc(num))), nil
		},
		"last": func(node *Node) (result *Node, err error) {
			if node.IsArray() {
				array := node.Inheritors()
				if len(array) > 0 {
					return array[len(array)-1], nil
				}
			}
			return valueNode(nil, "last", Null, nil), nil
		},
		"first": func(node *Node) (result *Node, err error) {
			if node.IsArray() {
				array := node.Inheritors()
				if len(array) > 0 {
					return array[0], nil
				}
			}
			return valueNode(nil, "first", Null, nil), nil
		},
		"parent": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "parent", Null, nil), nil
			}
			if node.parent != nil {
				return node.parent, nil
			}
			return valueNode(nil, "parent", Null, nil), nil
		},
		"root": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "root", Null, nil), nil
			}
			root := node.root()
			if root != nil {
				return root, nil
			}
			return valueNode(nil, "root", Null, nil), nil
		},
		"key": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "key", Null, nil), nil
			}
			if node.parent != nil {
				if node.parent.IsObject() {
					return valueNode(nil, "key", String, node.Key()), nil
				}
			}
			return valueNode(nil, "key", Null, nil), nil
		},
		"is_null": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "is_null", Null, nil), nil
			}
			return valueNode(nil, "is_null", Bool, node.IsNull()), nil
		},
		"is_numeric": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "is_numeric", Null, nil), nil
			}
			return valueNode(nil, "is_numeric", Bool, node.IsNumeric()), nil
		},
		"is_int": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "is_int", Null, nil), nil
			}
			_, err = node.getInteger()
			if err != nil {
				return valueNode(nil, "is_int", Bool, false), nil
			}
			return valueNode(nil, "is_int", Bool, true), nil
		},
		"is_uint": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "is_uint", Null, nil), nil
			}
			_, err = node.getUInteger()
			if err != nil {
				return valueNode(nil, "is_uint", Bool, false), nil
			}
			return valueNode(nil, "is_uint", Bool, true), nil
		},
		"is_float": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "is_float", Null, nil), nil
			}
			if node.IsNumeric() {
				_, err = node.getInteger()
				if err != nil {
					return valueNode(nil, "is_float", Bool, true), nil
				}
			}
			return valueNode(nil, "is_float", Bool, false), nil
		},
		"is_string": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "is_string", Null, nil), nil
			}
			return valueNode(nil, "is_string", Bool, node.IsString()), nil
		},
		"is_bool": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "is_bool", Null, nil), nil
			}
			return valueNode(nil, "is_bool", Bool, node.IsBool()), nil
		},
		"is_array": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "is_array", Null, nil), nil
			}
			return valueNode(nil, "is_array", Bool, node.IsArray()), nil
		},
		"is_object": func(node *Node) (result *Node, err error) {
			if node == nil {
				return valueNode(nil, "is_object", Null, nil), nil
			}
			return valueNode(nil, "is_object", Bool, node.IsObject()), nil
		},
	}

	constants = map[string]*Node{
		"e":   valueNode(nil, "e", Numeric, float64(math.E)),
		"pi":  valueNode(nil, "pi", Numeric, float64(math.Pi)),
		"phi": valueNode(nil, "phi", Numeric, float64(math.Phi)),

		"sqrt2":   valueNode(nil, "sqrt2", Numeric, float64(math.Sqrt2)),
		"sqrte":   valueNode(nil, "sqrte", Numeric, float64(math.SqrtE)),
		"sqrtpi":  valueNode(nil, "sqrtpi", Numeric, float64(math.SqrtPi)),
		"sqrtphi": valueNode(nil, "sqrtphi", Numeric, float64(math.SqrtPhi)),

		"ln2":    valueNode(nil, "ln2", Numeric, float64(math.Ln2)),
		"log2e":  valueNode(nil, "log2e", Numeric, float64(math.Log2E)),
		"ln10":   valueNode(nil, "ln10", Numeric, float64(math.Ln10)),
		"log10e": valueNode(nil, "log10e", Numeric, float64(math.Log10E)),

		"true":  valueNode(nil, "true", Bool, true),
		"false": valueNode(nil, "false", Bool, false),
		"null":  valueNode(nil, "null", Null, nil),
	}
)

// AddFunction add a function for internal JSONPath script
func AddFunction(alias string, function Function) {
	functions[strings.ToLower(alias)] = function
}

// AddOperation add an operation for internal JSONPath script
func AddOperation(alias string, prior uint8, right bool, operation Operation) {
	alias = strings.ToLower(alias)
	operations[alias] = operation
	priority[alias] = prior
	priorityChar[alias[0]] = true
	if right {
		rightOp[alias] = true
	}
}

// AddConstant add a constant for internal JSONPath script
func AddConstant(alias string, value *Node) {
	constants[strings.ToLower(alias)] = value
}

func numericFunction(name string, fn func(float float64) float64) Function {
	return func(node *Node) (result *Node, err error) {
		if node.IsNumeric() {
			num, err := node.GetNumeric()
			if err != nil {
				return nil, err
			}
			return valueNode(nil, name, Numeric, fn(num)), nil
		}
		return nil, errorRequest("function '%s' was called from non numeric node", name)
	}
}

func mathFactorial(x uint) uint {
	if x == 0 {
		return 1
	}
	return x * mathFactorial(x-1)
}

func comparisonOperationsOrder() []string {
	result := make([]string, 0, len(operations))
	for operation := range operations {
		result = append(result, operation)
	}

	sort.Slice(result, func(i, j int) bool {
		return len(result[i]) > len(result[j])
	})
	return result
}
