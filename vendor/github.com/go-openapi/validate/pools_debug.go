// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

//go:build validatedebug

package validate

import (
	"fmt"
	"runtime"
	"sync"
	"testing"

	"github.com/go-openapi/spec"
)

// This version of the pools is to be used for debugging and testing, with build tag "validatedebug".
//
// In this mode, the pools are tracked for allocation and redemption of borrowed objects, so we can
// verify a few behaviors of the validators. The debug pools panic when an invalid usage pattern is detected.

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
			debugMap:  make(map[*SchemaValidator]status),
			allocMap:  make(map[*SchemaValidator]string),
			redeemMap: make(map[*SchemaValidator]string),
		},
		poolOfObjectValidators: objectValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &objectValidator{}

					return s
				},
			},
			debugMap:  make(map[*objectValidator]status),
			allocMap:  make(map[*objectValidator]string),
			redeemMap: make(map[*objectValidator]string),
		},
		poolOfSliceValidators: sliceValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &schemaSliceValidator{}

					return s
				},
			},
			debugMap:  make(map[*schemaSliceValidator]status),
			allocMap:  make(map[*schemaSliceValidator]string),
			redeemMap: make(map[*schemaSliceValidator]string),
		},
		poolOfItemsValidators: itemsValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &itemsValidator{}

					return s
				},
			},
			debugMap:  make(map[*itemsValidator]status),
			allocMap:  make(map[*itemsValidator]string),
			redeemMap: make(map[*itemsValidator]string),
		},
		poolOfBasicCommonValidators: basicCommonValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &basicCommonValidator{}

					return s
				},
			},
			debugMap:  make(map[*basicCommonValidator]status),
			allocMap:  make(map[*basicCommonValidator]string),
			redeemMap: make(map[*basicCommonValidator]string),
		},
		poolOfHeaderValidators: headerValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &HeaderValidator{}

					return s
				},
			},
			debugMap:  make(map[*HeaderValidator]status),
			allocMap:  make(map[*HeaderValidator]string),
			redeemMap: make(map[*HeaderValidator]string),
		},
		poolOfParamValidators: paramValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &ParamValidator{}

					return s
				},
			},
			debugMap:  make(map[*ParamValidator]status),
			allocMap:  make(map[*ParamValidator]string),
			redeemMap: make(map[*ParamValidator]string),
		},
		poolOfBasicSliceValidators: basicSliceValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &basicSliceValidator{}

					return s
				},
			},
			debugMap:  make(map[*basicSliceValidator]status),
			allocMap:  make(map[*basicSliceValidator]string),
			redeemMap: make(map[*basicSliceValidator]string),
		},
		poolOfNumberValidators: numberValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &numberValidator{}

					return s
				},
			},
			debugMap:  make(map[*numberValidator]status),
			allocMap:  make(map[*numberValidator]string),
			redeemMap: make(map[*numberValidator]string),
		},
		poolOfStringValidators: stringValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &stringValidator{}

					return s
				},
			},
			debugMap:  make(map[*stringValidator]status),
			allocMap:  make(map[*stringValidator]string),
			redeemMap: make(map[*stringValidator]string),
		},
		poolOfSchemaPropsValidators: schemaPropsValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &schemaPropsValidator{}

					return s
				},
			},
			debugMap:  make(map[*schemaPropsValidator]status),
			allocMap:  make(map[*schemaPropsValidator]string),
			redeemMap: make(map[*schemaPropsValidator]string),
		},
		poolOfFormatValidators: formatValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &formatValidator{}

					return s
				},
			},
			debugMap:  make(map[*formatValidator]status),
			allocMap:  make(map[*formatValidator]string),
			redeemMap: make(map[*formatValidator]string),
		},
		poolOfTypeValidators: typeValidatorsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &typeValidator{}

					return s
				},
			},
			debugMap:  make(map[*typeValidator]status),
			allocMap:  make(map[*typeValidator]string),
			redeemMap: make(map[*typeValidator]string),
		},
		poolOfSchemas: schemasPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &spec.Schema{}

					return s
				},
			},
			debugMap:  make(map[*spec.Schema]status),
			allocMap:  make(map[*spec.Schema]string),
			redeemMap: make(map[*spec.Schema]string),
		},
		poolOfResults: resultsPool{
			Pool: &sync.Pool{
				New: func() any {
					s := &Result{}

					return s
				},
			},
			debugMap:  make(map[*Result]status),
			allocMap:  make(map[*Result]string),
			redeemMap: make(map[*Result]string),
		},
	}
}

