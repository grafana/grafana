package ajson

import (
	"math"
	"sort"
	"strconv"
	"sync/atomic"
)

// Node is a main struct, presents any type of JSON node.
// Available types are:
//
//	const (
//		Null NodeType = iota
//		Numeric
//		String
//		Bool
//		Array
//		Object
//	)
//
// Every type has its own methods to be called.
// Every Node contains link to a byte data, parent and children, also calculated type of value, atomic value and internal information.
type Node struct {
	parent   *Node
	children map[string]*Node
	key      *string
	index    *int
	_type    NodeType
	data     *[]byte
	borders  [2]int
	value    atomic.Value
	dirty    bool
}

// NodeType is a kind of reflection of JSON type to a type of golang.
type NodeType int32

// Reflections:
//
//	Null    = nil.(interface{})
//	Numeric = float64
//	String  = string
//	Bool    = bool
//	Array   = []*Node
//	Object  = map[string]*Node
const (
	// Null is reflection of nil.(interface{})
	Null NodeType = iota
	// Numeric is reflection of float64
	Numeric
	// String is reflection of string
	String
	// Bool is reflection of bool
	Bool
	// Array is reflection of []*Node
	Array
	// Object is reflection of map[string]*Node
	Object
)

// NullNode is constructor for Node with Null value.
func NullNode(key string) *Node {
	return &Node{
		_type: Null,
		key:   &key,
		dirty: true,
	}
}

// NumericNode is constructor for Node with a Numeric value.
func NumericNode(key string, value float64) (current *Node) {
	current = &Node{
		_type: Numeric,
		key:   &key,
		dirty: true,
	}
	current.value.Store(value)
	return
}

// StringNode is constructor for Node with a String value.
func StringNode(key string, value string) (current *Node) {
	current = &Node{
		_type: String,
		key:   &key,
		dirty: true,
	}
	current.value.Store(value)
	return
}

// BoolNode is constructor for Node with a Bool value.
func BoolNode(key string, value bool) (current *Node) {
	current = &Node{
		_type: Bool,
		key:   &key,
		dirty: true,
	}
	current.value.Store(value)
	return
}

// ArrayNode is constructor for Node with an Array value.
// Warning! This method will change the input value, to avoid this process only cloned with `Node.Clone` objects
func ArrayNode(key string, value []*Node) (current *Node) {
	current = &Node{
		data:  nil,
		_type: Array,
		key:   &key,
		dirty: true,
	}
	current.children = make(map[string]*Node, len(value))
	if value != nil {
		for i := range value {
			var index = i
			current.children[strconv.Itoa(index)] = value[index]
			value[index].parent = current
			value[index].index = &index
		}
		current.value.Store(value)
	}
	return
}

// ObjectNode is constructor for Node with an Object value.
// Warning! This method will change the input value, to avoid this process only cloned with `Node.Clone` objects
func ObjectNode(key string, value map[string]*Node) (current *Node) {
	current = &Node{
		_type:    Object,
		key:      &key,
		children: value,
		dirty:    true,
	}
	if value != nil {
		for key, val := range value {
			vkey := key
			val.parent = current
			val.key = &vkey
		}
		current.value.Store(value)
	} else {
		current.children = make(map[string]*Node)
	}
	return
}

func newNode(parent *Node, buf *buffer, _type NodeType, key **string) (current *Node, err error) {
	current = &Node{
		parent:  parent,
		data:    &buf.data,
		borders: [2]int{buf.index, 0},
		_type:   _type,
		key:     *key,
		dirty:   false,
	}
	if _type == Object || _type == Array {
		current.children = make(map[string]*Node)
	}
	if parent != nil {
		if parent.IsArray() {
			size := len(parent.children)
			current.index = &size
			parent.children[strconv.Itoa(size)] = current
		} else if parent.IsObject() {
			if *key == nil {
				err = errorSymbol(buf)
			} else {
				parent.children[**key] = current
			}
		} else {
			err = errorSymbol(buf)
		}
	}
	return
}

func valueNode(parent *Node, key string, _type NodeType, value interface{}) (current *Node) {
	current = &Node{
		parent:  parent,
		data:    nil,
		borders: [2]int{0, 0},
		_type:   _type,
		key:     &key,
		dirty:   true,
	}
	if value != nil {
		current.value.Store(value)
	}
	return
}

