package cty

import (
	"fmt"
	"math/big"

	"github.com/zclconf/go-cty/cty/set"
)

// GoString is an implementation of fmt.GoStringer that produces concise
// source-like representations of values suitable for use in debug messages.
func (val Value) GoString() string {
	if val.IsMarked() {
		unVal, marks := val.Unmark()
		if len(marks) == 1 {
			var mark interface{}
			for m := range marks {
				mark = m
			}
			return fmt.Sprintf("%#v.Mark(%#v)", unVal, mark)
		}
		return fmt.Sprintf("%#v.WithMarks(%#v)", unVal, marks)
	}

	if val == NilVal {
		return "cty.NilVal"
	}

	if val.IsNull() {
		return fmt.Sprintf("cty.NullVal(%#v)", val.ty)
	}
	if val == DynamicVal { // is unknown, so must be before the IsKnown check below
		return "cty.DynamicVal"
	}
	if !val.IsKnown() {
		rfn := val.v.(*unknownType).refinement
		var suffix string
		if rfn != nil {
			calls := rfn.GoString()
			if calls == ".NotNull()" {
				suffix = ".RefineNotNull()"
			} else {
				suffix = ".Refine()" + rfn.GoString() + ".NewValue()"
			}
		}
		return fmt.Sprintf("cty.UnknownVal(%#v)%s", val.ty, suffix)
	}

	// By the time we reach here we've dealt with all of the exceptions around
	// unknowns and nulls, so we're guaranteed that the values are the
	// canonical internal representation of the given type.

	switch val.ty {
	case Bool:
		if val.v.(bool) {
			return "cty.True"
		}
		return "cty.False"
	case Number:
		if f, ok := val.v.(big.Float); ok {
			panic(fmt.Sprintf("number value contains big.Float value %s, rather than pointer to big.Float", f.Text('g', -1)))
		}
		fv := val.v.(*big.Float)
		// We'll try to use NumberIntVal or NumberFloatVal if we can, since
		// the fully-general initializer call is pretty ugly-looking.
		if fv.IsInt() {
			return fmt.Sprintf("cty.NumberIntVal(%#v)", fv)
		}
		if rfv, accuracy := fv.Float64(); accuracy == big.Exact {
			return fmt.Sprintf("cty.NumberFloatVal(%#v)", rfv)
		}
		return fmt.Sprintf("cty.MustParseNumberVal(%q)", fv.Text('f', -1))
	case String:
		return fmt.Sprintf("cty.StringVal(%#v)", val.v)
	}

	switch {
	case val.ty.IsSetType():
		vals := val.AsValueSlice()
		if len(vals) == 0 {
			return fmt.Sprintf("cty.SetValEmpty(%#v)", val.ty.ElementType())
		}
		return fmt.Sprintf("cty.SetVal(%#v)", vals)
	case val.ty.IsListType():
		vals := val.AsValueSlice()
		if len(vals) == 0 {
			return fmt.Sprintf("cty.ListValEmpty(%#v)", val.ty.ElementType())
		}
		return fmt.Sprintf("cty.ListVal(%#v)", vals)
	case val.ty.IsMapType():
		vals := val.AsValueMap()
		if len(vals) == 0 {
			return fmt.Sprintf("cty.MapValEmpty(%#v)", val.ty.ElementType())
		}
		return fmt.Sprintf("cty.MapVal(%#v)", vals)
	case val.ty.IsTupleType():
		if val.ty.Equals(EmptyTuple) {
			return "cty.EmptyTupleVal"
		}
		vals := val.AsValueSlice()
		return fmt.Sprintf("cty.TupleVal(%#v)", vals)
	case val.ty.IsObjectType():
		if val.ty.Equals(EmptyObject) {
			return "cty.EmptyObjectVal"
		}
		vals := val.AsValueMap()
		return fmt.Sprintf("cty.ObjectVal(%#v)", vals)
	case val.ty.IsCapsuleType():
		impl := val.ty.CapsuleOps().GoString
		if impl == nil {
			return fmt.Sprintf("cty.CapsuleVal(%#v, %#v)", val.ty, val.v)
		}
		return impl(val.EncapsulatedValue())
	}

	// Default exposes implementation details, so should actually cover
	// all of the cases above for good caller UX.
	return fmt.Sprintf("cty.Value{ty: %#v, v: %#v}", val.ty, val.v)
}