const (
	statusFresh status = iota + 1
	statusRecycled
	statusRedeemed
)

func (s status) String() string {
	switch s {
	case statusFresh:
		return "fresh"
	case statusRecycled:
		return "recycled"
	case statusRedeemed:
		return "redeemed"
	default:
		panic(fmt.Errorf("invalid status: %d", s))
	}
}

type (
	// Debug
	status uint8

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
		debugMap  map[*SchemaValidator]status
		allocMap  map[*SchemaValidator]string
		redeemMap map[*SchemaValidator]string
		mx        sync.Mutex
	}

	objectValidatorsPool struct {
		*sync.Pool
		debugMap  map[*objectValidator]status
		allocMap  map[*objectValidator]string
		redeemMap map[*objectValidator]string
		mx        sync.Mutex
	}

	sliceValidatorsPool struct {
		*sync.Pool
		debugMap  map[*schemaSliceValidator]status
		allocMap  map[*schemaSliceValidator]string
		redeemMap map[*schemaSliceValidator]string
		mx        sync.Mutex
	}

	itemsValidatorsPool struct {
		*sync.Pool
		debugMap  map[*itemsValidator]status
		allocMap  map[*itemsValidator]string
		redeemMap map[*itemsValidator]string
		mx        sync.Mutex
	}

	basicCommonValidatorsPool struct {
		*sync.Pool
		debugMap  map[*basicCommonValidator]status
		allocMap  map[*basicCommonValidator]string
		redeemMap map[*basicCommonValidator]string
		mx        sync.Mutex
	}

	headerValidatorsPool struct {
		*sync.Pool
		debugMap  map[*HeaderValidator]status
		allocMap  map[*HeaderValidator]string
		redeemMap map[*HeaderValidator]string
		mx        sync.Mutex
	}

	paramValidatorsPool struct {
		*sync.Pool
		debugMap  map[*ParamValidator]status
		allocMap  map[*ParamValidator]string
		redeemMap map[*ParamValidator]string
		mx        sync.Mutex
	}

	basicSliceValidatorsPool struct {
		*sync.Pool
		debugMap  map[*basicSliceValidator]status
		allocMap  map[*basicSliceValidator]string
		redeemMap map[*basicSliceValidator]string
		mx        sync.Mutex
	}

	numberValidatorsPool struct {
		*sync.Pool
		debugMap  map[*numberValidator]status
		allocMap  map[*numberValidator]string
		redeemMap map[*numberValidator]string
		mx        sync.Mutex
	}

	stringValidatorsPool struct {
		*sync.Pool
		debugMap  map[*stringValidator]status
		allocMap  map[*stringValidator]string
		redeemMap map[*stringValidator]string
		mx        sync.Mutex
	}

	schemaPropsValidatorsPool struct {
		*sync.Pool
		debugMap  map[*schemaPropsValidator]status
		allocMap  map[*schemaPropsValidator]string
		redeemMap map[*schemaPropsValidator]string
		mx        sync.Mutex
	}

	formatValidatorsPool struct {
		*sync.Pool
		debugMap  map[*formatValidator]status
		allocMap  map[*formatValidator]string
		redeemMap map[*formatValidator]string
		mx        sync.Mutex
	}

	typeValidatorsPool struct {
		*sync.Pool
		debugMap  map[*typeValidator]status
		allocMap  map[*typeValidator]string
		redeemMap map[*typeValidator]string
		mx        sync.Mutex
	}

	schemasPool struct {
		*sync.Pool
		debugMap  map[*spec.Schema]status
		allocMap  map[*spec.Schema]string
		redeemMap map[*spec.Schema]string
		mx        sync.Mutex
	}

	resultsPool struct {
		*sync.Pool
		debugMap  map[*Result]status
		allocMap  map[*Result]string
		redeemMap map[*Result]string
		mx        sync.Mutex
	}
)

