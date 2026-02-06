// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package validate

import (
	stderrors "errors"
	"reflect"
	"strings"

	"github.com/go-openapi/errors"
	"github.com/go-openapi/spec"
)

var emptyResult = &Result{MatchCount: 1}

// Result represents a validation result set, composed of
// errors and warnings.
//
// It is used to keep track of all detected errors and warnings during
// the validation of a specification.
//
// Matchcount is used to determine
// which errors are relevant in the case of AnyOf, OneOf
// schema validation. Results from the validation branch
// with most matches get eventually selected.
//
// TODO: keep path of key originating the error
type Result struct {
	Errors     []error
	Warnings   []error
	MatchCount int

	// the object data
	data any

	// Schemata for the root object
	rootObjectSchemata schemata
	// Schemata for object fields
	fieldSchemata []fieldSchemata
	// Schemata for slice items
	itemSchemata []itemSchemata

	cachedFieldSchemata map[FieldKey][]*spec.Schema
	cachedItemSchemata  map[ItemKey][]*spec.Schema

	wantsRedeemOnMerge bool
}

// FieldKey is a pair of an object and a field, usable as a key for a map.
type FieldKey struct {
	object reflect.Value // actually a map[string]any, but the latter cannot be a key
	field  string
}

// ItemKey is a pair of a slice and an index, usable as a key for a map.
type ItemKey struct {
	slice reflect.Value // actually a []any, but the latter cannot be a key
	index int
}

// NewFieldKey returns a pair of an object and field usable as a key of a map.
func NewFieldKey(obj map[string]any, field string) FieldKey {
	return FieldKey{object: reflect.ValueOf(obj), field: field}
}

// Object returns the underlying object of this key.
func (fk *FieldKey) Object() map[string]any {
	return fk.object.Interface().(map[string]any)
}

// Field returns the underlying field of this key.
func (fk *FieldKey) Field() string {
	return fk.field
}

// NewItemKey returns a pair of a slice and index usable as a key of a map.
func NewItemKey(slice any, i int) ItemKey {
	return ItemKey{slice: reflect.ValueOf(slice), index: i}
}

// Slice returns the underlying slice of this key.
func (ik *ItemKey) Slice() []any {
	return ik.slice.Interface().([]any)
}

// Index returns the underlying index of this key.
func (ik *ItemKey) Index() int {
	return ik.index
}

type fieldSchemata struct {
	obj      map[string]any
	field    string
	schemata schemata
}

type itemSchemata struct {
	slice    reflect.Value
	index    int
	schemata schemata
}

// Merge merges this result with the other one(s), preserving match counts etc.
func (r *Result) Merge(others ...*Result) *Result {
	for _, other := range others {
		if other == nil {
			continue
		}
		r.mergeWithoutRootSchemata(other)
		r.rootObjectSchemata.Append(other.rootObjectSchemata)
		if other.wantsRedeemOnMerge {
			pools.poolOfResults.RedeemResult(other)
		}
	}
	return r
}

// Data returns the original data object used for validation. Mutating this renders
// the result invalid.
func (r *Result) Data() any {
	return r.data
}

// RootObjectSchemata returns the schemata which apply to the root object.
func (r *Result) RootObjectSchemata() []*spec.Schema {
	return r.rootObjectSchemata.Slice()
}

// FieldSchemata returns the schemata which apply to fields in objects.
func (r *Result) FieldSchemata() map[FieldKey][]*spec.Schema {
	if r.cachedFieldSchemata != nil {
		return r.cachedFieldSchemata
	}

	ret := make(map[FieldKey][]*spec.Schema, len(r.fieldSchemata))
	for _, fs := range r.fieldSchemata {
		key := NewFieldKey(fs.obj, fs.field)
		if fs.schemata.one != nil {
			ret[key] = append(ret[key], fs.schemata.one)
		} else if len(fs.schemata.multiple) > 0 {
			ret[key] = append(ret[key], fs.schemata.multiple...)
		}
	}
	r.cachedFieldSchemata = ret

	return ret
}

