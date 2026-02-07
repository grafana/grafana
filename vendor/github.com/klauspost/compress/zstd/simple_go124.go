// Copyright 2025+ Klaus Post. All rights reserved.
// License information can be found in the LICENSE file.

//go:build go1.24

package zstd

import (
	"errors"
	"runtime"
	"sync"
	"weak"
)

var weakMu sync.Mutex
var simpleEnc weak.Pointer[Encoder]
var simpleDec weak.Pointer[Decoder]

// EncodeTo appends the encoded data from src to dst.
func EncodeTo(dst []byte, src []byte) []byte {
	weakMu.Lock()
	enc := simpleEnc.Value()
	if enc == nil {
		var err error
		enc, err = NewWriter(nil, WithEncoderConcurrency(runtime.NumCPU()), WithWindowSize(1<<20), WithLowerEncoderMem(true), WithZeroFrames(true))
		if err != nil {
			panic("failed to create simple encoder: " + err.Error())
		}
		simpleEnc = weak.Make(enc)
	}
	weakMu.Unlock()

	return enc.EncodeAll(src, dst)
}

// DecodeTo appends the decoded data from src to dst.
// The maximum decoded size is 1GiB,
// not including what may already be in dst.
func DecodeTo(dst []byte, src []byte) ([]byte, error) {
	weakMu.Lock()
	dec := simpleDec.Value()
	if dec == nil {
		var err error
		dec, err = NewReader(nil, WithDecoderConcurrency(runtime.NumCPU()), WithDecoderLowmem(true), WithDecoderMaxMemory(1<<30))
		if err != nil {
			weakMu.Unlock()
			return nil, errors.New("failed to create simple decoder: " + err.Error())
		}
		runtime.SetFinalizer(dec, func(d *Decoder) {
			d.Close()
		})
		simpleDec = weak.Make(dec)
	}
	weakMu.Unlock()
	return dec.DecodeAll(src, dst)
}
