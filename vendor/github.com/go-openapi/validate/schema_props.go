// Copyright 2015 go-swagger maintainers
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package validate

import (
	"fmt"
	"reflect"

	"github.com/go-openapi/spec"
	"github.com/go-openapi/strfmt"
)

type schemaPropsValidator struct {
	Path            string
	In              string
	AllOf           []spec.Schema
	OneOf           []spec.Schema
	AnyOf           []spec.Schema
	Not             *spec.Schema
	Dependencies    spec.Dependencies
	anyOfValidators []*SchemaValidator
	allOfValidators []*SchemaValidator
	oneOfValidators []*SchemaValidator
	notValidator    *SchemaValidator
	Root            interface{}
	KnownFormats    strfmt.Registry
	Options         *SchemaValidatorOptions
}

func (s *schemaPropsValidator) SetPath(path string) {
	s.Path = path
}

func newSchemaPropsValidator(
	path string, in string, allOf, oneOf, anyOf []spec.Schema, not *spec.Schema, deps spec.Dependencies, root interface{}, formats strfmt.Registry,
	opts *SchemaValidatorOptions) *schemaPropsValidator {
	if opts == nil {
		opts = new(SchemaValidatorOptions)
	}

	anyValidators := make([]*SchemaValidator, 0, len(anyOf))
	for i := range anyOf {
		anyValidators = append(anyValidators, newSchemaValidator(&anyOf[i], root, path, formats, opts))
	}
	allValidators := make([]*SchemaValidator, 0, len(allOf))
	for i := range allOf {
		allValidators = append(allValidators, newSchemaValidator(&allOf[i], root, path, formats, opts))
	}
	oneValidators := make([]*SchemaValidator, 0, len(oneOf))
	for i := range oneOf {
		oneValidators = append(oneValidators, newSchemaValidator(&oneOf[i], root, path, formats, opts))
	}

	var notValidator *SchemaValidator
	if not != nil {
		notValidator = newSchemaValidator(not, root, path, formats, opts)
	}

	var s *schemaPropsValidator
	if opts.recycleValidators {
		s = pools.poolOfSchemaPropsValidators.BorrowValidator()
	} else {
		s = new(schemaPropsValidator)
	}

	s.Path = path
	s.In = in
	s.AllOf = allOf
	s.OneOf = oneOf
	s.AnyOf = anyOf
	s.Not = not
	s.Dependencies = deps
	s.anyOfValidators = anyValidators
	s.allOfValidators = allValidators
	s.oneOfValidators = oneValidators
	s.notValidator = notValidator
	s.Root = root
	s.KnownFormats = formats
	s.Options = opts

	return s
}

func (s *schemaPropsValidator) Applies(source interface{}, _ reflect.Kind) bool {
	_, isSchema := source.(*spec.Schema)
	return isSchema
}

func (s *schemaPropsValidator) Validate(data interface{}) *Result {
	var mainResult *Result
	if s.Options.recycleResult {
		mainResult = pools.poolOfResults.BorrowResult()
	} else {
		mainResult = new(Result)
	}

	// Intermediary error results

	// IMPORTANT! messages from underlying validators
	var keepResultAnyOf, keepResultOneOf, keepResultAllOf *Result

	if s.Options.recycleValidators {
		defer func() {
			s.redeemChildren()
			s.redeem()

			// results are redeemed when merged
		}()
	}

	if len(s.anyOfValidators) > 0 {
		keepResultAnyOf = pools.poolOfResults.BorrowResult()
		s.validateAnyOf(data, mainResult, keepResultAnyOf)
	}

	if len(s.oneOfValidators) > 0 {
		keepResultOneOf = pools.poolOfResults.BorrowResult()
		s.validateOneOf(data, mainResult, keepResultOneOf)
	}

	if len(s.allOfValidators) > 0 {
		keepResultAllOf = pools.poolOfResults.BorrowResult()
		s.validateAllOf(data, mainResult, keepResultAllOf)
	}

	if s.notValidator != nil {
		s.validateNot(data, mainResult)
	}

	if s.Dependencies != nil && len(s.Dependencies) > 0 && reflect.TypeOf(data).Kind() == reflect.Map {
		s.validateDependencies(data, mainResult)
	}

	mainResult.Inc()

	// In the end we retain best failures for schema validation
	// plus, if any, composite errors which may explain special cases (tagged as IMPORTANT!).
	return mainResult.Merge(keepResultAllOf, keepResultOneOf, keepResultAnyOf)
}

func (s *schemaPropsValidator) validateAnyOf(data interface{}, mainResult, keepResultAnyOf *Result) {
	// Validates at least one in anyOf schemas
	var bestFailures *Result

	for i, anyOfSchema := range s.anyOfValidators {
		result := anyOfSchema.Validate(data)
		if s.Options.recycleValidators {
			s.anyOfValidators[i] = nil
		}
		// We keep inner IMPORTANT! errors no matter what MatchCount tells us
		keepResultAnyOf.Merge(result.keepRelevantErrors()) // merges (and redeems) a new instance of Result

		if result.IsValid() {
			if bestFailures != nil && bestFailures.wantsRedeemOnMerge {
				pools.poolOfResults.RedeemResult(bestFailures)
			}

			_ = keepResultAnyOf.cleared()
			mainResult.Merge(result)

			return
		}

		// MatchCount is used to select errors from the schema with most positive checks
		if bestFailures == nil || result.MatchCount > bestFailures.MatchCount {
			if bestFailures != nil && bestFailures.wantsRedeemOnMerge {
				pools.poolOfResults.RedeemResult(bestFailures)
			}
			bestFailures = result

			continue
		}

		if result.wantsRedeemOnMerge {
			pools.poolOfResults.RedeemResult(result) // this result is ditched
		}
	}

	mainResult.AddErrors(mustValidateAtLeastOneSchemaMsg(s.Path))
	mainResult.Merge(bestFailures)
}