func (p *schemaValidatorsPool) BorrowValidator() *SchemaValidator {
	s := p.Get().(*SchemaValidator)

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled schema should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *schemaValidatorsPool) RedeemValidator(s *SchemaValidator) {
	// NOTE: s might be nil. In that case, Put is a noop.
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed schema should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic("redeemed schema should have been allocated from a fresh or recycled pointer")
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *objectValidatorsPool) BorrowValidator() *objectValidator {
	s := p.Get().(*objectValidator)

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled object should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *objectValidatorsPool) RedeemValidator(s *objectValidator) {
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed object should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic("redeemed object should have been allocated from a fresh or recycled pointer")
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *sliceValidatorsPool) BorrowValidator() *schemaSliceValidator {
	s := p.Get().(*schemaSliceValidator)

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled schemaSliceValidator should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *sliceValidatorsPool) RedeemValidator(s *schemaSliceValidator) {
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed schemaSliceValidator should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic("redeemed schemaSliceValidator should have been allocated from a fresh or recycled pointer")
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *itemsValidatorsPool) BorrowValidator() *itemsValidator {
	s := p.Get().(*itemsValidator)

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled itemsValidator should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *itemsValidatorsPool) RedeemValidator(s *itemsValidator) {
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed itemsValidator should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic("redeemed itemsValidator should have been allocated from a fresh or recycled pointer")
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *basicCommonValidatorsPool) BorrowValidator() *basicCommonValidator {
	s := p.Get().(*basicCommonValidator)

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled basicCommonValidator should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *basicCommonValidatorsPool) RedeemValidator(s *basicCommonValidator) {
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed basicCommonValidator should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic("redeemed basicCommonValidator should have been allocated from a fresh or recycled pointer")
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *headerValidatorsPool) BorrowValidator() *HeaderValidator {
	s := p.Get().(*HeaderValidator)

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled HeaderValidator should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *headerValidatorsPool) RedeemValidator(s *HeaderValidator) {
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed header should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic("redeemed header should have been allocated from a fresh or recycled pointer")
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *paramValidatorsPool) BorrowValidator() *ParamValidator {
	s := p.Get().(*ParamValidator)

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled param should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *paramValidatorsPool) RedeemValidator(s *ParamValidator) {
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed param should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic("redeemed param should have been allocated from a fresh or recycled pointer")
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *basicSliceValidatorsPool) BorrowValidator() *basicSliceValidator {
	s := p.Get().(*basicSliceValidator)

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled basicSliceValidator should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *basicSliceValidatorsPool) RedeemValidator(s *basicSliceValidator) {
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed basicSliceValidator should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic("redeemed basicSliceValidator should have been allocated from a fresh or recycled pointer")
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *numberValidatorsPool) BorrowValidator() *numberValidator {
	s := p.Get().(*numberValidator)

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled number should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *numberValidatorsPool) RedeemValidator(s *numberValidator) {
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed number should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic("redeemed number should have been allocated from a fresh or recycled pointer")
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *stringValidatorsPool) BorrowValidator() *stringValidator {
	s := p.Get().(*stringValidator)

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled string should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *stringValidatorsPool) RedeemValidator(s *stringValidator) {
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed string should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic("redeemed string should have been allocated from a fresh or recycled pointer")
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *schemaPropsValidatorsPool) BorrowValidator() *schemaPropsValidator {
	s := p.Get().(*schemaPropsValidator)

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled param should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *schemaPropsValidatorsPool) RedeemValidator(s *schemaPropsValidator) {
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed schemaProps should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic("redeemed schemaProps should have been allocated from a fresh or recycled pointer")
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *formatValidatorsPool) BorrowValidator() *formatValidator {
	s := p.Get().(*formatValidator)

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled format should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *formatValidatorsPool) RedeemValidator(s *formatValidator) {
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed format should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic("redeemed format should have been allocated from a fresh or recycled pointer")
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *typeValidatorsPool) BorrowValidator() *typeValidator {
	s := p.Get().(*typeValidator)

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled type should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *typeValidatorsPool) RedeemValidator(s *typeValidator) {
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed type should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic(fmt.Errorf("redeemed type should have been allocated from a fresh or recycled pointer. Got status %s, already redeamed at: %s", x, p.redeemMap[s]))
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *schemasPool) BorrowSchema() *spec.Schema {
	s := p.Get().(*spec.Schema)

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled spec.Schema should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *schemasPool) RedeemSchema(s *spec.Schema) {
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed spec.Schema should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic("redeemed spec.Schema should have been allocated from a fresh or recycled pointer")
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *resultsPool) BorrowResult() *Result {
	s := p.Get().(*Result).cleared()

	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		p.debugMap[s] = statusFresh
	} else {
		if x != statusRedeemed {
			panic("recycled result should have been redeemed")
		}
		p.debugMap[s] = statusRecycled
	}
	p.allocMap[s] = caller()

	return s
}

