// Copyright (c) 2012-2018 Ugorji Nwoke. All rights reserved.
// Use of this source code is governed by a MIT license found in the LICENSE file.

package codec

import "reflect"

// fastpath was removed for safety reasons

const fastpathEnabled = false

func fastpathDecodeTypeSwitch(iv interface{}, d *Decoder) bool      { return false }
func fastpathEncodeTypeSwitch(iv interface{}, e *Encoder) bool      { return false }
func fastpathEncodeTypeSwitchSlice(iv interface{}, e *Encoder) bool { return false }
func fastpathEncodeTypeSwitchMap(iv interface{}, e *Encoder) bool   { return false }
func fastpathDecodeSetZeroTypeSwitch(iv interface{}) bool           { return false }

type fastpathT struct{}
type fastpathE struct {
	rtid  uintptr
	rt    reflect.Type
	encfn func(*Encoder, *codecFnInfo, reflect.Value)
	decfn func(*Decoder, *codecFnInfo, reflect.Value)
}
type fastpathA [0]fastpathE

func (x fastpathA) index(rtid uintptr) int { return -1 }

func (_ fastpathT) DecSliceUint8V(v []uint8, canChange bool, d *Decoder) (_ []uint8, changed bool) {
	fn := d.h.fn(uint8SliceTyp, true, true)
	d.kSlice(&fn.i, reflect.ValueOf(&v).Elem())
	return v, true
}

var fastpathAV fastpathA
var fastpathTV fastpathT

// ----
// type TestMammoth2Wrapper struct{}
