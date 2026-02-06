package set

// Rules represents the operations that define membership for a Set.
//
// Each Set has a Rules instance, whose methods must satisfy the interface
// contracts given below for any value that will be added to the set.
type Rules[T any] interface {
	// Hash returns an int that somewhat-uniquely identifies the given value.
	//
	// A good hash function will minimize collisions for values that will be
	// added to the set, though collisions *are* permitted. Collisions will
	// simply reduce the efficiency of operations on the set.
	Hash(T) int

	// Equivalent returns true if and only if the two values are considered
	// equivalent for the sake of set membership. Two values that are
	// equivalent cannot exist in the set at the same time, and if two
	// equivalent values are added it is undefined which one will be
	// returned when enumerating all of the set members.
	//
	// Two values that are equivalent *must* result in the same hash value,
	// though it is *not* required that two values with the same hash value
	// be equivalent.
	Equivalent(T, T) bool

	// SameRules returns true if the instance is equivalent to another Rules
	// instance over the same element type.
	SameRules(Rules[T]) bool
}

// OrderedRules is an extension of Rules that can apply a partial order to
// element values. When a set's Rules implements OrderedRules an iterator
// over the set will return items in the order described by the rules.
//
// If the given order is not a total order (that is, some pairs of non-equivalent
// elements do not have a defined order) then the resulting iteration order
// is undefined but consistent for a particular version of cty. The exact
// order in that case is not part of the contract and is subject to change
// between versions.
type OrderedRules[T any] interface {
	Rules[T]

	// Less returns true if and only if the first argument should sort before
	// the second argument. If the second argument should sort before the first
	// or if there is no defined order for the values, return false.
	Less(interface{}, interface{}) bool
}
