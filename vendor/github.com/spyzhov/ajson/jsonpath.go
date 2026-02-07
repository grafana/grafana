package ajson

import (
	"io"
	"math"
	"strconv"
	"strings"
)

// JSONPath returns slice of founded elements in current JSON data, by it's JSONPath.
//
// JSONPath described at http://goessner.net/articles/JsonPath/
//
// JSONPath expressions always refer to a JSON structure in the same way as XPath expression are used in combination with an XML document. Since a JSON structure is usually anonymous and doesn't necessarily have a "root member object" JSONPath assumes the abstract name $ assigned to the outer level object.
//
// JSONPath expressions can use the dot–notation
//
//	$.store.book[0].title
//
// or the bracket–notation
//
//	$['store']['book'][0]['title']
//
// for input pathes. Internal or output pathes will always be converted to the more general bracket–notation.
//
// JSONPath allows the wildcard symbol * for member names and array indices. It borrows the descendant operator '..' from E4X and the array slice syntax proposal [start:end:step] from ECMASCRIPT 4.
//
// Expressions of the underlying scripting language (<expr>) can be used as an alternative to explicit names or indices as in
//
//	$.store.book[(@.length-1)].title
//
// using the symbol '@' for the current object. Filter expressions are supported via the syntax ?(<boolean expr>) as in
//
//	$.store.book[?(@.price < 10)].title
//
// Here is a complete overview and a side by side comparison of the JSONPath syntax elements with its XPath counterparts.
//
//	$          the root object/element
//	@          the current object/element
//	. or []  child operator
//	..      recursive descent. JSONPath borrows this syntax from E4X.
//	*       wildcard. All objects/elements regardless their names.
//	[]      subscript operator. XPath uses it to iterate over element collections and for predicates. In Javascript and JSON it is the native array operator.
//	[,]     Union operator in XPath results in a combination of node sets. JSONPath allows alternate names or array indices as a set.
//	[start:end:step]  array slice operator borrowed from ES4.
//	?()     applies a filter (script) expression.
//	()      script expression, using the underlying script engine.
//
// # JSONPath Script engine
//
// # Predefined constant
//
// Package has several predefined constants. You are free to add new one with AddConstant
//
//	e       math.E     float64
//	pi      math.Pi    float64
//	phi     math.Phi   float64
//
//	sqrt2     math.Sqrt2   float64
//	sqrte     math.SqrtE   float64
//	sqrtpi    math.SqrtPi  float64
//	sqrtphi   math.SqrtPhi float64
//
//	ln2     math.Ln2    float64
//	log2e   math.Log2E  float64
//	ln10    math.Ln10   float64
//	log10e  math.Log10E float64
//
//	true    true       bool
//	false   false      bool
//	null    nil        interface{}
//
// # Supported operations
//
// Package has several predefined operators. You are free to add new one with AddOperator
//
// Operator precedence: https://golang.org/ref/spec#Operator_precedence
//
//	Precedence    Operator
//	6             **
//	5             *   /   %  <<  >>  &  &^
//	4             +   -   |  ^
//	3             ==  !=  <  <=  >  >=  =~
//	2             &&
//	1             ||
//
// Arithmetic operators: https://golang.org/ref/spec#Arithmetic_operators
//
//	**   power                  integers, floats
//	+    sum                    integers, floats, strings
//	-    difference             integers, floats
//	*    product                integers, floats
//	/    quotient               integers, floats
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
// # Supported functions
//
// Package has several predefined functions. You are free to add new one with AddFunction
//
//	abs          math.Abs          integers, floats
//	acos         math.Acos         integers, floats
//	acosh        math.Acosh        integers, floats
//	asin         math.Asin         integers, floats
//	asinh        math.Asinh        integers, floats
//	atan         math.Atan         integers, floats
//	atanh        math.Atanh        integers, floats
//	avg          Average           array of integers or floats
//	cbrt         math.Cbrt         integers, floats
//	ceil         math.Ceil         integers, floats
//	cos          math.Cos          integers, floats
//	cosh         math.Cosh         integers, floats
//	erf          math.Erf          integers, floats
//	erfc         math.Erfc         integers, floats
//	erfcinv      math.Erfcinv      integers, floats
//	erfinv       math.Erfinv       integers, floats
//	exp          math.Exp          integers, floats
//	exp2         math.Exp2         integers, floats
//	expm1        math.Expm1        integers, floats
//	factorial    N!                unsigned integer
//	floor        math.Floor        integers, floats
//	gamma        math.Gamma        integers, floats
//	j0           math.J0           integers, floats
//	j1           math.J1           integers, floats
//	length       len               array
//	log          math.Log          integers, floats
//	log10        math.Log10        integers, floats
//	log1p        math.Log1p        integers, floats
//	log2         math.Log2         integers, floats
//	logb         math.Logb         integers, floats
//	not          not               any
//	pow10        math.Pow10        integer
//	round        math.Round        integers, floats
//	roundtoeven  math.RoundToEven  integers, floats
//	sin          math.Sin          integers, floats
//	sinh         math.Sinh         integers, floats
//	sqrt         math.Sqrt         integers, floats
//	tan          math.Tan          integers, floats
//	tanh         math.Tanh         integers, floats
//	trunc        math.Trunc        integers, floats
//	y0           math.Y0           integers, floats
//	y1           math.Y1           integers, floats
func JSONPath(data []byte, path string) (result []*Node, err error) {
	commands, err := ParseJSONPath(path)
	if err != nil {
		return nil, err
	}
	node, err := Unmarshal(data)
	if err != nil {
		return nil, err
	}
	return ApplyJSONPath(node, commands)
}

