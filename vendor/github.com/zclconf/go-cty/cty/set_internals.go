package cty

import (
	"bytes"
	"fmt"
	"hash/crc32"
	"math/big"
	"sort"

	"github.com/zclconf/go-cty/cty/set"
)

// setRules provides a Rules implementation for the ./set package that
// respects the equality rules for cty values of the given type.
//
// This implementation expects that values added to the set will be
// valid internal values for the given Type, which is to say that wrapping
// the given value in a Value struct along with the ruleset's type should
// produce a valid, working Value.
type setRules struct {
	Type Type
}

var _ set.OrderedRules[interface{}] = setRules{}

func newSetRules(ety Type) set.Rules[interface{}] {
	return setRules{ety}
}

// Hash returns a hash value for the receiver that can be used for equality
// checks where some inaccuracy is tolerable.
//
// The hash function is value-type-specific, so it is not meaningful to compare
// hash results for values of different types.
//
// This function is not safe to use for security-related applications, since
// the hash used is not strong enough.
func (val Value) Hash() int {
	hashBytes, marks := makeSetHashBytes(val)
	if len(marks) > 0 {
		panic("can't take hash of value that has marks or has embedded values that have marks")
	}
	return int(crc32.ChecksumIEEE(hashBytes))
}

func (r setRules) Hash(v interface{}) int {
	return Value{
		ty: r.Type,
		v:  v,
	}.Hash()
}

func (r setRules) Equivalent(v1 interface{}, v2 interface{}) bool {
	v1v := Value{
		ty: r.Type,
		v:  v1,
	}
	v2v := Value{
		ty: r.Type,
		v:  v2,
	}

	eqv := v1v.Equals(v2v)

	// By comparing the result to true we ensure that an Unknown result,
	// which will result if either value is unknown, will be considered
	// as non-equivalent. Two unknown values are not equivalent for the
	// sake of set membership.
	return eqv.v == true
}

// SameRules is only true if the other Rules instance is also a setRules struct,
// and the types are considered equal.
func (r setRules) SameRules(other set.Rules[interface{}]) bool {
	rules, ok := other.(setRules)
	if !ok {
		return false
	}

	return r.Type.Equals(rules.Type)
}

// Less is an implementation of set.OrderedRules so that we can iterate over
// set elements in a consistent order, where such an order is possible.
func (r setRules) Less(v1, v2 interface{}) bool {
	v1v := Value{
		ty: r.Type,
		v:  v1,
	}
	v2v := Value{
		ty: r.Type,
		v:  v2,
	}

	if v1v.RawEquals(v2v) { // Easy case: if they are equal then v1 can't be less
		return false
	}

	// Null values always sort after non-null values
	if v2v.IsNull() && !v1v.IsNull() {
		return true
	} else if v1v.IsNull() {
		return false
	}
	// Unknown values always sort after known values
	if v1v.IsKnown() && !v2v.IsKnown() {
		return true
	} else if !v1v.IsKnown() {
		return false
	}

	switch r.Type {
	case String:
		// String values sort lexicographically
		return v1v.AsString() < v2v.AsString()
	case Bool:
		// Weird to have a set of bools, but if we do then false sorts before true.
		if v2v.True() || !v1v.True() {
			return true
		}
		return false
	case Number:
		v1f := v1v.AsBigFloat()
		v2f := v2v.AsBigFloat()
		return v1f.Cmp(v2f) < 0
	default:
		// No other types have a well-defined ordering, so we just produce a
		// default consistent-but-undefined ordering then. This situation is
		// not considered a compatibility constraint; callers should rely only
		// on the ordering rules for primitive values.
		v1h, _ := makeSetHashBytes(v1v)
		v2h, _ := makeSetHashBytes(v2v)
		return bytes.Compare(v1h, v2h) < 0
	}
}

func makeSetHashBytes(val Value) ([]byte, ValueMarks) {
	var buf bytes.Buffer
	marks := make(ValueMarks)
	appendSetHashBytes(val, &buf, marks)
	return buf.Bytes(), marks
}