// Equals returns True if the receiver and the given other value have the
// same type and are exactly equal in value.
//
// As a special case, two null values are always equal regardless of type.
//
// The usual short-circuit rules apply, so the result will be unknown if
// either of the given values are.
//
// Use RawEquals to compare if two values are equal *ignoring* the
// short-circuit rules and the exception for null values.
func (val Value) Equals(other Value) Value {
	if val.ContainsMarked() || other.ContainsMarked() {
		val, valMarks := val.UnmarkDeep()
		other, otherMarks := other.UnmarkDeep()
		return val.Equals(other).WithMarks(valMarks, otherMarks)
	}

	// Some easy cases with comparisons to null.
	switch {
	case val.IsNull() && definitelyNotNull(other):
		return False
	case other.IsNull() && definitelyNotNull(val):
		return False
	}
	// If we have one known value and one unknown value then we may be
	// able to quickly disqualify equality based on the range of the unknown
	// value.
	if val.IsKnown() && !other.IsKnown() {
		otherRng := other.Range()
		if ok := otherRng.Includes(val); ok.IsKnown() && ok.False() {
			return False
		}
	} else if other.IsKnown() && !val.IsKnown() {
		valRng := val.Range()
		if ok := valRng.Includes(other); ok.IsKnown() && ok.False() {
			return False
		}
	}

	// We need to deal with unknown values before anything else with nulls
	// because any unknown value that hasn't yet been refined as non-null
	// could become null, and nulls of any types are equal to one another.
	unknownResult := func() Value {
		return UnknownVal(Bool).Refine().NotNull().NewValue()
	}
	switch {
	case !val.IsKnown() && !other.IsKnown():
		// both unknown
		return unknownResult()
	case val.IsKnown() && !other.IsKnown():
		switch {
		case val.IsNull(), other.ty.HasDynamicTypes():
			// If known is Null, we need to wait for the unknown value since
			// nulls of any type are equal.
			// An unknown with a dynamic type compares as unknown, which we need
			// to check before the type comparison below.
			return unknownResult()
		case !val.ty.Equals(other.ty):
			// There is no null comparison or dynamic types, so unequal types
			// will never be equal.
			return False
		default:
			return unknownResult()
		}
	case other.IsKnown() && !val.IsKnown():
		switch {
		case other.IsNull(), val.ty.HasDynamicTypes():
			// If known is Null, we need to wait for the unknown value since
			// nulls of any type are equal.
			// An unknown with a dynamic type compares as unknown, which we need
			// to check before the type comparison below.
			return unknownResult()
		case !other.ty.Equals(val.ty):
			// There's no null comparison or dynamic types, so unequal types
			// will never be equal.
			return False
		default:
			return unknownResult()
		}
	}

	switch {
	case val.IsNull() && other.IsNull():
		// Nulls are always equal, regardless of type
		return BoolVal(true)
	case val.IsNull() || other.IsNull():
		// If only one is null then the result must be false
		return BoolVal(false)
	}

	// Check if there are any nested dynamic values making this comparison
	// unknown.
	if !val.HasWhollyKnownType() || !other.HasWhollyKnownType() {
		// Even if we have dynamic values, we can still determine inequality if
		// there is no way the types could later conform.
		if val.ty.TestConformance(other.ty) != nil && other.ty.TestConformance(val.ty) != nil {
			return BoolVal(false)
		}

		return unknownResult()
	}

	if !val.ty.Equals(other.ty) {
		return BoolVal(false)
	}

	ty := val.ty
	result := false

	switch {
	case ty == Number:
		result = rawNumberEqual(val.v.(*big.Float), other.v.(*big.Float))
	case ty == Bool:
		result = val.v.(bool) == other.v.(bool)
	case ty == String:
		// Simple equality is safe because we NFC-normalize strings as they
		// enter our world from StringVal, and so we can assume strings are
		// always in normal form.
		result = val.v.(string) == other.v.(string)
	case ty.IsObjectType():
		oty := ty.typeImpl.(typeObject)
		result = true
		for attr, aty := range oty.AttrTypes {
			lhs := Value{
				ty: aty,
				v:  val.v.(map[string]interface{})[attr],
			}
			rhs := Value{
				ty: aty,
				v:  other.v.(map[string]interface{})[attr],
			}
			eq := lhs.Equals(rhs)
			if !eq.IsKnown() {
				return unknownResult()
			}
			if eq.False() {
				result = false
				break
			}
		}
	case ty.IsTupleType():
		tty := ty.typeImpl.(typeTuple)
		result = true
		for i, ety := range tty.ElemTypes {
			lhs := Value{
				ty: ety,
				v:  val.v.([]interface{})[i],
			}
			rhs := Value{
				ty: ety,
				v:  other.v.([]interface{})[i],
			}
			eq := lhs.Equals(rhs)
			if !eq.IsKnown() {
				return unknownResult()
			}
			if eq.False() {
				result = false
				break
			}
		}
	case ty.IsListType():
		ety := ty.typeImpl.(typeList).ElementTypeT
		if len(val.v.([]interface{})) == len(other.v.([]interface{})) {
			result = true
			for i := range val.v.([]interface{}) {
				lhs := Value{
					ty: ety,
					v:  val.v.([]interface{})[i],
				}
				rhs := Value{
					ty: ety,
					v:  other.v.([]interface{})[i],
				}
				eq := lhs.Equals(rhs)
				if !eq.IsKnown() {
					return unknownResult()
				}
				if eq.False() {
					result = false
					break
				}
			}
		}
	case ty.IsSetType():
		s1 := val.v.(set.Set[interface{}])
		s2 := other.v.(set.Set[interface{}])
		equal := true

		// Two sets are equal if all of their values are known and all values
		// in one are also in the other.
		for it := s1.Iterator(); it.Next(); {
			rv := it.Value()
			if _, unknown := rv.(*unknownType); unknown { // "*unknownType" is the internal representation of unknown-ness
				return unknownResult()
			}
			if !s2.Has(rv) {
				equal = false
			}
		}
		for it := s2.Iterator(); it.Next(); {
			rv := it.Value()
			if _, unknown := rv.(*unknownType); unknown { // "*unknownType" is the internal representation of unknown-ness
				return unknownResult()
			}
			if !s1.Has(rv) {
				equal = false
			}
		}

		result = equal
	case ty.IsMapType():
		ety := ty.typeImpl.(typeMap).ElementTypeT
		if len(val.v.(map[string]interface{})) == len(other.v.(map[string]interface{})) {
			result = true
			for k := range val.v.(map[string]interface{}) {
				if _, ok := other.v.(map[string]interface{})[k]; !ok {
					result = false
					break
				}
				lhs := Value{
					ty: ety,
					v:  val.v.(map[string]interface{})[k],
				}
				rhs := Value{
					ty: ety,
					v:  other.v.(map[string]interface{})[k],
				}
				eq := lhs.Equals(rhs)
				if !eq.IsKnown() {
					return unknownResult()
				}
				if eq.False() {
					result = false
					break
				}
			}
		}
	case ty.IsCapsuleType():
		impl := val.ty.CapsuleOps().Equals
		if impl == nil {
			impl := val.ty.CapsuleOps().RawEquals
			if impl == nil {
				// A capsule type's encapsulated value is a pointer to a value of its
				// native type, so we can just compare these to get the identity test
				// we need.
				return BoolVal(val.v == other.v)
			}
			return BoolVal(impl(val.v, other.v))
		}
		ret := impl(val.v, other.v)
		if !ret.Type().Equals(Bool) {
			panic(fmt.Sprintf("Equals for %#v returned %#v, not cty.Bool", ty, ret.Type()))
		}
		return ret

	default:
		// should never happen
		panic(fmt.Errorf("unsupported value type %#v in Equals", ty))
	}

	return BoolVal(result)
}

