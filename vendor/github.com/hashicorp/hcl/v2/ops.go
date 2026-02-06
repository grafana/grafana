// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hcl

import (
	"fmt"
	"math/big"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/convert"
)

// Index is a helper function that performs the same operation as the index
// operator in the HCL expression language. That is, the result is the
// same as it would be for collection[key] in a configuration expression.
//
// This is exported so that applications can perform indexing in a manner
// consistent with how the language does it, including handling of null and
// unknown values, etc.
//
// Diagnostics are produced if the given combination of values is not valid.
// Therefore a pointer to a source range must be provided to use in diagnostics,
// though nil can be provided if the calling application is going to
// ignore the subject of the returned diagnostics anyway.
func Index(collection, key cty.Value, srcRange *Range) (cty.Value, Diagnostics) {
	const invalidIndex = "Invalid index"

	if collection.IsNull() {
		return cty.DynamicVal, Diagnostics{
			{
				Severity: DiagError,
				Summary:  "Attempt to index null value",
				Detail:   "This value is null, so it does not have any indices.",
				Subject:  srcRange,
			},
		}
	}
	if key.IsNull() {
		return cty.DynamicVal, Diagnostics{
			{
				Severity: DiagError,
				Summary:  invalidIndex,
				Detail:   "Can't use a null value as an indexing key.",
				Subject:  srcRange,
			},
		}
	}
	ty := collection.Type()
	kty := key.Type()
	if kty == cty.DynamicPseudoType || ty == cty.DynamicPseudoType {
		return cty.DynamicVal.WithSameMarks(collection), nil
	}

	switch {

	case ty.IsListType() || ty.IsTupleType() || ty.IsMapType():
		var wantType cty.Type
		switch {
		case ty.IsListType() || ty.IsTupleType():
			wantType = cty.Number
		case ty.IsMapType():
			wantType = cty.String
		default:
			// should never happen
			panic("don't know what key type we want")
		}

		key, keyErr := convert.Convert(key, wantType)
		if keyErr != nil {
			return cty.DynamicVal, Diagnostics{
				{
					Severity: DiagError,
					Summary:  invalidIndex,
					Detail: fmt.Sprintf(
						"The given key does not identify an element in this collection value: %s.",
						keyErr.Error(),
					),
					Subject: srcRange,
				},
			}
		}

		// Here we drop marks from HasIndex result, in order to allow basic
		// traversal of a marked list, tuple, or map in the same way we can
		// traverse a marked object
		has, _ := collection.HasIndex(key).Unmark()
		if !has.IsKnown() {
			if ty.IsTupleType() {
				return cty.DynamicVal.WithSameMarks(collection), nil
			} else {
				return cty.UnknownVal(ty.ElementType()).WithSameMarks(collection), nil
			}
		}
		if has.False() {
			if (ty.IsListType() || ty.IsTupleType()) && key.Type().Equals(cty.Number) {
				if key.IsKnown() && !key.IsNull() {
					// NOTE: we don't know what any marks might've represented
					// up at the calling application layer, so we must avoid
					// showing the literal number value in these error messages
					// in case the mark represents something important, such as
					// a value being "sensitive".
					key, _ := key.Unmark()
					bf := key.AsBigFloat()
					if _, acc := bf.Int(nil); acc != big.Exact {
						// We have a more specialized error message for the
						// situation of using a fractional number to index into
						// a sequence, because that will tend to happen if the
						// user is trying to use division to calculate an index
						// and not realizing that HCL does float division
						// rather than integer division.
						return cty.DynamicVal, Diagnostics{
							{
								Severity: DiagError,
								Summary:  invalidIndex,
								Detail:   "The given key does not identify an element in this collection value: indexing a sequence requires a whole number, but the given index has a fractional part.",
								Subject:  srcRange,
							},
						}
					}

					if bf.Sign() < 0 {
						// Some other languages allow negative indices to
						// select "backwards" from the end of the sequence,
						// but HCL doesn't do that in order to give better
						// feedback if a dynamic index is calculated
						// incorrectly.
						return cty.DynamicVal, Diagnostics{
							{
								Severity: DiagError,
								Summary:  invalidIndex,
								Detail:   "The given key does not identify an element in this collection value: a negative number is not a valid index for a sequence.",
								Subject:  srcRange,
							},
						}
					}
					if lenVal := collection.Length(); lenVal.IsKnown() && !lenVal.IsMarked() {
						// Length always returns a number, and we already
						// checked that it's a known number, so this is safe.
						lenBF := lenVal.AsBigFloat()
						var result big.Float
						result.Sub(bf, lenBF)
						if result.Sign() < 1 {
							if lenBF.Sign() == 0 {
								return cty.DynamicVal, Diagnostics{
									{
										Severity: DiagError,
										Summary:  invalidIndex,
										Detail:   "The given key does not identify an element in this collection value: the collection has no elements.",
										Subject:  srcRange,
									},
								}
							} else {
								return cty.DynamicVal, Diagnostics{
									{
										Severity: DiagError,
										Summary:  invalidIndex,
										Detail:   "The given key does not identify an element in this collection value: the given index is greater than or equal to the length of the collection.",
										Subject:  srcRange,
									},
								}
							}
						}
					}
				}
			}

			// If this is not one of the special situations we handled above
			// then we'll fall back on a very generic message.
			return cty.DynamicVal, Diagnostics{
				{
					Severity: DiagError,
					Summary:  invalidIndex,
					Detail:   "The given key does not identify an element in this collection value.",
					Subject:  srcRange,
				},
			}
		}

		return collection.Index(key), nil

	case ty.IsObjectType():
		wasNumber := key.Type() == cty.Number
		key, keyErr := convert.Convert(key, cty.String)
		if keyErr != nil {
			return cty.DynamicVal, Diagnostics{
				{
					Severity: DiagError,
					Summary:  invalidIndex,
					Detail: fmt.Sprintf(
						"The given key does not identify an element in this collection value: %s.",
						keyErr.Error(),
					),
					Subject: srcRange,
				},
			}
		}
		if !key.IsKnown() {
			return cty.DynamicVal.WithSameMarks(collection), nil
		}

		key, _ = key.Unmark()
		attrName := key.AsString()

		if !ty.HasAttribute(attrName) {
			var suggestion string
			if wasNumber {
				// We note this only as an addendum to an error we would've
				// already returned anyway, because it is valid (albeit weird)
				// to have an attribute whose name is just decimal digits
				// and then access that attribute using a number whose
				// decimal representation is the same digits.
				suggestion = " An object only supports looking up attributes by name, not by numeric index."
			}
			return cty.DynamicVal, Diagnostics{
				{
					Severity: DiagError,
					Summary:  invalidIndex,
					Detail:   fmt.Sprintf("The given key does not identify an element in this collection value.%s", suggestion),
					Subject:  srcRange,
				},
			}
		}

		if !collection.IsKnown() {
			return cty.UnknownVal(ty.AttributeType(attrName)).WithSameMarks(collection), nil
		}

		return collection.GetAttr(attrName), nil

	case ty.IsSetType():
		return cty.DynamicVal, Diagnostics{
			{
				Severity: DiagError,
				Summary:  invalidIndex,
				Detail:   "Elements of a set are identified only by their value and don't have any separate index or key to select with, so it's only possible to perform operations across all elements of the set.",
				Subject:  srcRange,
			},
		}

	default:
		return cty.DynamicVal, Diagnostics{
			{
				Severity: DiagError,
				Summary:  invalidIndex,
				Detail:   "This value does not have any indices.",
				Subject:  srcRange,
			},
		}
	}

}

