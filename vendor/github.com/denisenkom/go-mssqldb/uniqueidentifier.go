package mssql

import (
	"database/sql/driver"
	"encoding/hex"
	"errors"
	"fmt"
)

type UniqueIdentifier [16]byte

func (u *UniqueIdentifier) Scan(v interface{}) error {
	reverse := func(b []byte) {
		for i, j := 0, len(b)-1; i < j; i, j = i+1, j-1 {
			b[i], b[j] = b[j], b[i]
		}
	}

	switch vt := v.(type) {
	case []byte:
		if len(vt) != 16 {
			return errors.New("mssql: invalid UniqueIdentifier length")
		}

		var raw UniqueIdentifier

		copy(raw[:], vt)

		reverse(raw[0:4])
		reverse(raw[4:6])
		reverse(raw[6:8])
		*u = raw

		return nil
	case string:
		if len(vt) != 36 {
			return errors.New("mssql: invalid UniqueIdentifier string length")
		}

		b := []byte(vt)
		for i, c := range b {
			switch c {
			case '-':
				b = append(b[:i], b[i+1:]...)
			}
		}

		_, err := hex.Decode(u[:], []byte(b))
		return err
	default:
		return fmt.Errorf("mssql: cannot convert %T to UniqueIdentifier", v)
	}
}

func (u UniqueIdentifier) Value() (driver.Value, error) {
	reverse := func(b []byte) {
		for i, j := 0, len(b)-1; i < j; i, j = i+1, j-1 {
			b[i], b[j] = b[j], b[i]
		}
	}

	raw := make([]byte, len(u))
	copy(raw, u[:])

	reverse(raw[0:4])
	reverse(raw[4:6])
	reverse(raw[6:8])

	return raw, nil
}

func (u UniqueIdentifier) String() string {
	return fmt.Sprintf("%X-%X-%X-%X-%X", u[0:4], u[4:6], u[6:8], u[8:10], u[10:])
}

// MarshalText converts Uniqueidentifier to bytes corresponding to the stringified hexadecimal representation of the Uniqueidentifier
// e.g., "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA" -> [65 65 65 65 65 65 65 65 45 65 65 65 65 45 65 65 65 65 45 65 65 65 65 65 65 65 65 65 65 65 65]
func (u UniqueIdentifier) MarshalText() []byte {
	return []byte(u.String())
}
