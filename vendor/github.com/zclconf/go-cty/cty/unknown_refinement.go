package cty

import (
	"fmt"
	"math"
	"strings"

	"github.com/zclconf/go-cty/cty/ctystrings"
)

// Refine creates a [RefinementBuilder] with which to annotate the reciever
// with zero or more additional refinements that constrain the range of
// the value.
//
// Calling methods on a RefinementBuilder for a known value essentially just
// serves as assertions about the range of that value, leading to panics if
// those assertions don't hold in practice. This is mainly supported just to
// make programs that rely on refinements automatically self-check by using
// the refinement codepath unconditionally on both placeholders and final
// values for those placeholders. It's always a bug to refine the range of
// an unknown value and then later substitute an exact value outside of the
// refined range.
//
// Calling methods on a RefinementBuilder for an unknown value is perhaps
// more useful because the newly-refined value will then be a placeholder for
// a smaller range of values and so it may be possible for other operations
// on the unknown value to return a known result despite the exact value not
// yet being known.
//
// It is never valid to refine [DynamicVal], because that value is a
// placeholder for a value about which we knkow absolutely nothing. A value
// must at least have a known root type before it can support further
// refinement.
func (v Value) Refine() *RefinementBuilder {
	v, marks := v.Unmark()
	if unk, isUnk := v.v.(*unknownType); isUnk && unk.refinement != nil {
		// We're refining a value that's already been refined before, so
		// we'll start from a copy of its existing refinements.
		wip := unk.refinement.copy()
		return &RefinementBuilder{v, marks, wip}
	}

	ty := v.Type()
	var wip unknownValRefinement
	switch {
	case ty == DynamicPseudoType && !v.IsKnown():
		// This case specifically matches DynamicVal, which is constrained
		// by backward compatibility to be a singleton and so we cannot allow
		// any refinements to it.
		// To preserve the typical assumption that DynamicVal is a safe
		// placeholder to use when no value is known at all, we silently
		// ignore all attempts to refine this particular value and just
		// always echo back a totally-unrefined DynamicVal.
		return &RefinementBuilder{
			orig:  DynamicVal,
			marks: marks,
		}
	case ty == String:
		wip = &refinementString{}
	case ty == Number:
		wip = &refinementNumber{}
	case ty.IsCollectionType():
		wip = &refinementCollection{
			// A collection can never have a negative length, so we'll
			// start with that already constrained.
			minLen: 0,
			maxLen: math.MaxInt,
		}
	case ty == Bool || ty.IsObjectType() || ty.IsTupleType() || ty.IsCapsuleType():
		// For other known types we'll just track nullability
		wip = &refinementNullable{}
	case ty == DynamicPseudoType && v.IsNull():
		// It's okay in principle to refine a null value of unknown type,
		// although all we can refine about it is that it's definitely null and
		// so this is pretty pointless and only supported to avoid callers
		// always needing to treat this situation as a special case to avoid
		// panic.
		wip = &refinementNullable{
			isNull: tristateTrue,
		}
	default:
		// we leave "wip" as nil for all other types, representing that
		// they don't support refinements at all and so any call on the
		// RefinementBuilder should fail.

		// NOTE: We intentionally don't allow any refinements for
		// cty.DynamicVal here, even though it could be nice in principle
		// to at least track non-nullness for those, because it's historically
		// been valid to directly compare values with cty.DynamicVal using
		// the Go "==" operator and recording a refinement for an untyped
		// unknown value would break existing code relying on that.
	}

	return &RefinementBuilder{v, marks, wip}
}

// RefineWith is a variant of Refine which uses callback functions instead of
// the builder pattern.
//
// The result is equivalent to passing the return value of [Value.Refine] to the
// first callback, and then continue passing the builder through any other
// callbacks in turn, and then calling [RefinementBuilder.NewValue] on the
// final result.
//
// The builder pattern approach of [Value.Refine] is more convenient for inline
// annotation of refinements when constructing a value, but this alternative
// approach may be more convenient when applying pre-defined collections of
// refinements, or when refinements are defined separately from the values
// they will apply to.
//
// Each refiner callback should return the same pointer that it was given,
// typically after having mutated it using the [RefinementBuilder] methods.
// It's invalid to return a different builder.
func (v Value) RefineWith(refiners ...func(*RefinementBuilder) *RefinementBuilder) Value {
	if len(refiners) == 0 {
		return v
	}
	origBuilder := v.Refine()
	builder := origBuilder
	for _, refiner := range refiners {
		builder = refiner(builder)
		if builder != origBuilder {
			panic("refiner callback returned a different builder")
		}
	}
	return builder.NewValue()
}