func appendSetHashBytes(val Value, buf *bytes.Buffer, marks ValueMarks) {
	// Exactly what bytes we generate here don't matter as long as the following
	// constraints hold:
	// - Unknown and null values all generate distinct strings from
	//   each other and from any normal value of the given type.
	// - The delimiter used to separate items in a compound structure can
	//   never appear literally in any of its elements.
	// Since we don't support hetrogenous lists we don't need to worry about
	// collisions between values of different types, apart from
	// PseudoTypeDynamic.
	// If in practice we *do* get a collision then it's not a big deal because
	// the Equivalent function will still distinguish values, but set
	// performance will be best if we are able to produce a distinct string
	// for each distinct value, unknown values notwithstanding.

	// Marks aren't considered part of a value for equality-testing purposes,
	// so we'll unmark our value before we work with it but we'll remember
	// the marks in case the caller needs to re-apply them to a derived
	// value.
	if val.IsMarked() {
		unmarkedVal, valMarks := val.Unmark()
		for m := range valMarks {
			marks[m] = struct{}{}
		}
		val = unmarkedVal
	}

	if !val.IsKnown() {
		buf.WriteRune('?')
		return
	}
	if val.IsNull() {
		buf.WriteRune('~')
		return
	}

	switch val.ty {
	case Number:
		// Due to an unfortunate quirk of gob encoding for big.Float, we end up
		// with non-pointer values immediately after a gob round-trip, and
		// we end up in here before we've had a chance to run
		// gobDecodeFixNumberPtr on the inner values of a gob-encoded set,
		// and so sadly we must make a special effort to handle that situation
		// here just so that we can get far enough along to fix it up for
		// everything else in this package.
		if bf, ok := val.v.(big.Float); ok {
			buf.WriteString(bf.String())
			return
		}
		buf.WriteString(val.v.(*big.Float).String())
		return
	case Bool:
		if val.v.(bool) {
			buf.WriteRune('T')
		} else {
			buf.WriteRune('F')
		}
		return
	case String:
		buf.WriteString(fmt.Sprintf("%q", val.v.(string)))
		return
	}

	if val.ty.IsMapType() {
		buf.WriteRune('{')
		val.ForEachElement(func(keyVal, elementVal Value) bool {
			appendSetHashBytes(keyVal, buf, marks)
			buf.WriteRune(':')
			appendSetHashBytes(elementVal, buf, marks)
			buf.WriteRune(';')
			return false
		})
		buf.WriteRune('}')
		return
	}

	if val.ty.IsListType() || val.ty.IsSetType() {
		buf.WriteRune('[')
		val.ForEachElement(func(keyVal, elementVal Value) bool {
			appendSetHashBytes(elementVal, buf, marks)
			buf.WriteRune(';')
			return false
		})
		buf.WriteRune(']')
		return
	}

	if val.ty.IsObjectType() {
		buf.WriteRune('<')
		attrNames := make([]string, 0, len(val.ty.AttributeTypes()))
		for attrName := range val.ty.AttributeTypes() {
			attrNames = append(attrNames, attrName)
		}
		sort.Strings(attrNames)
		for _, attrName := range attrNames {
			appendSetHashBytes(val.GetAttr(attrName), buf, marks)
			buf.WriteRune(';')
		}
		buf.WriteRune('>')
		return
	}

	if val.ty.IsTupleType() {
		buf.WriteRune('<')
		val.ForEachElement(func(keyVal, elementVal Value) bool {
			appendSetHashBytes(elementVal, buf, marks)
			buf.WriteRune(';')
			return false
		})
		buf.WriteRune('>')
		return
	}

	if val.ty.IsCapsuleType() {
		buf.WriteRune('«')
		ops := val.ty.CapsuleOps()
		if ops != nil && ops.HashKey != nil {
			key := ops.HashKey(val.EncapsulatedValue())
			buf.WriteString(fmt.Sprintf("%q", key))
		} else {
			// If there isn't an explicit hash implementation then we'll
			// just generate the same hash value for every value of this
			// type, which is logically fine but less efficient for
			// larger sets because we'll have to bucket all values
			// together and scan over them with Equals to determine
			// set membership.
			buf.WriteRune('?')
		}
		buf.WriteRune('»')
		return
	}

	// should never get down here
	panic(fmt.Sprintf("unsupported type %#v in set hash", val.ty))
}