// ItemSchemata returns the schemata which apply to items in slices.
func (r *Result) ItemSchemata() map[ItemKey][]*spec.Schema {
	if r.cachedItemSchemata != nil {
		return r.cachedItemSchemata
	}

	ret := make(map[ItemKey][]*spec.Schema, len(r.itemSchemata))
	for _, ss := range r.itemSchemata {
		key := NewItemKey(ss.slice, ss.index)
		if ss.schemata.one != nil {
			ret[key] = append(ret[key], ss.schemata.one)
		} else if len(ss.schemata.multiple) > 0 {
			ret[key] = append(ret[key], ss.schemata.multiple...)
		}
	}
	r.cachedItemSchemata = ret
	return ret
}

// MergeAsErrors merges this result with the other one(s), preserving match counts etc.
//
// Warnings from input are merged as Errors in the returned merged Result.
func (r *Result) MergeAsErrors(others ...*Result) *Result {
	for _, other := range others {
		if other != nil {
			r.resetCaches()
			r.AddErrors(other.Errors...)
			r.AddErrors(other.Warnings...)
			r.MatchCount += other.MatchCount
			if other.wantsRedeemOnMerge {
				pools.poolOfResults.RedeemResult(other)
			}
		}
	}
	return r
}

// MergeAsWarnings merges this result with the other one(s), preserving match counts etc.
//
// Errors from input are merged as Warnings in the returned merged Result.
func (r *Result) MergeAsWarnings(others ...*Result) *Result {
	for _, other := range others {
		if other != nil {
			r.resetCaches()
			r.AddWarnings(other.Errors...)
			r.AddWarnings(other.Warnings...)
			r.MatchCount += other.MatchCount
			if other.wantsRedeemOnMerge {
				pools.poolOfResults.RedeemResult(other)
			}
		}
	}
	return r
}

// AddErrors adds errors to this validation result (if not already reported).
//
// Since the same check may be passed several times while exploring the
// spec structure (via $ref, ...) reported messages are kept
// unique.
func (r *Result) AddErrors(errors ...error) {
	for _, e := range errors {
		found := false
		if e != nil {
			for _, isReported := range r.Errors {
				if e.Error() == isReported.Error() {
					found = true
					break
				}
			}
			if !found {
				r.Errors = append(r.Errors, e)
			}
		}
	}
}

// AddWarnings adds warnings to this validation result (if not already reported).
func (r *Result) AddWarnings(warnings ...error) {
	for _, e := range warnings {
		found := false
		if e != nil {
			for _, isReported := range r.Warnings {
				if e.Error() == isReported.Error() {
					found = true
					break
				}
			}
			if !found {
				r.Warnings = append(r.Warnings, e)
			}
		}
	}
}

// IsValid returns true when this result is valid.
//
// Returns true on a nil *Result.
func (r *Result) IsValid() bool {
	if r == nil {
		return true
	}
	return len(r.Errors) == 0
}

// HasErrors returns true when this result is invalid.
//
// Returns false on a nil *Result.
func (r *Result) HasErrors() bool {
	if r == nil {
		return false
	}
	return !r.IsValid()
}

// HasWarnings returns true when this result contains warnings.
//
// Returns false on a nil *Result.
func (r *Result) HasWarnings() bool {
	if r == nil {
		return false
	}
	return len(r.Warnings) > 0
}

// HasErrorsOrWarnings returns true when this result contains
// either errors or warnings.
//
// Returns false on a nil *Result.
func (r *Result) HasErrorsOrWarnings() bool {
	if r == nil {
		return false
	}
	return len(r.Errors) > 0 || len(r.Warnings) > 0
}

// Inc increments the match count
func (r *Result) Inc() {
	r.MatchCount++
}

// AsError renders this result as an error interface
//
// TODO: reporting / pretty print with path ordered and indented
func (r *Result) AsError() error {
	if r.IsValid() {
		return nil
	}
	return errors.CompositeValidationError(r.Errors...)
}

func (r *Result) resetCaches() {
	r.cachedFieldSchemata = nil
	r.cachedItemSchemata = nil
}

