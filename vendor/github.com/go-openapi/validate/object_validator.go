// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package validate

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/go-openapi/errors"
	"github.com/go-openapi/spec"
	"github.com/go-openapi/strfmt"
)

type objectValidator struct {
	Path                 string
	In                   string
	MaxProperties        *int64
	MinProperties        *int64
	Required             []string
	Properties           map[string]spec.Schema
	AdditionalProperties *spec.SchemaOrBool
	PatternProperties    map[string]spec.Schema
	Root                 any
	KnownFormats         strfmt.Registry
	Options              *SchemaValidatorOptions
	splitPath            []string
}

func newObjectValidator(path, in string,
	maxProperties, minProperties *int64, required []string, properties spec.SchemaProperties,
	additionalProperties *spec.SchemaOrBool, patternProperties spec.SchemaProperties,
	root any, formats strfmt.Registry, opts *SchemaValidatorOptions) *objectValidator {
	if opts == nil {
		opts = new(SchemaValidatorOptions)
	}

	var v *objectValidator
	if opts.recycleValidators {
		v = pools.poolOfObjectValidators.BorrowValidator()
	} else {
		v = new(objectValidator)
	}

	v.Path = path
	v.In = in
	v.MaxProperties = maxProperties
	v.MinProperties = minProperties
	v.Required = required
	v.Properties = properties
	v.AdditionalProperties = additionalProperties
	v.PatternProperties = patternProperties
	v.Root = root
	v.KnownFormats = formats
	v.Options = opts
	v.splitPath = strings.Split(v.Path, ".")

	return v
}

func (o *objectValidator) Validate(data any) *Result {
	if o.Options.recycleValidators {
		defer func() {
			o.redeem()
		}()
	}

	var val map[string]any
	if data != nil {
		var ok bool
		val, ok = data.(map[string]any)
		if !ok {
			return errorHelp.sErr(invalidObjectMsg(o.Path, o.In), o.Options.recycleResult)
		}
	}
	numKeys := int64(len(val))

	if o.MinProperties != nil && numKeys < *o.MinProperties {
		return errorHelp.sErr(errors.TooFewProperties(o.Path, o.In, *o.MinProperties), o.Options.recycleResult)
	}
	if o.MaxProperties != nil && numKeys > *o.MaxProperties {
		return errorHelp.sErr(errors.TooManyProperties(o.Path, o.In, *o.MaxProperties), o.Options.recycleResult)
	}

	var res *Result
	if o.Options.recycleResult {
		res = pools.poolOfResults.BorrowResult()
	} else {
		res = new(Result)
	}

	o.precheck(res, val)

	// check validity of field names
	if o.AdditionalProperties != nil && !o.AdditionalProperties.Allows {
		// Case: additionalProperties: false
		o.validateNoAdditionalProperties(val, res)
	} else {
		// Cases: empty additionalProperties (implying: true), or additionalProperties: true, or additionalProperties: { <<schema>> }
		o.validateAdditionalProperties(val, res)
	}

	o.validatePropertiesSchema(val, res)

	// Check patternProperties
	// TODO: it looks like we have done that twice in many cases
	for key, value := range val {
		_, regularProperty := o.Properties[key]
		matched, _, patterns := o.validatePatternProperty(key, value, res) // applies to regular properties as well
		if regularProperty || !matched {
			continue
		}

		for _, pName := range patterns {
			if v, ok := o.PatternProperties[pName]; ok {
				r := newSchemaValidator(&v, o.Root, o.Path+"."+key, o.KnownFormats, o.Options).Validate(value)
				res.mergeForField(data.(map[string]any), key, r)
			}
		}
	}

	return res
}

func (o *objectValidator) SetPath(path string) {
	o.Path = path
	o.splitPath = strings.Split(path, ".")
}

func (o *objectValidator) Applies(source any, kind reflect.Kind) bool {
	// TODO: this should also work for structs
	// there is a problem in the type validator where it will be unhappy about null values
	// so that requires more testing
	_, isSchema := source.(*spec.Schema)
	return isSchema && (kind == reflect.Map || kind == reflect.Struct)
}

