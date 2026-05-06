// Copyright 2017 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package s2

import (
	"errors"
	"fmt"

	"github.com/golang/geo/r3"
)

// maxEncodedVertices is the maximum number of vertices, in a row, to be encoded or decoded.
// On decode, this defends against malicious encodings that try and have us exceed RAM.
const maxEncodedVertices = 50000000

// xyzFaceSiTi represents the The XYZ and face,si,ti coordinates of a Point
// and, if this point is equal to the center of a Cell, the level of this cell
// (-1 otherwise). This is used for Loops and Polygons to store data in a more
// compressed format.
type xyzFaceSiTi struct {
	xyz    Point
	face   int
	si, ti uint32
	level  int
}

const derivativeEncodingOrder = 2

func appendFace(faces []faceRun, face int) []faceRun {
	if len(faces) == 0 || faces[len(faces)-1].face != face {
		return append(faces, faceRun{face, 1})
	}
	faces[len(faces)-1].count++
	return faces
}

// encodePointsCompressed uses an optimized compressed format to encode the given values.
func encodePointsCompressed(e *encoder, vertices []xyzFaceSiTi, level int) {
	var faces []faceRun
	for _, v := range vertices {
		faces = appendFace(faces, v.face)
	}
	encodeFaces(e, faces)

	type piQi struct {
		pi, qi uint32
	}
	verticesPiQi := make([]piQi, len(vertices))
	for i, v := range vertices {
		verticesPiQi[i] = piQi{siTitoPiQi(v.si, level), siTitoPiQi(v.ti, level)}
	}
	piCoder, qiCoder := newNthDerivativeCoder(derivativeEncodingOrder), newNthDerivativeCoder(derivativeEncodingOrder)
	for i, v := range verticesPiQi {
		f := encodePointCompressed
		if i == 0 {
			// The first point will be just the (pi, qi) coordinates
			// of the Point. NthDerivativeCoder will not save anything
			// in that case, so we encode in fixed format rather than varint
			// to avoid the varint overhead.
			f = encodeFirstPointFixedLength
		}
		f(e, v.pi, v.qi, level, piCoder, qiCoder)
	}

	var offCenter []int
	for i, v := range vertices {
		if v.level != level {
			offCenter = append(offCenter, i)
		}
	}
	e.writeUvarint(uint64(len(offCenter)))
	for _, idx := range offCenter {
		e.writeUvarint(uint64(idx))
		e.writeFloat64(vertices[idx].xyz.X)
		e.writeFloat64(vertices[idx].xyz.Y)
		e.writeFloat64(vertices[idx].xyz.Z)
	}
}

func encodeFirstPointFixedLength(e *encoder, pi, qi uint32, level int, piCoder, qiCoder *nthDerivativeCoder) {
	// Do not ZigZagEncode the first point, since it cannot be negative.
	codedPi, codedQi := piCoder.encode(int32(pi)), qiCoder.encode(int32(qi))
	// Interleave to reduce overhead from two partial bytes to one.
	interleaved := interleaveUint32(uint32(codedPi), uint32(codedQi))

	// Write as little endian.
	bytesRequired := (level + 7) / 8 * 2
	for i := 0; i < bytesRequired; i++ {
		e.writeUint8(uint8(interleaved))
		interleaved >>= 8
	}
}

// encodePointCompressed encodes points into e.
// Given a sequence of Points assumed to be the center of level-k cells,
// compresses it into a stream using the following method:
// - decompose the points into (face, si, ti) tuples.
// - run-length encode the faces, combining face number and count into a
//     varint32. See the faceRun struct.
// - right shift the (si, ti) to remove the part that's constant for all cells
//     of level-k. The result is called the (pi, qi) space.
// - 2nd derivative encode the pi and qi sequences (linear prediction)
// - zig-zag encode all derivative values but the first, which cannot be
//     negative
// - interleave the zig-zag encoded values
// - encode the first interleaved value in a fixed length encoding
//     (varint would make this value larger)
// - encode the remaining interleaved values as varint64s, as the
//     derivative encoding should make the values small.
// In addition, provides a lossless method to compress a sequence of points even
// if some points are not the center of level-k cells. These points are stored
// exactly, using 3 double precision values, after the above encoded string,
// together with their index in the sequence (this leads to some redundancy - it
// is expected that only a small fraction of the points are not cell centers).
//
// To encode leaf cells, this requires 8 bytes for the first vertex plus
// an average of 3.8 bytes for each additional vertex, when computed on
// Google's geographic repository.
func encodePointCompressed(e *encoder, pi, qi uint32, level int, piCoder, qiCoder *nthDerivativeCoder) {
	// ZigZagEncode, as varint requires the maximum number of bytes for
	// negative numbers.
	zzPi := zigzagEncode(piCoder.encode(int32(pi)))
	zzQi := zigzagEncode(qiCoder.encode(int32(qi)))
	// Interleave to reduce overhead from two partial bytes to one.
	interleaved := interleaveUint32(zzPi, zzQi)
	e.writeUvarint(interleaved)
}

type faceRun struct {
	face, count int
}

func decodeFaceRun(d *decoder) faceRun {
	faceAndCount := d.readUvarint()
	ret := faceRun{
		face:  int(faceAndCount % numFaces),
		count: int(faceAndCount / numFaces),
	}
	if ret.count <= 0 && d.err == nil {
		d.err = errors.New("non-positive count for face run")
	}
	return ret
}

func decodeFaces(numVertices int, d *decoder) []faceRun {
	var frs []faceRun
	for nparsed := 0; nparsed < numVertices; {
		fr := decodeFaceRun(d)
		if d.err != nil {
			return nil
		}
		frs = append(frs, fr)
		nparsed += fr.count
	}
	return frs
}

