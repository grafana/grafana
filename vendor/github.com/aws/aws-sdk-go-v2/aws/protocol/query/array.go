package query

import (
	"net/url"
	"strconv"
)

// Array represents the encoding of Query lists and sets. A Query array is a
// representation of a list of values of a fixed type. A serialized array might
// look like the following:
//
//	ListName.member.1=foo
//	&ListName.member.2=bar
//	&Listname.member.3=baz
type Array struct {
	// The query values to add the array to.
	values url.Values
	// The array's prefix, which includes the names of all parent structures
	// and ends with the name of the list. For example, the prefix might be
	// "ParentStructure.ListName". This prefix will be used to form the full
	// keys for each element in the list. For example, an entry might have the
	// key "ParentStructure.ListName.member.MemberName.1".
	//
	// When the array is not flat the prefix will contain the memberName otherwise the memberName is ignored
	prefix string
	// Elements are stored in values, so we keep track of the list size here.
	size int32
	// Empty lists are encoded as "<prefix>=", if we add a value later we will
	// remove this encoding
	emptyValue Value
}

func newArray(values url.Values, prefix string, flat bool, memberName string) *Array {
	emptyValue := newValue(values, prefix, flat)
	emptyValue.String("")

	if !flat {
		// This uses string concatenation in place of fmt.Sprintf as fmt.Sprintf has a much higher resource overhead
		prefix = prefix + keySeparator + memberName
	}

	return &Array{
		values:     values,
		prefix:     prefix,
		emptyValue: emptyValue,
	}
}

// Value adds a new element to the Query Array. Returns a Value type used to
// encode the array element.
func (a *Array) Value() Value {
	if a.size == 0 {
		delete(a.values, a.emptyValue.key)
	}

	// Query lists start a 1, so adjust the size first
	a.size++
	// Lists can't have flat members
	// This uses string concatenation in place of fmt.Sprintf as fmt.Sprintf has a much higher resource overhead
	return newValue(a.values, a.prefix+keySeparator+strconv.FormatInt(int64(a.size), 10), false)
}
