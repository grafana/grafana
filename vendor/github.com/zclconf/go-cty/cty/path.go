package cty

import (
	"errors"
	"fmt"
)

// A Path is a sequence of operations to locate a nested value within a
// data structure.
//
// The empty Path represents the given item. Any PathSteps within represent
// taking a single step down into a data structure.
//
// Path has some convenience methods for gradually constructing a path,
// but callers can also feel free to just produce a slice of PathStep manually
// and convert to this type, which may be more appropriate in environments
// where memory pressure is a concern.
//
// Although a Path is technically mutable, by convention callers should not
// mutate a path once it has been built and passed to some other subsystem.
// Instead, use Copy and then mutate the copy before using it.
type Path []PathStep

// PathStep represents a single step down into a data structure, as part
// of a Path. PathStep is a closed interface, meaning that the only
// permitted implementations are those within this package.
type PathStep interface {
	pathStepSigil() pathStepImpl
	Apply(Value) (Value, error)
}

// embed pathImpl into a struct to declare it a PathStep implementation
type pathStepImpl struct{}

func (p pathStepImpl) pathStepSigil() pathStepImpl {
	return p
}

// Index returns a new Path that is the reciever with an IndexStep appended
// to the end.
//
// This is provided as a convenient way to construct paths, but each call
// will create garbage so it should not be used where memory pressure is a
// concern.
func (p Path) Index(v Value) Path {
	ret := make(Path, len(p)+1)
	copy(ret, p)
	ret[len(p)] = IndexStep{
		Key: v,
	}
	return ret
}

// IndexInt is a typed convenience method for Index.
func (p Path) IndexInt(v int) Path {
	return p.Index(NumberIntVal(int64(v)))
}

// IndexString is a typed convenience method for Index.
func (p Path) IndexString(v string) Path {
	return p.Index(StringVal(v))
}

// IndexPath is a convenience method to start a new Path with an IndexStep.
func IndexPath(v Value) Path {
	return Path{}.Index(v)
}

// IndexIntPath is a typed convenience method for IndexPath.
func IndexIntPath(v int) Path {
	return IndexPath(NumberIntVal(int64(v)))
}

// IndexStringPath is a typed convenience method for IndexPath.
func IndexStringPath(v string) Path {
	return IndexPath(StringVal(v))
}

// GetAttr returns a new Path that is the reciever with a GetAttrStep appended
// to the end.
//
// This is provided as a convenient way to construct paths, but each call
// will create garbage so it should not be used where memory pressure is a
// concern.
func (p Path) GetAttr(name string) Path {
	ret := make(Path, len(p)+1)
	copy(ret, p)
	ret[len(p)] = GetAttrStep{
		Name: name,
	}
	return ret
}

// Equals compares 2 Paths for exact equality.
func (p Path) Equals(other Path) bool {
	if len(p) != len(other) {
		return false
	}

	for i := range p {
		pv := p[i]
		switch pv := pv.(type) {
		case GetAttrStep:
			ov, ok := other[i].(GetAttrStep)
			if !ok || pv != ov {
				return false
			}
		case IndexStep:
			ov, ok := other[i].(IndexStep)
			if !ok {
				return false
			}

			if !pv.Key.RawEquals(ov.Key) {
				return false
			}
		default:
			// Any invalid steps default to evaluating false.
			return false
		}
	}

	return true

}

// HasPrefix determines if the path p contains the provided prefix.
func (p Path) HasPrefix(prefix Path) bool {
	if len(prefix) > len(p) {
		return false
	}

	return p[:len(prefix)].Equals(prefix)
}

// GetAttrPath is a convenience method to start a new Path with a GetAttrStep.
func GetAttrPath(name string) Path {
	return Path{}.GetAttr(name)
}

// Apply applies each of the steps in turn to successive values starting with
// the given value, and returns the result. If any step returns an error,
// the whole operation returns an error.
func (p Path) Apply(val Value) (Value, error) {
	var err error
	for i, step := range p {
		val, err = step.Apply(val)
		if err != nil {
			return NilVal, fmt.Errorf("at step %d: %s", i, err)
		}
	}
	return val, nil
}

// LastStep applies the given path up to the last step and then returns
// the resulting value and the final step.
//
// This is useful when dealing with assignment operations, since in that
// case the *value* of the last step is not important (and may not, in fact,
// present at all) and we care only about its location.
//
// Since LastStep applies all steps except the last, it will return errors
// for those steps in the same way as Apply does.
//
// If the path has *no* steps then the returned PathStep will be nil,
// representing that any operation should be applied directly to the
// given value.
func (p Path) LastStep(val Value) (Value, PathStep, error) {
	var err error

	if len(p) == 0 {
		return val, nil, nil
	}

	journey := p[:len(p)-1]
	val, err = journey.Apply(val)
	if err != nil {
		return NilVal, nil, err
	}
	return val, p[len(p)-1], nil
}

// Copy makes a shallow copy of the receiver. Often when paths are passed to
// caller code they come with the constraint that they are valid only until
// the caller returns, due to how they are constructed internally. Callers
// can use Copy to conveniently produce a copy of the value that _they_ control
// the validity of.
func (p Path) Copy() Path {
	ret := make(Path, len(p))
	copy(ret, p)
	return ret
}

// IndexStep is a Step implementation representing applying the index operation
// to a value, which must be of either a list, map, or set type.
//
// When describing a path through a *type* rather than a concrete value,
// the Key may be an unknown value, indicating that the step applies to
// *any* key of the given type.
//
// When indexing into a set, the Key is actually the element being accessed
// itself, since in sets elements are their own identity.
type IndexStep struct {
	pathStepImpl
	Key Value
}

// Apply returns the value resulting from indexing the given value with
// our key value.
func (s IndexStep) Apply(val Value) (Value, error) {
	if val == NilVal || val.IsNull() {
		return NilVal, errors.New("cannot index a null value")
	}

	switch s.Key.Type() {
	case Number:
		if !(val.Type().IsListType() || val.Type().IsTupleType()) {
			return NilVal, errors.New("not a list type")
		}
	case String:
		if !val.Type().IsMapType() {
			return NilVal, errors.New("not a map type")
		}
	default:
		return NilVal, errors.New("key value not number or string")
	}

	has := val.HasIndex(s.Key)
	if !has.IsKnown() {
		return UnknownVal(val.Type().ElementType()), nil
	}
	if !has.True() {
		return NilVal, errors.New("value does not have given index key")
	}

	return val.Index(s.Key), nil
}

func (s IndexStep) GoString() string {
	return fmt.Sprintf("cty.IndexStep{Key:%#v}", s.Key)
}

// GetAttrStep is a Step implementation representing retrieving an attribute
// from a value, which must be of an object type.
type GetAttrStep struct {
	pathStepImpl
	Name string
}

// Apply returns the value of our named attribute from the given value, which
// must be of an object type that has a value of that name.
func (s GetAttrStep) Apply(val Value) (Value, error) {
	if val == NilVal || val.IsNull() {
		return NilVal, errors.New("cannot access attributes on a null value")
	}

	if !val.Type().IsObjectType() {
		return NilVal, errors.New("not an object type")
	}

	if !val.Type().HasAttribute(s.Name) {
		return NilVal, fmt.Errorf("object has no attribute %q", s.Name)
	}

	return val.GetAttr(s.Name), nil
}

func (s GetAttrStep) GoString() string {
	return fmt.Sprintf("cty.GetAttrStep{Name:%q}", s.Name)
}
