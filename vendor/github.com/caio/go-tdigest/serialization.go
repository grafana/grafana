package tdigest

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"math"
)

const smallEncoding int32 = 2

var endianess = binary.BigEndian

// AsBytes serializes the digest into a byte array so it can be
// saved to disk or sent over the wire.
func (t TDigest) AsBytes() ([]byte, error) {
	// TODO get rid of the (now) useless error
	return t.ToBytes(make([]byte, t.requiredSize())), nil
}

func (t *TDigest) requiredSize() int {
	return 16 + (4 * len(t.summary.means)) + (len(t.summary.counts) * binary.MaxVarintLen64)
}

// ToBytes serializes into the supplied slice, avoiding allocation if the slice
// is large enough. The result slice is returned.
func (t *TDigest) ToBytes(b []byte) []byte {
	requiredSize := t.requiredSize()
	if cap(b) < requiredSize {
		b = make([]byte, requiredSize)
	}

	// The binary.Put* functions helpfully don't extend the slice for you, they
	// just panic if it's not already long enough. So pre-set the slice length;
	// we'll return it with the actual encoded length.
	b = b[:cap(b)]

	endianess.PutUint32(b[0:4], uint32(smallEncoding))
	endianess.PutUint64(b[4:12], math.Float64bits(t.compression))
	endianess.PutUint32(b[12:16], uint32(t.summary.Len()))

	var x float64
	idx := 16
	for _, mean := range t.summary.means {
		delta := mean - x
		x = mean
		endianess.PutUint32(b[idx:], math.Float32bits(float32(delta)))
		idx += 4
	}

	for _, count := range t.summary.counts {
		idx += binary.PutUvarint(b[idx:], count)
	}
	return b[:idx]
}

// FromBytes reads a byte buffer with a serialized digest (from AsBytes)
// and deserializes it.
//
// This function creates a new tdigest instance with the provided options,
// but ignores the compression setting since the correct value comes
// from the buffer.
func FromBytes(buf *bytes.Reader, options ...tdigestOption) (*TDigest, error) {
	var encoding int32
	err := binary.Read(buf, endianess, &encoding)
	if err != nil {
		return nil, err
	}

	if encoding != smallEncoding {
		return nil, fmt.Errorf("Unsupported encoding version: %d", encoding)
	}

	t, err := newWithoutSummary(options...)

	if err != nil {
		return nil, err
	}

	var compression float64
	err = binary.Read(buf, endianess, &compression)
	if err != nil {
		return nil, err
	}

	t.compression = compression

	var numCentroids int32
	err = binary.Read(buf, endianess, &numCentroids)
	if err != nil {
		return nil, err
	}

	if numCentroids < 0 || numCentroids > 1<<22 {
		return nil, errors.New("bad number of centroids in serialization")
	}

	t.summary = newSummary(int(numCentroids))
	t.summary.means = t.summary.means[:numCentroids]
	t.summary.counts = t.summary.counts[:numCentroids]

	var x float64
	for i := 0; i < int(numCentroids); i++ {
		var delta float32
		err = binary.Read(buf, endianess, &delta)
		if err != nil {
			return nil, err
		}
		x += float64(delta)
		t.summary.means[i] = x
	}

	for i := 0; i < int(numCentroids); i++ {
		count, err := decodeUint(buf)
		if err != nil {
			return nil, err
		}
		t.summary.counts[i] = count
		t.count += count
	}

	return t, nil
}

// FromBytes deserializes into the supplied TDigest struct, re-using
// and overwriting any existing buffers.
//
// This method reinitializes the digest from the provided buffer
// discarding any previously collected data. Notice that in case
// of errors this may leave the digest in a unusable state.
func (t *TDigest) FromBytes(buf []byte) error {
	if len(buf) < 16 {
		return errors.New("buffer too small for deserialization")
	}

	encoding := int32(endianess.Uint32(buf))
	if encoding != smallEncoding {
		return fmt.Errorf("unsupported encoding version: %d", encoding)
	}

	compression := math.Float64frombits(endianess.Uint64(buf[4:12]))
	numCentroids := int(endianess.Uint32(buf[12:16]))
	if numCentroids < 0 || numCentroids > 1<<22 {
		return errors.New("bad number of centroids in serialization")
	}

	if len(buf) < 16+(4*numCentroids) {
		return errors.New("buffer too small for deserialization")
	}

	t.count = 0
	t.compression = compression
	if t.summary == nil ||
		cap(t.summary.means) < numCentroids ||
		cap(t.summary.counts) < numCentroids {
		t.summary = newSummary(numCentroids)
	}
	t.summary.means = t.summary.means[:numCentroids]
	t.summary.counts = t.summary.counts[:numCentroids]

	idx := 16
	var x float64
	for i := 0; i < numCentroids; i++ {
		delta := math.Float32frombits(endianess.Uint32(buf[idx:]))
		idx += 4
		x += float64(delta)
		t.summary.means[i] = x
	}

	for i := 0; i < numCentroids; i++ {
		count, read := binary.Uvarint(buf[idx:])
		if read < 1 {
			return errors.New("error decoding varint, this TDigest is now invalid")
		}

		idx += read

		t.summary.counts[i] = count
		t.count += count
	}

	if idx != len(buf) {
		return errors.New("buffer has unread data")
	}
	return nil
}

func encodeUint(buf *bytes.Buffer, n uint64) error {
	var b [binary.MaxVarintLen64]byte

	l := binary.PutUvarint(b[:], n)

	_, err := buf.Write(b[:l])

	return err
}

func decodeUint(buf *bytes.Reader) (uint64, error) {
	v, err := binary.ReadUvarint(buf)
	return v, err
}