// mergeForField merges other into r, assigning other's root schemata to the given Object and field name.
//
//nolint:unparam
func (r *Result) mergeForField(obj map[string]any, field string, other *Result) *Result {
	if other == nil {
		return r
	}
	r.mergeWithoutRootSchemata(other)

	if other.rootObjectSchemata.Len() > 0 {
		if r.fieldSchemata == nil {
			r.fieldSchemata = make([]fieldSchemata, len(obj))
		}
		// clone other schemata, as other is about to be redeemed to the pool
		r.fieldSchemata = append(r.fieldSchemata, fieldSchemata{
			obj:      obj,
			field:    field,
			schemata: other.rootObjectSchemata.Clone(),
		})
	}
	if other.wantsRedeemOnMerge {
		pools.poolOfResults.RedeemResult(other)
	}

	return r
}

// mergeForSlice merges other into r, assigning other's root schemata to the given slice and index.
//
//nolint:unparam
func (r *Result) mergeForSlice(slice reflect.Value, i int, other *Result) *Result {
	if other == nil {
		return r
	}
	r.mergeWithoutRootSchemata(other)

	if other.rootObjectSchemata.Len() > 0 {
		if r.itemSchemata == nil {
			r.itemSchemata = make([]itemSchemata, slice.Len())
		}
		// clone other schemata, as other is about to be redeemed to the pool
		r.itemSchemata = append(r.itemSchemata, itemSchemata{
			slice:    slice,
			index:    i,
			schemata: other.rootObjectSchemata.Clone(),
		})
	}

	if other.wantsRedeemOnMerge {
		pools.poolOfResults.RedeemResult(other)
	}

	return r
}

// addRootObjectSchemata adds the given schemata for the root object of the result.
//
// Since the slice schemata might be reused, it is shallow-cloned before saving it into the result.
func (r *Result) addRootObjectSchemata(s *spec.Schema) {
	clone := *s
	r.rootObjectSchemata.Append(schemata{one: &clone})
}

// addPropertySchemata adds the given schemata for the object and field.
//
// Since the slice schemata might be reused, it is shallow-cloned before saving it into the result.
func (r *Result) addPropertySchemata(obj map[string]any, fld string, schema *spec.Schema) {
	if r.fieldSchemata == nil {
		r.fieldSchemata = make([]fieldSchemata, 0, len(obj))
	}
	clone := *schema
	r.fieldSchemata = append(r.fieldSchemata, fieldSchemata{obj: obj, field: fld, schemata: schemata{one: &clone}})
}

/*
// addSliceSchemata adds the given schemata for the slice and index.
// The slice schemata might be reused. I.e. do not modify it after being added to a result.
func (r *Result) addSliceSchemata(slice reflect.Value, i int, schema *spec.Schema) {
	if r.itemSchemata == nil {
		r.itemSchemata = make([]itemSchemata, 0, slice.Len())
	}
	r.itemSchemata = append(r.itemSchemata, itemSchemata{slice: slice, index: i, schemata: schemata{one: schema}})
}
*/

// mergeWithoutRootSchemata merges other into r, ignoring the rootObject schemata.
func (r *Result) mergeWithoutRootSchemata(other *Result) {
	r.resetCaches()
	r.AddErrors(other.Errors...)
	r.AddWarnings(other.Warnings...)
	r.MatchCount += other.MatchCount

	if other.fieldSchemata != nil {
		if r.fieldSchemata == nil {
			r.fieldSchemata = make([]fieldSchemata, 0, len(other.fieldSchemata))
		}
		for _, field := range other.fieldSchemata {
			field.schemata = field.schemata.Clone()
			r.fieldSchemata = append(r.fieldSchemata, field)
		}
	}

	if other.itemSchemata != nil {
		if r.itemSchemata == nil {
			r.itemSchemata = make([]itemSchemata, 0, len(other.itemSchemata))
		}
		for _, field := range other.itemSchemata {
			field.schemata = field.schemata.Clone()
			r.itemSchemata = append(r.itemSchemata, field)
		}
	}
}

func isImportant(err error) bool {
	return strings.HasPrefix(err.Error(), "IMPORTANT!")
}

func stripImportantTag(err error) error {
	return stderrors.New(strings.TrimPrefix(err.Error(), "IMPORTANT!")) //nolint:err113
}

