package cty

import (
	"fmt"
	"hash/crc64"

	"github.com/zclconf/go-cty/cty/set"
)

// PathSet represents a set of Path objects. This can be used, for example,
// to talk about a subset of paths within a value that meet some criteria,
// without directly modifying the values at those paths.
type PathSet struct {
	set set.Set[Path]
}

// NewPathSet creates and returns a PathSet, with initial contents optionally
// set by the given arguments.
func NewPathSet(paths ...Path) PathSet {
	ret := PathSet{
		set: set.NewSet(set.Rules[Path](pathSetRules{})),
	}

	for _, path := range paths {
		ret.Add(path)
	}

	return ret
}

// Add inserts a single given path into the set.
//
// Paths are immutable after construction by convention. It is particularly
// important not to mutate a path after it has been placed into a PathSet.
// If a Path is mutated while in a set, behavior is undefined.
func (s PathSet) Add(path Path) {
	s.set.Add(path)
}

// AddAllSteps is like Add but it also adds all of the steps leading to
// the given path.
//
// For example, if given a path representing "foo.bar", it will add both
// "foo" and "bar".
func (s PathSet) AddAllSteps(path Path) {
	for i := 1; i <= len(path); i++ {
		s.Add(path[:i])
	}
}

// Has returns true if the given path is in the receiving set.
func (s PathSet) Has(path Path) bool {
	return s.set.Has(path)
}

// List makes and returns a slice of all of the paths in the receiving set,
// in an undefined but consistent order.
func (s PathSet) List() []Path {
	if s.Empty() {
		return nil
	}
	ret := make([]Path, 0, s.set.Length())
	for it := s.set.Iterator(); it.Next(); {
		ret = append(ret, it.Value())
	}
	return ret
}

// Remove modifies the receving set to no longer include the given path.
// If the given path was already absent, this is a no-op.
func (s PathSet) Remove(path Path) {
	s.set.Remove(path)
}

// Empty returns true if the length of the receiving set is zero.
func (s PathSet) Empty() bool {
	return s.set.Length() == 0
}

// Union returns a new set whose contents are the union of the receiver and
// the given other set.
func (s PathSet) Union(other PathSet) PathSet {
	return PathSet{
		set: s.set.Union(other.set),
	}
}

// Intersection returns a new set whose contents are the intersection of the
// receiver and the given other set.
func (s PathSet) Intersection(other PathSet) PathSet {
	return PathSet{
		set: s.set.Intersection(other.set),
	}
}

// Subtract returns a new set whose contents are those from the receiver with
// any elements of the other given set subtracted.
func (s PathSet) Subtract(other PathSet) PathSet {
	return PathSet{
		set: s.set.Subtract(other.set),
	}
}

// SymmetricDifference returns a new set whose contents are the symmetric
// difference of the receiver and the given other set.
func (s PathSet) SymmetricDifference(other PathSet) PathSet {
	return PathSet{
		set: s.set.SymmetricDifference(other.set),
	}
}

// Equal returns true if and only if both the receiver and the given other
// set contain exactly the same paths.
func (s PathSet) Equal(other PathSet) bool {
	if s.set.Length() != other.set.Length() {
		return false
	}
	// Now we know the lengths are the same we only need to test in one
	// direction whether everything in one is in the other.
	for it := s.set.Iterator(); it.Next(); {
		if !other.set.Has(it.Value()) {
			return false
		}
	}
	return true
}

var crc64Table = crc64.MakeTable(crc64.ISO)

var indexStepPlaceholder = []byte("#")

// pathSetRules is an implementation of set.Rules from the set package,
// used internally within PathSet.
type pathSetRules struct {
}

func (r pathSetRules) Hash(path Path) int {
	hash := crc64.New(crc64Table)

	for _, rawStep := range path {
		switch step := rawStep.(type) {
		case GetAttrStep:
			// (this creates some garbage converting the string name to a
			// []byte, but that's okay since cty is not designed to be
			// used in tight loops under memory pressure.)
			hash.Write([]byte(step.Name))
		default:
			// For any other step type we just append a predefined value,
			// which means that e.g. all indexes into a given collection will
			// hash to the same value but we assume that collections are
			// small and thus this won't hurt too much.
			hash.Write(indexStepPlaceholder)
		}
	}

	// We discard half of the hash on 32-bit platforms; collisions just make
	// our lookups take marginally longer, so not a big deal.
	return int(hash.Sum64())
}

func (r pathSetRules) Equivalent(aPath, bPath Path) bool {
	if len(aPath) != len(bPath) {
		return false
	}

	for i := range aPath {
		switch aStep := aPath[i].(type) {
		case GetAttrStep:
			bStep, ok := bPath[i].(GetAttrStep)
			if !ok {
				return false
			}

			if aStep.Name != bStep.Name {
				return false
			}
		case IndexStep:
			bStep, ok := bPath[i].(IndexStep)
			if !ok {
				return false
			}

			eq := aStep.Key.Equals(bStep.Key)
			if !eq.IsKnown() || eq.False() {
				return false
			}
		default:
			// Should never happen, since we document PathStep as a closed type.
			panic(fmt.Errorf("unsupported step type %T", aStep))
		}
	}

	return true
}

// SameRules is true if both Rules instances are pathSetRules structs.
func (r pathSetRules) SameRules(other set.Rules[Path]) bool {
	_, ok := other.(pathSetRules)
	return ok
}
