// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package strfmt

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

func init() {
	d := Date{}
	// register this format in the default registry
	Default.Add("date", &d, IsDate)
}

// IsDate returns true when the string is a valid date
func IsDate(str string) bool {
	_, err := time.Parse(RFC3339FullDate, str)
	return err == nil
}

const (
	// RFC3339FullDate represents a full-date as specified by RFC3339
	// See: http://goo.gl/xXOvVd
	RFC3339FullDate = "2006-01-02"
)

// Date represents a date from the API
//
// swagger:strfmt date
type Date time.Time

// String converts this date into a string
func (d Date) String() string {
	return time.Time(d).Format(RFC3339FullDate)
}

// UnmarshalText parses a text representation into a date type
func (d *Date) UnmarshalText(text []byte) error {
	if len(text) == 0 {
		return nil
	}
	dd, err := time.ParseInLocation(RFC3339FullDate, string(text), DefaultTimeLocation)
	if err != nil {
		return err
	}
	*d = Date(dd)
	return nil
}

// MarshalText serializes this date type to string
func (d Date) MarshalText() ([]byte, error) {
	return []byte(d.String()), nil
}

// Scan scans a Date value from database driver type.
func (d *Date) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		return d.UnmarshalText(v)
	case string:
		return d.UnmarshalText([]byte(v))
	case time.Time:
		*d = Date(v)
		return nil
	case nil:
		*d = Date{}
		return nil
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.Date from: %#v: %w", v, ErrFormat)
	}
}

// Value converts Date to a primitive value ready to written to a database.
func (d Date) Value() (driver.Value, error) {
	return driver.Value(d.String()), nil
}

// MarshalJSON returns the Date as JSON
func (d Date) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Time(d).Format(RFC3339FullDate))
}

// UnmarshalJSON sets the Date from JSON
func (d *Date) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var strdate string
	if err := json.Unmarshal(data, &strdate); err != nil {
		return err
	}
	tt, err := time.ParseInLocation(RFC3339FullDate, strdate, DefaultTimeLocation)
	if err != nil {
		return err
	}
	*d = Date(tt)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (d *Date) DeepCopyInto(out *Date) {
	*out = *d
}

// DeepCopy copies the receiver into a new Date.
func (d *Date) DeepCopy() *Date {
	if d == nil {
		return nil
	}
	out := new(Date)
	d.DeepCopyInto(out)
	return out
}

// GobEncode implements the gob.GobEncoder interface.
func (d Date) GobEncode() ([]byte, error) {
	return d.MarshalBinary()
}

// GobDecode implements the gob.GobDecoder interface.
func (d *Date) GobDecode(data []byte) error {
	return d.UnmarshalBinary(data)
}

// MarshalBinary implements the encoding.BinaryMarshaler interface.
func (d Date) MarshalBinary() ([]byte, error) {
	return time.Time(d).MarshalBinary()
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface.
func (d *Date) UnmarshalBinary(data []byte) error {
	var original time.Time

	err := original.UnmarshalBinary(data)
	if err != nil {
		return err
	}

	*d = Date(original)

	return nil
}

// Equal checks if two Date instances are equal
func (d Date) Equal(d2 Date) bool {
	return time.Time(d).Equal(time.Time(d2))
}