func (p *resultsPool) RedeemResult(s *Result) {
	if s == emptyResult {
		if len(s.Errors) > 0 || len(s.Warnings) > 0 {
			panic("empty result should not mutate")
		}
		return
	}
	p.mx.Lock()
	defer p.mx.Unlock()
	x, ok := p.debugMap[s]
	if !ok {
		panic("redeemed Result should have been allocated")
	}
	if x != statusRecycled && x != statusFresh {
		panic("redeemed Result should have been allocated from a fresh or recycled pointer")
	}
	p.debugMap[s] = statusRedeemed
	p.redeemMap[s] = caller()
	p.Put(s)
}

func (p *allPools) allIsRedeemed(t testing.TB) bool {
	outcome := true
	for k, v := range p.poolOfSchemaValidators.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("schemaValidator should be redeemed. Allocated by: %s", p.poolOfSchemaValidators.allocMap[k])
		outcome = false
	}
	for k, v := range p.poolOfObjectValidators.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("objectValidator should be redeemed. Allocated by: %s", p.poolOfObjectValidators.allocMap[k])
		outcome = false
	}
	for k, v := range p.poolOfSliceValidators.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("sliceValidator should be redeemed. Allocated by: %s", p.poolOfSliceValidators.allocMap[k])
		outcome = false
	}
	for k, v := range p.poolOfItemsValidators.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("itemsValidator should be redeemed. Allocated by: %s", p.poolOfItemsValidators.allocMap[k])
		outcome = false
	}
	for k, v := range p.poolOfBasicCommonValidators.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("basicCommonValidator should be redeemed. Allocated by: %s", p.poolOfBasicCommonValidators.allocMap[k])
		outcome = false
	}
	for k, v := range p.poolOfHeaderValidators.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("headerValidator should be redeemed. Allocated by: %s", p.poolOfHeaderValidators.allocMap[k])
		outcome = false
	}
	for k, v := range p.poolOfParamValidators.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("paramValidator should be redeemed. Allocated by: %s", p.poolOfParamValidators.allocMap[k])
		outcome = false
	}
	for k, v := range p.poolOfBasicSliceValidators.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("basicSliceValidator should be redeemed. Allocated by: %s", p.poolOfBasicSliceValidators.allocMap[k])
		outcome = false
	}
	for k, v := range p.poolOfNumberValidators.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("numberValidator should be redeemed. Allocated by: %s", p.poolOfNumberValidators.allocMap[k])
		outcome = false
	}
	for k, v := range p.poolOfStringValidators.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("stringValidator should be redeemed. Allocated by: %s", p.poolOfStringValidators.allocMap[k])
		outcome = false
	}
	for k, v := range p.poolOfSchemaPropsValidators.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("schemaPropsValidator should be redeemed. Allocated by: %s", p.poolOfSchemaPropsValidators.allocMap[k])
		outcome = false
	}
	for k, v := range p.poolOfFormatValidators.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("formatValidator should be redeemed. Allocated by: %s", p.poolOfFormatValidators.allocMap[k])
		outcome = false
	}
	for k, v := range p.poolOfTypeValidators.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("typeValidator should be redeemed. Allocated by: %s", p.poolOfTypeValidators.allocMap[k])
		outcome = false
	}
	for k, v := range p.poolOfSchemas.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("schemas should be redeemed. Allocated by: %s", p.poolOfSchemas.allocMap[k])
		outcome = false
	}
	for k, v := range p.poolOfResults.debugMap {
		if v == statusRedeemed {
			continue
		}
		t.Logf("result should be redeemed. Allocated by: %s", p.poolOfResults.allocMap[k])
		outcome = false
	}

	return outcome
}

func caller() string {
	pc, _, _, _ := runtime.Caller(3) //nolint:dogsled
	from, line := runtime.FuncForPC(pc).FileLine(pc)

	return fmt.Sprintf("%s:%d", from, line)
}
