// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package validate

import (
	"reflect"

	"github.com/go-openapi/spec"
	"github.com/go-openapi/strfmt"
)

type formatValidator struct {
	Path         string
	In           string
	Format       string
	KnownFormats strfmt.Registry
	Options      *SchemaValidatorOptions
}

func newFormatValidator(path, in, format string, formats strfmt.Registry, opts *SchemaValidatorOptions) *formatValidator {
	if opts == nil {
		opts = new(SchemaValidatorOptions)
	}

	var f *formatValidator
	if opts.recycleValidators {
		f = pools.poolOfFormatValidators.BorrowValidator()
	} else {
		f = new(formatValidator)
	}

	f.Path = path
	f.In = in
	f.Format = format
	f.KnownFormats = formats
	f.Options = opts

	return f
}

func (f *formatValidator) SetPath(path string) {
	f.Path = path
}

func (f *formatValidator) Applies(source any, kind reflect.Kind) bool {
	if source == nil || f.KnownFormats == nil {
		return false
	}

	switch source := source.(type) {
	case *spec.Items:
		return kind == reflect.String && f.KnownFormats.ContainsName(source.Format)
	case *spec.Parameter:
		return kind == reflect.String && f.KnownFormats.ContainsName(source.Format)
	case *spec.Schema:
		return kind == reflect.String && f.KnownFormats.ContainsName(source.Format)
	case *spec.Header:
		return kind == reflect.String && f.KnownFormats.ContainsName(source.Format)
	default:
		return false
	}
}

func (f *formatValidator) Validate(val any) *Result {
	if f.Options.recycleValidators {
		defer func() {
			f.redeem()
		}()
	}

	var result *Result
	if f.Options.recycleResult {
		result = pools.poolOfResults.BorrowResult()
	} else {
		result = new(Result)
	}

	if err := FormatOf(f.Path, f.In, f.Format, val.(string), f.KnownFormats); err != nil {
		result.AddErrors(err)
	}

	return result
}

func (f *formatValidator) redeem() {
	pools.poolOfFormatValidators.RedeemValidator(f)
}