// NotEqual is a shorthand for Equals followed by Not.
func (val Value) NotEqual(other Value) Value {
	return val.Equals(other).Not()
}

// True returns true if the receiver is True, false if False, and panics if
// the receiver is not of type Bool.
//
// This is a helper function to help write application logic that works with
// values, rather than a first-class operation. It does not work with unknown
// or null values. For more robust handling with unknown value
// short-circuiting, use val.Equals(cty.True).
func (val Value) True() bool {
	val.assertUnmarked()
	if val.ty != Bool {
		panic("not bool")
	}
	return val.Equals(True).v.(bool)
}

// False is the opposite of True.
func (val Value) False() bool {
	return !val.True()
}

// RawEquals returns true if and only if the two given values have the same
// type and equal value, ignoring the usual short-circuit rules about
// unknowns and dynamic types.
//
// This method is more appropriate for testing than for real use, since it
// skips over usual semantics around unknowns but as a consequence allows
// testing the result of another operation that is expected to return unknown.
// It returns a primitive Go bool rather than a Value to remind us that it
// is not a first-class value operation.
func (val Value) RawEquals(other Value) bool {
	if !val.ty.Equals(other.ty) {
		return false
	}
	if !val.HasSameMarks(other) {
		return false
	}
	// Since we've now checked the marks, we'll unmark for the rest of this...
	val = val.unmarkForce()
	other = other.unmarkForce()

	if (!val.IsKnown()) && (!other.IsKnown()) {
		// If either unknown value has refinements then they must match.
		valRfn := val.v.(*unknownType).refinement
		otherRfn := other.v.(*unknownType).refinement
		switch {
		case (valRfn == nil) != (otherRfn == nil):
			return false
		case valRfn != nil:
			return valRfn.rawEqual(otherRfn)
		default:
			return true
		}
	}
	if (val.IsKnown() && !other.IsKnown()) || (other.IsKnown() && !val.IsKnown()) {
		return false
	}
	if val.IsNull() && other.IsNull() {
		return true
	}
	if (val.IsNull() && !other.IsNull()) || (other.IsNull() && !val.IsNull()) {
		return false
	}
	if val.ty == DynamicPseudoType && other.ty == DynamicPseudoType {
		return true
	}

	ty := val.ty
	switch {
	case ty == Number || ty == Bool || ty == String || ty == DynamicPseudoType:
		return val.Equals(other).True()
	case ty.IsObjectType():
		oty := ty.typeImpl.(typeObject)
		for attr, aty := range oty.AttrTypes {
			lhs := Value{
				ty: aty,
				v:  val.v.(map[string]interface{})[attr],
			}
			rhs := Value{
				ty: aty,
				v:  other.v.(map[string]interface{})[attr],
			}
			eq := lhs.RawEquals(rhs)
			if !eq {
				return false
			}
		}
		return true
	case ty.IsTupleType():
		tty := ty.typeImpl.(typeTuple)
		for i, ety := range tty.ElemTypes {
			lhs := Value{
				ty: ety,
				v:  val.v.([]interface{})[i],
			}
			rhs := Value{
				ty: ety,
				v:  other.v.([]interface{})[i],
			}
			eq := lhs.RawEquals(rhs)
			if !eq {
				return false
			}
		}
		return true
	case ty.IsListType():
		ety := ty.typeImpl.(typeList).ElementTypeT
		if len(val.v.([]interface{})) == len(other.v.([]interface{})) {
			for i := range val.v.([]interface{}) {
				lhs := Value{
					ty: ety,
					v:  val.v.([]interface{})[i],
				}
				rhs := Value{
					ty: ety,
					v:  other.v.([]interface{})[i],
				}
				eq := lhs.RawEquals(rhs)
				if !eq {
					return false
				}
			}
			return true
		}
		return false

	case ty.IsSetType():
		// Convert the set values into a slice so that we can compare each
		// value. This is safe because the underlying sets are ordered (see
		// setRules in set_internals.go), and so the results are guaranteed to
		// be in a consistent order for two equal sets
		setList1 := val.AsValueSlice()
		setList2 := other.AsValueSlice()

		// If both physical sets have the same length and they have all of their
		// _known_ values in common, we know that both sets also have the same
		// number of unknown values.
		if len(setList1) != len(setList2) {
			return false
		}

		for i := range setList1 {
			eq := setList1[i].RawEquals(setList2[i])
			if !eq {
				return false
			}
		}

		// If we got here without returning false already then our sets are
		// equal enough for RawEquals purposes.
		return true

	case ty.IsMapType():
		ety := ty.typeImpl.(typeMap).ElementTypeT
		if !val.HasSameMarks(other) {
			return false
		}
		valUn, _ := val.Unmark()
		otherUn, _ := other.Unmark()
		if len(valUn.v.(map[string]interface{})) == len(otherUn.v.(map[string]interface{})) {
			for k := range valUn.v.(map[string]interface{}) {
				if _, ok := otherUn.v.(map[string]interface{})[k]; !ok {
					return false
				}
				lhs := Value{
					ty: ety,
					v:  valUn.v.(map[string]interface{})[k],
				}
				rhs := Value{
					ty: ety,
					v:  otherUn.v.(map[string]interface{})[k],
				}
				eq := lhs.RawEquals(rhs)
				if !eq {
					return false
				}
			}
			return true
		}
		return false
	case ty.IsCapsuleType():
		impl := val.ty.CapsuleOps().RawEquals
		if impl == nil {
			// A capsule type's encapsulated value is a pointer to a value of its
			// native type, so we can just compare these to get the identity test
			// we need.
			return val.v == other.v
		}
		return impl(val.v, other.v)

	default:
		// should never happen
		panic(fmt.Errorf("unsupported value type %#v in RawEquals", ty))
	}
}