// Parent returns link to the parent of current node, nil for root.
func (n *Node) Parent() *Node {
	if n == nil {
		return nil
	}
	return n.parent
}

// Source returns slice of bytes, which was identified to be current node.
func (n *Node) Source() []byte {
	if n == nil {
		return nil
	}
	if n.ready() && !n.dirty && n.data != nil {
		return (*n.data)[n.borders[0]:n.borders[1]]
	}
	return nil
}

// String is implementation of Stringer interface, returns string based on source part.
func (n *Node) String() string {
	if n == nil {
		return ""
	}
	if n.ready() && !n.dirty {
		return string(n.Source())
	}
	val, err := Marshal(n)
	if err != nil {
		return "Error: " + err.Error()
	}
	return string(val)
}

// Type will return type of current node.
func (n *Node) Type() NodeType {
	if n == nil {
		return Null
	}
	return n._type
}

// Key will return key of current node, please check, that parent of this node has an Object type.
func (n *Node) Key() string {
	if n == nil {
		return ""
	}
	if n.key == nil {
		return ""
	}
	return *n.key
}

// Index will return index of current node, please check, that parent of this node has an Array type.
func (n *Node) Index() int {
	if n == nil {
		return -1
	}
	if n.index == nil {
		return -1
	}
	return *n.index
}

// Size will return count of children of current node, please check, that parent of this node has an Array type.
func (n *Node) Size() int {
	if n == nil {
		return 0
	}
	return len(n.children)
}

// Keys will return count all keys of children of current node, please check, that parent of this node has an Object type.
func (n *Node) Keys() (result []string) {
	if n == nil {
		return nil
	}
	result = make([]string, 0, len(n.children))
	for key := range n.children {
		result = append(result, key)
	}
	return
}

// IsArray returns true if current node is Array.
func (n *Node) IsArray() bool {
	if n == nil {
		return false
	}
	return n._type == Array
}

// IsObject returns true if current node is Object.
func (n *Node) IsObject() bool {
	if n == nil {
		return false
	}
	return n._type == Object
}

// IsNull returns true if current node is Null.
func (n *Node) IsNull() bool {
	if n == nil {
		return false
	}
	return n._type == Null
}

// IsNumeric returns true if current node is Numeric.
func (n *Node) IsNumeric() bool {
	if n == nil {
		return false
	}
	return n._type == Numeric
}

// IsString returns true if current node is String.
func (n *Node) IsString() bool {
	if n == nil {
		return false
	}
	return n._type == String
}

// IsBool returns true if current node is Bool.
func (n *Node) IsBool() bool {
	if n == nil {
		return false
	}
	return n._type == Bool
}

// Value is calculating and returns a value of current node.
//
// It returns nil, if current node type is Null.
//
// It returns float64, if current node type is Numeric.
//
// It returns string, if current node type is String.
//
// It returns bool, if current node type is Bool.
//
// It returns []*Node, if current node type is Array.
//
// It returns map[string]*Node, if current node type is Object.
//
// BUT! Current method doesn't calculate underlying nodes (use method Node.Unpack for that).
//
// Value will be calculated only once and saved into atomic.Value.
func (n *Node) Value() (value interface{}, err error) {
	if n == nil {
		return nil, errorUnparsed()
	}
	switch n._type {
	case Null:
		return n.GetNull()
	case Numeric:
		return n.GetNumeric()
	case String:
		return n.GetString()
	case Bool:
		return n.GetBool()
	case Array:
		return n.GetArray()
	case Object:
		return n.GetObject()
	}
	return nil, errorType()
}

func (n *Node) getValue() (value interface{}, err error) {
	value = n.value.Load()
	if value == nil {
		switch n._type {
		case Null:
			return nil, nil
		case Numeric:
			value, err = strconv.ParseFloat(string(n.Source()), 64)
			if err != nil {
				return
			}
			n.value.Store(value)
		case String:
			var ok bool
			value, ok = unquote(n.Source(), quotes)
			if !ok {
				return "", errorAt(n.borders[0], (*n.data)[n.borders[0]])
			}
			n.value.Store(value)
		case Bool:
			if len(n.Source()) == 0 {
				return nil, errorUnparsed()
			}
			b := n.Source()[0]
			value = b == 't' || b == 'T'
			n.value.Store(value)
		case Array:
			children := make([]*Node, len(n.children))
			for _, child := range n.children {
				children[*child.index] = child
			}
			value = children
			n.value.Store(value)
		case Object:
			result := make(map[string]*Node)
			for key, child := range n.children {
				result[key] = child
			}
			value = result
			n.value.Store(value)
		}
	}
	return
}

