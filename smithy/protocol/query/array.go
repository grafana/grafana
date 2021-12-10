package query

import (
	"fmt"
	"net/url"
)

// Array represents the encoding of Query lists and sets. A Query array is a
// representation of a list of values of a fixed type. A serialized array might
// look like the following:
//
//     ListName.member.1=foo
//     &ListName.member.2=bar
//     &Listname.member.3=baz
type Array struct {
	// The query values to add the array to.
	values url.Values
	// The array's prefix, which includes the names of all parent structures
	// and ends with the name of the list. For example, the prefix might be
	// "ParentStructure.ListName". This prefix will be used to form the full
	// keys for each element in the list. For example, an entry might have the
	// key "ParentStructure.ListName.member.MemberName.1".
	//
	// While this is currently represented as a string that gets added to, it
	// could also be represented as a stack that only gets condensed into a
	// string when a finalized key is created. This could potentially reduce
	// allocations.
	prefix string
	// Whether the list is flat or not. A list that is not flat will produce the
	// following entry to the url.Values for a given entry:
	//     ListName.MemberName.1=value
	// A list that is flat will produce the following:
	//     ListName.1=value
	flat bool
	// The location name of the member. In most cases this should be "member".
	memberName string
	// Elements are stored in values, so we keep track of the list size here.
	size int32
}

func newArray(values url.Values, prefix string, flat bool, memberName string) *Array {
	return &Array{
		values:     values,
		prefix:     prefix,
		flat:       flat,
		memberName: memberName,
	}
}

// Value adds a new element to the Query Array. Returns a Value type used to
// encode the array element.
func (a *Array) Value() Value {
	// Query lists start a 1, so adjust the size first
	a.size++
	prefix := a.prefix
	if !a.flat {
		prefix = fmt.Sprintf("%s.%s", prefix, a.memberName)
	}
	// Lists can't have flat members
	return newValue(a.values, fmt.Sprintf("%s.%d", prefix, a.size), false)
}