// Add returns the sum of the receiver and the given other value. Both values
// must be numbers; this method will panic if not.
func (val Value) Add(other Value) Value {
	if val.IsMarked() || other.IsMarked() {
		val, valMarks := val.Unmark()
		other, otherMarks := other.Unmark()
		return val.Add(other).WithMarks(valMarks, otherMarks)
	}

	if shortCircuit := mustTypeCheck(Number, Number, val, other); shortCircuit != nil {
		shortCircuit = forceShortCircuitType(shortCircuit, Number)
		ret := shortCircuit.RefineWith(numericRangeArithmetic(Value.Add, val.Range(), other.Range()))
		return ret.RefineNotNull()
	}

	ret := new(big.Float)
	ret.Add(val.v.(*big.Float), other.v.(*big.Float))
	return NumberVal(ret)
}

// Subtract returns receiver minus the given other value. Both values must be
// numbers; this method will panic if not.
func (val Value) Subtract(other Value) Value {
	if val.IsMarked() || other.IsMarked() {
		val, valMarks := val.Unmark()
		other, otherMarks := other.Unmark()
		return val.Subtract(other).WithMarks(valMarks, otherMarks)
	}

	if shortCircuit := mustTypeCheck(Number, Number, val, other); shortCircuit != nil {
		shortCircuit = forceShortCircuitType(shortCircuit, Number)
		ret := shortCircuit.RefineWith(numericRangeArithmetic(Value.Subtract, val.Range(), other.Range()))
		return ret.RefineNotNull()
	}

	return val.Add(other.Negate())
}

// Negate returns the numeric negative of the receiver, which must be a number.
// This method will panic when given a value of any other type.
func (val Value) Negate() Value {
	if val.IsMarked() {
		val, valMarks := val.Unmark()
		return val.Negate().WithMarks(valMarks)
	}

	if shortCircuit := mustTypeCheck(Number, Number, val); shortCircuit != nil {
		shortCircuit = forceShortCircuitType(shortCircuit, Number)
		return (*shortCircuit).RefineNotNull()
	}

	ret := new(big.Float).Neg(val.v.(*big.Float))
	return NumberVal(ret)
}

// Multiply returns the product of the receiver and the given other value.
// Both values must be numbers; this method will panic if not.
func (val Value) Multiply(other Value) Value {
	if val.IsMarked() || other.IsMarked() {
		val, valMarks := val.Unmark()
		other, otherMarks := other.Unmark()
		return val.Multiply(other).WithMarks(valMarks, otherMarks)
	}

	if shortCircuit := mustTypeCheck(Number, Number, val, other); shortCircuit != nil {
		// If either value is exactly zero then the result must either be
		// zero or an error.
		if val == Zero || other == Zero {
			return Zero
		}
		shortCircuit = forceShortCircuitType(shortCircuit, Number)
		ret := shortCircuit.RefineWith(numericRangeArithmetic(Value.Multiply, val.Range(), other.Range()))
		return ret.RefineNotNull()
	}

	// find the larger precision of the arguments
	resPrec := val.v.(*big.Float).Prec()
	otherPrec := other.v.(*big.Float).Prec()
	if otherPrec > resPrec {
		resPrec = otherPrec
	}

	// make sure we have enough precision for the product
	ret := new(big.Float).SetPrec(512)
	ret.Mul(val.v.(*big.Float), other.v.(*big.Float))

	// now reduce the precision back to the greater argument, or the minimum
	// required by the product.
	minPrec := ret.MinPrec()
	if minPrec > resPrec {
		resPrec = minPrec
	}
	ret.SetPrec(resPrec)

	return NumberVal(ret)
}

// Divide returns the quotient of the receiver and the given other value.
// Both values must be numbers; this method will panic if not.
//
// If the "other" value is exactly zero, this operation will return either
// PositiveInfinity or NegativeInfinity, depending on the sign of the
// receiver value. For some use-cases the presence of infinities may be
// undesirable, in which case the caller should check whether the
// other value equals zero before calling and raise an error instead.
//
// If both values are zero or infinity, this function will panic with
// an instance of big.ErrNaN.
func (val Value) Divide(other Value) Value {
	if val.IsMarked() || other.IsMarked() {
		val, valMarks := val.Unmark()
		other, otherMarks := other.Unmark()
		return val.Divide(other).WithMarks(valMarks, otherMarks)
	}

	if shortCircuit := mustTypeCheck(Number, Number, val, other); shortCircuit != nil {
		shortCircuit = forceShortCircuitType(shortCircuit, Number)
		// TODO: We could potentially refine the range of the result here, but
		// we don't right now because our division operation is not monotone
		// if the denominator could potentially be zero.
		return (*shortCircuit).RefineNotNull()
	}

	ret := new(big.Float)
	ret.Quo(val.v.(*big.Float), other.v.(*big.Float))
	return NumberVal(ret)
}

// Modulo returns the remainder of an integer division of the receiver and
// the given other value. Both values must be numbers; this method will panic
// if not.
//
// If the "other" value is exactly zero, this operation will return either
// PositiveInfinity or NegativeInfinity, depending on the sign of the
// receiver value. For some use-cases the presence of infinities may be
// undesirable, in which case the caller should check whether the
// other value equals zero before calling and raise an error instead.
//
// This operation is primarily here for use with nonzero natural numbers.
// Modulo with "other" as a non-natural number gets somewhat philosophical,
// and this function takes a position on what that should mean, but callers
// may wish to disallow such things outright or implement their own modulo
// if they disagree with the interpretation used here.
func (val Value) Modulo(other Value) Value {
	if val.IsMarked() || other.IsMarked() {
		val, valMarks := val.Unmark()
		other, otherMarks := other.Unmark()
		return val.Modulo(other).WithMarks(valMarks, otherMarks)
	}

	if shortCircuit := mustTypeCheck(Number, Number, val, other); shortCircuit != nil {
		shortCircuit = forceShortCircuitType(shortCircuit, Number)
		return (*shortCircuit).RefineNotNull()
	}

	// We cheat a bit here with infinities, just abusing the Multiply operation
	// to get an infinite result of the correct sign.
	if val == PositiveInfinity || val == NegativeInfinity || other == PositiveInfinity || other == NegativeInfinity {
		return val.Multiply(other)
	}

	if other.RawEquals(Zero) {
		return val
	}

	// FIXME: This is a bit clumsy. Should come back later and see if there's a
	// more straightforward way to do this.
	rat := val.Divide(other)
	ratFloorInt, _ := rat.v.(*big.Float).Int(nil)

	// start with a copy of the original larger value so that we do not lose
	// precision.
	v := val.v.(*big.Float)
	work := new(big.Float).Copy(v).SetInt(ratFloorInt)
	work.Mul(other.v.(*big.Float), work)
	work.Sub(v, work)

	return NumberVal(work)
}

