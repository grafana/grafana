// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package validate

import (
	"fmt"
	"reflect"

	"github.com/go-openapi/spec"
	"github.com/go-openapi/strfmt"
)

type schemaSliceValidator struct {
	Path            string
	In              string
	MaxItems        *int64
	MinItems        *int64
	UniqueItems     bool
	AdditionalItems *spec.SchemaOrBool
	Items           *spec.SchemaOrArray
	Root            any
	KnownFormats    strfmt.Registry
	Options         *SchemaValidatorOptions
}

func newSliceValidator(path, in string,
	maxItems, minItems *int64, uniqueItems bool,
	additionalItems *spec.SchemaOrBool, items *spec.SchemaOrArray,
	root any, formats strfmt.Registry, opts *SchemaValidatorOptions) *schemaSliceValidator {
	if opts == nil {
		opts = new(SchemaValidatorOptions)
	}

	var v *schemaSliceValidator
	if opts.recycleValidators {
		v = pools.poolOfSliceValidators.BorrowValidator()
	} else {
		v = new(schemaSliceValidator)
	}

	v.Path = path
	v.In = in
	v.MaxItems = maxItems
	v.MinItems = minItems
	v.UniqueItems = uniqueItems
	v.AdditionalItems = additionalItems
	v.Items = items
	v.Root = root
	v.KnownFormats = formats
	v.Options = opts

	return v
}

func (s *schemaSliceValidator) SetPath(path string) {
	s.Path = path
}

func (s *schemaSliceValidator) Applies(source any, kind reflect.Kind) bool {
	_, ok := source.(*spec.Schema)
	r := ok && kind == reflect.Slice
	return r
}

func (s *schemaSliceValidator) Validate(data any) *Result {
	if s.Options.recycleValidators {
		defer func() {
			s.redeem()
		}()
	}

	var result *Result
	if s.Options.recycleResult {
		result = pools.poolOfResults.BorrowResult()
	} else {
		result = new(Result)
	}
	if data == nil {
		return result
	}
	val := reflect.ValueOf(data)
	size := val.Len()

	if s.Items != nil && s.Items.Schema != nil {
		for i := range size {
			validator := newSchemaValidator(s.Items.Schema, s.Root, s.Path, s.KnownFormats, s.Options)
			validator.SetPath(fmt.Sprintf("%s.%d", s.Path, i))
			value := val.Index(i)
			result.mergeForSlice(val, i, validator.Validate(value.Interface()))
		}
	}

	itemsSize := 0
	if s.Items != nil && len(s.Items.Schemas) > 0 {
		itemsSize = len(s.Items.Schemas)
		for i := range itemsSize {
			if size <= i {
				break
			}

			validator := newSchemaValidator(&s.Items.Schemas[i], s.Root, fmt.Sprintf("%s.%d", s.Path, i), s.KnownFormats, s.Options)
			result.mergeForSlice(val, i, validator.Validate(val.Index(i).Interface()))
		}
	}
	if s.AdditionalItems != nil && itemsSize < size {
		if s.Items != nil && len(s.Items.Schemas) > 0 && !s.AdditionalItems.Allows {
			result.AddErrors(arrayDoesNotAllowAdditionalItemsMsg())
		}
		if s.AdditionalItems.Schema != nil {
			for i := itemsSize; i < size-itemsSize+1; i++ {
				validator := newSchemaValidator(s.AdditionalItems.Schema, s.Root, fmt.Sprintf("%s.%d", s.Path, i), s.KnownFormats, s.Options)
				result.mergeForSlice(val, i, validator.Validate(val.Index(i).Interface()))
			}
		}
	}

	if s.MinItems != nil {
		if err := MinItems(s.Path, s.In, int64(size), *s.MinItems); err != nil {
			result.AddErrors(err)
		}
	}
	if s.MaxItems != nil {
		if err := MaxItems(s.Path, s.In, int64(size), *s.MaxItems); err != nil {
			result.AddErrors(err)
		}
	}
	if s.UniqueItems {
		if err := UniqueItems(s.Path, s.In, val.Interface()); err != nil {
			result.AddErrors(err)
		}
	}
	result.Inc()
	return result
}

func (s *schemaSliceValidator) redeem() {
	pools.poolOfSliceValidators.RedeemValidator(s)
}