func (r *Result) keepRelevantErrors() *Result {
	// TODO: this one is going to disapear...
	// keepRelevantErrors strips a result from standard errors and keeps
	// the ones which are supposedly more accurate.
	//
	// The original result remains unaffected (creates a new instance of Result).
	// This method is used to work around the "matchCount" filter which would otherwise
	// strip our result from some accurate error reporting from lower level validators.
	//
	// NOTE: this implementation with a placeholder (IMPORTANT!) is neither clean nor
	// very efficient. On the other hand, relying on go-openapi/errors to manipulate
	// codes would require to change a lot here. So, for the moment, let's go with
	// placeholders.
	strippedErrors := []error{}
	for _, e := range r.Errors {
		if isImportant(e) {
			strippedErrors = append(strippedErrors, stripImportantTag(e))
		}
	}
	strippedWarnings := []error{}
	for _, e := range r.Warnings {
		if isImportant(e) {
			strippedWarnings = append(strippedWarnings, stripImportantTag(e))
		}
	}
	var strippedResult *Result
	if r.wantsRedeemOnMerge {
		strippedResult = pools.poolOfResults.BorrowResult()
	} else {
		strippedResult = new(Result)
	}
	strippedResult.Errors = strippedErrors
	strippedResult.Warnings = strippedWarnings
	return strippedResult
}

func (r *Result) cleared() *Result {
	// clear the Result to be reusable. Keep allocated capacity.
	r.Errors = r.Errors[:0]
	r.Warnings = r.Warnings[:0]
	r.MatchCount = 0
	r.data = nil
	r.rootObjectSchemata.one = nil
	r.rootObjectSchemata.multiple = r.rootObjectSchemata.multiple[:0]
	r.fieldSchemata = r.fieldSchemata[:0]
	r.itemSchemata = r.itemSchemata[:0]
	for k := range r.cachedFieldSchemata {
		delete(r.cachedFieldSchemata, k)
	}
	for k := range r.cachedItemSchemata {
		delete(r.cachedItemSchemata, k)
	}
	r.wantsRedeemOnMerge = true // mark this result as eligible for redeem when merged into another

	return r
}

// schemata is an arbitrary number of schemata. It does a distinction between zero,
// one and many schemata to avoid slice allocations.
type schemata struct {
	// one is set if there is exactly one schema. In that case multiple must be nil.
	one *spec.Schema
	// multiple is an arbitrary number of schemas. If it is set, one must be nil.
	multiple []*spec.Schema
}

func (s *schemata) Len() int {
	if s.one != nil {
		return 1
	}
	return len(s.multiple)
}

func (s *schemata) Slice() []*spec.Schema {
	if s == nil {
		return nil
	}
	if s.one != nil {
		return []*spec.Schema{s.one}
	}
	return s.multiple
}

// Append appends the schemata in other to s. It mutates s in-place.
func (s *schemata) Append(other schemata) {
	if other.one == nil && len(other.multiple) == 0 {
		return
	}
	if s.one == nil && len(s.multiple) == 0 {
		*s = other
		return
	}

	if s.one != nil {
		if other.one != nil {
			s.multiple = []*spec.Schema{s.one, other.one}
		} else {
			t := make([]*spec.Schema, 0, 1+len(other.multiple))
			s.multiple = append(append(t, s.one), other.multiple...)
		}
		s.one = nil
	} else {
		if other.one != nil {
			s.multiple = append(s.multiple, other.one)
		} else {
			if cap(s.multiple) >= len(s.multiple)+len(other.multiple) {
				s.multiple = append(s.multiple, other.multiple...)
			} else {
				t := make([]*spec.Schema, 0, len(s.multiple)+len(other.multiple))
				s.multiple = append(append(t, s.multiple...), other.multiple...)
			}
		}
	}
}

func (s schemata) Clone() schemata {
	var clone schemata

	if s.one != nil {
		clone.one = new(spec.Schema)
		*clone.one = *s.one
	}

	if len(s.multiple) > 0 {
		clone.multiple = make([]*spec.Schema, len(s.multiple))
		for idx := range len(s.multiple) {
			sp := new(spec.Schema)
			*sp = *s.multiple[idx]
			clone.multiple[idx] = sp
		}
	}

	return clone
}
