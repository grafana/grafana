package core

import (
	"database/sql/driver"
	"fmt"
	"time"
)

type NullTime time.Time

var (
	_ driver.Valuer = NullTime{}
)

func (ns *NullTime) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	return convertTime(ns, value)
}

// Value implements the driver Valuer interface.
func (ns NullTime) Value() (driver.Value, error) {
	if (time.Time)(ns).IsZero() {
		return nil, nil
	}
	return (time.Time)(ns).Format("2006-01-02 15:04:05"), nil
}

func convertTime(dest *NullTime, src interface{}) error {
	// Common cases, without reflect.
	switch s := src.(type) {
	case string:
		t, err := time.Parse("2006-01-02 15:04:05", s)
		if err != nil {
			return err
		}
		*dest = NullTime(t)
		return nil
	case []uint8:
		t, err := time.Parse("2006-01-02 15:04:05", string(s))
		if err != nil {
			return err
		}
		*dest = NullTime(t)
		return nil
	case time.Time:
		*dest = NullTime(s)
		return nil
	case nil:
	default:
		return fmt.Errorf("unsupported driver -> Scan pair: %T -> %T", src, dest)
	}
	return nil
}