// Paths returns calculated paths of underlying nodes
func Paths(array []*Node) []string {
	result := make([]string, 0, len(array))
	for _, element := range array {
		result = append(result, element.Path())
	}
	return result
}

func recursiveChildren(node *Node) (result []*Node) {
	if node.isContainer() {
		for _, element := range node.Inheritors() {
			if element.isContainer() {
				result = append(result, element)
			}
		}
	}
	temp := make([]*Node, 0, len(result))
	temp = append(temp, result...)
	for _, element := range result {
		temp = append(temp, recursiveChildren(element)...)
	}
	return temp
}

// ParseJSONPath will parse current path and return all commands tobe run.
// Example:
//
//	result, _ := ParseJSONPath("$.store.book[?(@.price < 10)].title")
//	result == []string{"$", "store", "book", "?(@.price < 10)", "title"}
func ParseJSONPath(path string) (result []string, err error) {
	buf := newBuffer([]byte(path))
	result = make([]string, 0)
	const (
		fQuote  = 1 << 0
		fQuotes = 1 << 1
	)
	var (
		c           byte
		start, stop int
		childEnd    = map[byte]bool{dot: true, bracketL: true}
		flag        int
		brackets    int
	)
	for {
		c, err = buf.current()
		if err != nil {
			break
		}
	parseSwitch:
		switch true {
		case c == dollar || c == at:
			result = append(result, string(c))
		case c == dot:
			start = buf.index
			c, err = buf.next()
			if err == io.EOF {
				//nolint:ineffassign
				err = nil
				break
			}
			if err != nil {
				break
			}
			if c == dot {
				result = append(result, "..")
				buf.index--
				break
			}
			err = buf.skipAny(childEnd)
			stop = buf.index
			if err == io.EOF {
				err = nil
				stop = buf.length
			} else {
				buf.index--
			}
			if err != nil {
				break
			}
			if start+1 < stop {
				result = append(result, string(buf.data[start+1:stop]))
			}
		case c == bracketL:
			_, err = buf.next()
			if err != nil {
				return nil, buf.errorEOF()
			}
			brackets = 1
			start = buf.index
			for ; buf.index < buf.length; buf.index++ {
				c = buf.data[buf.index]
				switch c {
				case quote:
					if flag&fQuotes == 0 {
						if flag&fQuote == 0 {
							flag |= fQuote
						} else if !buf.backslash() {
							flag ^= fQuote
						}
					}
				case quotes:
					if flag&fQuote == 0 {
						if flag&fQuotes == 0 {
							flag |= fQuotes
						} else if !buf.backslash() {
							flag ^= fQuotes
						}
					}
				case bracketL:
					if flag == 0 && !buf.backslash() {
						brackets++
					}
				case bracketR:
					if flag == 0 && !buf.backslash() {
						brackets--
					}
					if brackets == 0 {
						result = append(result, string(buf.data[start:buf.index]))
						break parseSwitch
					}
				}
			}
			return nil, buf.errorEOF()
		default:
			return nil, buf.errorSymbol()
		}
		err = buf.step()
		if err != nil {
			if err == io.EOF {
				err = nil
			}
			break
		}
	}
	return
}

