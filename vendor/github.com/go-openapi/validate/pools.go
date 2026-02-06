// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

//go:build !validatedebug

package validate

import (
	"sync"

	"github.com/go-openapi/spec"
)

var pools allPools

func init() {
	resetPools()
}

func resetPools() {
	// NOTE: for testing purpose, we might want to reset pools after calling Validate twice.
	// The pool is corrupted in that case: calling Put twice inserts a duplicate in the pool
	// and further calls to Get are mishandled.

	pools = allPools{
		poolOfSchemaValidators: schemaValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &SchemaValidator{}

					return s
				},
			},
		},
		poolOfObjectValidators: objectValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &objectValidator{}

					return s
				},
			},
		},
		poolOfSliceValidators: sliceValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &schemaSliceValidator{}

					return s
				},
			},
		},
		poolOfItemsValidators: itemsValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &itemsValidator{}

					return s
				},
			},
		},
		poolOfBasicCommonValidators: basicCommonValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &basicCommonValidator{}

					return s
				},
			},
		},
		poolOfHeaderValidators: headerValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &HeaderValidator{}

					return s
				},
			},
		},
		poolOfParamValidators: paramValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &ParamValidator{}

					return s
				},
			},
		},
		poolOfBasicSliceValidators: basicSliceValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &basicSliceValidator{}

					return s
				},
			},
		},
		poolOfNumberValidators: numberValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &numberValidator{}

					return s
				},
			},
		},
		poolOfStringValidators: stringValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &stringValidator{}

					return s
				},
			},
		},
		poolOfSchemaPropsValidators: schemaPropsValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &schemaPropsValidator{}

					return s
				},
			},
		},
		poolOfFormatValidators: formatValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &formatValidator{}

					return s
				},
			},
		},
		poolOfTypeValidators: typeValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &typeValidator{}

					return s
				},
			},
		},
		poolOfSchemas: schemasPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &spec.Schema{}

					return s
				},
			},
		},
		poolOfResults: resultsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &Result{}

					return s
				},
			},
		},
	}
}

type (
	allPools struct {
		// memory pools for all validator objects.
		//
		// Each pool can be borrowed from and redeemed to.
		poolOfSchemaValidators      schemaValidatorsPool
		poolOfObjectValidators      objectValidatorsPool
		poolOfSliceValidators       sliceValidatorsPool
		poolOfItemsValidators       itemsValidatorsPool
		poolOfBasicCommonValidators basicCommonValidatorsPool
		poolOfHeaderValidators      headerValidatorsPool
		poolOfParamValidators       paramValidatorsPool
		poolOfBasicSliceValidators  basicSliceValidatorsPool
		poolOfNumberValidators      numberValidatorsPool
		poolOfStringValidators      stringValidatorsPool
		poolOfSchemaPropsValidators schemaPropsValidatorsPool
		poolOfFormatValidators      formatValidatorsPool
		poolOfTypeValidators        typeValidatorsPool
		poolOfSchemas               schemasPool
		poolOfResults               resultsPool
	}

	schemaValidatorsPool struct {
		*sync.Pool
	}

	objectValidatorsPool struct {
		*sync.Pool
	}

	sliceValidatorsPool struct {
		*sync.Pool
	}

	itemsValidatorsPool struct {
		*sync.Pool
	}

	basicCommonValidatorsPool struct {
		*sync.Pool
	}

	headerValidatorsPool struct {
		*sync.Pool
	}

	paramValidatorsPool struct {
		*sync.Pool
	}

	basicSliceValidatorsPool struct {
		*sync.Pool
	}

	numberValidatorsPool struct {
		*sync.Pool
	}

	stringValidatorsPool struct {
		*sync.Pool
	}

	schemaPropsValidatorsPool struct {
		*sync.Pool
	}

	formatValidatorsPool struct {
		*sync.Pool
	}

	typeValidatorsPool struct {
		*sync.Pool
	}

	schemasPool struct {
		*sync.Pool
	}

	resultsPool struct {
		*sync.Pool
	}
)

func (p schemaValidatorsPool) BorrowValidator() *SchemaValidator {
	return p.Get().(*SchemaValidator)
}

func (p schemaValidatorsPool) RedeemValidator(s *SchemaValidator) {
	// NOTE: s might be nil. In that case, Put is a noop.
	p.Put(s)
}

func (p objectValidatorsPool) BorrowValidator() *objectValidator {
	return p.Get().(*objectValidator)
}

func (p objectValidatorsPool) RedeemValidator(s *objectValidator) {
	p.Put(s)
}

func (p sliceValidatorsPool) BorrowValidator() *schemaSliceValidator {
	return p.Get().(*schemaSliceValidator)
}

func (p sliceValidatorsPool) RedeemValidator(s *schemaSliceValidator) {
	p.Put(s)
}

func (p itemsValidatorsPool) BorrowValidator() *itemsValidator {
	return p.Get().(*itemsValidator)
}

func (p itemsValidatorsPool) RedeemValidator(s *itemsValidator) {
	p.Put(s)
}

func (p basicCommonValidatorsPool) BorrowValidator() *basicCommonValidator {
	return p.Get().(*basicCommonValidator)
}

func (p basicCommonValidatorsPool) RedeemValidator(s *basicCommonValidator) {
	p.Put(s)
}

func (p headerValidatorsPool) BorrowValidator() *HeaderValidator {
	return p.Get().(*HeaderValidator)
}

func (p headerValidatorsPool) RedeemValidator(s *HeaderValidator) {
	p.Put(s)
}

func (p paramValidatorsPool) BorrowValidator() *ParamValidator {
	return p.Get().(*ParamValidator)
}

func (p paramValidatorsPool) RedeemValidator(s *ParamValidator) {
	p.Put(s)
}

func (p basicSliceValidatorsPool) BorrowValidator() *basicSliceValidator {
	return p.Get().(*basicSliceValidator)
}

func (p basicSliceValidatorsPool) RedeemValidator(s *basicSliceValidator) {
	p.Put(s)
}

func (p numberValidatorsPool) BorrowValidator() *numberValidator {
	return p.Get().(*numberValidator)
}

func (p numberValidatorsPool) RedeemValidator(s *numberValidator) {
	p.Put(s)
}

func (p stringValidatorsPool) BorrowValidator() *stringValidator {
	return p.Get().(*stringValidator)
}

func (p stringValidatorsPool) RedeemValidator(s *stringValidator) {
	p.Put(s)
}

func (p schemaPropsValidatorsPool) BorrowValidator() *schemaPropsValidator {
	return p.Get().(*schemaPropsValidator)
}

func (p schemaPropsValidatorsPool) RedeemValidator(s *schemaPropsValidator) {
	p.Put(s)
}

func (p formatValidatorsPool) BorrowValidator() *formatValidator {
	return p.Get().(*formatValidator)
}

func (p formatValidatorsPool) RedeemValidator(s *formatValidator) {
	p.Put(s)
}

func (p typeValidatorsPool) BorrowValidator() *typeValidator {
	return p.Get().(*typeValidator)
}

func (p typeValidatorsPool) RedeemValidator(s *typeValidator) {
	p.Put(s)
}

func (p schemasPool) BorrowSchema() *spec.Schema {
	return p.Get().(*spec.Schema)
}

func (p schemasPool) RedeemSchema(s *spec.Schema) {
	p.Put(s)
}

func (p resultsPool) BorrowResult() *Result {
	return p.Get().(*Result).cleared()
}

func (p resultsPool) RedeemResult(s *Result) {
	if s == emptyResult {
		return
	}
	p.Put(s)
}
