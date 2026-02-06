// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package strfmt

import (
	cryptorand "crypto/rand"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"io"
	"sync"

	"github.com/oklog/ulid"
)

// ULID represents a ulid string format
// ref:
//
//	https://github.com/ulid/spec
//
// impl:
//
//	https://github.com/oklog/ulid
//
// swagger:strfmt ulid
type ULID struct {
	ulid.ULID
}

var (
	ulidEntropyPool = sync.Pool{
		New: func() any {
			return cryptorand.Reader
		},
	}

	ULIDScanDefaultFunc = func(raw any) (ULID, error) {
		u := NewULIDZero()
		switch x := raw.(type) {
		case nil:
			// zerp ulid
			return u, nil
		case string:
			if x == "" {
				// zero ulid
				return u, nil
			}
			return u, u.UnmarshalText([]byte(x))
		case []byte:
			return u, u.UnmarshalText(x)
		}

		return u, fmt.Errorf("cannot sql.Scan() strfmt.ULID from: %#v: %w", raw, ulid.ErrScanValue)
	}

	// ULIDScanOverrideFunc allows you to override the Scan method of the ULID type
	ULIDScanOverrideFunc = ULIDScanDefaultFunc

	ULIDValueDefaultFunc = func(u ULID) (driver.Value, error) {
		return driver.Value(u.String()), nil
	}

	// ULIDValueOverrideFunc allows you to override the Value method of the ULID type
	ULIDValueOverrideFunc = ULIDValueDefaultFunc
)

func init() {
	// register formats in the default registry:
	//   - ulid
	ulid := ULID{}
	Default.Add("ulid", &ulid, IsULID)
}

// IsULID checks if provided string is ULID format
// Be noticed that this function considers overflowed ULID as non-ulid.
// For more details see https://github.com/ulid/spec
func IsULID(str string) bool {
	_, err := ulid.ParseStrict(str)
	return err == nil
}

// ParseULID parses a string that represents an valid ULID
func ParseULID(str string) (ULID, error) {
	var u ULID

	return u, u.UnmarshalText([]byte(str))
}

// NewULIDZero returns a zero valued ULID type
func NewULIDZero() ULID {
	return ULID{}
}

// NewULID generates new unique ULID value and a error if any
func NewULID() (ULID, error) {
	var u ULID

	obj := ulidEntropyPool.Get()
	entropy, ok := obj.(io.Reader)
	if !ok {
		return u, fmt.Errorf("failed to cast %+v to io.Reader: %w", obj, ErrFormat)
	}

	id, err := ulid.New(ulid.Now(), entropy)
	if err != nil {
		return u, err
	}
	ulidEntropyPool.Put(entropy)

	u.ULID = id
	return u, nil
}

// GetULID returns underlying instance of ULID
func (u *ULID) GetULID() any {
	return u.ULID
}

// MarshalText returns this instance into text
func (u ULID) MarshalText() ([]byte, error) {
	return u.ULID.MarshalText()
}

// UnmarshalText hydrates this instance from text
func (u *ULID) UnmarshalText(data []byte) error { // validation is performed later on
	return u.ULID.UnmarshalText(data)
}

// Scan reads a value from a database driver
func (u *ULID) Scan(raw any) error {
	ul, err := ULIDScanOverrideFunc(raw)
	if err == nil {
		*u = ul
	}
	return err
}

// Value converts a value to a database driver value
func (u ULID) Value() (driver.Value, error) {
	return ULIDValueOverrideFunc(u)
}

func (u ULID) String() string {
	return u.ULID.String()
}

// MarshalJSON returns the ULID as JSON
func (u ULID) MarshalJSON() ([]byte, error) {
	return json.Marshal(u.String())
}

// UnmarshalJSON sets the ULID from JSON
func (u *ULID) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	id, err := ulid.ParseStrict(ustr)
	if err != nil {
		return fmt.Errorf("couldn't parse JSON value as ULID: %w", err)
	}
	u.ULID = id
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *ULID) DeepCopyInto(out *ULID) {
	*out = *u
}

// DeepCopy copies the receiver into a new ULID.
func (u *ULID) DeepCopy() *ULID {
	if u == nil {
		return nil
	}
	out := new(ULID)
	u.DeepCopyInto(out)
	return out
}

// GobEncode implements the gob.GobEncoder interface.
func (u ULID) GobEncode() ([]byte, error) {
	return u.ULID.MarshalBinary()
}

// GobDecode implements the gob.GobDecoder interface.
func (u *ULID) GobDecode(data []byte) error {
	return u.ULID.UnmarshalBinary(data)
}

// MarshalBinary implements the encoding.BinaryMarshaler interface.
func (u ULID) MarshalBinary() ([]byte, error) {
	return u.ULID.MarshalBinary()
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface.
func (u *ULID) UnmarshalBinary(data []byte) error {
	return u.ULID.UnmarshalBinary(data)
}

// Equal checks if two ULID instances are equal by their underlying type
func (u ULID) Equal(other ULID) bool {
	return u.ULID == other.ULID
}
