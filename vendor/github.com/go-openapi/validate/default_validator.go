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
	"strings"

	"github.com/go-openapi/spec"
)

// defaultValidator validates default values in a spec.
// According to Swagger spec, default values MUST validate their schema.
type defaultValidator struct {
	SpecValidator  *SpecValidator
	visitedSchemas map[string]struct{}
	schemaOptions  *SchemaValidatorOptions
}

// resetVisited resets the internal state of visited schemas
func (d *defaultValidator) resetVisited() {
	if d.visitedSchemas == nil {
		d.visitedSchemas = make(map[string]struct{})

		return
	}

	// TODO(go1.21): clear(ex.visitedSchemas)
	for k := range d.visitedSchemas {
		delete(d.visitedSchemas, k)
	}
}

func isVisited(path string, visitedSchemas map[string]struct{}) bool {
	_, found := visitedSchemas[path]
	if found {
		return true
	}

	// search for overlapping paths
	var (
		parent string
		suffix string
	)
	for i := len(path) - 2; i >= 0; i-- {
		r := path[i]
		if r != '.' {
			continue
		}

		parent = path[0:i]
		suffix = path[i+1:]

		if strings.HasSuffix(parent, suffix) {
			return true
		}
	}

	return false
}

// beingVisited asserts a schema is being visited
func (d *defaultValidator) beingVisited(path string) {
	d.visitedSchemas[path] = struct{}{}
}

// isVisited tells if a path has already been visited
func (d *defaultValidator) isVisited(path string) bool {
	return isVisited(path, d.visitedSchemas)
}

// Validate validates the default values declared in the swagger spec
func (d *defaultValidator) Validate() *Result {
	errs := pools.poolOfResults.BorrowResult() // will redeem when merged

	if d == nil || d.SpecValidator == nil {
		return errs
	}
	d.resetVisited()
	errs.Merge(d.validateDefaultValueValidAgainstSchema()) // error -
	return errs
}

func (d *defaultValidator) validateDefaultValueValidAgainstSchema() *Result {
	// every default value that is specified must validate against the schema for that property
	// headers, items, parameters, schema

	res := pools.poolOfResults.BorrowResult() // will redeem when merged
	s := d.SpecValidator

	for method, pathItem := range s.expandedAnalyzer().Operations() {
		for path, op := range pathItem {
			// parameters
			for _, param := range paramHelp.safeExpandedParamsFor(path, method, op.ID, res, s) {
				if param.Default != nil && param.Required {
					res.AddWarnings(requiredHasDefaultMsg(param.Name, param.In))
				}

				// reset explored schemas to get depth-first recursive-proof exploration
				d.resetVisited()

				// Check simple parameters first
				// default values provided must validate against their inline definition (no explicit schema)
				if param.Default != nil && param.Schema == nil {
					// check param default value is valid
					red := newParamValidator(&param, s.KnownFormats, d.schemaOptions).Validate(param.Default) //#nosec
					if red.HasErrorsOrWarnings() {
						res.AddErrors(defaultValueDoesNotValidateMsg(param.Name, param.In))
						res.Merge(red)
					} else if red.wantsRedeemOnMerge {
						pools.poolOfResults.RedeemResult(red)
					}
				}

				// Recursively follows Items and Schemas
				if param.Items != nil {
					red := d.validateDefaultValueItemsAgainstSchema(param.Name, param.In, &param, param.Items) //#nosec
					if red.HasErrorsOrWarnings() {
						res.AddErrors(defaultValueItemsDoesNotValidateMsg(param.Name, param.In))
						res.Merge(red)
					} else if red.wantsRedeemOnMerge {
						pools.poolOfResults.RedeemResult(red)
					}
				}

				if param.Schema != nil {
					// Validate default value against schema
					red := d.validateDefaultValueSchemaAgainstSchema(param.Name, param.In, param.Schema)
					if red.HasErrorsOrWarnings() {
						res.AddErrors(defaultValueDoesNotValidateMsg(param.Name, param.In))
						res.Merge(red)
					} else if red.wantsRedeemOnMerge {
						pools.poolOfResults.RedeemResult(red)
					}
				}
			}

			if op.Responses != nil {
				if op.Responses.Default != nil {
					// Same constraint on default Response
					res.Merge(d.validateDefaultInResponse(op.Responses.Default, jsonDefault, path, 0, op.ID))
				}
				// Same constraint on regular Responses
				if op.Responses.StatusCodeResponses != nil { // Safeguard
					for code, r := range op.Responses.StatusCodeResponses {
						res.Merge(d.validateDefaultInResponse(&r, "response", path, code, op.ID)) //#nosec
					}
				}
			} else if op.ID != "" {
				// Empty op.ID means there is no meaningful operation: no need to report a specific message
				res.AddErrors(noValidResponseMsg(op.ID))
			}
		}
	}
	if s.spec.Spec().Definitions != nil { // Safeguard
		// reset explored schemas to get depth-first recursive-proof exploration
		d.resetVisited()
		for nm, sch := range s.spec.Spec().Definitions {
			res.Merge(d.validateDefaultValueSchemaAgainstSchema("definitions."+nm, "body", &sch)) //#nosec
		}
	}
	return res
}