// ApplyJSONPath function applies commands sequence parse from JSONPath.
// Example:
//
//	commands := []string{"$", "store", "book", "?(@.price < 10)", "title"}
//	result, _ := ApplyJSONPath(node, commands)
func ApplyJSONPath(node *Node, commands []string) (result []*Node, err error) {
	if node == nil {
		return nil, nil
	}
	result = make([]*Node, 0)
	var (
		temporary   []*Node
		keys        []string
		ikeys       [3]int
		fkeys       [3]float64
		num         int
		key         string
		ok          bool
		value, temp *Node
		float       float64
		tokens      tokens
		expr        rpn
	)
	for i, cmd := range commands {
		tokens, err = newBuffer([]byte(cmd)).tokenize()
		if err != nil {
			return
		}
		switch {
		case cmd == "$": // root element
			if i == 0 {
				result = append(result, node.root())
			}
		case cmd == "@": // current element
			if i == 0 {
				result = append(result, node)
			}
		case cmd == "..": // recursive descent
			temporary = make([]*Node, 0)
			for _, element := range result {
				temporary = append(temporary, recursiveChildren(element)...)
			}
			result = append(result, temporary...)
		case cmd == "*": // wildcard
			temporary = make([]*Node, 0)
			for _, element := range result {
				temporary = append(temporary, element.Inheritors()...)
			}
			result = temporary
		case tokens.exists(":"): // array slice operator
			if tokens.count(":") > 3 {
				return nil, errorRequest("slice must contains no more than 2 colons, got '%s'", cmd)
			}
			keys = tokens.slice(":")

			temporary = make([]*Node, 0)
			for _, element := range result {
				if element.IsArray() && element.Size() > 0 {
					if fkeys[0], err = getNumberIndex(element, keys[0], math.NaN()); err != nil {
						return nil, errorRequest("wrong request: %s", cmd)
					}
					if fkeys[1], err = getNumberIndex(element, keys[1], math.NaN()); err != nil {
						return nil, errorRequest("wrong request: %s", cmd)
					}
					if len(keys) < 3 {
						fkeys[2] = 1
					} else if fkeys[2], err = getNumberIndex(element, keys[2], 1); err != nil {
						return nil, errorRequest("wrong request: %s", cmd)
					}

					ikeys[2] = int(fkeys[2])
					if ikeys[2] == 0 {
						return nil, errorRequest("wrong request: %s", cmd)
					}

					if math.IsNaN(fkeys[0]) {
						if ikeys[2] > 0 {
							ikeys[0] = 0
						} else {
							ikeys[0] = element.Size() - 1
						}
					} else {
						ikeys[0] = getPositiveIndex(int(fkeys[0]), element.Size())
					}
					if math.IsNaN(fkeys[1]) {
						if ikeys[2] > 0 {
							ikeys[1] = element.Size()
						} else {
							ikeys[1] = -1
						}
					} else {
						ikeys[1] = getPositiveIndex(int(fkeys[1]), element.Size())
					}

					if ikeys[2] > 0 {
						if ikeys[0] < 0 {
							ikeys[0] = 0
						}
						if ikeys[1] > element.Size() {
							ikeys[1] = element.Size()
						}

						for i := ikeys[0]; i < ikeys[1]; i += ikeys[2] {
							value, ok := element.children[strconv.Itoa(i)]
							if ok {
								temporary = append(temporary, value)
							}
						}
					} else if ikeys[2] < 0 {
						if ikeys[0] > element.Size() {
							ikeys[0] = element.Size()
						}
						if ikeys[1] < -1 {
							ikeys[1] = -1
						}

						for i := ikeys[0]; i > ikeys[1]; i += ikeys[2] {
							value, ok := element.children[strconv.Itoa(i)]
							if ok {
								temporary = append(temporary, value)
							}
						}
					}
				}
			}
			result = temporary
		case strings.HasPrefix(cmd, "?(") && strings.HasSuffix(cmd, ")"): // applies a filter (script) expression
			expr, err = newBuffer([]byte(cmd[2 : len(cmd)-1])).rpn()
			if err != nil {
				return nil, errorRequest("wrong request: %s", cmd)
			}
			temporary = make([]*Node, 0)
			for _, element := range result {
				if element.isContainer() {
					for _, temp = range element.Inheritors() {
						value, err = eval(temp, expr, cmd)
						if err != nil {
							return nil, errorRequest("wrong request: %s", cmd)
						}
						if value != nil {
							ok, err = boolean(value)
							if err != nil || !ok {
								continue
							}
							temporary = append(temporary, temp)
						}
					}
				}
			}
			result = temporary
		case strings.HasPrefix(cmd, "(") && strings.HasSuffix(cmd, ")"): // script expression, using the underlying script engine
			expr, err = newBuffer([]byte(cmd[1 : len(cmd)-1])).rpn()
			if err != nil {
				return nil, errorRequest("wrong request: %s", cmd)
			}
			temporary = make([]*Node, 0)
			for _, element := range result {
				if !element.isContainer() {
					continue
				}
				temp, err = eval(element, expr, cmd)
				if err != nil {
					return nil, errorRequest("wrong request: %s", cmd)
				}
				if temp != nil {
					value = nil
					switch temp.Type() {
					case String:
						key, err = temp.GetString()
						if err != nil {
							return nil, errorRequest("wrong type convert: %s", err.Error())
						}
						value = element.children[key]
					case Numeric:
						num, err = temp.getInteger()
						if err == nil { // INTEGER
							if num < 0 {
								key = strconv.Itoa(element.Size() - num)
							} else {
								key = strconv.Itoa(num)
							}
						} else {
							float, err = temp.GetNumeric()
							if err != nil {
								return nil, errorRequest("wrong type convert: %s", err.Error())
							}
							key = strconv.FormatFloat(float, 'g', -1, 64)
						}
						value = element.children[key]
					case Bool:
						ok, err = temp.GetBool()
						if err != nil {
							return nil, errorRequest("wrong type convert: %s", err.Error())
						}
						if ok {
							temporary = append(temporary, element.Inheritors()...)
						}
						continue
						// case Array: // get all keys from element via array values
					}
					if value != nil {
						temporary = append(temporary, value)
					}
				}
			}
			result = temporary
		default: // try to get by key & Union
			if tokens.exists(",") {
				keys = tokens.slice(",")
				if len(keys) == 0 {
					return nil, errorRequest("wrong request: %s", cmd)
				}
			} else {
				keys = []string{cmd}
			}

			temporary = make([]*Node, 0)
			for _, key = range keys { // fixme
				for _, element := range result {
					if element.IsArray() {
						if key == "length" || key == "'length'" || key == "\"length\"" {
							value, err = functions["length"](element)
							if err != nil {
								return
							}
							ok = true
						} else if strings.HasPrefix(key, "(") && strings.HasSuffix(key, ")") {
							fkeys[0], err = getNumberIndex(element, key, math.NaN())
							if err != nil {
								return nil, err
							}
							if math.IsNaN(fkeys[0]) {
								return nil, errorRequest("wrong request: %s", cmd)
							}
							if element.Size() == 0 {
								ok = false
							} else {
								num = getPositiveIndex(int(fkeys[0]), element.Size())
								key = strconv.Itoa(num)
								value, ok = element.children[key]
							}
						} else {
							key, _ = str(key)
							num, err = strconv.Atoi(key)
							if err != nil || element.Size() == 0 {
								ok = false
								err = nil
							} else {
								num = getPositiveIndex(num, element.Size())
								key = strconv.Itoa(num)
								value, ok = element.children[key]
							}
						}

					} else if element.IsObject() {
						key, _ = str(key)
						value, ok = element.children[key]
					}
					if ok {
						temporary = append(temporary, value)
						ok = false
					}
				}
			}
			result = temporary
		}
	}
	return
}