// RefineNotNull is a shorthand for Value.Refine().NotNull().NewValue(), because
// declaring that a unknown value isn't null is by far the most common use of
// refinements.
func (v Value) RefineNotNull() Value {
	return v.Refine().NotNull().NewValue()
}

// RefinementBuilder is a supporting type for the [Value.Refine] method,
// using the builder pattern to apply zero or more constraints before
// constructing a new value with all of those constraints applied.
//
// Most of the methods of this type return the same reciever to allow
// for method call chaining. End call chains with a call to
// [RefinementBuilder.NewValue] to obtain the newly-refined value.
type RefinementBuilder struct {
	orig  Value
	marks ValueMarks
	wip   unknownValRefinement
}

// refineable is an internal detail to help with two special situations
// related to refinements:
//   - If the refinement is to a value of a type that doesn't support any
//     refinements at all, this function will immediately panic with a
//     message reporting that, because it's a caller bug to try to refine
//     a value in a way that's inappropriate for its known type.
//   - If the refinement is to an unknown value of an unknown type
//     (i.e. cty.DynamicVal) then it returns false, indicating that the
//     caller should just silently ignore whatever refinement was requested.
//   - In all other cases this function returns true, which means the direct
//     caller should attempt to apply the requested refinement, and then
//     panic itself if the requested refinement doesn't make sense for the
//     specific value being refined.
func (b *RefinementBuilder) refineable() bool {
	if b.orig == DynamicVal {
		return false
	}
	if b.wip == nil {
		panic(fmt.Sprintf("cannot refine a %#v value", b.orig.Type()))
	}
	return true
}

// NotNull constrains the value as definitely not being null.
//
// NotNull is valid when refining values of the following types:
//   - number, boolean, and string values
//   - list, set, or map types of any element type
//   - values of object types
//   - values of collection types
//   - values of capsule types
//
// When refining any other type this function will panic.
//
// In particular note that it is not valid to constrain an untyped value
// -- a value whose type is `cty.DynamicPseudoType` -- as being non-null.
// An unknown value of an unknown type is always completely unconstrained.
func (b *RefinementBuilder) NotNull() *RefinementBuilder {
	if !b.refineable() {
		return b
	}

	if b.orig.IsKnown() && b.orig.IsNull() {
		panic("refining null value as non-null")
	}
	if b.wip.null() == tristateTrue {
		panic("refining null value as non-null")
	}

	b.wip.setNull(tristateFalse)

	return b
}

// Null constrains the value as definitely null.
//
// Null is valid for the same types as [RefinementBuilder.NotNull].
// When refining any other type this function will panic.
//
// Explicitly cnstraining a value to be null is strange because that suggests
// that the caller does actually know the value -- there is only one null
// value for each type constraint -- but this is here for symmetry with the
// fact that a [ValueRange] can also represent that a value is definitely null.
func (b *RefinementBuilder) Null() *RefinementBuilder {
	if !b.refineable() {
		return b
	}

	if b.orig.IsKnown() && !b.orig.IsNull() {
		panic("refining non-null value as null")
	}
	if b.wip.null() == tristateFalse {
		panic("refining non-null value as null")
	}

	b.wip.setNull(tristateTrue)

	return b
}

// NumericRange constrains the upper and/or lower bounds of a number value,
// or panics if this builder is not refining a number value.
//
// The two given values are interpreted as inclusive bounds and either one
// may be an unknown number if only one of the two bounds is currently known.
// If either of the given values is not a non-null number value then this
// function will panic.
func (b *RefinementBuilder) NumberRangeInclusive(min, max Value) *RefinementBuilder {
	return b.NumberRangeLowerBound(min, true).NumberRangeUpperBound(max, true)
}

