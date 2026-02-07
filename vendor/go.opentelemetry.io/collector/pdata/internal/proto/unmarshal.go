// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package proto // import "go.opentelemetry.io/collector/pdata/internal/proto"

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
)

// WireType represents the proto wire type.
type WireType int8

const (
	WireTypeVarint     WireType = 0
	WireTypeI64        WireType = 1
	WireTypeLen        WireType = 2
	WireTypeStartGroup WireType = 3
	WireTypeEndGroup   WireType = 4
	WireTypeI32        WireType = 5
)

var (
	ErrInvalidLength        = errors.New("proto: negative length found during unmarshaling")
	ErrIntOverflow          = errors.New("proto: integer overflow")
	ErrUnexpectedEndOfGroup = errors.New("proto: unexpected end of group")
)

// ConsumeUnknown parses buf starting at pos as a wireType field, reporting the new position.
func ConsumeUnknown(buf []byte, pos int, wireType WireType) (int, error) {
	var err error
	l := len(buf)
	depth := 0
	for pos < l {
		switch wireType {
		case WireTypeVarint:
			_, pos, err = ConsumeVarint(buf, pos)
			return pos, err
		case WireTypeI64:
			_, pos, err = ConsumeI64(buf, pos)
			return pos, err
		case WireTypeLen:
			_, pos, err = ConsumeLen(buf, pos)
			return pos, err
		case WireTypeStartGroup:
			depth++
		case WireTypeEndGroup:
			if depth == 0 {
				return 0, ErrUnexpectedEndOfGroup
			}
			depth--
		case WireTypeI32:
			_, pos, err = ConsumeI32(buf, pos)
			return pos, err
		default:
			return 0, fmt.Errorf("proto: illegal wireType %d", wireType)
		}

		// Only when parsing a group can be here, if done return otherwise parse more tags.
		if depth == 0 {
			return pos, nil
		}

		// If in a group parsing, move to the next tag.
		_, wireType, pos, err = ConsumeTag(buf, pos)
		if err != nil {
			return 0, err
		}
	}
	return 0, io.ErrUnexpectedEOF
}

// ConsumeI64 parses buf starting at pos as a WireTypeI64 field, reporting the value and the new position.
func ConsumeI64(buf []byte, pos int) (uint64, int, error) {
	pos += 8
	if pos < 0 || pos > len(buf) {
		return 0, 0, io.ErrUnexpectedEOF
	}
	return binary.LittleEndian.Uint64(buf[pos-8:]), pos, nil
}

// ConsumeLen parses buf starting at pos as a WireTypeLen field, reporting the len and the new position.
func ConsumeLen(buf []byte, pos int) (int, int, error) {
	var num uint64
	var err error
	num, pos, err = ConsumeVarint(buf, pos)
	if err != nil {
		return 0, 0, err
	}
	//nolint:gosec
	length := int(num)
	if length < 0 {
		return 0, 0, ErrInvalidLength
	}
	pos += length
	if pos < 0 || pos > len(buf) {
		return 0, 0, io.ErrUnexpectedEOF
	}
	return length, pos, nil
}

// ConsumeI32 parses buf starting at pos as a WireTypeI32 field, reporting the value and the new position.
func ConsumeI32(buf []byte, pos int) (uint32, int, error) {
	pos += 4
	if pos < 0 || pos > len(buf) {
		return 0, 0, io.ErrUnexpectedEOF
	}
	return binary.LittleEndian.Uint32(buf[pos-4:]), pos, nil
}

// ConsumeTag parses buf starting at pos as a varint-encoded tag, reporting the new position.
func ConsumeTag(buf []byte, pos int) (int32, WireType, int, error) {
	tag, pos, err := ConsumeVarint(buf, pos)
	if err != nil {
		return 0, 0, 0, err
	}
	//nolint:gosec
	fieldNum := int32(tag >> 3)
	//nolint:gosec
	wireType := int8(tag & 0x7)
	if fieldNum <= 0 {
		return 0, 0, 0, fmt.Errorf("proto: Link: illegal field=%d (tag=%d, pos=%d)", fieldNum, tag, pos)
	}
	return fieldNum, WireType(wireType), pos, nil
}

// ConsumeVarint parses buf starting at pos as a varint-encoded uint64, reporting the new position.
func ConsumeVarint(buf []byte, pos int) (uint64, int, error) {
	l := len(buf)
	var num uint64
	for shift := uint(0); ; shift += 7 {
		if shift >= 64 {
			return 0, 0, ErrIntOverflow
		}
		if pos >= l {
			return 0, 0, io.ErrUnexpectedEOF
		}
		b := buf[pos]
		pos++
		num |= uint64(b&0x7F) << shift
		if b < 0x80 {
			break
		}
	}
	return num, pos, nil
}