func (o *objectValidator) isProperties() bool {
	p := o.splitPath
	return len(p) > 1 && p[len(p)-1] == jsonProperties && p[len(p)-2] != jsonProperties
}

func (o *objectValidator) isDefault() bool {
	p := o.splitPath
	return len(p) > 1 && p[len(p)-1] == jsonDefault && p[len(p)-2] != jsonDefault
}

func (o *objectValidator) isExample() bool {
	p := o.splitPath
	return len(p) > 1 && (p[len(p)-1] == swaggerExample || p[len(p)-1] == swaggerExamples) && p[len(p)-2] != swaggerExample
}

func (o *objectValidator) checkArrayMustHaveItems(res *Result, val map[string]any) {
	// for swagger 2.0 schemas, there is an additional constraint to have array items defined explicitly.
	// with pure jsonschema draft 4, one may have arrays with undefined items (i.e. any type).
	if val == nil {
		return
	}

	t, typeFound := val[jsonType]
	if !typeFound {
		return
	}

	tpe, isString := t.(string)
	if !isString || tpe != arrayType {
		return
	}

	item, itemsKeyFound := val[jsonItems]
	if itemsKeyFound {
		return
	}

	res.AddErrors(errors.Required(jsonItems, o.Path, item))
}

func (o *objectValidator) checkItemsMustBeTypeArray(res *Result, val map[string]any) {
	if val == nil {
		return
	}

	if o.isProperties() || o.isDefault() || o.isExample() {
		return
	}

	_, itemsKeyFound := val[jsonItems]
	if !itemsKeyFound {
		return
	}

	t, typeFound := val[jsonType]
	if !typeFound {
		// there is no type
		res.AddErrors(errors.Required(jsonType, o.Path, t))
	}

	if tpe, isString := t.(string); !isString || tpe != arrayType {
		res.AddErrors(errors.InvalidType(o.Path, o.In, arrayType, nil))
	}
}

func (o *objectValidator) precheck(res *Result, val map[string]any) {
	if o.Options.EnableArrayMustHaveItemsCheck {
		o.checkArrayMustHaveItems(res, val)
	}
	if o.Options.EnableObjectArrayTypeCheck {
		o.checkItemsMustBeTypeArray(res, val)
	}
}

func (o *objectValidator) validateNoAdditionalProperties(val map[string]any, res *Result) {
	for k := range val {
		if k == "$schema" || k == "id" {
			// special properties "$schema" and "id" are ignored
			continue
		}

		_, regularProperty := o.Properties[k]
		if regularProperty {
			continue
		}

		matched := false
		for pk := range o.PatternProperties {
			re, err := compileRegexp(pk)
			if err != nil {
				continue
			}
			if matches := re.MatchString(k); matches {
				matched = true
				break
			}
		}
		if matched {
			continue
		}

		res.AddErrors(errors.PropertyNotAllowed(o.Path, o.In, k))

		// BUG(fredbi): This section should move to a part dedicated to spec validation as
		// it will conflict with regular schemas where a property "headers" is defined.

		//
		// Croaks a more explicit message on top of the standard one
		// on some recognized cases.
		//
		// NOTE: edge cases with invalid type assertion are simply ignored here.
		// NOTE: prefix your messages here by "IMPORTANT!" so there are not filtered
		// by higher level callers (the IMPORTANT! tag will be eventually
		// removed).
		if k != "headers" || val[k] == nil {
			continue
		}

		// $ref is forbidden in header
		headers, mapOk := val[k].(map[string]any)
		if !mapOk {
			continue
		}

		for headerKey, headerBody := range headers {
			if headerBody == nil {
				continue
			}

			headerSchema, mapOfMapOk := headerBody.(map[string]any)
			if !mapOfMapOk {
				continue
			}

			_, found := headerSchema["$ref"]
			if !found {
				continue
			}

			refString, stringOk := headerSchema["$ref"].(string)
			if !stringOk {
				continue
			}

			msg := strings.Join([]string{", one may not use $ref=\":", refString, "\""}, "")
			res.AddErrors(refNotAllowedInHeaderMsg(o.Path, headerKey, msg))
			/*
				case "$ref":
					if val[k] != nil {
						// TODO: check context of that ref: warn about siblings, check against invalid context
					}
			*/
		}
	}
}

