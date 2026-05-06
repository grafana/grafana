// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package memberlist

import (
	"bufio"
	"fmt"
	"io"
	"net"
)

// General approach is to prefix all packets and streams with the same structure:
//
// magic type byte (244): uint8
// length of label name:  uint8 (because labels can't be longer than 255 bytes)
// label name:            []uint8

// LabelMaxSize is the maximum length of a packet or stream label.
const LabelMaxSize = 255

// AddLabelHeaderToPacket prefixes outgoing packets with the correct header if
// the label is not empty.
func AddLabelHeaderToPacket(buf []byte, label string) ([]byte, error) {
	if label == "" {
		return buf, nil
	}
	if len(label) > LabelMaxSize {
		return nil, fmt.Errorf("label %q is too long", label)
	}

	return makeLabelHeader(label, buf), nil
}

// RemoveLabelHeaderFromPacket removes any label header from the provided
// packet and returns it along with the remaining packet contents.
func RemoveLabelHeaderFromPacket(buf []byte) (newBuf []byte, label string, err error) {
	if len(buf) == 0 {
		return buf, "", nil // can't possibly be labeled
	}

	// [type:byte] [size:byte] [size bytes]

	msgType := messageType(buf[0])
	if msgType != hasLabelMsg {
		return buf, "", nil
	}

	if len(buf) < 2 {
		return nil, "", fmt.Errorf("cannot decode label; packet has been truncated")
	}

	size := int(buf[1])
	if size < 1 {
		return nil, "", fmt.Errorf("label header cannot be empty when present")
	}

	if len(buf) < 2+size {
		return nil, "", fmt.Errorf("cannot decode label; packet has been truncated")
	}

	label = string(buf[2 : 2+size])
	newBuf = buf[2+size:]

	return newBuf, label, nil
}

// AddLabelHeaderToStream prefixes outgoing streams with the correct header if
// the label is not empty.
func AddLabelHeaderToStream(conn net.Conn, label string) error {
	if label == "" {
		return nil
	}
	if len(label) > LabelMaxSize {
		return fmt.Errorf("label %q is too long", label)
	}

	header := makeLabelHeader(label, nil)

	_, err := conn.Write(header)
	return err
}

// RemoveLabelHeaderFromStream removes any label header from the beginning of
// the stream if present and returns it along with an updated conn with that
// header removed.
//
// Note that on error it is the caller's responsibility to close the
// connection.
func RemoveLabelHeaderFromStream(conn net.Conn) (net.Conn, string, error) {
	br := bufio.NewReader(conn)

	// First check for the type byte.
	peeked, err := br.Peek(1)
	if err != nil {
		if err == io.EOF {
			// It is safe to return the original net.Conn at this point because
			// it never contained any data in the first place so we don't have
			// to splice the buffer into the conn because both are empty.
			return conn, "", nil
		}
		return nil, "", err
	}

	msgType := messageType(peeked[0])
	if msgType != hasLabelMsg {
		conn, err = newPeekedConnFromBufferedReader(conn, br, 0)
		return conn, "", err
	}

	// We are guaranteed to get a size byte as well.
	peeked, err = br.Peek(2)
	if err != nil {
		if err == io.EOF {
			return nil, "", fmt.Errorf("cannot decode label; stream has been truncated")
		}
		return nil, "", err
	}

	size := int(peeked[1])
	if size < 1 {
		return nil, "", fmt.Errorf("label header cannot be empty when present")
	}
	// NOTE: we don't have to check this against LabelMaxSize because a byte
	// already has a max value of 255.

	// Once we know the size we can peek the label as well. Note that since we
	// are using the default bufio.Reader size of 4096, the entire label header
	// fits in the initial buffer fill so this should be free.
	peeked, err = br.Peek(2 + size)
	if err != nil {
		if err == io.EOF {
			return nil, "", fmt.Errorf("cannot decode label; stream has been truncated")
		}
		return nil, "", err
	}

	label := string(peeked[2 : 2+size])

	conn, err = newPeekedConnFromBufferedReader(conn, br, 2+size)
	if err != nil {
		return nil, "", err
	}

	return conn, label, nil
}

// newPeekedConnFromBufferedReader will splice the buffer contents after the
// offset into the provided net.Conn and return the result so that the rest of
// the buffer contents are returned first when reading from the returned
// peekedConn before moving on to the unbuffered conn contents.
func newPeekedConnFromBufferedReader(conn net.Conn, br *bufio.Reader, offset int) (*peekedConn, error) {
	// Extract any of the readahead buffer.
	peeked, err := br.Peek(br.Buffered())
	if err != nil {
		return nil, err
	}

	return &peekedConn{
		Peeked: peeked[offset:],
		Conn:   conn,
	}, nil
}

func makeLabelHeader(label string, rest []byte) []byte {
	newBuf := make([]byte, 2, 2+len(label)+len(rest))
	newBuf[0] = byte(hasLabelMsg)
	newBuf[1] = byte(len(label))
	newBuf = append(newBuf, []byte(label)...)
	if len(rest) > 0 {
		newBuf = append(newBuf, []byte(rest)...)
	}
	return newBuf
}

func labelOverhead(label string) int {
	if label == "" {
		return 0
	}
	return 2 + len(label)
}