// NumberRangeLowerBound constraints the lower bound of a number value, or
// panics if this builder is not refining a number value.
func (b *RefinementBuilder) NumberRangeLowerBound(min Value, inclusive bool) *RefinementBuilder {
	if !b.refineable() {
		return b
	}

	wip, ok := b.wip.(*refinementNumber)
	if !ok {
		panic(fmt.Sprintf("cannot refine numeric bounds for a %#v value", b.orig.Type()))
	}

	if !min.IsKnown() {
		// Nothing to do if the lower bound is unknown.
		return b
	}
	if min.IsNull() {
		panic("number range lower bound must not be null")
	}

	if inclusive {
		if gt := min.GreaterThan(b.orig); gt.IsKnown() && gt.True() {
			panic(fmt.Sprintf("refining %#v to be >= %#v", b.orig, min))
		}
	} else {
		if gt := min.GreaterThanOrEqualTo(b.orig); gt.IsKnown() && gt.True() {
			panic(fmt.Sprintf("refining %#v to be > %#v", b.orig, min))
		}
	}

	if wip.min != NilVal {
		var ok Value
		if inclusive && !wip.minInc {
			ok = min.GreaterThan(wip.min)
		} else {
			ok = min.GreaterThanOrEqualTo(wip.min)
		}
		if ok.IsKnown() && ok.False() {
			return b // Our existing refinement is more constrained
		}
	}

	if min != NegativeInfinity {
		wip.min = min
		wip.minInc = inclusive
	}

	wip.assertConsistentBounds()
	return b
}

// NumberRangeUpperBound constraints the upper bound of a number value, or
// panics if this builder is not refining a number value.
func (b *RefinementBuilder) NumberRangeUpperBound(max Value, inclusive bool) *RefinementBuilder {
	if !b.refineable() {
		return b
	}

	wip, ok := b.wip.(*refinementNumber)
	if !ok {
		panic(fmt.Sprintf("cannot refine numeric bounds for a %#v value", b.orig.Type()))
	}

	if !max.IsKnown() {
		// Nothing to do if the upper bound is unknown.
		return b
	}
	if max.IsNull() {
		panic("number range upper bound must not be null")
	}

	if inclusive {
		if lt := max.LessThan(b.orig); lt.IsKnown() && lt.True() {
			panic(fmt.Sprintf("refining %#v to be <= %#v", b.orig, max))
		}
	} else {
		if lt := max.LessThanOrEqualTo(b.orig); lt.IsKnown() && lt.True() {
			panic(fmt.Sprintf("refining %#v to be < %#v", b.orig, max))
		}
	}

	if wip.max != NilVal {
		var ok Value
		if inclusive && !wip.maxInc {
			ok = max.LessThan(wip.max)
		} else {
			ok = max.LessThanOrEqualTo(wip.max)
		}
		if ok.IsKnown() && ok.False() {
			return b // Our existing refinement is more constrained
		}
	}

	if max != PositiveInfinity {
		wip.max = max
		wip.maxInc = inclusive
	}

	wip.assertConsistentBounds()
	return b
}

// CollectionLengthLowerBound constrains the lower bound of the length of a
// collection value, or panics if this builder is not refining a collection
// value.
func (b *RefinementBuilder) CollectionLengthLowerBound(min int) *RefinementBuilder {
	if !b.refineable() {
		return b
	}

	wip, ok := b.wip.(*refinementCollection)
	if !ok {
		panic(fmt.Sprintf("cannot refine collection length bounds for a %#v value", b.orig.Type()))
	}

	minVal := NumberIntVal(int64(min))
	if b.orig.IsKnown() {
		realLen := b.orig.Length()
		if gt := minVal.GreaterThan(realLen); gt.IsKnown() && gt.True() {
			panic(fmt.Sprintf("refining collection of length %#v with lower bound %#v", realLen, min))
		}
	}

	if wip.minLen > min {
		return b // Our existing refinement is more constrained
	}

	wip.minLen = min
	wip.assertConsistentLengthBounds()

	return b
}