// Eval evaluate expression `@.price == 19.95 && @.color == 'red'` to the result value i.e. Bool(true), Numeric(3.14), etc.
func Eval(node *Node, cmd string) (result *Node, err error) {
	calc, err := newBuffer([]byte(cmd)).rpn()
	if err != nil {
		return nil, err
	}
	return eval(node, calc, cmd)
}

func eval(node *Node, expression rpn, cmd string) (result *Node, err error) {
	if node == nil {
		return nil, nil
	}
	var (
		stack    = make([]*Node, 0)
		slice    []*Node
		temp     *Node
		fn       Function
		op       Operation
		ok       bool
		size     int
		commands []string
		bstr     []byte
	)
	for _, exp := range expression {
		size = len(stack)
		if fn, ok = functions[exp]; ok {
			if size < 1 {
				return nil, errorRequest("wrong request: %s", cmd)
			}
			stack[size-1], err = fn(stack[size-1])
			if err != nil {
				return
			}
		} else if op, ok = operations[exp]; ok {
			if size < 2 {
				return nil, errorRequest("wrong request: %s", cmd)
			}
			stack[size-2], err = op(stack[size-2], stack[size-1])
			if err != nil {
				return
			}
			stack = stack[:size-1]
		} else if len(exp) > 0 {
			if exp[0] == dollar || exp[0] == at {
				commands, err = ParseJSONPath(exp)
				if err != nil {
					return
				}
				slice, err = ApplyJSONPath(node, commands)
				if err != nil {
					return
				}
				if len(slice) > 1 { // array given
					stack = append(stack, ArrayNode("", clone(slice)))
				} else if len(slice) == 1 {
					stack = append(stack, slice[0])
				} else { // no data found
					stack = append(stack, nil)
				}
			} else if constant, ok := constants[strings.ToLower(exp)]; ok {
				stack = append(stack, constant)
			} else {
				bstr = []byte(exp)
				size = len(bstr)
				if size >= 2 && bstr[0] == quote && bstr[size-1] == quote {
					if sstr, ok := unquote(bstr, quote); ok {
						temp = StringNode("", sstr)
					} else {
						err = errorRequest("wrong request: %s", cmd)
					}
				} else {
					temp, err = Unmarshal(bstr)
				}
				if err != nil {
					return
				}
				stack = append(stack, temp)
			}
		} else {
			stack = append(stack, valueNode(nil, "", String, ""))
		}
	}
	if len(stack) == 1 {
		if stack[0] == nil {
			return NullNode(""), nil
		}
		return stack[0], nil
	}
	if len(stack) == 0 {
		return NullNode(""), nil
	}
	return nil, errorRequest("wrong request: %s", cmd)
}

func getNumberIndex(element *Node, input string, Default float64) (result float64, err error) {
	var integer int
	if input == "" {
		result = Default
	} else if input == "(@.length)" {
		result = float64(element.Size())
	} else if strings.HasPrefix(input, "(") && strings.HasSuffix(input, ")") {
		var expr rpn
		var temp *Node
		expr, err = newBuffer([]byte(input[1 : len(input)-1])).rpn()
		if err != nil {
			return 0, err
		}
		temp, err = eval(element, expr, input)
		if err != nil {
			return
		}
		integer, err = temp.getInteger()
		if err != nil {
			return
		}
		result = float64(integer)
	} else {
		integer, err = strconv.Atoi(input)
		if err != nil {
			return 0, err
		}
		result = float64(integer)
	}
	return
}

func getPositiveIndex(index int, count int) int {
	if index < 0 {
		index += count
	}
	return index
}

func clone(list []*Node) []*Node {
	if list == nil {
		return nil
	}
	result := make([]*Node, len(list))
	for i, node := range list {
		result[i] = node.Clone()
	}
	return result
}