// encodeFaceRun encodes each faceRun as a varint64 with value numFaces * count + face.
func encodeFaceRun(e *encoder, fr faceRun) {
	// It isn't necessary to encode the number of faces left for the last run,
	// but since this would only help if there were more than 21 faces, it will
	// be a small overall savings, much smaller than the bound encoding.
	coded := numFaces*uint64(fr.count) + uint64(fr.face)
	e.writeUvarint(coded)
}

func encodeFaces(e *encoder, frs []faceRun) {
	for _, fr := range frs {
		encodeFaceRun(e, fr)
	}
}

type facesIterator struct {
	faces []faceRun
	// How often have we yet shown the current face?
	numCurrentFaceShown int
	curFace             int
}

func (fi *facesIterator) next() (ok bool) {
	if len(fi.faces) == 0 {
		return false
	}
	fi.curFace = fi.faces[0].face
	fi.numCurrentFaceShown++

	// Advance fs if needed.
	if fi.faces[0].count <= fi.numCurrentFaceShown {
		fi.faces = fi.faces[1:]
		fi.numCurrentFaceShown = 0
	}

	return true
}

func decodePointsCompressed(d *decoder, level int, target []Point) {
	faces := decodeFaces(len(target), d)

	piCoder := newNthDerivativeCoder(derivativeEncodingOrder)
	qiCoder := newNthDerivativeCoder(derivativeEncodingOrder)

	iter := facesIterator{faces: faces}
	for i := range target {
		decodeFn := decodePointCompressed
		if i == 0 {
			decodeFn = decodeFirstPointFixedLength
		}
		pi, qi := decodeFn(d, level, piCoder, qiCoder)
		if ok := iter.next(); !ok && d.err == nil {
			d.err = fmt.Errorf("ran out of faces at target %d", i)
			return
		}
		target[i] = Point{facePiQitoXYZ(iter.curFace, pi, qi, level)}
	}

	numOffCenter := int(d.readUvarint())
	if d.err != nil {
		return
	}
	if numOffCenter > len(target) {
		d.err = fmt.Errorf("numOffCenter = %d, should be at most len(target) = %d", numOffCenter, len(target))
		return
	}
	for i := 0; i < numOffCenter; i++ {
		idx := int(d.readUvarint())
		if d.err != nil {
			return
		}
		if idx >= len(target) {
			d.err = fmt.Errorf("off center index = %d, should be < len(target) = %d", idx, len(target))
			return
		}
		target[idx].X = d.readFloat64()
		target[idx].Y = d.readFloat64()
		target[idx].Z = d.readFloat64()
	}
}

func decodeFirstPointFixedLength(d *decoder, level int, piCoder, qiCoder *nthDerivativeCoder) (pi, qi uint32) {
	bytesToRead := (level + 7) / 8 * 2
	var interleaved uint64
	for i := 0; i < bytesToRead; i++ {
		rr := d.readUint8()
		interleaved |= (uint64(rr) << uint(i*8))
	}

	piCoded, qiCoded := deinterleaveUint32(interleaved)

	return uint32(piCoder.decode(int32(piCoded))), uint32(qiCoder.decode(int32(qiCoded)))
}

func zigzagEncode(x int32) uint32 {
	return (uint32(x) << 1) ^ uint32(x>>31)
}

func zigzagDecode(x uint32) int32 {
	return int32((x >> 1) ^ uint32((int32(x&1)<<31)>>31))
}

func decodePointCompressed(d *decoder, level int, piCoder, qiCoder *nthDerivativeCoder) (pi, qi uint32) {
	interleavedZigZagEncodedDerivPiQi := d.readUvarint()
	piZigzag, qiZigzag := deinterleaveUint32(interleavedZigZagEncodedDerivPiQi)
	return uint32(piCoder.decode(zigzagDecode(piZigzag))), uint32(qiCoder.decode(zigzagDecode(qiZigzag)))
}

// We introduce a new coordinate system (pi, qi), which is (si, ti)
// with the bits that are constant for cells of that level shifted
// off to the right.
// si = round(s * 2^31)
// pi = si >> (31 - level)
//    = floor(s * 2^level)
// If the point has been snapped to the level, the bits that are
// shifted off will be a 1 in the msb, then 0s after that, so the
// fractional part discarded by the cast is (close to) 0.5.

// stToPiQi returns the value transformed to the PiQi coordinate space.
func stToPiQi(s float64, level uint) uint32 {
	return uint32(s * float64(int(1)<<level))
}

// siTiToPiQi returns the value transformed into the PiQi coordinate spade.
// encodeFirstPointFixedLength encodes the return value using level bits,
// so we clamp si to the range [0, 2**level - 1] before trying to encode
// it. This is okay because if si == maxSiTi, then it is not a cell center
// anyway and will be encoded separately as an off-center point.
func siTitoPiQi(siTi uint32, level int) uint32 {
	s := uint(siTi)
	const max = maxSiTi - 1
	if s > max {
		s = max
	}

	return uint32(s >> (maxLevel + 1 - uint(level)))
}

// piQiToST returns the value transformed to ST space.
func piQiToST(pi uint32, level int) float64 {
	// We want to recover the position at the center of the cell. If the point
	// was snapped to the center of the cell, then math.Modf(s * 2^level) == 0.5.
	// Inverting STtoPiQi gives:
	// s = (pi + 0.5) / 2^level.
	return (float64(pi) + 0.5) / float64(int(1)<<uint(level))
}

func facePiQitoXYZ(face int, pi, qi uint32, level int) r3.Vector {
	return faceUVToXYZ(face, stToUV(piQiToST(pi, level)), stToUV(piQiToST(qi, level))).Normalize()
}