// CollectionLengthUpperBound constrains the upper bound of the length of a
// collection value, or panics if this builder is not refining a collection
// value.
//
// The upper bound must be a known, non-null number or this function will
// panic.
func (b *RefinementBuilder) CollectionLengthUpperBound(max int) *RefinementBuilder {
	if !b.refineable() {
		return b
	}

	wip, ok := b.wip.(*refinementCollection)
	if !ok {
		panic(fmt.Sprintf("cannot refine collection length bounds for a %#v value", b.orig.Type()))
	}

	if b.orig.IsKnown() {
		maxVal := NumberIntVal(int64(max))
		realLen := b.orig.Length()
		if lt := maxVal.LessThan(realLen); lt.IsKnown() && lt.True() {
			panic(fmt.Sprintf("refining collection of length %#v with upper bound %#v", realLen, max))
		}
	}

	if wip.maxLen < max {
		return b // Our existing refinement is more constrained
	}

	wip.maxLen = max
	wip.assertConsistentLengthBounds()

	return b
}

// CollectionLength is a shorthand for passing the same length to both
// [CollectionLengthLowerBound] and [CollectionLengthUpperBound].
//
// A collection with a refined length with equal bounds can sometimes collapse
// to a known value. Refining to length zero always produces a known value.
// The behavior for other lengths varies by collection type kind.
//
// If the unknown value is of a set type, it's only valid to use this method
// if the caller knows that there will be the given number of _unique_ values
// in the set. If any values might potentially coalesce together once known,
// use [CollectionLengthUpperBound] instead.
func (b *RefinementBuilder) CollectionLength(length int) *RefinementBuilder {
	return b.CollectionLengthLowerBound(length).CollectionLengthUpperBound(length)
}

// StringPrefix constrains the prefix of a string value, or panics if this
// builder is not refining a string value.
//
// The given prefix will be Unicode normalized in the same way that a
// cty.StringVal would be.
//
// Due to Unicode normalization and grapheme cluster rules, appending new
// characters to a string can change the meaning of earlier characters.
// StringPrefix may discard one or more characters from the end of the given
// prefix to avoid that problem.
//
// Although cty cannot check this automatically, applications should avoid
// relying on the discarding of the suffix for correctness. For example, if the
// prefix ends with an emoji base character then StringPrefix will discard it
// in case subsequent characters include emoji modifiers, but it's still
// incorrect for the final string to use an entirely different base character.
//
// Applications which fully control the final result and can guarantee the
// subsequent characters will not combine with the prefix may be able to use
// [RefinementBuilder.StringPrefixFull] instead, after carefully reviewing
// the constraints described in its documentation.
func (b *RefinementBuilder) StringPrefix(prefix string) *RefinementBuilder {
	return b.StringPrefixFull(ctystrings.SafeKnownPrefix(prefix))
}

// StringPrefixFull is a variant of StringPrefix that will never shorten the
// given prefix to take into account the possibility of the next character
// combining with the end of the prefix.
//
// Applications which fully control the subsequent characters can use this
// as long as they guarantee that the characters added later cannot possibly
// combine with characters at the end of the prefix to form a single grapheme
// cluster. For example, it would be unsafe to use the full prefix "hello" if
// there is any chance that the final string will add a combining diacritic
// character after the "o", because that would then change the final character.
//
// Use [RefinementBuilder.StringPrefix] instead if an application cannot fully
// control the final result to avoid violating this rule.
func (b *RefinementBuilder) StringPrefixFull(prefix string) *RefinementBuilder {
	if !b.refineable() {
		return b
	}

	wip, ok := b.wip.(*refinementString)
	if !ok {
		panic(fmt.Sprintf("cannot refine string prefix for a %#v value", b.orig.Type()))
	}

	// We must apply the same Unicode processing we'd normally use for a
	// cty string so that the prefix will be comparable.
	prefix = NormalizeString(prefix)

	// If we have a known string value then the given prefix must actually
	// match it.
	if b.orig.IsKnown() && !b.orig.IsNull() {
		have := b.orig.AsString()
		matchLen := len(have)
		if l := len(prefix); l < matchLen {
			matchLen = l
		}
		have = have[:matchLen]
		new := prefix[:matchLen]
		if have != new {
			panic("refined prefix is inconsistent with known value")
		}
	}

	// If we already have a refined prefix then the overlapping parts of that
	// and the new prefix must match.
	{
		matchLen := len(wip.prefix)
		if l := len(prefix); l < matchLen {
			matchLen = l
		}

		have := wip.prefix[:matchLen]
		new := prefix[:matchLen]
		if have != new {
			panic("refined prefix is inconsistent with previous refined prefix")
		}
	}

	// We'll only save the new prefix if it's longer than the one we already
	// had.
	if len(prefix) > len(wip.prefix) {
		wip.prefix = prefix
	}

	return b
}

