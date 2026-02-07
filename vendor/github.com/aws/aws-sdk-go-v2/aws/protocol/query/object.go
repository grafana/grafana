package query

import "net/url"

// Object represents the encoding of Query structures and unions. A Query
// object is a representation of a mapping of string keys to arbitrary
// values where there is a fixed set of keys whose values each have their
// own known type. A serialized object might look like the following:
//
//	ObjectName.Foo=value
//	&ObjectName.Bar=5
type Object struct {
	// The query values to add the object to.
	values url.Values
	// The object's prefix, which includes the names of all parent structures
	// and ends with the name of the object. For example, the prefix might be
	// "ParentStructure.ObjectName". This prefix will be used to form the full
	// keys for each member of the object. For example, a member might have the
	// key "ParentStructure.ObjectName.MemberName".
	//
	// While this is currently represented as a string that gets added to, it
	// could also be represented as a stack that only gets condensed into a
	// string when a finalized key is created. This could potentially reduce
	// allocations.
	prefix string
}

func newObject(values url.Values, prefix string) *Object {
	return &Object{
		values: values,
		prefix: prefix,
	}
}

// Key adds the given named key to the Query object.
// Returns a Value encoder that should be used to encode a Query value type.
func (o *Object) Key(name string) Value {
	return o.key(name, false)
}

// KeyWithValues adds the given named key to the Query object.
// Returns a Value encoder that should be used to encode a Query list of values.
func (o *Object) KeyWithValues(name string) Value {
	return o.keyWithValues(name, false)
}

// FlatKey adds the given named key to the Query object.
// Returns a Value encoder that should be used to encode a Query value type. The
// value will be flattened if it is a map or array.
func (o *Object) FlatKey(name string) Value {
	return o.key(name, true)
}

func (o *Object) key(name string, flatValue bool) Value {
	if o.prefix != "" {
		// This uses string concatenation in place of fmt.Sprintf as fmt.Sprintf has a much higher resource overhead
		return newValue(o.values, o.prefix+keySeparator+name, flatValue)
	}
	return newValue(o.values, name, flatValue)
}

func (o *Object) keyWithValues(name string, flatValue bool) Value {
	if o.prefix != "" {
		// This uses string concatenation in place of fmt.Sprintf as fmt.Sprintf has a much higher resource overhead
		return newAppendValue(o.values, o.prefix+keySeparator+name, flatValue)
	}
	return newAppendValue(o.values, name, flatValue)
}
