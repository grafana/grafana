package nature

import (
	"fmt"
	"reflect"
	"time"

	"github.com/expr-lang/expr/builtin"
	"github.com/expr-lang/expr/internal/deref"
)

var (
	intType       = reflect.TypeOf(0)
	floatType     = reflect.TypeOf(float64(0))
	arrayType     = reflect.TypeOf([]any{})
	byteSliceType = reflect.TypeOf([]byte{})
	timeType      = reflect.TypeOf(time.Time{})
	durationType  = reflect.TypeOf(time.Duration(0))

	builtinInt = map[reflect.Type]struct{}{
		reflect.TypeOf(int(0)):     {},
		reflect.TypeOf(int8(0)):    {},
		reflect.TypeOf(int16(0)):   {},
		reflect.TypeOf(int32(0)):   {},
		reflect.TypeOf(int64(0)):   {},
		reflect.TypeOf(uintptr(0)): {},
		reflect.TypeOf(uint(0)):    {},
		reflect.TypeOf(uint8(0)):   {},
		reflect.TypeOf(uint16(0)):  {},
		reflect.TypeOf(uint32(0)):  {},
		reflect.TypeOf(uint64(0)):  {},
	}
	builtinFloat = map[reflect.Type]struct{}{
		reflect.TypeOf(float32(0)): {},
		reflect.TypeOf(float64(0)): {},
	}
)

type NatureCheck int

const (
	_ NatureCheck = iota
	BoolCheck
	StringCheck
	IntegerCheck
	NumberCheck
	MapCheck
	ArrayCheck
	TimeCheck
	DurationCheck
)

type Nature struct {
	// The order of the fields matter, check alignment before making changes.

	Type reflect.Type // Type of the value. If nil, then value is unknown.
	Kind reflect.Kind // Kind of the value.

	*TypeData

	// Ref is a reference used for multiple, disjoint purposes. When the Nature
	// is for a:
	//	- Predicate: then Ref is the nature of the Out of the predicate.
	//	- Array-like types: then Ref is the Elem nature of array type (usually Type is []any, but ArrayOf can be any nature).
	Ref *Nature

	Nil       bool // If value is nil.
	Strict    bool // If map is types.StrictMap.
	Method    bool // If value retrieved from method. Usually used to determine amount of in arguments.
	IsInteger bool // If it's a builtin integer or unsigned integer type.
	IsFloat   bool // If it's a builtin float type.
}

type TypeData struct {
	methodset *methodset // optional to avoid the map in *Cache

	*structData

	// map-only data
	Fields          map[string]Nature // Fields of map type.
	DefaultMapValue *Nature           // Default value of map type.

	// callable-only data
	Func            *builtin.Function // Used to pass function type from callee to CallNode.
	MethodIndex     int               // Index of method in type.
	inElem, outZero *Nature
	numIn, numOut   int

	isVariadic    bool
	isVariadicSet bool
	numInSet      bool
	numOutSet     bool
}

// Cache is a shared cache of type information. It is only used in the stages
// where type information becomes relevant, so packages like ast, parser, types,
// and lexer do not need to use the cache because they don't need any service
// from the Nature type, they only describe. However, when receiving a Nature
// from one of those packages, the cache must be set immediately.
type Cache struct {
	methods map[reflect.Type]*methodset
	structs map[reflect.Type]Nature
}

// NatureOf returns a Nature describing "i". If "i" is nil then it returns a
// Nature describing the value "nil".
func (c *Cache) NatureOf(i any) Nature {
	// reflect.TypeOf(nil) returns nil, but in FromType we want to differentiate
	// what nil means for us
	if i == nil {
		return Nature{Nil: true}
	}
	return c.FromType(reflect.TypeOf(i))
}

