// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package validate

import (
	"encoding/json"
	"reflect"

	"github.com/go-openapi/errors"
	"github.com/go-openapi/spec"
	"github.com/go-openapi/strfmt"
	"github.com/go-openapi/swag/jsonutils"
)

// SchemaValidator validates data against a JSON schema
type SchemaValidator struct {
	Path         string
	in           string
	Schema       *spec.Schema
	validators   [8]valueValidator
	Root         any
	KnownFormats strfmt.Registry
	Options      *SchemaValidatorOptions
}

// AgainstSchema validates the specified data against the provided schema, using a registry of supported formats.
//
// When no pre-parsed *spec.Schema structure is provided, it uses a JSON schema as default. See example.
func AgainstSchema(schema *spec.Schema, data any, formats strfmt.Registry, options ...Option) error {
	res := NewSchemaValidator(schema, nil, "", formats,
		append(options, WithRecycleValidators(true), withRecycleResults(true))...,
	).Validate(data)
	defer func() {
		pools.poolOfResults.RedeemResult(res)
	}()

	if res.HasErrors() {
		return errors.CompositeValidationError(res.Errors...)
	}

	return nil
}

// NewSchemaValidator creates a new schema validator.
//
// Panics if the provided schema is invalid.
func NewSchemaValidator(schema *spec.Schema, rootSchema any, root string, formats strfmt.Registry, options ...Option) *SchemaValidator {
	opts := new(SchemaValidatorOptions)
	for _, o := range options {
		o(opts)
	}

	return newSchemaValidator(schema, rootSchema, root, formats, opts)
}

func newSchemaValidator(schema *spec.Schema, rootSchema any, root string, formats strfmt.Registry, opts *SchemaValidatorOptions) *SchemaValidator {
	if schema == nil {
		return nil
	}

	if rootSchema == nil {
		rootSchema = schema
	}

	if schema.ID != "" || schema.Ref.String() != "" || schema.Ref.IsRoot() {
		err := spec.ExpandSchema(schema, rootSchema, nil)
		if err != nil {
			msg := invalidSchemaProvidedMsg(err).Error()
			panic(msg)
		}
	}

	if opts == nil {
		opts = new(SchemaValidatorOptions)
	}

	var s *SchemaValidator
	if opts.recycleValidators {
		s = pools.poolOfSchemaValidators.BorrowValidator()
	} else {
		s = new(SchemaValidator)
	}

	s.Path = root
	s.in = "body"
	s.Schema = schema
	s.Root = rootSchema
	s.Options = opts
	s.KnownFormats = formats

	s.validators = [8]valueValidator{
		s.typeValidator(),
		s.schemaPropsValidator(),
		s.stringValidator(),
		s.formatValidator(),
		s.numberValidator(),
		s.sliceValidator(),
		s.commonValidator(),
		s.objectValidator(),
	}

	return s
}

// SetPath sets the path for this schema valdiator
func (s *SchemaValidator) SetPath(path string) {
	s.Path = path
}

// Applies returns true when this schema validator applies
func (s *SchemaValidator) Applies(source any, _ reflect.Kind) bool {
	_, ok := source.(*spec.Schema)
	return ok
}

