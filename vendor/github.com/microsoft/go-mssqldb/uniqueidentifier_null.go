package mssql

import (
	"database/sql/driver"
	"encoding/json"
)

type NullUniqueIdentifier struct {
	UUID  UniqueIdentifier
	Valid bool // Valid is true if UUID is not NULL
}

func (n *NullUniqueIdentifier) Scan(v interface{}) error {
	if v == nil {
		*n = NullUniqueIdentifier{
			UUID:  [16]byte{0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0},
			Valid: false,
		}
		return nil
	}
	u := n.UUID
	err := u.Scan(v)
	*n = NullUniqueIdentifier{
		UUID:  u,
		Valid: true,
	}
	return err
}

func (n NullUniqueIdentifier) Value() (driver.Value, error) {
	if !n.Valid {
		return nil, nil
	}
	return n.UUID.Value()
}

func (n NullUniqueIdentifier) String() string {
	if !n.Valid {
		return "NULL"
	}
	return n.UUID.String()
}

func (n NullUniqueIdentifier) MarshalText() (text []byte, err error) {
	if !n.Valid {
		return []byte("null"), nil
	}
	return n.UUID.MarshalText()
}

func (n *NullUniqueIdentifier) UnmarshalJSON(b []byte) error {
	u := n.UUID
	if string(b) == "null" {
		*n = NullUniqueIdentifier{
			UUID:  [16]byte{0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0},
			Valid: false,
		}
		return nil
	}
	err := u.UnmarshalJSON(b)
	*n = NullUniqueIdentifier{
		UUID:  u,
		Valid: true,
	}
	return err
}

func (n NullUniqueIdentifier) MarshalJSON() ([]byte, error) {
	if !n.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(n.UUID)
}