// FromType returns a Nature describing a value of type "t". If "t" is nil then
// it returns a Nature describing an unknown value.
func (c *Cache) FromType(t reflect.Type) Nature {
	if t == nil {
		return Nature{}
	}
	var td *TypeData
	var isInteger, isFloat bool
	k := t.Kind()
	switch k {
	case reflect.Struct:
		// c can be nil when we call the package function FromType, which uses a
		// nil *Cache to call this method.
		if c != nil {
			return c.getStruct(t)
		}
		fallthrough
	case reflect.Func:
		td = new(TypeData)
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		_, isInteger = builtinInt[t]
	case reflect.Float32, reflect.Float64:
		_, isFloat = builtinFloat[t]
	}
	return Nature{
		Type:      t,
		Kind:      k,
		TypeData:  td,
		IsInteger: isInteger,
		IsFloat:   isFloat,
	}
}

func (c *Cache) getStruct(t reflect.Type) Nature {
	if c.structs == nil {
		c.structs = map[reflect.Type]Nature{}
	} else if nt, ok := c.structs[t]; ok {
		return nt
	}
	nt := Nature{
		Type: t,
		Kind: reflect.Struct,
		TypeData: &TypeData{
			structData: &structData{
				rType:    t,
				numField: t.NumField(),
				anonIdx:  -1, // do not lookup embedded fields yet
			},
		},
	}
	c.structs[t] = nt
	return nt
}

func (c *Cache) getMethodset(t reflect.Type, k reflect.Kind) *methodset {
	if t == nil || c == nil {
		return nil
	}
	if c.methods == nil {
		c.methods = map[reflect.Type]*methodset{
			t: nil,
		}
	} else if s, ok := c.methods[t]; ok {
		return s
	}
	numMethod := t.NumMethod()
	if numMethod < 1 {
		c.methods[t] = nil // negative cache
		return nil
	}
	s := &methodset{
		rType:     t,
		kind:      k,
		numMethod: numMethod,
	}
	c.methods[t] = s
	return s
}

// NatureOf calls NatureOf on a nil *Cache. See the comment on Cache.
func NatureOf(i any) Nature {
	var c *Cache
	return c.NatureOf(i)
}

// FromType calls FromType on a nil *Cache. See the comment on Cache.
func FromType(t reflect.Type) Nature {
	var c *Cache
	return c.FromType(t)
}

func ArrayFromType(c *Cache, t reflect.Type) Nature {
	elem := c.FromType(t)
	nt := c.FromType(arrayType)
	nt.Ref = &elem
	return nt
}

func (n *Nature) IsAny(c *Cache) bool {
	return n.Type != nil && n.Kind == reflect.Interface && n.NumMethods(c) == 0
}

func (n *Nature) IsUnknown(c *Cache) bool {
	return n.Type == nil && !n.Nil || n.IsAny(c)
}

func (n *Nature) String() string {
	if n.Type != nil {
		return n.Type.String()
	}
	return "unknown"
}

func (n *Nature) Deref(c *Cache) Nature {
	t, _, changed := deref.TypeKind(n.Type, n.Kind)
	if !changed {
		return *n
	}
	return c.FromType(t)
}

func (n *Nature) Key(c *Cache) Nature {
	if n.Kind == reflect.Map {
		return c.FromType(n.Type.Key())
	}
	return Nature{}
}

func (n *Nature) Elem(c *Cache) Nature {
	switch n.Kind {
	case reflect.Ptr:
		return c.FromType(n.Type.Elem())
	case reflect.Map:
		if n.TypeData != nil && n.DefaultMapValue != nil {
			return *n.DefaultMapValue
		}
		return c.FromType(n.Type.Elem())
	case reflect.Slice, reflect.Array:
		if n.Ref != nil {
			return *n.Ref
		}
		return c.FromType(n.Type.Elem())
	}
	return Nature{}
}

func (n *Nature) AssignableTo(nt Nature) bool {
	if n.Nil {
		switch nt.Kind {
		case reflect.Pointer, reflect.Interface, reflect.Chan, reflect.Func,
			reflect.Map, reflect.Slice:
			// nil can be assigned to these kinds
			return true
		}
	}
	if n.Type == nil || nt.Type == nil ||
		n.Kind != nt.Kind && nt.Kind != reflect.Interface {
		return false
	}
	return n.Type.AssignableTo(nt.Type)
}

