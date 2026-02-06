// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsoncore

import (
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"

	"go.mongodb.org/mongo-driver/bson/bsontype"
)

// ValidationError is an error type returned when attempting to validate a document or array.
type ValidationError string

func (ve ValidationError) Error() string { return string(ve) }

// NewDocumentLengthError creates and returns an error for when the length of a document exceeds the
// bytes available.
func NewDocumentLengthError(length, rem int) error {
	return lengthError("document", length, rem)
}

func lengthError(bufferType string, length, rem int) error {
	return ValidationError(fmt.Sprintf("%v length exceeds available bytes. length=%d remainingBytes=%d",
		bufferType, length, rem))
}

// InsufficientBytesError indicates that there were not enough bytes to read the next component.
type InsufficientBytesError struct {
	Source    []byte
	Remaining []byte
}

// NewInsufficientBytesError creates a new InsufficientBytesError with the given Document and
// remaining bytes.
func NewInsufficientBytesError(src, rem []byte) InsufficientBytesError {
	return InsufficientBytesError{Source: src, Remaining: rem}
}

// Error implements the error interface.
func (ibe InsufficientBytesError) Error() string {
	return "too few bytes to read next component"
}

// Equal checks that err2 also is an ErrTooSmall.
func (ibe InsufficientBytesError) Equal(err2 error) bool {
	switch err2.(type) {
	case InsufficientBytesError:
		return true
	default:
		return false
	}
}

// InvalidDepthTraversalError is returned when attempting a recursive Lookup when one component of
// the path is neither an embedded document nor an array.
type InvalidDepthTraversalError struct {
	Key  string
	Type bsontype.Type
}

func (idte InvalidDepthTraversalError) Error() string {
	return fmt.Sprintf(
		"attempt to traverse into %s, but it's type is %s, not %s nor %s",
		idte.Key, idte.Type, bsontype.EmbeddedDocument, bsontype.Array,
	)
}

// ErrMissingNull is returned when a document or array's last byte is not null.
const ErrMissingNull ValidationError = "document or array end is missing null byte"

// ErrInvalidLength indicates that a length in a binary representation of a BSON document or array
// is invalid.
const ErrInvalidLength ValidationError = "document or array length is invalid"

// ErrNilReader indicates that an operation was attempted on a nil io.Reader.
var ErrNilReader = errors.New("nil reader")

// ErrEmptyKey indicates that no key was provided to a Lookup method.
var ErrEmptyKey = errors.New("empty key provided")

// ErrElementNotFound indicates that an Element matching a certain condition does not exist.
var ErrElementNotFound = errors.New("element not found")

// ErrOutOfBounds indicates that an index provided to access something was invalid.
var ErrOutOfBounds = errors.New("out of bounds")

// Document is a raw bytes representation of a BSON document.
type Document []byte

// NewDocumentFromReader reads a document from r. This function will only validate the length is
// correct and that the document ends with a null byte.
func NewDocumentFromReader(r io.Reader) (Document, error) {
	return newBufferFromReader(r)
}

func newBufferFromReader(r io.Reader) ([]byte, error) {
	if r == nil {
		return nil, ErrNilReader
	}

	var lengthBytes [4]byte

	// ReadFull guarantees that we will have read at least len(lengthBytes) if err == nil
	_, err := io.ReadFull(r, lengthBytes[:])
	if err != nil {
		return nil, err
	}

	length, _, _ := readi32(lengthBytes[:]) // ignore ok since we always have enough bytes to read a length
	if length < 0 {
		return nil, ErrInvalidLength
	}
	buffer := make([]byte, length)

	copy(buffer, lengthBytes[:])

	_, err = io.ReadFull(r, buffer[4:])
	if err != nil {
		return nil, err
	}

	if buffer[length-1] != 0x00 {
		return nil, ErrMissingNull
	}

	return buffer, nil
}

// Lookup searches the document, potentially recursively, for the given key. If there are multiple
// keys provided, this method will recurse down, as long as the top and intermediate nodes are
// either documents or arrays. If an error occurs or if the value doesn't exist, an empty Value is
// returned.
func (d Document) Lookup(key ...string) Value {
	val, _ := d.LookupErr(key...)
	return val
}

// LookupErr is the same as Lookup, except it returns an error in addition to an empty Value.
func (d Document) LookupErr(key ...string) (Value, error) {
	if len(key) < 1 {
		return Value{}, ErrEmptyKey
	}
	length, rem, ok := ReadLength(d)
	if !ok {
		return Value{}, NewInsufficientBytesError(d, rem)
	}

	length -= 4

	var elem Element
	for length > 1 {
		elem, rem, ok = ReadElement(rem)
		length -= int32(len(elem))
		if !ok {
			return Value{}, NewInsufficientBytesError(d, rem)
		}
		// We use `KeyBytes` rather than `Key` to avoid a needless string alloc.
		if string(elem.KeyBytes()) != key[0] {
			continue
		}
		if len(key) > 1 {
			tt := bsontype.Type(elem[0])
			switch tt {
			case bsontype.EmbeddedDocument:
				val, err := elem.Value().Document().LookupErr(key[1:]...)
				if err != nil {
					return Value{}, err
				}
				return val, nil
			case bsontype.Array:
				// Convert to Document to continue Lookup recursion.
				val, err := Document(elem.Value().Array()).LookupErr(key[1:]...)
				if err != nil {
					return Value{}, err
				}
				return val, nil
			default:
				return Value{}, InvalidDepthTraversalError{Key: elem.Key(), Type: tt}
			}
		}
		return elem.ValueErr()
	}
	return Value{}, ErrElementNotFound
}