// GetNull returns nil, if current type is Null, else: WrongType error.
func (n *Node) GetNull() (interface{}, error) {
	if n == nil {
		return nil, errorUnparsed()
	}
	if n._type != Null {
		return nil, errorType()
	}
	return nil, nil
}

// GetNumeric returns float64, if current type is Numeric, else: WrongType error.
func (n *Node) GetNumeric() (value float64, err error) {
	if n == nil {
		return 0, errorUnparsed()
	}
	if n._type != Numeric {
		return value, errorType()
	}
	iValue, err := n.getValue()
	if err != nil {
		return 0, err
	}
	value, ok := iValue.(float64)
	if !ok {
		return value, errorType()
	}
	return value, nil
}

// GetString returns string, if current type is String, else: WrongType error.
func (n *Node) GetString() (value string, err error) {
	if n == nil {
		return "", errorUnparsed()
	}
	if n._type != String {
		return value, errorType()
	}
	iValue, err := n.getValue()
	if err != nil {
		return "", err
	}
	value, ok := iValue.(string)
	if !ok {
		return value, errorType()
	}
	return value, nil
}

// GetBool returns bool, if current type is Bool, else: WrongType error.
func (n *Node) GetBool() (value bool, err error) {
	if n == nil {
		return value, errorUnparsed()
	}
	if n._type != Bool {
		return value, errorType()
	}
	iValue, err := n.getValue()
	if err != nil {
		return false, err
	}
	value, ok := iValue.(bool)
	if !ok {
		return value, errorType()
	}
	return value, nil
}

// GetArray returns []*Node, if current type is Array, else: WrongType error.
func (n *Node) GetArray() (value []*Node, err error) {
	if n == nil {
		return nil, errorUnparsed()
	}
	if n._type != Array {
		return value, errorType()
	}
	iValue, err := n.getValue()
	if err != nil {
		return nil, err
	}
	value, ok := iValue.([]*Node)
	if !ok {
		return value, errorType()
	}
	return value, nil
}

// GetObject returns map[string]*Node, if current type is Object, else: WrongType error.
func (n *Node) GetObject() (value map[string]*Node, err error) {
	if n == nil {
		return nil, errorUnparsed()
	}
	if n._type != Object {
		return value, errorType()
	}
	iValue, err := n.getValue()
	if err != nil {
		return nil, err
	}
	value, ok := iValue.(map[string]*Node)
	if !ok {
		return value, errorType()
	}
	return value, nil
}

// MustNull returns nil, if current type is Null, else: panic if error happened.
func (n *Node) MustNull() (value interface{}) {
	value, err := n.GetNull()
	if err != nil {
		panic(err)
	}
	return
}

// MustNumeric returns float64, if current type is Numeric, else: panic if error happened.
func (n *Node) MustNumeric() (value float64) {
	value, err := n.GetNumeric()
	if err != nil {
		panic(err)
	}
	return
}

// MustString returns string, if current type is String, else: panic if error happened.
func (n *Node) MustString() (value string) {
	value, err := n.GetString()
	if err != nil {
		panic(err)
	}
	return
}

// MustBool returns bool, if current type is Bool, else: panic if error happened.
func (n *Node) MustBool() (value bool) {
	value, err := n.GetBool()
	if err != nil {
		panic(err)
	}
	return
}

// MustArray returns []*Node, if current type is Array, else: panic if error happened.
func (n *Node) MustArray() (value []*Node) {
	value, err := n.GetArray()
	if err != nil {
		panic(err)
	}
	return
}

// MustObject returns map[string]*Node, if current type is Object, else: panic if error happened.
func (n *Node) MustObject() (value map[string]*Node) {
	value, err := n.GetObject()
	if err != nil {
		panic(err)
	}
	return
}