// Absolute returns the absolute (signless) value of the receiver, which must
// be a number or this method will panic.
func (val Value) Absolute() Value {
	if val.IsMarked() {
		val, valMarks := val.Unmark()
		return val.Absolute().WithMarks(valMarks)
	}

	if shortCircuit := mustTypeCheck(Number, Number, val); shortCircuit != nil {
		shortCircuit = forceShortCircuitType(shortCircuit, Number)
		return (*shortCircuit).Refine().NotNull().NumberRangeInclusive(Zero, UnknownVal(Number)).NewValue()
	}

	ret := (&big.Float{}).Abs(val.v.(*big.Float))
	return NumberVal(ret)
}

// GetAttr returns the value of the given attribute of the receiver, which
// must be of an object type that has an attribute of the given name.
// This method will panic if the receiver type is not compatible.
//
// The method will also panic if the given attribute name is not defined
// for the value's type. Use the attribute-related methods on Type to
// check for the validity of an attribute before trying to use it.
//
// This method may be called on a value whose type is DynamicPseudoType,
// in which case the result will also be DynamicVal.
func (val Value) GetAttr(name string) Value {
	if val.IsMarked() {
		val, valMarks := val.Unmark()
		return val.GetAttr(name).WithMarks(valMarks)
	}

	if val.ty == DynamicPseudoType {
		return DynamicVal
	}

	if !val.ty.IsObjectType() {
		panic("value is not an object")
	}

	name = NormalizeString(name)
	if !val.ty.HasAttribute(name) {
		panic("value has no attribute of that name")
	}

	attrType := val.ty.AttributeType(name)

	if !val.IsKnown() {
		return UnknownVal(attrType)
	}

	return Value{
		ty: attrType,
		v:  val.v.(map[string]interface{})[name],
	}
}

// Index returns the value of an element of the receiver, which must have
// either a list, map or tuple type. This method will panic if the receiver
// type is not compatible.
//
// The key value must be the correct type for the receving collection: a
// number if the collection is a list or tuple, or a string if it is a map.
// In the case of a list or tuple, the given number must be convertable to int
// or this method will panic. The key may alternatively be of
// DynamicPseudoType, in which case the result itself is an unknown of the
// collection's element type.
//
// The result is of the receiver collection's element type, or in the case
// of a tuple the type of the specific element index requested.
//
// This method may be called on a value whose type is DynamicPseudoType,
// in which case the result will also be the DynamicValue.
func (val Value) Index(key Value) Value {
	if val.IsMarked() || key.IsMarked() {
		val, valMarks := val.Unmark()
		key, keyMarks := key.Unmark()
		return val.Index(key).WithMarks(valMarks, keyMarks)
	}

	if val.ty == DynamicPseudoType {
		return DynamicVal
	}

	switch {
	case val.Type().IsListType():
		elty := val.Type().ElementType()
		if key.Type() == DynamicPseudoType {
			return UnknownVal(elty)
		}

		if key.Type() != Number {
			panic("element key for list must be number")
		}
		if !key.IsKnown() {
			return UnknownVal(elty)
		}

		if !val.IsKnown() {
			return UnknownVal(elty)
		}

		index, accuracy := key.v.(*big.Float).Int64()
		if accuracy != big.Exact || index < 0 {
			panic("element key for list must be non-negative integer")
		}

		return Value{
			ty: elty,
			v:  val.v.([]interface{})[index],
		}
	case val.Type().IsMapType():
		elty := val.Type().ElementType()
		if key.Type() == DynamicPseudoType {
			return UnknownVal(elty)
		}

		if key.Type() != String {
			panic("element key for map must be string")
		}
		if !key.IsKnown() {
			return UnknownVal(elty)
		}

		if !val.IsKnown() {
			return UnknownVal(elty)
		}

		keyStr := key.v.(string)

		return Value{
			ty: elty,
			v:  val.v.(map[string]interface{})[keyStr],
		}
	case val.Type().IsTupleType():
		if key.Type() == DynamicPseudoType {
			return DynamicVal
		}

		if key.Type() != Number {
			panic("element key for tuple must be number")
		}
		if !key.IsKnown() {
			return DynamicVal
		}

		index, accuracy := key.v.(*big.Float).Int64()
		if accuracy != big.Exact || index < 0 {
			panic("element key for list must be non-negative integer")
		}

		eltys := val.Type().TupleElementTypes()

		if !val.IsKnown() {
			return UnknownVal(eltys[index])
		}

		return Value{
			ty: eltys[index],
			v:  val.v.([]interface{})[index],
		}
	default:
		panic("not a list, map, or tuple type")
	}
}