// NewValue completes the refinement process by constructing a new value
// that is guaranteed to meet all of the previously-specified refinements.
//
// If the original value being refined was known then the result is exactly
// that value, because otherwise the previous refinement calls would have
// panicked reporting the refinements as invalid for the value.
//
// If the original value was unknown then the result is typically also unknown
// but may have additional refinements compared to the original. If the applied
// refinements have reduced the range to a single exact value then the result
// might be that known value.
func (b *RefinementBuilder) NewValue() (ret Value) {
	defer func() {
		// Regardless of how we return, the new value should have the same
		// marks as our original value.
		ret = ret.WithMarks(b.marks)
	}()

	if b.orig.IsKnown() || b.orig == DynamicVal {
		return b.orig
	}

	// We have a few cases where the value has been refined enough that we now
	// know exactly what the value is, or at least we can produce a more
	// detailed approximation of it.
	switch b.wip.null() {
	case tristateTrue:
		// There is only one null value of each type so this is now known.
		return NullVal(b.orig.Type())
	case tristateFalse:
		// If we know it's definitely not null then we might have enough
		// information to construct a known, non-null value.
		if rfn, ok := b.wip.(*refinementNumber); ok {
			// If both bounds are inclusive and equal then our value can
			// only be the same number as the bounds.
			if rfn.maxInc && rfn.minInc {
				if rfn.min != NilVal && rfn.max != NilVal {
					eq := rfn.min.Equals(rfn.max)
					if eq.IsKnown() && eq.True() {
						return rfn.min
					}
				}
			}
		} else if rfn, ok := b.wip.(*refinementCollection); ok {
			// If both of the bounds are equal then we know the length is
			// the same number as the bounds.
			if rfn.minLen == rfn.maxLen {
				knownLen := rfn.minLen
				ty := b.orig.Type()
				if knownLen == 0 {
					// If we know the length is zero then we can construct
					// a known value of any collection kind.
					switch {
					case ty.IsListType():
						return ListValEmpty(ty.ElementType())
					case ty.IsSetType():
						return SetValEmpty(ty.ElementType())
					case ty.IsMapType():
						return MapValEmpty(ty.ElementType())
					}
				} else if ty.IsListType() {
					// If we know the length of the list then we can
					// create a known list with unknown elements instead
					// of a wholly-unknown list.
					elems := make([]Value, knownLen)
					unk := UnknownVal(ty.ElementType())
					for i := range elems {
						elems[i] = unk
					}
					return ListVal(elems)
				} else if ty.IsSetType() && knownLen == 1 {
					// If we know we have a one-element set then we
					// know the one element can't possibly coalesce with
					// anything else and so we can create a known set with
					// an unknown element.
					return SetVal([]Value{UnknownVal(ty.ElementType())})
				}
			}
		}
	}

	return Value{
		ty: b.orig.ty,
		v:  &unknownType{refinement: b.wip},
	}
}

// unknownValRefinment is an interface pretending to be a sum type representing
// the different kinds of unknown value refinements we support for different
// types of value.
type unknownValRefinement interface {
	unknownValRefinementSigil()
	copy() unknownValRefinement
	null() tristateBool
	setNull(tristateBool)
	rawEqual(other unknownValRefinement) bool
	GoString() string
}

type refinementString struct {
	refinementNullable
	prefix string
}

func (r *refinementString) unknownValRefinementSigil() {}

func (r *refinementString) copy() unknownValRefinement {
	ret := *r
	// Everything in refinementString is immutable, so a shallow copy is sufficient.
	return &ret
}

func (r *refinementString) rawEqual(other unknownValRefinement) bool {
	{
		other, ok := other.(*refinementString)
		if !ok {
			return false
		}
		return (r.refinementNullable.rawEqual(&other.refinementNullable) &&
			r.prefix == other.prefix)
	}
}

func (r *refinementString) GoString() string {
	var b strings.Builder
	b.WriteString(r.refinementNullable.GoString())
	if r.prefix != "" {
		fmt.Fprintf(&b, ".StringPrefixFull(%q)", r.prefix)
	}
	return b.String()
}

