// Copyright 2019 The age Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package stream implements a variant of the STREAM chunked encryption scheme.
package stream

import (
	"crypto/cipher"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/chacha20poly1305"
)

const ChunkSize = 64 * 1024

type Reader struct {
	a   cipher.AEAD
	src io.Reader

	unread []byte // decrypted but unread data, backed by buf
	buf    [encChunkSize]byte

	err   error
	nonce [chacha20poly1305.NonceSize]byte
}

const (
	encChunkSize  = ChunkSize + chacha20poly1305.Overhead
	lastChunkFlag = 0x01
)

func NewReader(key []byte, src io.Reader) (*Reader, error) {
	aead, err := chacha20poly1305.New(key)
	if err != nil {
		return nil, err
	}
	return &Reader{
		a:   aead,
		src: src,
	}, nil
}

func (r *Reader) Read(p []byte) (int, error) {
	if len(r.unread) > 0 {
		n := copy(p, r.unread)
		r.unread = r.unread[n:]
		return n, nil
	}
	if r.err != nil {
		return 0, r.err
	}
	if len(p) == 0 {
		return 0, nil
	}

	last, err := r.readChunk()
	if err != nil {
		r.err = err
		return 0, err
	}

	n := copy(p, r.unread)
	r.unread = r.unread[n:]

	if last {
		// Ensure there is an EOF after the last chunk as expected. In other
		// words, check for trailing data after a full-length final chunk.
		// Hopefully, the underlying reader supports returning EOF even if it
		// had previously returned an EOF to ReadFull.
		if _, err := r.src.Read(make([]byte, 1)); err == nil {
			r.err = errors.New("trailing data after end of encrypted file")
		} else if err != io.EOF {
			r.err = fmt.Errorf("non-EOF error reading after end of encrypted file: %w", err)
		} else {
			r.err = io.EOF
		}
	}

	return n, nil
}

// readChunk reads the next chunk of ciphertext from r.src and makes it available
// in r.unread. last is true if the chunk was marked as the end of the message.
// readChunk must not be called again after returning a last chunk or an error.
func (r *Reader) readChunk() (last bool, err error) {
	if len(r.unread) != 0 {
		panic("stream: internal error: readChunk called with dirty buffer")
	}

	in := r.buf[:]
	n, err := io.ReadFull(r.src, in)
	switch {
	case err == io.EOF:
		// A message can't end without a marked chunk. This message is truncated.
		return false, io.ErrUnexpectedEOF
	case err == io.ErrUnexpectedEOF:
		// The last chunk can be short, but not empty unless it's the first and
		// only chunk.
		if !nonceIsZero(&r.nonce) && n == r.a.Overhead() {
			return false, errors.New("last chunk is empty, try age v1.0.0, and please consider reporting this")
		}
		in = in[:n]
		last = true
		setLastChunkFlag(&r.nonce)
	case err != nil:
		return false, err
	}

	outBuf := make([]byte, 0, ChunkSize)
	out, err := r.a.Open(outBuf, r.nonce[:], in, nil)
	if err != nil && !last {
		// Check if this was a full-length final chunk.
		last = true
		setLastChunkFlag(&r.nonce)
		out, err = r.a.Open(outBuf, r.nonce[:], in, nil)
	}
	if err != nil {
		return false, errors.New("failed to decrypt and authenticate payload chunk")
	}

	incNonce(&r.nonce)
	r.unread = r.buf[:copy(r.buf[:], out)]
	return last, nil
}

func incNonce(nonce *[chacha20poly1305.NonceSize]byte) {
	for i := len(nonce) - 2; i >= 0; i-- {
		nonce[i]++
		if nonce[i] != 0 {
			break
		} else if i == 0 {
			// The counter is 88 bits, this is unreachable.
			panic("stream: chunk counter wrapped around")
		}
	}
}

func setLastChunkFlag(nonce *[chacha20poly1305.NonceSize]byte) {
	nonce[len(nonce)-1] = lastChunkFlag
}

func nonceIsZero(nonce *[chacha20poly1305.NonceSize]byte) bool {
	return *nonce == [chacha20poly1305.NonceSize]byte{}
}

type Writer struct {
	a         cipher.AEAD
	dst       io.Writer
	unwritten []byte // backed by buf
	buf       [encChunkSize]byte
	nonce     [chacha20poly1305.NonceSize]byte
	err       error
}

func NewWriter(key []byte, dst io.Writer) (*Writer, error) {
	aead, err := chacha20poly1305.New(key)
	if err != nil {
		return nil, err
	}
	w := &Writer{
		a:   aead,
		dst: dst,
	}
	w.unwritten = w.buf[:0]
	return w, nil
}

func (w *Writer) Write(p []byte) (n int, err error) {
	// TODO: consider refactoring with a bytes.Buffer.
	if w.err != nil {
		return 0, w.err
	}
	if len(p) == 0 {
		return 0, nil
	}

	total := len(p)
	for len(p) > 0 {
		freeBuf := w.buf[len(w.unwritten):ChunkSize]
		n := copy(freeBuf, p)
		p = p[n:]
		w.unwritten = w.unwritten[:len(w.unwritten)+n]

		if len(w.unwritten) == ChunkSize && len(p) > 0 {
			if err := w.flushChunk(notLastChunk); err != nil {
				w.err = err
				return 0, err
			}
		}
	}
	return total, nil
}

// Close flushes the last chunk. It does not close the underlying Writer.
func (w *Writer) Close() error {
	if w.err != nil {
		return w.err
	}

	w.err = w.flushChunk(lastChunk)
	if w.err != nil {
		return w.err
	}

	w.err = errors.New("stream.Writer is already closed")
	return nil
}

const (
	lastChunk    = true
	notLastChunk = false
)

func (w *Writer) flushChunk(last bool) error {
	if !last && len(w.unwritten) != ChunkSize {
		panic("stream: internal error: flush called with partial chunk")
	}

	if last {
		setLastChunkFlag(&w.nonce)
	}
	buf := w.a.Seal(w.buf[:0], w.nonce[:], w.unwritten, nil)
	_, err := w.dst.Write(buf)
	w.unwritten = w.buf[:0]
	incNonce(&w.nonce)
	return err
}