// Validate validates the data against the schema
func (s *SchemaValidator) Validate(data any) *Result {
	if s == nil {
		return emptyResult
	}

	if s.Options.recycleValidators {
		defer func() {
			s.redeemChildren()
			s.redeem() // one-time use validator
		}()
	}

	var result *Result
	if s.Options.recycleResult {
		result = pools.poolOfResults.BorrowResult()
		result.data = data
	} else {
		result = &Result{data: data}
	}

	if s.Schema != nil && !s.Options.skipSchemataResult {
		result.addRootObjectSchemata(s.Schema)
	}

	if data == nil {
		// early exit with minimal validation
		result.Merge(s.validators[0].Validate(data)) // type validator
		result.Merge(s.validators[6].Validate(data)) // common validator

		if s.Options.recycleValidators {
			s.validators[0] = nil
			s.validators[6] = nil
		}

		return result
	}

	tpe := reflect.TypeOf(data)
	kind := tpe.Kind()
	for kind == reflect.Ptr {
		tpe = tpe.Elem()
		kind = tpe.Kind()
	}
	d := data

	if kind == reflect.Struct {
		// NOTE: since reflect retrieves the true nature of types
		// this means that all strfmt types passed here (e.g. strfmt.Datetime, etc..)
		// are converted here to strings, and structs are systematically converted
		// to map[string]interface{}.
		var dd any
		if err := jsonutils.FromDynamicJSON(data, &dd); err != nil {
			result.AddErrors(err)
			result.Inc()

			return result
		}

		d = dd
	}

	// TODO: this part should be handed over to type validator
	// Handle special case of json.Number data (number marshalled as string)
	isnumber := s.Schema != nil && (s.Schema.Type.Contains(numberType) || s.Schema.Type.Contains(integerType))
	if num, ok := data.(json.Number); ok && isnumber {
		if s.Schema.Type.Contains(integerType) { // avoid lossy conversion
			in, erri := num.Int64()
			if erri != nil {
				result.AddErrors(invalidTypeConversionMsg(s.Path, erri))
				result.Inc()

				return result
			}
			d = in
		} else {
			nf, errf := num.Float64()
			if errf != nil {
				result.AddErrors(invalidTypeConversionMsg(s.Path, errf))
				result.Inc()

				return result
			}
			d = nf
		}

		tpe = reflect.TypeOf(d)
		kind = tpe.Kind()
	}

	for idx, v := range s.validators {
		if !v.Applies(s.Schema, kind) {
			if s.Options.recycleValidators {
				// Validate won't be called, so relinquish this validator
				if redeemableChildren, ok := v.(interface{ redeemChildren() }); ok {
					redeemableChildren.redeemChildren()
				}
				if redeemable, ok := v.(interface{ redeem() }); ok {
					redeemable.redeem()
				}
				s.validators[idx] = nil // prevents further (unsafe) usage
			}

			continue
		}

		result.Merge(v.Validate(d))
		if s.Options.recycleValidators {
			s.validators[idx] = nil // prevents further (unsafe) usage
		}
		result.Inc()
	}
	result.Inc()

	return result
}

func (s *SchemaValidator) typeValidator() valueValidator {
	return newTypeValidator(
		s.Path,
		s.in,
		s.Schema.Type,
		s.Schema.Nullable,
		s.Schema.Format,
		s.Options,
	)
}

func (s *SchemaValidator) commonValidator() valueValidator {
	return newBasicCommonValidator(
		s.Path,
		s.in,
		s.Schema.Default,
		s.Schema.Enum,
		s.Options,
	)
}

func (s *SchemaValidator) sliceValidator() valueValidator {
	return newSliceValidator(
		s.Path,
		s.in,
		s.Schema.MaxItems,
		s.Schema.MinItems,
		s.Schema.UniqueItems,
		s.Schema.AdditionalItems,
		s.Schema.Items,
		s.Root,
		s.KnownFormats,
		s.Options,
	)
}

func (s *SchemaValidator) numberValidator() valueValidator {
	return newNumberValidator(
		s.Path,
		s.in,
		s.Schema.Default,
		s.Schema.MultipleOf,
		s.Schema.Maximum,
		s.Schema.ExclusiveMaximum,
		s.Schema.Minimum,
		s.Schema.ExclusiveMinimum,
		"",
		"",
		s.Options,
	)
}

func (s *SchemaValidator) stringValidator() valueValidator {
	return newStringValidator(
		s.Path,
		s.in,
		nil,
		false,
		false,
		s.Schema.MaxLength,
		s.Schema.MinLength,
		s.Schema.Pattern,
		s.Options,
	)
}

func (s *SchemaValidator) formatValidator() valueValidator {
	return newFormatValidator(
		s.Path,
		s.in,
		s.Schema.Format,
		s.KnownFormats,
		s.Options,
	)
}

func (s *SchemaValidator) schemaPropsValidator() valueValidator {
	sch := s.Schema
	return newSchemaPropsValidator(
		s.Path, s.in, sch.AllOf, sch.OneOf, sch.AnyOf, sch.Not, sch.Dependencies, s.Root, s.KnownFormats,
		s.Options,
	)
}

func (s *SchemaValidator) objectValidator() valueValidator {
	return newObjectValidator(
		s.Path,
		s.in,
		s.Schema.MaxProperties,
		s.Schema.MinProperties,
		s.Schema.Required,
		s.Schema.Properties,
		s.Schema.AdditionalProperties,
		s.Schema.PatternProperties,
		s.Root,
		s.KnownFormats,
		s.Options,
	)
}

func (s *SchemaValidator) redeem() {
	pools.poolOfSchemaValidators.RedeemValidator(s)
}

func (s *SchemaValidator) redeemChildren() {
	for i, validator := range s.validators {
		if validator == nil {
			continue
		}
		if redeemableChildren, ok := validator.(interface{ redeemChildren() }); ok {
			redeemableChildren.redeemChildren()
		}
		if redeemable, ok := validator.(interface{ redeem() }); ok {
			redeemable.redeem()
		}
		s.validators[i] = nil // free up allocated children if not in pool
	}
}