// Unpack will produce current node to it's interface, recursively with all underlying nodes (in contrast to Node.Value).
func (n *Node) Unpack() (value interface{}, err error) {
	if n == nil {
		return nil, errorUnparsed()
	}
	switch n._type {
	case Null:
		return nil, nil
	case Numeric:
		value, err = n.Value()
		if _, ok := value.(float64); !ok {
			return nil, errorType()
		}
	case String:
		value, err = n.Value()
		if _, ok := value.(string); !ok {
			return nil, errorType()
		}
	case Bool:
		value, err = n.Value()
		if _, ok := value.(bool); !ok {
			return nil, errorType()
		}
	case Array:
		children := make([]interface{}, len(n.children))
		for _, child := range n.children {
			val, err := child.Unpack()
			if err != nil {
				return nil, err
			}
			children[*child.index] = val
		}
		value = children
	case Object:
		result := make(map[string]interface{})
		for key, child := range n.children {
			result[key], err = child.Unpack()
			if err != nil {
				return nil, err
			}
		}
		value = result
	}
	return
}

// GetIndex will return child node of current array node. If current node is not Array, or index is unavailable, will return error.
func (n *Node) GetIndex(index int) (*Node, error) {
	if n == nil {
		return nil, errorUnparsed()
	}
	if n._type != Array {
		return nil, errorType()
	}
	if index < 0 {
		index += len(n.children)
	}
	child, ok := n.children[strconv.Itoa(index)]
	if !ok {
		return nil, errorRequest("out of index %d", index)
	}
	return child, nil
}

// MustIndex will return child node of current array node. If current node is not Array, or index is unavailable, raise a panic.
func (n *Node) MustIndex(index int) (value *Node) {
	value, err := n.GetIndex(index)
	if err != nil {
		panic(err)
	}
	return
}

// GetKey will return child node of current object node. If current node is not Object, or key is unavailable, will return error.
func (n *Node) GetKey(key string) (*Node, error) {
	if n == nil {
		return nil, errorUnparsed()
	}
	if n._type != Object {
		return nil, errorType()
	}
	value, ok := n.children[key]
	if !ok {
		return nil, errorRequest("wrong key '%s'", key)
	}
	return value, nil
}

// MustKey will return child node of current object node. If current node is not Object, or key is unavailable, raise a panic.
func (n *Node) MustKey(key string) (value *Node) {
	value, err := n.GetKey(key)
	if err != nil {
		panic(err)
	}
	return
}

// HasKey will return boolean value, if current object node has custom key.
func (n *Node) HasKey(key string) bool {
	if n == nil {
		return false
	}
	_, ok := n.children[key]
	return ok
}

// Empty method check if current container node has no children.
func (n *Node) Empty() bool {
	if n == nil {
		return false
	}
	return len(n.children) == 0
}

// Path returns full JsonPath of current Node.
func (n *Node) Path() string {
	if n == nil {
		return ""
	}
	if n.parent == nil {
		return "$"
	}
	if n.key != nil {
		return n.parent.Path() + "['" + n.Key() + "']"
	}
	return n.parent.Path() + "[" + strconv.Itoa(n.Index()) + "]"
}

// Eq check if nodes value are the same.
func (n *Node) Eq(node *Node) (result bool, err error) {
	if n == nil || node == nil {
		return false, errorUnparsed()
	}
	if n.Type() == node.Type() {
		switch n.Type() {
		case Bool:
			lnum, rnum, err := _bools(n, node)
			if err != nil {
				return false, err
			}
			result = lnum == rnum
		case Numeric:
			lnum, rnum, err := _floats(n, node)
			if err != nil {
				return false, err
			}
			result = lnum == rnum
		case String:
			lnum, rnum, err := _strings(n, node)
			if err != nil {
				return false, err
			}
			result = lnum == rnum
		case Null:
			// Null type always is the same
			result = true
		case Array:
			lnum, rnum, err := _arrays(n, node)
			if err != nil {
				return false, err
			}
			if len(lnum) == len(rnum) {
				result = true
				for i := range lnum {
					result, err = lnum[i].Eq(rnum[i])
					if err != nil {
						return false, err
					}
					if !result {
						return false, err
					}
				}
			}
		case Object:
			lnum, rnum, err := _objects(n, node)
			if err != nil {
				return false, err
			}
			if len(lnum) == len(rnum) {
				result = true
				for i := range lnum {
					element, ok := rnum[i]
					if !ok {
						return false, nil
					}
					result, err = lnum[i].Eq(element)
					if err != nil {
						return false, err
					}
					if !result {
						return false, err
					}
				}
			}
		}
	}
	return
}