func (d *defaultValidator) validateDefaultInResponse(resp *spec.Response, responseType, path string, responseCode int, operationID string) *Result {
	s := d.SpecValidator

	response, res := responseHelp.expandResponseRef(resp, path, s)
	if !res.IsValid() {
		return res
	}

	responseName, responseCodeAsStr := responseHelp.responseMsgVariants(responseType, responseCode)

	if response.Headers != nil { // Safeguard
		for nm, h := range response.Headers {
			// reset explored schemas to get depth-first recursive-proof exploration
			d.resetVisited()

			if h.Default != nil {
				red := newHeaderValidator(nm, &h, s.KnownFormats, d.schemaOptions).Validate(h.Default) //#nosec
				if red.HasErrorsOrWarnings() {
					res.AddErrors(defaultValueHeaderDoesNotValidateMsg(operationID, nm, responseName))
					res.Merge(red)
				} else if red.wantsRedeemOnMerge {
					pools.poolOfResults.RedeemResult(red)
				}
			}

			// Headers have inline definition, like params
			if h.Items != nil {
				red := d.validateDefaultValueItemsAgainstSchema(nm, "header", &h, h.Items) //#nosec
				if red.HasErrorsOrWarnings() {
					res.AddErrors(defaultValueHeaderItemsDoesNotValidateMsg(operationID, nm, responseName))
					res.Merge(red)
				} else if red.wantsRedeemOnMerge {
					pools.poolOfResults.RedeemResult(red)
				}
			}

			if _, err := compileRegexp(h.Pattern); err != nil {
				res.AddErrors(invalidPatternInHeaderMsg(operationID, nm, responseName, h.Pattern, err))
			}

			// Headers don't have schema
		}
	}
	if response.Schema != nil {
		// reset explored schemas to get depth-first recursive-proof exploration
		d.resetVisited()

		red := d.validateDefaultValueSchemaAgainstSchema(responseCodeAsStr, "response", response.Schema)
		if red.HasErrorsOrWarnings() {
			// Additional message to make sure the context of the error is not lost
			res.AddErrors(defaultValueInDoesNotValidateMsg(operationID, responseName))
			res.Merge(red)
		} else if red.wantsRedeemOnMerge {
			pools.poolOfResults.RedeemResult(red)
		}
	}
	return res
}

func (d *defaultValidator) validateDefaultValueSchemaAgainstSchema(path, in string, schema *spec.Schema) *Result {
	if schema == nil || d.isVisited(path) {
		// Avoids recursing if we are already done with that check
		return nil
	}
	d.beingVisited(path)
	res := pools.poolOfResults.BorrowResult()
	s := d.SpecValidator

	if schema.Default != nil {
		res.Merge(
			newSchemaValidator(schema, s.spec.Spec(), path+".default", s.KnownFormats, d.schemaOptions).Validate(schema.Default),
		)
	}
	if schema.Items != nil {
		if schema.Items.Schema != nil {
			res.Merge(d.validateDefaultValueSchemaAgainstSchema(path+".items.default", in, schema.Items.Schema))
		}
		// Multiple schemas in items
		if schema.Items.Schemas != nil { // Safeguard
			for i, sch := range schema.Items.Schemas {
				res.Merge(d.validateDefaultValueSchemaAgainstSchema(fmt.Sprintf("%s.items[%d].default", path, i), in, &sch)) //#nosec
			}
		}
	}
	if _, err := compileRegexp(schema.Pattern); err != nil {
		res.AddErrors(invalidPatternInMsg(path, in, schema.Pattern))
	}
	if schema.AdditionalItems != nil && schema.AdditionalItems.Schema != nil {
		// NOTE: we keep validating values, even though additionalItems is not supported by Swagger 2.0 (and 3.0 as well)
		res.Merge(d.validateDefaultValueSchemaAgainstSchema(path+".additionalItems", in, schema.AdditionalItems.Schema))
	}
	for propName, prop := range schema.Properties {
		res.Merge(d.validateDefaultValueSchemaAgainstSchema(path+"."+propName, in, &prop)) //#nosec
	}
	for propName, prop := range schema.PatternProperties {
		res.Merge(d.validateDefaultValueSchemaAgainstSchema(path+"."+propName, in, &prop)) //#nosec
	}
	if schema.AdditionalProperties != nil && schema.AdditionalProperties.Schema != nil {
		res.Merge(d.validateDefaultValueSchemaAgainstSchema(path+".additionalProperties", in, schema.AdditionalProperties.Schema))
	}
	if schema.AllOf != nil {
		for i, aoSch := range schema.AllOf {
			res.Merge(d.validateDefaultValueSchemaAgainstSchema(fmt.Sprintf("%s.allOf[%d]", path, i), in, &aoSch)) //#nosec
		}
	}
	return res
}

// TODO: Temporary duplicated code. Need to refactor with examples

func (d *defaultValidator) validateDefaultValueItemsAgainstSchema(path, in string, root interface{}, items *spec.Items) *Result {
	res := pools.poolOfResults.BorrowResult()
	s := d.SpecValidator
	if items != nil {
		if items.Default != nil {
			res.Merge(
				newItemsValidator(path, in, items, root, s.KnownFormats, d.schemaOptions).Validate(0, items.Default),
			)
		}
		if items.Items != nil {
			res.Merge(d.validateDefaultValueItemsAgainstSchema(path+"[0].default", in, root, items.Items))
		}
		if _, err := compileRegexp(items.Pattern); err != nil {
			res.AddErrors(invalidPatternInMsg(path, in, items.Pattern))
		}
	}
	return res
}
