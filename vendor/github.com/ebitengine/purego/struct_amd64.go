// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024 The Ebitengine Authors

package purego

import (
	"math"
	"reflect"
	"unsafe"
)

func getStruct(outType reflect.Type, syscall syscall15Args) (v reflect.Value) {
	outSize := outType.Size()
	switch {
	case outSize == 0:
		return reflect.New(outType).Elem()
	case outSize <= 8:
		if isAllFloats(outType) {
			// 2 float32s or 1 float64s are return in the float register
			return reflect.NewAt(outType, unsafe.Pointer(&struct{ a uintptr }{syscall.f1})).Elem()
		}
		// up to 8 bytes is returned in RAX
		return reflect.NewAt(outType, unsafe.Pointer(&struct{ a uintptr }{syscall.a1})).Elem()
	case outSize <= 16:
		r1, r2 := syscall.a1, syscall.a2
		if isAllFloats(outType) {
			r1 = syscall.f1
			r2 = syscall.f2
		} else {
			// check first 8 bytes if it's floats
			hasFirstFloat := false
			f1 := outType.Field(0).Type
			if f1.Kind() == reflect.Float64 || f1.Kind() == reflect.Float32 && outType.Field(1).Type.Kind() == reflect.Float32 {
				r1 = syscall.f1
				hasFirstFloat = true
			}

			// find index of the field that starts the second 8 bytes
			var i int
			for i = 0; i < outType.NumField(); i++ {
				if outType.Field(i).Offset == 8 {
					break
				}
			}

			// check last 8 bytes if they are floats
			f1 = outType.Field(i).Type
			if f1.Kind() == reflect.Float64 || f1.Kind() == reflect.Float32 && i+1 == outType.NumField() {
				r2 = syscall.f1
			} else if hasFirstFloat {
				// if the first field was a float then that means the second integer field
				// comes from the first integer register
				r2 = syscall.a1
			}
		}
		return reflect.NewAt(outType, unsafe.Pointer(&struct{ a, b uintptr }{r1, r2})).Elem()
	default:
		// create struct from the Go pointer created above
		// weird pointer dereference to circumvent go vet
		return reflect.NewAt(outType, *(*unsafe.Pointer)(unsafe.Pointer(&syscall.a1))).Elem()
	}
}

func isAllFloats(ty reflect.Type) bool {
	for i := 0; i < ty.NumField(); i++ {
		f := ty.Field(i)
		switch f.Type.Kind() {
		case reflect.Float64, reflect.Float32:
		default:
			return false
		}
	}
	return true
}

// https://refspecs.linuxbase.org/elf/x86_64-abi-0.99.pdf
// https://gitlab.com/x86-psABIs/x86-64-ABI
// Class determines where the 8 byte value goes.
// Higher value classes win over lower value classes
const (
	_NO_CLASS = 0b0000
	_SSE      = 0b0001
	_X87      = 0b0011 // long double not used in Go
	_INTEGER  = 0b0111
	_MEMORY   = 0b1111
)

func addStruct(v reflect.Value, numInts, numFloats, numStack *int, addInt, addFloat, addStack func(uintptr), keepAlive []interface{}) []interface{} {
	if v.Type().Size() == 0 {
		return keepAlive
	}

	// if greater than 64 bytes place on stack
	if v.Type().Size() > 8*8 {
		placeStack(v, addStack)
		return keepAlive
	}
	var (
		savedNumFloats = *numFloats
		savedNumInts   = *numInts
		savedNumStack  = *numStack
	)
	placeOnStack := postMerger(v.Type()) || !tryPlaceRegister(v, addFloat, addInt)
	if placeOnStack {
		// reset any values placed in registers
		*numFloats = savedNumFloats
		*numInts = savedNumInts
		*numStack = savedNumStack
		placeStack(v, addStack)
	}
	return keepAlive
}