func (s *schemaPropsValidator) validateOneOf(data interface{}, mainResult, keepResultOneOf *Result) {
	// Validates exactly one in oneOf schemas
	var (
		firstSuccess, bestFailures *Result
		validated                  int
	)

	for i, oneOfSchema := range s.oneOfValidators {
		result := oneOfSchema.Validate(data)
		if s.Options.recycleValidators {
			s.oneOfValidators[i] = nil
		}

		// We keep inner IMPORTANT! errors no matter what MatchCount tells us
		keepResultOneOf.Merge(result.keepRelevantErrors()) // merges (and redeems) a new instance of Result

		if result.IsValid() {
			validated++
			_ = keepResultOneOf.cleared()

			if firstSuccess == nil {
				firstSuccess = result
			} else if result.wantsRedeemOnMerge {
				pools.poolOfResults.RedeemResult(result) // this result is ditched
			}

			continue
		}

		// MatchCount is used to select errors from the schema with most positive checks
		if validated == 0 && (bestFailures == nil || result.MatchCount > bestFailures.MatchCount) {
			if bestFailures != nil && bestFailures.wantsRedeemOnMerge {
				pools.poolOfResults.RedeemResult(bestFailures)
			}
			bestFailures = result
		} else if result.wantsRedeemOnMerge {
			pools.poolOfResults.RedeemResult(result) // this result is ditched
		}
	}

	switch validated {
	case 0:
		mainResult.AddErrors(mustValidateOnlyOneSchemaMsg(s.Path, "Found none valid"))
		mainResult.Merge(bestFailures)
		// firstSucess necessarily nil
	case 1:
		mainResult.Merge(firstSuccess)
		if bestFailures != nil && bestFailures.wantsRedeemOnMerge {
			pools.poolOfResults.RedeemResult(bestFailures)
		}
	default:
		mainResult.AddErrors(mustValidateOnlyOneSchemaMsg(s.Path, fmt.Sprintf("Found %d valid alternatives", validated)))
		mainResult.Merge(bestFailures)
		if firstSuccess != nil && firstSuccess.wantsRedeemOnMerge {
			pools.poolOfResults.RedeemResult(firstSuccess)
		}
	}
}

func (s *schemaPropsValidator) validateAllOf(data interface{}, mainResult, keepResultAllOf *Result) {
	// Validates all of allOf schemas
	var validated int

	for i, allOfSchema := range s.allOfValidators {
		result := allOfSchema.Validate(data)
		if s.Options.recycleValidators {
			s.allOfValidators[i] = nil
		}
		// We keep inner IMPORTANT! errors no matter what MatchCount tells us
		keepResultAllOf.Merge(result.keepRelevantErrors())
		if result.IsValid() {
			validated++
		}
		mainResult.Merge(result)
	}

	switch validated {
	case 0:
		mainResult.AddErrors(mustValidateAllSchemasMsg(s.Path, ". None validated"))
	case len(s.allOfValidators):
	default:
		mainResult.AddErrors(mustValidateAllSchemasMsg(s.Path, ""))
	}
}

func (s *schemaPropsValidator) validateNot(data interface{}, mainResult *Result) {
	result := s.notValidator.Validate(data)
	if s.Options.recycleValidators {
		s.notValidator = nil
	}
	// We keep inner IMPORTANT! errors no matter what MatchCount tells us
	if result.IsValid() {
		mainResult.AddErrors(mustNotValidatechemaMsg(s.Path))
	}
	if result.wantsRedeemOnMerge {
		pools.poolOfResults.RedeemResult(result) // this result is ditched
	}
}

func (s *schemaPropsValidator) validateDependencies(data interface{}, mainResult *Result) {
	val := data.(map[string]interface{})
	for key := range val {
		dep, ok := s.Dependencies[key]
		if !ok {
			continue
		}

		if dep.Schema != nil {
			mainResult.Merge(
				newSchemaValidator(dep.Schema, s.Root, s.Path+"."+key, s.KnownFormats, s.Options).Validate(data),
			)
			continue
		}

		if len(dep.Property) > 0 {
			for _, depKey := range dep.Property {
				if _, ok := val[depKey]; !ok {
					mainResult.AddErrors(hasADependencyMsg(s.Path, depKey))
				}
			}
		}
	}
}

func (s *schemaPropsValidator) redeem() {
	pools.poolOfSchemaPropsValidators.RedeemValidator(s)
}

func (s *schemaPropsValidator) redeemChildren() {
	for _, v := range s.anyOfValidators {
		if v == nil {
			continue
		}
		v.redeemChildren()
		v.redeem()
	}
	s.anyOfValidators = nil

	for _, v := range s.allOfValidators {
		if v == nil {
			continue
		}
		v.redeemChildren()
		v.redeem()
	}
	s.allOfValidators = nil

	for _, v := range s.oneOfValidators {
		if v == nil {
			continue
		}
		v.redeemChildren()
		v.redeem()
	}
	s.oneOfValidators = nil

	if s.notValidator != nil {
		s.notValidator.redeemChildren()
		s.notValidator.redeem()
		s.notValidator = nil
	}
}