func (n *Nature) getMethodset(c *Cache) *methodset {
	if n.TypeData != nil && n.TypeData.methodset != nil {
		return n.TypeData.methodset
	}
	s := c.getMethodset(n.Type, n.Kind)
	if n.TypeData != nil {
		n.TypeData.methodset = s // cache locally if possible
	}
	return s
}

func (n *Nature) NumMethods(c *Cache) int {
	if s := n.getMethodset(c); s != nil {
		return s.numMethod
	}
	return 0
}

func (n *Nature) MethodByName(c *Cache, name string) (Nature, bool) {
	if s := n.getMethodset(c); s != nil {
		if m := s.method(c, name); m != nil {
			return m.nature, true
		}
	}
	return Nature{}, false
}

func (n *Nature) NumIn() int {
	if n.numInSet {
		return n.numIn
	}
	n.numInSet = true
	n.numIn = n.Type.NumIn()
	return n.numIn
}

func (n *Nature) InElem(c *Cache, i int) Nature {
	if n.inElem == nil {
		n2 := c.FromType(n.Type.In(i))
		n2 = n2.Elem(c)
		n.inElem = &n2
	}
	return *n.inElem
}

func (n *Nature) In(c *Cache, i int) Nature {
	return c.FromType(n.Type.In(i))
}

func (n *Nature) IsFirstArgUnknown(c *Cache) bool {
	if n.Type != nil {
		n2 := c.FromType(n.Type.In(0))
		return n2.IsUnknown(c)
	}
	return false
}

func (n *Nature) NumOut() int {
	if n.numOutSet {
		return n.numOut
	}
	n.numOutSet = true
	n.numOut = n.Type.NumOut()
	return n.numOut
}

func (n *Nature) Out(c *Cache, i int) Nature {
	if i != 0 {
		return n.out(c, i)
	}
	if n.outZero != nil {
		return *n.outZero
	}
	nt := n.out(c, 0)
	n.outZero = &nt
	return nt
}

func (n *Nature) out(c *Cache, i int) Nature {
	if n.Type == nil {
		return Nature{}
	}
	return c.FromType(n.Type.Out(i))
}

func (n *Nature) IsVariadic() bool {
	if n.isVariadicSet {
		return n.isVariadic
	}
	n.isVariadicSet = true
	n.isVariadic = n.Type.IsVariadic()
	return n.isVariadic
}

func (n *Nature) FieldByName(c *Cache, name string) (Nature, bool) {
	if n.Kind != reflect.Struct {
		return Nature{}, false
	}
	var sd *structData
	if n.TypeData != nil && n.structData != nil {
		sd = n.structData
	} else {
		sd = c.getStruct(n.Type).structData
	}
	if sf := sd.structField(c, nil, name); sf != nil {
		return sf.Nature, true
	}
	return Nature{}, false
}

func (n *Nature) IsFastMap() bool {
	return n.Type != nil &&
		n.Type.Kind() == reflect.Map &&
		n.Type.Key().Kind() == reflect.String &&
		n.Type.Elem().Kind() == reflect.Interface
}

func (n *Nature) Get(c *Cache, name string) (Nature, bool) {
	if n.Kind == reflect.Map && n.TypeData != nil {
		f, ok := n.Fields[name]
		return f, ok
	}
	return n.getSlow(c, name)
}

func (n *Nature) getSlow(c *Cache, name string) (Nature, bool) {
	if nt, ok := n.MethodByName(c, name); ok {
		return nt, true
	}
	t, k, changed := deref.TypeKind(n.Type, n.Kind)
	if k == reflect.Struct {
		var sd *structData
		if changed {
			sd = c.getStruct(t).structData
		} else {
			sd = n.structData
		}
		if sf := sd.structField(c, nil, name); sf != nil {
			return sf.Nature, true
		}
	}
	return Nature{}, false
}

func (n *Nature) FieldIndex(c *Cache, name string) ([]int, bool) {
	if n.Kind != reflect.Struct {
		return nil, false
	}
	if sf := n.structField(c, nil, name); sf != nil {
		return sf.Index, true
	}
	return nil, false
}