// GetAttr is a helper function that performs the same operation as the
// attribute access in the HCL expression language. That is, the result is the
// same as it would be for obj.attr in a configuration expression.
//
// This is exported so that applications can access attributes in a manner
// consistent with how the language does it, including handling of null and
// unknown values, etc.
//
// Diagnostics are produced if the given combination of values is not valid.
// Therefore a pointer to a source range must be provided to use in diagnostics,
// though nil can be provided if the calling application is going to
// ignore the subject of the returned diagnostics anyway.
func GetAttr(obj cty.Value, attrName string, srcRange *Range) (cty.Value, Diagnostics) {
	if obj.IsNull() {
		return cty.DynamicVal, Diagnostics{
			{
				Severity: DiagError,
				Summary:  "Attempt to get attribute from null value",
				Detail:   "This value is null, so it does not have any attributes.",
				Subject:  srcRange,
			},
		}
	}

	const unsupportedAttr = "Unsupported attribute"

	ty := obj.Type()
	switch {
	case ty.IsObjectType():
		if !ty.HasAttribute(attrName) {
			return cty.DynamicVal, Diagnostics{
				{
					Severity: DiagError,
					Summary:  unsupportedAttr,
					Detail:   fmt.Sprintf("This object does not have an attribute named %q.", attrName),
					Subject:  srcRange,
				},
			}
		}

		if !obj.IsKnown() {
			return cty.UnknownVal(ty.AttributeType(attrName)).WithSameMarks(obj), nil
		}

		return obj.GetAttr(attrName), nil
	case ty.IsMapType():
		if !obj.IsKnown() {
			return cty.UnknownVal(ty.ElementType()).WithSameMarks(obj), nil
		}

		idx := cty.StringVal(attrName)

		// Here we drop marks from HasIndex result, in order to allow basic
		// traversal of a marked map in the same way we can traverse a marked
		// object
		hasIndex, _ := obj.HasIndex(idx).Unmark()
		if hasIndex.False() {
			return cty.DynamicVal, Diagnostics{
				{
					Severity: DiagError,
					Summary:  "Missing map element",
					Detail:   fmt.Sprintf("This map does not have an element with the key %q.", attrName),
					Subject:  srcRange,
				},
			}
		}

		return obj.Index(idx), nil
	case ty == cty.DynamicPseudoType:
		return cty.DynamicVal.WithSameMarks(obj), nil
	case ty.IsListType() && ty.ElementType().IsObjectType():
		// It seems a common mistake to try to access attributes on a whole
		// list of objects rather than on a specific individual element, so
		// we have some extra hints for that case.

		switch {
		case ty.ElementType().HasAttribute(attrName):
			// This is a very strong indication that the user mistook the list
			// of objects for a single object, so we can be a little more
			// direct in our suggestion here.
			return cty.DynamicVal, Diagnostics{
				{
					Severity: DiagError,
					Summary:  unsupportedAttr,
					Detail:   fmt.Sprintf("Can't access attributes on a list of objects. Did you mean to access attribute %q for a specific element of the list, or across all elements of the list?", attrName),
					Subject:  srcRange,
				},
			}
		default:
			return cty.DynamicVal, Diagnostics{
				{
					Severity: DiagError,
					Summary:  unsupportedAttr,
					Detail:   "Can't access attributes on a list of objects. Did you mean to access an attribute for a specific element of the list, or across all elements of the list?",
					Subject:  srcRange,
				},
			}
		}

	case ty.IsSetType() && ty.ElementType().IsObjectType():
		// This is similar to the previous case, but we can't give such a
		// direct suggestion because there is no mechanism to select a single
		// item from a set.
		// We could potentially suggest using a for expression or splat
		// operator here, but we typically don't get into syntax specifics
		// in hcl.GetAttr suggestions because it's a general function used in
		// various other situations, such as in application-specific operations
		// that might have a more constraint set of alternative approaches.

		return cty.DynamicVal, Diagnostics{
			{
				Severity: DiagError,
				Summary:  unsupportedAttr,
				Detail:   "Can't access attributes on a set of objects. Did you mean to access an attribute across all elements of the set?",
				Subject:  srcRange,
			},
		}

	case ty.IsPrimitiveType():
		return cty.DynamicVal, Diagnostics{
			{
				Severity: DiagError,
				Summary:  unsupportedAttr,
				Detail:   fmt.Sprintf("Can't access attributes on a primitive-typed value (%s).", ty.FriendlyName()),
				Subject:  srcRange,
			},
		}

	default:
		return cty.DynamicVal, Diagnostics{
			{
				Severity: DiagError,
				Summary:  unsupportedAttr,
				Detail:   "This value does not have any attributes.",
				Subject:  srcRange,
			},
		}
	}

}