// HasIndex returns True if the receiver (which must be supported for Index)
// has an element with the given index key, or False if it does not.
//
// The result will be UnknownVal(Bool) if either the collection or the
// key value are unknown.
//
// This method will panic if the receiver is not indexable, but does not
// impose any panic-causing type constraints on the key.
func (val Value) HasIndex(key Value) Value {
	if val.IsMarked() || key.IsMarked() {
		val, valMarks := val.Unmark()
		key, keyMarks := key.Unmark()
		return val.HasIndex(key).WithMarks(valMarks, keyMarks)
	}

	if val.ty == DynamicPseudoType {
		return UnknownVal(Bool).RefineNotNull()
	}

	switch {
	case val.Type().IsListType():
		if key.Type() == DynamicPseudoType {
			return UnknownVal(Bool).RefineNotNull()
		}

		if key.Type() != Number {
			return False
		}
		if !key.IsKnown() {
			return UnknownVal(Bool).RefineNotNull()
		}
		if !val.IsKnown() {
			return UnknownVal(Bool).RefineNotNull()
		}

		index, accuracy := key.v.(*big.Float).Int64()
		if accuracy != big.Exact || index < 0 {
			return False
		}

		return BoolVal(int(index) < len(val.v.([]interface{})) && index >= 0)
	case val.Type().IsMapType():
		if key.Type() == DynamicPseudoType {
			return UnknownVal(Bool).RefineNotNull()
		}

		if key.Type() != String {
			return False
		}
		if !key.IsKnown() {
			return UnknownVal(Bool).RefineNotNull()
		}
		if !val.IsKnown() {
			return UnknownVal(Bool).RefineNotNull()
		}

		keyStr := key.v.(string)
		_, exists := val.v.(map[string]interface{})[keyStr]

		return BoolVal(exists)
	case val.Type().IsTupleType():
		if key.Type() == DynamicPseudoType {
			return UnknownVal(Bool).RefineNotNull()
		}

		if key.Type() != Number {
			return False
		}
		if !key.IsKnown() {
			return UnknownVal(Bool).RefineNotNull()
		}

		index, accuracy := key.v.(*big.Float).Int64()
		if accuracy != big.Exact || index < 0 {
			return False
		}

		length := val.Type().Length()
		return BoolVal(int(index) < length && index >= 0)
	default:
		panic("not a list, map, or tuple type")
	}
}

// HasElement returns True if the receiver (which must be of a set type)
// has the given value as an element, or False if it does not.
//
// The result will be UnknownVal(Bool) if either the set or the
// given value are unknown.
//
// This method will panic if the receiver is not a set, or if it is a null set.
func (val Value) HasElement(elem Value) Value {
	if val.IsMarked() || elem.IsMarked() {
		val, valMarks := val.Unmark()
		elem, elemMarks := elem.Unmark()
		return val.HasElement(elem).WithMarks(valMarks, elemMarks)
	}

	ty := val.Type()
	unknownResult := UnknownVal(Bool).RefineNotNull()

	if val.IsNull() {
		panic("cannot HasElement on null value")
	}
	if !val.IsKnown() {
		return unknownResult
	}
	if elem.Type() != DynamicPseudoType && val.Type().IsSetType() && val.Type().ElementType() != DynamicPseudoType {
		// If we know the type of the given element and the element type of
		// the set then they must match for the element to be present, because
		// a set can't contain elements of any other type than its element type.
		if !elem.Type().Equals(val.ty.ElementType()) {
			return False
		}
	}
	if !ty.IsSetType() {
		panic("not a set type")
	}
	if !elem.IsKnown() {
		return unknownResult
	}
	noMatchResult := False
	if !val.IsWhollyKnown() {
		// If the set has any unknown elements then a failure to find a
		// known-value elem in it means that we don't know whether the
		// element is present, rather than that it definitely isn't.
		noMatchResult = unknownResult
	}
	if !ty.ElementType().Equals(elem.Type()) {
		// A set can only contain an element of its own element type
		return False
	}

	s := val.v.(set.Set[interface{}])
	if !s.Has(elem.v) {
		return noMatchResult
	}
	return True
}

// Length returns the length of the receiver, which must be a collection type
// or tuple type, as a number value. If the receiver is not a compatible type
// then this method will panic.
//
// If the receiver is unknown then the result is also unknown.
//
// If the receiver is null then this function will panic.
//
// Note that Length is not supported for strings. To determine the length
// of a string, use the Length function in funcs/stdlib.
func (val Value) Length() Value {
	if val.IsMarked() {
		val, valMarks := val.Unmark()
		return val.Length().WithMarks(valMarks)
	}

	if val.Type().IsTupleType() {
		// For tuples, we can return the length even if the value is not known.
		return NumberIntVal(int64(val.Type().Length()))
	}

	if !val.IsKnown() {
		// If the whole collection isn't known then the length isn't known
		// either, but we can still put some bounds on the range of the result.
		rng := val.Range()
		return UnknownVal(Number).RefineWith(valueRefineLengthResult(rng))
	}
	if val.Type().IsSetType() {
		// The Length rules are a little different for sets because if any
		// unknown values are present then the values they are standing in for
		// may or may not be equal to other elements in the set, and thus they
		// may or may not coalesce with other elements and produce fewer
		// items in the resulting set.
		storeLength := int64(val.v.(set.Set[interface{}]).Length())
		if storeLength == 1 || val.IsWhollyKnown() {
			// If our set is wholly known then we know its length.
			//
			// We also know the length if the physical store has only one
			// element, even if that element is unknown, because there's
			// nothing else in the set for it to coalesce with and a single
			// unknown value cannot represent more than one known value.
			return NumberIntVal(storeLength)
		}
		// Otherwise, we cannot predict the length exactly but we can at
		// least constrain both bounds of its range, because value coalescing
		// can only ever reduce the number of elements in the set.
		return UnknownVal(Number).Refine().NotNull().NumberRangeInclusive(NumberIntVal(1), NumberIntVal(storeLength)).NewValue()
	}

	return NumberIntVal(int64(val.LengthInt()))
}

func valueRefineLengthResult(collRng ValueRange) func(*RefinementBuilder) *RefinementBuilder {
	return func(b *RefinementBuilder) *RefinementBuilder {
		return b.
			NotNull().
			NumberRangeInclusive(
				NumberIntVal(int64(collRng.LengthLowerBound())),
				NumberIntVal(int64(collRng.LengthUpperBound())),
			)
	}
}