func postMerger(t reflect.Type) (passInMemory bool) {
	// (c) If the size of the aggregate exceeds two eightbytes and the first eight- byte isn’t SSE or any other
	// eightbyte isn’t SSEUP, the whole argument is passed in memory.
	if t.Kind() != reflect.Struct {
		return false
	}
	if t.Size() <= 2*8 {
		return false
	}
	return true // Go does not have an SSE/SEEUP type so this is always true
}

func tryPlaceRegister(v reflect.Value, addFloat func(uintptr), addInt func(uintptr)) (ok bool) {
	ok = true
	var val uint64
	var shift byte // # of bits to shift
	var flushed bool
	class := _NO_CLASS
	flushIfNeeded := func() {
		if flushed {
			return
		}
		flushed = true
		if class == _SSE {
			addFloat(uintptr(val))
		} else {
			addInt(uintptr(val))
		}
		val = 0
		shift = 0
		class = _NO_CLASS
	}
	var place func(v reflect.Value)
	place = func(v reflect.Value) {
		var numFields int
		if v.Kind() == reflect.Struct {
			numFields = v.Type().NumField()
		} else {
			numFields = v.Type().Len()
		}

		for i := 0; i < numFields; i++ {
			flushed = false
			var f reflect.Value
			if v.Kind() == reflect.Struct {
				f = v.Field(i)
			} else {
				f = v.Index(i)
			}
			switch f.Kind() {
			case reflect.Struct:
				place(f)
			case reflect.Bool:
				if f.Bool() {
					val |= 1
				}
				shift += 8
				class |= _INTEGER
			case reflect.Pointer:
				ok = false
				return
			case reflect.Int8:
				val |= uint64(f.Int()&0xFF) << shift
				shift += 8
				class |= _INTEGER
			case reflect.Int16:
				val |= uint64(f.Int()&0xFFFF) << shift
				shift += 16
				class |= _INTEGER
			case reflect.Int32:
				val |= uint64(f.Int()&0xFFFF_FFFF) << shift
				shift += 32
				class |= _INTEGER
			case reflect.Int64, reflect.Int:
				val = uint64(f.Int())
				shift = 64
				class = _INTEGER
			case reflect.Uint8:
				val |= f.Uint() << shift
				shift += 8
				class |= _INTEGER
			case reflect.Uint16:
				val |= f.Uint() << shift
				shift += 16
				class |= _INTEGER
			case reflect.Uint32:
				val |= f.Uint() << shift
				shift += 32
				class |= _INTEGER
			case reflect.Uint64, reflect.Uint:
				val = f.Uint()
				shift = 64
				class = _INTEGER
			case reflect.Float32:
				val |= uint64(math.Float32bits(float32(f.Float()))) << shift
				shift += 32
				class |= _SSE
			case reflect.Float64:
				if v.Type().Size() > 16 {
					ok = false
					return
				}
				val = uint64(math.Float64bits(f.Float()))
				shift = 64
				class = _SSE
			case reflect.Array:
				place(f)
			default:
				panic("purego: unsupported kind " + f.Kind().String())
			}

			if shift == 64 {
				flushIfNeeded()
			} else if shift > 64 {
				// Should never happen, but may if we forget to reset shift after flush (or forget to flush),
				// better fall apart here, than corrupt arguments.
				panic("purego: tryPlaceRegisters shift > 64")
			}
		}
	}

	place(v)
	flushIfNeeded()
	return ok
}

func placeStack(v reflect.Value, addStack func(uintptr)) {
	for i := 0; i < v.Type().NumField(); i++ {
		f := v.Field(i)
		switch f.Kind() {
		case reflect.Pointer:
			addStack(f.Pointer())
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			addStack(uintptr(f.Int()))
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			addStack(uintptr(f.Uint()))
		case reflect.Float32:
			addStack(uintptr(math.Float32bits(float32(f.Float()))))
		case reflect.Float64:
			addStack(uintptr(math.Float64bits(f.Float())))
		case reflect.Struct:
			placeStack(f, addStack)
		default:
			panic("purego: unsupported kind " + f.Kind().String())
		}
	}
}
