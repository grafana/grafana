// Copyright (c) 2012 The gocql Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The uuid package can be used to generate and parse universally unique
// identifiers, a standardized format in the form of a 128 bit number.
//
// http://tools.ietf.org/html/rfc4122
package gocql

import (
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"sync/atomic"
	"time"
)

type UUID [16]byte

var hardwareAddr []byte
var clockSeq uint32

const (
	VariantNCSCompat = 0
	VariantIETF      = 2
	VariantMicrosoft = 6
	VariantFuture    = 7
)

func init() {
	if interfaces, err := net.Interfaces(); err == nil {
		for _, i := range interfaces {
			if i.Flags&net.FlagLoopback == 0 && len(i.HardwareAddr) > 0 {
				hardwareAddr = i.HardwareAddr
				break
			}
		}
	}
	if hardwareAddr == nil {
		// If we failed to obtain the MAC address of the current computer,
		// we will use a randomly generated 6 byte sequence instead and set
		// the multicast bit as recommended in RFC 4122.
		hardwareAddr = make([]byte, 6)
		_, err := io.ReadFull(rand.Reader, hardwareAddr)
		if err != nil {
			panic(err)
		}
		hardwareAddr[0] = hardwareAddr[0] | 0x01
	}

	// initialize the clock sequence with a random number
	var clockSeqRand [2]byte
	io.ReadFull(rand.Reader, clockSeqRand[:])
	clockSeq = uint32(clockSeqRand[1])<<8 | uint32(clockSeqRand[0])
}

// ParseUUID parses a 32 digit hexadecimal number (that might contain hypens)
// representing an UUID.
func ParseUUID(input string) (UUID, error) {
	var u UUID
	j := 0
	for _, r := range input {
		switch {
		case r == '-' && j&1 == 0:
			continue
		case r >= '0' && r <= '9' && j < 32:
			u[j/2] |= byte(r-'0') << uint(4-j&1*4)
		case r >= 'a' && r <= 'f' && j < 32:
			u[j/2] |= byte(r-'a'+10) << uint(4-j&1*4)
		case r >= 'A' && r <= 'F' && j < 32:
			u[j/2] |= byte(r-'A'+10) << uint(4-j&1*4)
		default:
			return UUID{}, fmt.Errorf("invalid UUID %q", input)
		}
		j += 1
	}
	if j != 32 {
		return UUID{}, fmt.Errorf("invalid UUID %q", input)
	}
	return u, nil
}

// UUIDFromBytes converts a raw byte slice to an UUID.
func UUIDFromBytes(input []byte) (UUID, error) {
	var u UUID
	if len(input) != 16 {
		return u, errors.New("UUIDs must be exactly 16 bytes long")
	}

	copy(u[:], input)
	return u, nil
}

// RandomUUID generates a totally random UUID (version 4) as described in
// RFC 4122.
func RandomUUID() (UUID, error) {
	var u UUID
	_, err := io.ReadFull(rand.Reader, u[:])
	if err != nil {
		return u, err
	}
	u[6] &= 0x0F // clear version
	u[6] |= 0x40 // set version to 4 (random uuid)
	u[8] &= 0x3F // clear variant
	u[8] |= 0x80 // set to IETF variant
	return u, nil
}

var timeBase = time.Date(1582, time.October, 15, 0, 0, 0, 0, time.UTC).Unix()

// TimeUUID generates a new time based UUID (version 1) using the current
// time as the timestamp.
func TimeUUID() UUID {
	return UUIDFromTime(time.Now())
}

