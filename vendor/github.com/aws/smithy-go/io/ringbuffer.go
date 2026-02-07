package io

import (
	"bytes"
	"io"
)

// RingBuffer struct satisfies io.ReadWrite interface.
//
// ReadBuffer is a revolving buffer data structure, which can be used to store snapshots of data in a
// revolving window.
type RingBuffer struct {
	slice []byte
	start int
	end   int
	size  int
}

// NewRingBuffer method takes in a byte slice as an input and returns a RingBuffer.
func NewRingBuffer(slice []byte) *RingBuffer {
	ringBuf := RingBuffer{
		slice: slice,
	}
	return &ringBuf
}

// Write method inserts the elements in a byte slice, and returns the number of bytes written along with any error.
func (r *RingBuffer) Write(p []byte) (int, error) {
	for _, b := range p {
		// check if end points to invalid index, we need to circle back
		if r.end == len(r.slice) {
			r.end = 0
		}
		// check if start points to invalid index, we need to circle back
		if r.start == len(r.slice) {
			r.start = 0
		}
		// if ring buffer is filled, increment the start index
		if r.size == len(r.slice) {
			r.size--
			r.start++
		}

		r.slice[r.end] = b
		r.end++
		r.size++
	}
	return len(p), nil
}

// Read copies the data on the ring buffer into the byte slice provided to the method.
// Returns the read count along with any error encountered while reading.
func (r *RingBuffer) Read(p []byte) (int, error) {
	// readCount keeps track of the number of bytes read
	var readCount int
	for j := 0; j < len(p); j++ {
		// if ring buffer is empty or completely read
		// return EOF error.
		if r.size == 0 {
			return readCount, io.EOF
		}

		if r.start == len(r.slice) {
			r.start = 0
		}

		p[j] = r.slice[r.start]
		readCount++
		// increment the start pointer for ring buffer
		r.start++
		// decrement the size of ring buffer
		r.size--
	}
	return readCount, nil
}

// Len returns the number of unread bytes in the buffer.
func (r *RingBuffer) Len() int {
	return r.size
}

// Bytes returns a copy of the RingBuffer's bytes.
func (r RingBuffer) Bytes() []byte {
	var b bytes.Buffer
	io.Copy(&b, &r)
	return b.Bytes()
}

// Reset resets the ring buffer.
func (r *RingBuffer) Reset() {
	*r = RingBuffer{
		slice: r.slice,
	}
}