type refinementNumber struct {
	refinementNullable
	min, max       Value
	minInc, maxInc bool
}

func (r *refinementNumber) unknownValRefinementSigil() {}

func (r *refinementNumber) copy() unknownValRefinement {
	ret := *r
	// Everything in refinementNumber is immutable, so a shallow copy is sufficient.
	return &ret
}

func (r *refinementNumber) rawEqual(other unknownValRefinement) bool {
	{
		other, ok := other.(*refinementNumber)
		if !ok {
			return false
		}
		return (r.refinementNullable.rawEqual(&other.refinementNullable) &&
			r.min.RawEquals(other.min) &&
			r.max.RawEquals(other.max) &&
			r.minInc == other.minInc &&
			r.maxInc == other.maxInc)
	}
}

func (r *refinementNumber) GoString() string {
	var b strings.Builder
	b.WriteString(r.refinementNullable.GoString())
	if r.min != NilVal && r.min != NegativeInfinity {
		fmt.Fprintf(&b, ".NumberLowerBound(%#v, %t)", r.min, r.minInc)
	}
	if r.max != NilVal && r.max != PositiveInfinity {
		fmt.Fprintf(&b, ".NumberUpperBound(%#v, %t)", r.max, r.maxInc)
	}
	return b.String()
}

func (r *refinementNumber) assertConsistentBounds() {
	if r.min == NilVal || r.max == NilVal {
		return // If only one bound is constrained then there's nothing to be inconsistent with
	}
	var ok Value
	if r.minInc != r.maxInc {
		ok = r.min.LessThan(r.max)
	} else {
		ok = r.min.LessThanOrEqualTo(r.max)
	}
	if ok.IsKnown() && ok.False() {
		panic(fmt.Sprintf("number lower bound %#v is greater than upper bound %#v", r.min, r.max))
	}
}

type refinementCollection struct {
	refinementNullable
	minLen, maxLen int
}

func (r *refinementCollection) unknownValRefinementSigil() {}

func (r *refinementCollection) copy() unknownValRefinement {
	ret := *r
	// Everything in refinementCollection is immutable, so a shallow copy is sufficient.
	return &ret
}

func (r *refinementCollection) rawEqual(other unknownValRefinement) bool {
	{
		other, ok := other.(*refinementCollection)
		if !ok {
			return false
		}
		return (r.refinementNullable.rawEqual(&other.refinementNullable) &&
			r.minLen == other.minLen &&
			r.maxLen == other.maxLen)
	}
}

func (r *refinementCollection) GoString() string {
	var b strings.Builder
	b.WriteString(r.refinementNullable.GoString())
	if r.minLen != 0 {
		fmt.Fprintf(&b, ".CollectionLengthLowerBound(%d)", r.minLen)
	}
	if r.maxLen != math.MaxInt {
		fmt.Fprintf(&b, ".CollectionLengthUpperBound(%d)", r.maxLen)
	}
	return b.String()
}

func (r *refinementCollection) assertConsistentLengthBounds() {
	if r.maxLen < r.minLen {
		panic(fmt.Sprintf("collection length upper bound %d is less than lower bound %d", r.maxLen, r.minLen))
	}
}

type refinementNullable struct {
	isNull tristateBool
}

func (r *refinementNullable) unknownValRefinementSigil() {}

func (r *refinementNullable) copy() unknownValRefinement {
	ret := *r
	// Everything in refinementJustNull is immutable, so a shallow copy is sufficient.
	return &ret
}

func (r *refinementNullable) null() tristateBool {
	return r.isNull
}

func (r *refinementNullable) setNull(v tristateBool) {
	r.isNull = v
}

func (r *refinementNullable) rawEqual(other unknownValRefinement) bool {
	{
		other, ok := other.(*refinementNullable)
		if !ok {
			return false
		}
		return r.isNull == other.isNull
	}
}

func (r *refinementNullable) GoString() string {
	switch r.isNull {
	case tristateFalse:
		return ".NotNull()"
	case tristateTrue:
		return ".Null()"
	default:
		return ""
	}
}

type tristateBool rune

const tristateTrue tristateBool = 'T'
const tristateFalse tristateBool = 'F'
const tristateUnknown tristateBool = 0