// ApplyPath is a helper function that applies a cty.Path to a value using the
// indexing and attribute access operations from HCL.
//
// This is similar to calling the path's own Apply method, but ApplyPath uses
// the more relaxed typing rules that apply to these operations in HCL, rather
// than cty's relatively-strict rules. ApplyPath is implemented in terms of
// Index and GetAttr, and so it has the same behavior for individual steps
// but will stop and return any errors returned by intermediate steps.
//
// Diagnostics are produced if the given path cannot be applied to the given
// value. Therefore a pointer to a source range must be provided to use in
// diagnostics, though nil can be provided if the calling application is going
// to ignore the subject of the returned diagnostics anyway.
func ApplyPath(val cty.Value, path cty.Path, srcRange *Range) (cty.Value, Diagnostics) {
	var diags Diagnostics

	for _, step := range path {
		var stepDiags Diagnostics
		switch ts := step.(type) {
		case cty.IndexStep:
			val, stepDiags = Index(val, ts.Key, srcRange)
		case cty.GetAttrStep:
			val, stepDiags = GetAttr(val, ts.Name, srcRange)
		default:
			// Should never happen because the above are all of the step types.
			diags = diags.Append(&Diagnostic{
				Severity: DiagError,
				Summary:  "Invalid path step",
				Detail:   fmt.Sprintf("Go type %T is not a valid path step. This is a bug in this program.", step),
				Subject:  srcRange,
			})
			return cty.DynamicVal, diags
		}

		diags = append(diags, stepDiags...)
		if stepDiags.HasErrors() {
			return cty.DynamicVal, diags
		}
	}

	return val, diags
}