// Index searches for and retrieves the element at the given index. This method will panic if
// the document is invalid or if the index is out of bounds.
func (d Document) Index(index uint) Element {
	elem, err := d.IndexErr(index)
	if err != nil {
		panic(err)
	}
	return elem
}

// IndexErr searches for and retrieves the element at the given index.
func (d Document) IndexErr(index uint) (Element, error) {
	return indexErr(d, index)
}

func indexErr(b []byte, index uint) (Element, error) {
	length, rem, ok := ReadLength(b)
	if !ok {
		return nil, NewInsufficientBytesError(b, rem)
	}

	length -= 4

	var current uint
	var elem Element
	for length > 1 {
		elem, rem, ok = ReadElement(rem)
		length -= int32(len(elem))
		if !ok {
			return nil, NewInsufficientBytesError(b, rem)
		}
		if current != index {
			current++
			continue
		}
		return elem, nil
	}
	return nil, ErrOutOfBounds
}

// DebugString outputs a human readable version of Document. It will attempt to stringify the
// valid components of the document even if the entire document is not valid.
func (d Document) DebugString() string {
	if len(d) < 5 {
		return "<malformed>"
	}
	var buf strings.Builder
	buf.WriteString("Document")
	length, rem, _ := ReadLength(d) // We know we have enough bytes to read the length
	buf.WriteByte('(')
	buf.WriteString(strconv.Itoa(int(length)))
	length -= 4
	buf.WriteString("){")
	var elem Element
	var ok bool
	for length > 1 {
		elem, rem, ok = ReadElement(rem)
		length -= int32(len(elem))
		if !ok {
			buf.WriteString(fmt.Sprintf("<malformed (%d)>", length))
			break
		}
		buf.WriteString(elem.DebugString())
	}
	buf.WriteByte('}')

	return buf.String()
}

// String outputs an ExtendedJSON version of Document. If the document is not valid, this method
// returns an empty string.
func (d Document) String() string {
	if len(d) < 5 {
		return ""
	}
	var buf strings.Builder
	buf.WriteByte('{')

	length, rem, _ := ReadLength(d) // We know we have enough bytes to read the length

	length -= 4

	var elem Element
	var ok bool
	first := true
	for length > 1 {
		if !first {
			buf.WriteByte(',')
		}
		elem, rem, ok = ReadElement(rem)
		length -= int32(len(elem))
		if !ok {
			return ""
		}
		buf.WriteString(elem.String())
		first = false
	}
	buf.WriteByte('}')

	return buf.String()
}

// Elements returns this document as a slice of elements. The returned slice will contain valid
// elements. If the document is not valid, the elements up to the invalid point will be returned
// along with an error.
func (d Document) Elements() ([]Element, error) {
	length, rem, ok := ReadLength(d)
	if !ok {
		return nil, NewInsufficientBytesError(d, rem)
	}

	length -= 4

	var elem Element
	var elems []Element
	for length > 1 {
		elem, rem, ok = ReadElement(rem)
		length -= int32(len(elem))
		if !ok {
			return elems, NewInsufficientBytesError(d, rem)
		}
		if err := elem.Validate(); err != nil {
			return elems, err
		}
		elems = append(elems, elem)
	}
	return elems, nil
}

// Values returns this document as a slice of values. The returned slice will contain valid values.
// If the document is not valid, the values up to the invalid point will be returned along with an
// error.
func (d Document) Values() ([]Value, error) {
	return values(d)
}

func values(b []byte) ([]Value, error) {
	length, rem, ok := ReadLength(b)
	if !ok {
		return nil, NewInsufficientBytesError(b, rem)
	}

	length -= 4

	var elem Element
	var vals []Value
	for length > 1 {
		elem, rem, ok = ReadElement(rem)
		length -= int32(len(elem))
		if !ok {
			return vals, NewInsufficientBytesError(b, rem)
		}
		if err := elem.Value().Validate(); err != nil {
			return vals, err
		}
		vals = append(vals, elem.Value())
	}
	return vals, nil
}

// Validate validates the document and ensures the elements contained within are valid.
func (d Document) Validate() error {
	length, rem, ok := ReadLength(d)
	if !ok {
		return NewInsufficientBytesError(d, rem)
	}
	if int(length) > len(d) {
		return NewDocumentLengthError(int(length), len(d))
	}
	if d[length-1] != 0x00 {
		return ErrMissingNull
	}

	length -= 4
	var elem Element

	for length > 1 {
		elem, rem, ok = ReadElement(rem)
		length -= int32(len(elem))
		if !ok {
			return NewInsufficientBytesError(d, rem)
		}
		err := elem.Validate()
		if err != nil {
			return err
		}
	}

	if len(rem) < 1 || rem[0] != 0x00 {
		return ErrMissingNull
	}
	return nil
}