func (o *objectValidator) validateAdditionalProperties(val map[string]any, res *Result) {
	for key, value := range val {
		_, regularProperty := o.Properties[key]
		if regularProperty {
			continue
		}

		// Validates property against "patternProperties" if applicable
		// BUG(fredbi): succeededOnce is always false

		// NOTE: how about regular properties which do not match patternProperties?
		matched, succeededOnce, _ := o.validatePatternProperty(key, value, res)
		if matched || succeededOnce {
			continue
		}

		if o.AdditionalProperties == nil || o.AdditionalProperties.Schema == nil {
			continue
		}

		// Cases: properties which are not regular properties and have not been matched by the PatternProperties validator
		// AdditionalProperties as Schema
		r := newSchemaValidator(o.AdditionalProperties.Schema, o.Root, o.Path+"."+key, o.KnownFormats, o.Options).Validate(value)
		res.mergeForField(val, key, r)
	}
	// Valid cases: additionalProperties: true or undefined
}

func (o *objectValidator) validatePropertiesSchema(val map[string]any, res *Result) {
	createdFromDefaults := map[string]struct{}{}

	// Property types:
	// - regular Property
	pSchema := pools.poolOfSchemas.BorrowSchema() // recycle a spec.Schema object which lifespan extends only to the validation of properties
	defer func() {
		pools.poolOfSchemas.RedeemSchema(pSchema)
	}()

	for pName := range o.Properties {
		*pSchema = o.Properties[pName]
		var rName string
		if o.Path == "" {
			rName = pName
		} else {
			rName = o.Path + "." + pName
		}

		// Recursively validates each property against its schema
		v, ok := val[pName]
		if ok {
			r := newSchemaValidator(pSchema, o.Root, rName, o.KnownFormats, o.Options).Validate(v)
			res.mergeForField(val, pName, r)

			continue
		}

		if pSchema.Default != nil {
			// if a default value is defined, creates the property from defaults
			// NOTE: JSON schema does not enforce default values to be valid against schema. Swagger does.
			createdFromDefaults[pName] = struct{}{}
			if !o.Options.skipSchemataResult {
				res.addPropertySchemata(val, pName, pSchema) // this shallow-clones the content of the pSchema pointer
			}
		}
	}

	if len(o.Required) == 0 {
		return
	}

	// Check required properties
	for _, k := range o.Required {
		v, ok := val[k]
		if ok {
			continue
		}
		_, isCreatedFromDefaults := createdFromDefaults[k]
		if isCreatedFromDefaults {
			continue
		}

		res.AddErrors(errors.Required(fmt.Sprintf("%s.%s", o.Path, k), o.In, v))
	}
}

// TODO: succeededOnce is not used anywhere
func (o *objectValidator) validatePatternProperty(key string, value any, result *Result) (bool, bool, []string) {
	if len(o.PatternProperties) == 0 {
		return false, false, nil
	}

	matched := false
	succeededOnce := false
	patterns := make([]string, 0, len(o.PatternProperties))

	schema := pools.poolOfSchemas.BorrowSchema()
	defer func() {
		pools.poolOfSchemas.RedeemSchema(schema)
	}()

	for k := range o.PatternProperties {
		re, err := compileRegexp(k)
		if err != nil {
			continue
		}

		match := re.MatchString(key)
		if !match {
			continue
		}

		*schema = o.PatternProperties[k]
		patterns = append(patterns, k)
		matched = true
		validator := newSchemaValidator(schema, o.Root, fmt.Sprintf("%s.%s", o.Path, key), o.KnownFormats, o.Options)

		res := validator.Validate(value)
		result.Merge(res)
	}

	return matched, succeededOnce, patterns
}

func (o *objectValidator) redeem() {
	pools.poolOfObjectValidators.RedeemValidator(o)
}