// LengthInt is like Length except it returns an int. It has the same behavior
// as Length except that it will panic if the receiver is unknown.
//
// This is an integration method provided for the convenience of code bridging
// into Go's type system.
//
// For backward compatibility with an earlier implementation error, LengthInt's
// result can disagree with Length's result for any set containing unknown
// values. Length can potentially indicate the set's length is unknown in that
// case, whereas LengthInt will return the maximum possible length as if the
// unknown values were each a placeholder for a value not equal to any other
// value in the set.
func (val Value) LengthInt() int {
	val.assertUnmarked()
	if val.Type().IsTupleType() {
		// For tuples, we can return the length even if the value is not known.
		return val.Type().Length()
	}
	if val.Type().IsObjectType() {
		// For objects, the length is the number of attributes associated with the type.
		return len(val.Type().AttributeTypes())
	}
	if !val.IsKnown() {
		panic("value is not known")
	}
	if val.IsNull() {
		panic("value is null")
	}

	switch {

	case val.ty.IsListType():
		return len(val.v.([]interface{}))

	case val.ty.IsSetType():
		// NOTE: This is technically not correct in cases where the set
		// contains unknown values, because in that case we can't know how
		// many known values those unknown values are standing in for -- they
		// might coalesce with other values once known.
		//
		// However, this incorrect behavior is preserved for backward
		// compatibility with callers that were relying on LengthInt rather
		// than calling Length. Instead of panicking when a set contains an
		// unknown value, LengthInt returns the largest possible length.
		return val.v.(set.Set[interface{}]).Length()

	case val.ty.IsMapType():
		return len(val.v.(map[string]interface{}))

	default:
		panic("value is not a collection")
	}
}

// ElementIterator returns an ElementIterator for iterating the elements
// of the receiver, which must be a collection type, a tuple type, or an object
// type. If called on a method of any other type, this method will panic.
//
// The value must be Known and non-Null, or this method will panic.
//
// If the receiver is of a list type, the returned keys will be of type Number
// and the values will be of the list's element type.
//
// If the receiver is of a map type, the returned keys will be of type String
// and the value will be of the map's element type. Elements are passed in
// ascending lexicographical order by key.
//
// If the receiver is of a set type, each element is returned as both the
// key and the value, since set members are their own identity.
//
// If the receiver is of a tuple type, the returned keys will be of type Number
// and the value will be of the corresponding element's type.
//
// If the receiver is of an object type, the returned keys will be of type
// String and the value will be of the corresponding attributes's type.
//
// ElementIterator is an integration method, so it cannot handle Unknown
// values. This method will panic if the receiver is Unknown.
func (val Value) ElementIterator() ElementIterator {
	val.assertUnmarked()
	if !val.IsKnown() {
		panic("can't use ElementIterator on unknown value")
	}
	if val.IsNull() {
		panic("can't use ElementIterator on null value")
	}
	return elementIterator(val)
}

// CanIterateElements returns true if the receiver can support the
// ElementIterator method (and by extension, ForEachElement) without panic.
func (val Value) CanIterateElements() bool {
	return canElementIterator(val)
}

// ForEachElement executes a given callback function for each element of
// the receiver, which must be a collection type or tuple type, or this method
// will panic.
//
// ForEachElement uses ElementIterator internally, and so the values passed
// to the callback are as described for ElementIterator.
//
// Returns true if the iteration exited early due to the callback function
// returning true, or false if the loop ran to completion.
//
// ForEachElement is an integration method, so it cannot handle Unknown
// values. This method will panic if the receiver is Unknown.
func (val Value) ForEachElement(cb ElementCallback) bool {
	val.assertUnmarked()
	it := val.ElementIterator()
	for it.Next() {
		key, val := it.Element()
		stop := cb(key, val)
		if stop {
			return true
		}
	}
	return false
}

// Not returns the logical inverse of the receiver, which must be of type
// Bool or this method will panic.
func (val Value) Not() Value {
	if val.IsMarked() {
		val, valMarks := val.Unmark()
		return val.Not().WithMarks(valMarks)
	}

	if shortCircuit := mustTypeCheck(Bool, Bool, val); shortCircuit != nil {
		shortCircuit = forceShortCircuitType(shortCircuit, Bool)
		return (*shortCircuit).RefineNotNull()
	}

	return BoolVal(!val.v.(bool))
}

// And returns the result of logical AND with the receiver and the other given
// value, which must both be of type Bool or this method will panic.
func (val Value) And(other Value) Value {
	if val.IsMarked() || other.IsMarked() {
		val, valMarks := val.Unmark()
		other, otherMarks := other.Unmark()
		return val.And(other).WithMarks(valMarks, otherMarks)
	}

	if shortCircuit := mustTypeCheck(Bool, Bool, val, other); shortCircuit != nil {
		// If either value is known to be exactly False then it doesn't
		// matter what the other value is, because the final result must
		// either be False or an error.
		if val == False || other == False {
			return False
		}
		shortCircuit = forceShortCircuitType(shortCircuit, Bool)
		return (*shortCircuit).RefineNotNull()
	}

	return BoolVal(val.v.(bool) && other.v.(bool))
}

// Or returns the result of logical OR with the receiver and the other given
// value, which must both be of type Bool or this method will panic.
func (val Value) Or(other Value) Value {
	if val.IsMarked() || other.IsMarked() {
		val, valMarks := val.Unmark()
		other, otherMarks := other.Unmark()
		return val.Or(other).WithMarks(valMarks, otherMarks)
	}

	if shortCircuit := mustTypeCheck(Bool, Bool, val, other); shortCircuit != nil {
		// If either value is known to be exactly True then it doesn't
		// matter what the other value is, because the final result must
		// either be True or an error.
		if val == True || other == True {
			return True
		}
		shortCircuit = forceShortCircuitType(shortCircuit, Bool)
		return (*shortCircuit).RefineNotNull()
	}

	return BoolVal(val.v.(bool) || other.v.(bool))
}

// LessThan returns True if the receiver is less than the other given value,
// which must both be numbers or this method will panic.
func (val Value) LessThan(other Value) Value {
	if val.IsMarked() || other.IsMarked() {
		val, valMarks := val.Unmark()
		other, otherMarks := other.Unmark()
		return val.LessThan(other).WithMarks(valMarks, otherMarks)
	}

	if shortCircuit := mustTypeCheck(Number, Bool, val, other); shortCircuit != nil {
		// We might be able to return a known answer even with unknown inputs.
		// FIXME: This is more conservative than it needs to be, because it
		// treats all bounds as exclusive bounds.
		valRng := val.Range()
		otherRng := other.Range()
		if valRng.TypeConstraint() == Number && other.Range().TypeConstraint() == Number {
			valMax, _ := valRng.NumberUpperBound()
			otherMin, _ := otherRng.NumberLowerBound()
			if valMax.IsKnown() && otherMin.IsKnown() {
				if r := valMax.LessThan(otherMin); r.True() {
					return True
				}
			}
			valMin, _ := valRng.NumberLowerBound()
			otherMax, _ := otherRng.NumberUpperBound()
			if valMin.IsKnown() && otherMax.IsKnown() {
				if r := valMin.GreaterThan(otherMax); r.True() {
					return False
				}
			}
		}

		shortCircuit = forceShortCircuitType(shortCircuit, Bool)
		return (*shortCircuit).RefineNotNull()
	}

	return BoolVal(val.v.(*big.Float).Cmp(other.v.(*big.Float)) < 0)
}