func (n *Nature) All(c *Cache) map[string]Nature {
	table := make(map[string]Nature)

	if n.Type == nil {
		return table
	}

	for i := 0; i < n.NumMethods(c); i++ {
		method := n.Type.Method(i)
		nt := c.FromType(method.Type)
		if nt.TypeData == nil {
			nt.TypeData = new(TypeData)
		}
		nt.Method = true
		nt.MethodIndex = method.Index
		table[method.Name] = nt
	}

	t := deref.Type(n.Type)

	switch t.Kind() {
	case reflect.Struct:
		for name, nt := range StructFields(c, t) {
			if _, ok := table[name]; ok {
				continue
			}
			table[name] = nt
		}

	case reflect.Map:
		if n.TypeData != nil {
			for key, nt := range n.Fields {
				if _, ok := table[key]; ok {
					continue
				}
				table[key] = nt
			}
		}
	}

	return table
}

func (n *Nature) IsNumber() bool {
	return n.IsInteger || n.IsFloat
}

func (n *Nature) PromoteNumericNature(c *Cache, rhs Nature) Nature {
	if n.IsUnknown(c) || rhs.IsUnknown(c) {
		return Nature{}
	}
	if n.IsFloat || rhs.IsFloat {
		return c.FromType(floatType)
	}
	return c.FromType(intType)
}

func (n *Nature) IsTime() bool {
	return n.Type == timeType
}

func (n *Nature) IsDuration() bool {
	return n.Type == durationType
}

func (n *Nature) IsBool() bool {
	return n.Kind == reflect.Bool
}

func (n *Nature) IsString() bool {
	return n.Kind == reflect.String
}

func (n *Nature) IsByteSlice() bool {
	return n.Type == byteSliceType
}

func (n *Nature) IsArray() bool {
	return n.Kind == reflect.Slice || n.Kind == reflect.Array
}

func (n *Nature) IsMap() bool {
	return n.Kind == reflect.Map
}

func (n *Nature) IsStruct() bool {
	return n.Kind == reflect.Struct
}

func (n *Nature) IsFunc() bool {
	return n.Kind == reflect.Func
}

func (n *Nature) IsPointer() bool {
	return n.Kind == reflect.Ptr
}

func (n *Nature) IsAnyOf(cs ...NatureCheck) bool {
	var result bool
	for i := 0; i < len(cs) && !result; i++ {
		switch cs[i] {
		case BoolCheck:
			result = n.IsBool()
		case StringCheck:
			result = n.IsString()
		case IntegerCheck:
			result = n.IsInteger
		case NumberCheck:
			result = n.IsNumber()
		case MapCheck:
			result = n.IsMap()
		case ArrayCheck:
			result = n.IsArray()
		case TimeCheck:
			result = n.IsTime()
		case DurationCheck:
			result = n.IsDuration()
		default:
			panic(fmt.Sprintf("unknown check value %d", cs[i]))
		}
	}
	return result
}

func (n *Nature) ComparableTo(c *Cache, rhs Nature) bool {
	return n.IsUnknown(c) || rhs.IsUnknown(c) ||
		n.Nil || rhs.Nil ||
		n.IsNumber() && rhs.IsNumber() ||
		n.IsDuration() && rhs.IsDuration() ||
		n.IsTime() && rhs.IsTime() ||
		n.IsArray() && rhs.IsArray() ||
		n.AssignableTo(rhs)
}

func (n *Nature) MaybeCompatible(c *Cache, rhs Nature, cs ...NatureCheck) bool {
	nIsUnknown := n.IsUnknown(c)
	rshIsUnknown := rhs.IsUnknown(c)
	return nIsUnknown && rshIsUnknown ||
		nIsUnknown && rhs.IsAnyOf(cs...) ||
		rshIsUnknown && n.IsAnyOf(cs...)
}

func (n *Nature) MakeArrayOf(c *Cache) Nature {
	nt := c.FromType(arrayType)
	nt.Ref = n
	return nt
}
