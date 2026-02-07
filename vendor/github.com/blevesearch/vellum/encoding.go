//  Copyright (c) 2017 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package vellum

import (
	"encoding/binary"
	"fmt"
	"io"
)

const headerSize = 16

type encoderConstructor func(w io.Writer) encoder
type decoderConstructor func([]byte) decoder

var encoders = map[int]encoderConstructor{}
var decoders = map[int]decoderConstructor{}

type encoder interface {
	start() error
	encodeState(s *builderNode, addr int) (int, error)
	finish(count, rootAddr int) error
	reset(w io.Writer)
}

func loadEncoder(ver int, w io.Writer) (encoder, error) {
	if cons, ok := encoders[ver]; ok {
		return cons(w), nil
	}
	return nil, fmt.Errorf("no encoder for version %d registered", ver)
}

func registerEncoder(ver int, cons encoderConstructor) {
	encoders[ver] = cons
}

type decoder interface {
	getRoot() int
	getLen() int
	stateAt(addr int, prealloc fstState) (fstState, error)
}

func loadDecoder(ver int, data []byte) (decoder, error) {
	if cons, ok := decoders[ver]; ok {
		return cons(data), nil
	}
	return nil, fmt.Errorf("no decoder for version %d registered", ver)
}

func registerDecoder(ver int, cons decoderConstructor) {
	decoders[ver] = cons
}

func decodeHeader(header []byte) (ver int, typ int, err error) {
	if len(header) < headerSize {
		err = fmt.Errorf("invalid header < 16 bytes")
		return
	}
	ver = int(binary.LittleEndian.Uint64(header[0:8]))
	typ = int(binary.LittleEndian.Uint64(header[8:16]))
	return
}

// fstState represents a state inside the FTS runtime
// It is the main contract between the FST impl and the decoder
// The FST impl should work only with this interface, while only the decoder
// impl knows the physical representation.
type fstState interface {
	Address() int
	Final() bool
	FinalOutput() uint64
	NumTransitions() int
	TransitionFor(b byte) (int, int, uint64)
	TransitionAt(i int) byte
}