// Neq check if nodes value are not the same.
func (n *Node) Neq(node *Node) (result bool, err error) {
	result, err = n.Eq(node)
	return !result, err
}

// Le check if nodes value is lesser than given.
func (n *Node) Le(node *Node) (result bool, err error) {
	if n == nil || node == nil {
		return false, errorUnparsed()
	}
	if n.Type() == node.Type() {
		switch n.Type() {
		case Numeric:
			lnum, rnum, err := _floats(n, node)
			if err != nil {
				return false, err
			}
			result = lnum < rnum
		case String:
			lnum, rnum, err := _strings(n, node)
			if err != nil {
				return false, err
			}
			result = lnum < rnum
		default:
			return false, errorType()
		}
	}
	return
}

// Leq check if nodes value is lesser or equal than given.
func (n *Node) Leq(node *Node) (result bool, err error) {
	if n == nil || node == nil {
		return false, errorUnparsed()
	}
	if n.Type() == node.Type() {
		switch n.Type() {
		case Numeric:
			lnum, rnum, err := _floats(n, node)
			if err != nil {
				return false, err
			}
			result = lnum <= rnum
		case String:
			lnum, rnum, err := _strings(n, node)
			if err != nil {
				return false, err
			}
			result = lnum <= rnum
		default:
			return false, errorType()
		}
	}
	return
}

// Ge check if nodes value is greater than given.
func (n *Node) Ge(node *Node) (result bool, err error) {
	if n == nil || node == nil {
		return false, errorUnparsed()
	}
	if n.Type() == node.Type() {
		switch n.Type() {
		case Numeric:
			lnum, rnum, err := _floats(n, node)
			if err != nil {
				return false, err
			}
			result = lnum > rnum
		case String:
			lnum, rnum, err := _strings(n, node)
			if err != nil {
				return false, err
			}
			result = lnum > rnum
		default:
			return false, errorType()
		}
	}
	return
}

// Geq check if nodes value is greater or equal than given.
func (n *Node) Geq(node *Node) (result bool, err error) {
	if n == nil || node == nil {
		return false, errorUnparsed()
	}
	if n.Type() == node.Type() {
		switch n.Type() {
		case Numeric:
			lnum, rnum, err := _floats(n, node)
			if err != nil {
				return false, err
			}
			result = lnum >= rnum
		case String:
			lnum, rnum, err := _strings(n, node)
			if err != nil {
				return false, err
			}
			result = lnum >= rnum
		default:
			return false, errorType()
		}
	}
	return
}

func (n *Node) ready() bool {
	return n.borders[1] != 0
}

func (n *Node) isContainer() bool {
	return n._type == Array || n._type == Object
}

func (n *Node) getInteger() (int, error) {
	if !n.IsNumeric() {
		return 0, errorType()
	}
	float, err := n.GetNumeric()
	if err != nil {
		return 0, err
	}
	if math.Mod(float, 1.0) != 0 {
		return 0, errorRequest("node is not INT")
	}
	return int(float), nil
}

func (n *Node) getUInteger() (uint, error) {
	result, err := n.getInteger()
	if err != nil {
		return 0, err
	}
	if result < 0 {
		return 0, errorRequest("node is not UINT")
	}
	return uint(result), nil
}

// Inheritors return sorted by keys/index slice of children.
func (n *Node) Inheritors() (result []*Node) {
	if n == nil {
		return nil
	}
	size := len(n.children)
	if n.IsObject() {
		result = make([]*Node, size)
		keys := n.Keys()
		sort.Slice(keys, func(i, j int) bool {
			return keys[i] < keys[j]
		})
		for i, key := range keys {
			result[i] = n.children[key]
		}
	} else if n.IsArray() {
		result = make([]*Node, size)
		for _, element := range n.children {
			result[*element.index] = element
		}
	}
	return
}

// JSONPath evaluate path for current node.
func (n *Node) JSONPath(path string) (result []*Node, err error) {
	commands, err := ParseJSONPath(path)
	if err != nil {
		return nil, err
	}
	return ApplyJSONPath(n, commands)
}

// root returns the root node.
func (n *Node) root() (node *Node) {
	node = n
	for node.parent != nil {
		node = node.parent
	}
	return node
}