// GreaterThan returns True if the receiver is greater than the other given
// value, which must both be numbers or this method will panic.
func (val Value) GreaterThan(other Value) Value {
	if val.IsMarked() || other.IsMarked() {
		val, valMarks := val.Unmark()
		other, otherMarks := other.Unmark()
		return val.GreaterThan(other).WithMarks(valMarks, otherMarks)
	}

	if shortCircuit := mustTypeCheck(Number, Bool, val, other); shortCircuit != nil {
		// We might be able to return a known answer even with unknown inputs.
		// FIXME: This is more conservative than it needs to be, because it
		// treats all bounds as exclusive bounds.
		valRng := val.Range()
		otherRng := other.Range()
		if valRng.TypeConstraint() == Number && other.Range().TypeConstraint() == Number {
			valMin, _ := valRng.NumberLowerBound()
			otherMax, _ := otherRng.NumberUpperBound()
			if valMin.IsKnown() && otherMax.IsKnown() {
				if r := valMin.GreaterThan(otherMax); r.True() {
					return True
				}
			}
			valMax, _ := valRng.NumberUpperBound()
			otherMin, _ := otherRng.NumberLowerBound()
			if valMax.IsKnown() && otherMin.IsKnown() {
				if r := valMax.LessThan(otherMin); r.True() {
					return False
				}
			}
		}

		shortCircuit = forceShortCircuitType(shortCircuit, Bool)
		return (*shortCircuit).RefineNotNull()
	}

	return BoolVal(val.v.(*big.Float).Cmp(other.v.(*big.Float)) > 0)
}

// LessThanOrEqualTo is equivalent to LessThan and Equal combined with Or.
func (val Value) LessThanOrEqualTo(other Value) Value {
	return val.LessThan(other).Or(val.Equals(other))
}

// GreaterThanOrEqualTo is equivalent to GreaterThan and Equal combined with Or.
func (val Value) GreaterThanOrEqualTo(other Value) Value {
	return val.GreaterThan(other).Or(val.Equals(other))
}

// AsString returns the native string from a non-null, non-unknown cty.String
// value, or panics if called on any other value.
func (val Value) AsString() string {
	val.assertUnmarked()
	if val.ty != String {
		panic("not a string")
	}
	if val.IsNull() {
		panic("value is null")
	}
	if !val.IsKnown() {
		panic("value is unknown")
	}

	return val.v.(string)
}

// AsBigFloat returns a big.Float representation of a non-null, non-unknown
// cty.Number value, or panics if called on any other value.
//
// For more convenient conversions to other native numeric types, use the
// "gocty" package.
func (val Value) AsBigFloat() *big.Float {
	val.assertUnmarked()
	if val.ty != Number {
		panic("not a number")
	}
	if val.IsNull() {
		panic("value is null")
	}
	if !val.IsKnown() {
		panic("value is unknown")
	}

	// Copy the float so that callers can't mutate our internal state
	return new(big.Float).Copy(val.v.(*big.Float))
}

// AsValueSlice returns a []cty.Value representation of a non-null, non-unknown
// value of any type that CanIterateElements, or panics if called on
// any other value.
//
// For more convenient conversions to slices of more specific types, use
// the "gocty" package.
func (val Value) AsValueSlice() []Value {
	val.assertUnmarked()
	l := val.LengthInt()
	if l == 0 {
		return nil
	}

	ret := make([]Value, 0, l)
	for it := val.ElementIterator(); it.Next(); {
		_, v := it.Element()
		ret = append(ret, v)
	}
	return ret
}

// AsValueMap returns a map[string]cty.Value representation of a non-null,
// non-unknown value of any type that CanIterateElements, or panics if called
// on any other value.
//
// For more convenient conversions to maps of more specific types, use
// the "gocty" package.
func (val Value) AsValueMap() map[string]Value {
	val.assertUnmarked()
	l := val.LengthInt()
	if l == 0 {
		return nil
	}

	ret := make(map[string]Value, l)
	for it := val.ElementIterator(); it.Next(); {
		k, v := it.Element()
		ret[k.AsString()] = v
	}
	return ret
}

// AsValueSet returns a ValueSet representation of a non-null,
// non-unknown value of any collection type, or panics if called
// on any other value.
//
// Unlike AsValueSlice and AsValueMap, this method requires specifically a
// collection type (list, set or map) and does not allow structural types
// (tuple or object), because the ValueSet type requires homogenous
// element types.
//
// The returned ValueSet can store only values of the receiver's element type.
func (val Value) AsValueSet() ValueSet {
	val.assertUnmarked()
	if !val.Type().IsCollectionType() {
		panic("not a collection type")
	}

	// We don't give the caller our own set.Set (assuming we're a cty.Set value)
	// because then the caller could mutate our internals, which is forbidden.
	// Instead, we will construct a new set and append our elements into it.
	ret := NewValueSet(val.Type().ElementType())
	for it := val.ElementIterator(); it.Next(); {
		_, v := it.Element()
		ret.Add(v)
	}
	return ret
}

// EncapsulatedValue returns the native value encapsulated in a non-null,
// non-unknown capsule-typed value, or panics if called on any other value.
//
// The result is the same pointer that was passed to CapsuleVal to create
// the value. Since cty considers values to be immutable, it is strongly
// recommended to treat the encapsulated value itself as immutable too.
func (val Value) EncapsulatedValue() interface{} {
	val.assertUnmarked()
	if !val.Type().IsCapsuleType() {
		panic("not a capsule-typed value")
	}

	return val.v
}
