package query

import (
	"fmt"
	"net/url"
)

// Map represents the encoding of Query maps. A Query map is a representation
// of a mapping of arbitrary string keys to arbitrary values of a fixed type.
// A Map differs from an Object in that the set of keys is not fixed, in that
// the values must all be of the same type, and that map entries are ordered.
// A serialized map might look like the following:
//
//	MapName.entry.1.key=Foo
//	&MapName.entry.1.value=spam
//	&MapName.entry.2.key=Bar
//	&MapName.entry.2.value=eggs
type Map struct {
	// The query values to add the map to.
	values url.Values
	// The map's prefix, which includes the names of all parent structures
	// and ends with the name of the object. For example, the prefix might be
	// "ParentStructure.MapName". This prefix will be used to form the full
	// keys for each key-value pair of the map. For example, a value might have
	// the key "ParentStructure.MapName.1.value".
	//
	// While this is currently represented as a string that gets added to, it
	// could also be represented as a stack that only gets condensed into a
	// string when a finalized key is created. This could potentially reduce
	// allocations.
	prefix string
	// Whether the map is flat or not. A map that is not flat will produce the
	// following entries to the url.Values for a given key-value pair:
	//     MapName.entry.1.KeyLocationName=mykey
	//     MapName.entry.1.ValueLocationName=myvalue
	// A map that is flat will produce the following:
	//     MapName.1.KeyLocationName=mykey
	//     MapName.1.ValueLocationName=myvalue
	flat bool
	// The location name of the key. In most cases this should be "key".
	keyLocationName string
	// The location name of the value. In most cases this should be "value".
	valueLocationName string
	// Elements are stored in values, so we keep track of the list size here.
	size int32
}

func newMap(values url.Values, prefix string, flat bool, keyLocationName string, valueLocationName string) *Map {
	return &Map{
		values:            values,
		prefix:            prefix,
		flat:              flat,
		keyLocationName:   keyLocationName,
		valueLocationName: valueLocationName,
	}
}

// Key adds the given named key to the Query map.
// Returns a Value encoder that should be used to encode a Query value type.
func (m *Map) Key(name string) Value {
	// Query lists start a 1, so adjust the size first
	m.size++
	var key string
	var value string
	if m.flat {
		key = fmt.Sprintf("%s.%d.%s", m.prefix, m.size, m.keyLocationName)
		value = fmt.Sprintf("%s.%d.%s", m.prefix, m.size, m.valueLocationName)
	} else {
		key = fmt.Sprintf("%s.entry.%d.%s", m.prefix, m.size, m.keyLocationName)
		value = fmt.Sprintf("%s.entry.%d.%s", m.prefix, m.size, m.valueLocationName)
	}

	// The key can only be a string, so we just go ahead and set it here
	newValue(m.values, key, false).String(name)

	// Maps can't have flat members
	return newValue(m.values, value, false)
}