// UUIDFromTime generates a new time based UUID (version 1) as described in
// RFC 4122. This UUID contains the MAC address of the node that generated
// the UUID, the given timestamp and a sequence number.
func UUIDFromTime(aTime time.Time) UUID {
	var u UUID

	utcTime := aTime.In(time.UTC)
	t := uint64(utcTime.Unix()-timeBase)*10000000 + uint64(utcTime.Nanosecond()/100)
	u[0], u[1], u[2], u[3] = byte(t>>24), byte(t>>16), byte(t>>8), byte(t)
	u[4], u[5] = byte(t>>40), byte(t>>32)
	u[6], u[7] = byte(t>>56)&0x0F, byte(t>>48)

	clock := atomic.AddUint32(&clockSeq, 1)
	u[8] = byte(clock >> 8)
	u[9] = byte(clock)

	copy(u[10:], hardwareAddr)

	u[6] |= 0x10 // set version to 1 (time based uuid)
	u[8] &= 0x3F // clear variant
	u[8] |= 0x80 // set to IETF variant

	return u
}

// String returns the UUID in it's canonical form, a 32 digit hexadecimal
// number in the form of xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.
func (u UUID) String() string {
	var offsets = [...]int{0, 2, 4, 6, 9, 11, 14, 16, 19, 21, 24, 26, 28, 30, 32, 34}
	const hexString = "0123456789abcdef"
	r := make([]byte, 36)
	for i, b := range u {
		r[offsets[i]] = hexString[b>>4]
		r[offsets[i]+1] = hexString[b&0xF]
	}
	r[8] = '-'
	r[13] = '-'
	r[18] = '-'
	r[23] = '-'
	return string(r)

}

// Bytes returns the raw byte slice for this UUID. A UUID is always 128 bits
// (16 bytes) long.
func (u UUID) Bytes() []byte {
	return u[:]
}

// Variant returns the variant of this UUID. This package will only generate
// UUIDs in the IETF variant.
func (u UUID) Variant() int {
	x := u[8]
	if x&0x80 == 0 {
		return VariantNCSCompat
	}
	if x&0x40 == 0 {
		return VariantIETF
	}
	if x&0x20 == 0 {
		return VariantMicrosoft
	}
	return VariantFuture
}

// Version extracts the version of this UUID variant. The RFC 4122 describes
// five kinds of UUIDs.
func (u UUID) Version() int {
	return int(u[6] & 0xF0 >> 4)
}

// Node extracts the MAC address of the node who generated this UUID. It will
// return nil if the UUID is not a time based UUID (version 1).
func (u UUID) Node() []byte {
	if u.Version() != 1 {
		return nil
	}
	return u[10:]
}

// Timestamp extracts the timestamp information from a time based UUID
// (version 1).
func (u UUID) Timestamp() int64 {
	if u.Version() != 1 {
		return 0
	}
	return int64(uint64(u[0])<<24|uint64(u[1])<<16|
		uint64(u[2])<<8|uint64(u[3])) +
		int64(uint64(u[4])<<40|uint64(u[5])<<32) +
		int64(uint64(u[6]&0x0F)<<56|uint64(u[7])<<48)
}

// Time is like Timestamp, except that it returns a time.Time.
func (u UUID) Time() time.Time {
	if u.Version() != 1 {
		return time.Time{}
	}
	t := u.Timestamp()
	sec := t / 1e7
	nsec := (t % 1e7) * 100
	return time.Unix(sec+timeBase, nsec).UTC()
}

// Marshaling for JSON
func (u UUID) MarshalJSON() ([]byte, error) {
	return []byte(`"` + u.String() + `"`), nil
}

// Unmarshaling for JSON
func (u *UUID) UnmarshalJSON(data []byte) error {
	str := strings.Trim(string(data), `"`)
	if len(str) > 36 {
		return fmt.Errorf("invalid JSON UUID %s", str)
	}

	parsed, err := ParseUUID(str)
	if err == nil {
		copy(u[:], parsed[:])
	}

	return err
}

func (u UUID) MarshalText() ([]byte, error) {
	return []byte(u.String()), nil
}

func (u *UUID) UnmarshalText(text []byte) (err error) {
	*u, err = ParseUUID(string(text))
	return
}
