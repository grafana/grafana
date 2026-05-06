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

// SchemaValidatorOptions defines optional rules for schema validation
type SchemaValidatorOptions struct {
	EnableObjectArrayTypeCheck    bool
	EnableArrayMustHaveItemsCheck bool
	recycleValidators             bool
	recycleResult                 bool
	skipSchemataResult            bool
}

// Option sets optional rules for schema validation
type Option func(*SchemaValidatorOptions)

// EnableObjectArrayTypeCheck activates the swagger rule: an items must be in type: array
func EnableObjectArrayTypeCheck(enable bool) Option {
	return func(svo *SchemaValidatorOptions) {
		svo.EnableObjectArrayTypeCheck = enable
	}
}

// EnableArrayMustHaveItemsCheck activates the swagger rule: an array must have items defined
func EnableArrayMustHaveItemsCheck(enable bool) Option {
	return func(svo *SchemaValidatorOptions) {
		svo.EnableArrayMustHaveItemsCheck = enable
	}
}

// SwaggerSchema activates swagger schema validation rules
func SwaggerSchema(enable bool) Option {
	return func(svo *SchemaValidatorOptions) {
		svo.EnableObjectArrayTypeCheck = enable
		svo.EnableArrayMustHaveItemsCheck = enable
	}
}

// WithRecycleValidators saves memory allocations and makes validators
// available for a single use of Validate() only.
//
// When a validator is recycled, called MUST not call the Validate() method twice.
func WithRecycleValidators(enable bool) Option {
	return func(svo *SchemaValidatorOptions) {
		svo.recycleValidators = enable
	}
}

func withRecycleResults(enable bool) Option {
	return func(svo *SchemaValidatorOptions) {
		svo.recycleResult = enable
	}
}

// WithSkipSchemataResult skips the deep audit payload stored in validation Result
func WithSkipSchemataResult(enable bool) Option {
	return func(svo *SchemaValidatorOptions) {
		svo.skipSchemataResult = enable
	}
}

// Options returns the current set of options
func (svo SchemaValidatorOptions) Options() []Option {
	return []Option{
		EnableObjectArrayTypeCheck(svo.EnableObjectArrayTypeCheck),
		EnableArrayMustHaveItemsCheck(svo.EnableArrayMustHaveItemsCheck),
		WithRecycleValidators(svo.recycleValidators),
		withRecycleResults(svo.recycleResult),
		WithSkipSchemataResult(svo.skipSchemataResult),
	}
}
