// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package strfmt

import (
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"time"

	"github.com/oklog/ulid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/bsontype"
	bsonprim "go.mongodb.org/mongo-driver/bson/primitive"
)

var (
	_ bson.Marshaler   = Date{}
	_ bson.Unmarshaler = &Date{}
	_ bson.Marshaler   = Base64{}
	_ bson.Unmarshaler = &Base64{}
	_ bson.Marshaler   = Duration(0)
	_ bson.Unmarshaler = (*Duration)(nil)
	_ bson.Marshaler   = DateTime{}
	_ bson.Unmarshaler = &DateTime{}
	_ bson.Marshaler   = ULID{}
	_ bson.Unmarshaler = &ULID{}
	_ bson.Marshaler   = URI("")
	_ bson.Unmarshaler = (*URI)(nil)
	_ bson.Marshaler   = Email("")
	_ bson.Unmarshaler = (*Email)(nil)
	_ bson.Marshaler   = Hostname("")
	_ bson.Unmarshaler = (*Hostname)(nil)
	_ bson.Marshaler   = IPv4("")
	_ bson.Unmarshaler = (*IPv4)(nil)
	_ bson.Marshaler   = IPv6("")
	_ bson.Unmarshaler = (*IPv6)(nil)
	_ bson.Marshaler   = CIDR("")
	_ bson.Unmarshaler = (*CIDR)(nil)
	_ bson.Marshaler   = MAC("")
	_ bson.Unmarshaler = (*MAC)(nil)
	_ bson.Marshaler   = Password("")
	_ bson.Unmarshaler = (*Password)(nil)
	_ bson.Marshaler   = UUID("")
	_ bson.Unmarshaler = (*UUID)(nil)
	_ bson.Marshaler   = UUID3("")
	_ bson.Unmarshaler = (*UUID3)(nil)
	_ bson.Marshaler   = UUID4("")
	_ bson.Unmarshaler = (*UUID4)(nil)
	_ bson.Marshaler   = UUID5("")
	_ bson.Unmarshaler = (*UUID5)(nil)
	_ bson.Marshaler   = UUID7("")
	_ bson.Unmarshaler = (*UUID7)(nil)
	_ bson.Marshaler   = ISBN("")
	_ bson.Unmarshaler = (*ISBN)(nil)
	_ bson.Marshaler   = ISBN10("")
	_ bson.Unmarshaler = (*ISBN10)(nil)
	_ bson.Marshaler   = ISBN13("")
	_ bson.Unmarshaler = (*ISBN13)(nil)
	_ bson.Marshaler   = CreditCard("")
	_ bson.Unmarshaler = (*CreditCard)(nil)
	_ bson.Marshaler   = SSN("")
	_ bson.Unmarshaler = (*SSN)(nil)
	_ bson.Marshaler   = HexColor("")
	_ bson.Unmarshaler = (*HexColor)(nil)
	_ bson.Marshaler   = RGBColor("")
	_ bson.Unmarshaler = (*RGBColor)(nil)
	_ bson.Marshaler   = ObjectId{}
	_ bson.Unmarshaler = &ObjectId{}

	_ bson.ValueMarshaler   = DateTime{}
	_ bson.ValueUnmarshaler = &DateTime{}
	_ bson.ValueMarshaler   = ObjectId{}
	_ bson.ValueUnmarshaler = &ObjectId{}
)

const (
	millisec         = 1000
	microsec         = 1_000_000
	bsonDateTimeSize = 8
)

func (d Date) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": d.String()})
}

func (d *Date) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if data, ok := m["data"].(string); ok {
		rd, err := time.ParseInLocation(RFC3339FullDate, data, DefaultTimeLocation)
		if err != nil {
			return err
		}
		*d = Date(rd)
		return nil
	}

	return fmt.Errorf("couldn't unmarshal bson bytes value as Date: %w", ErrFormat)
}

// MarshalBSON document from this value
func (b Base64) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": b.String()})
}

// UnmarshalBSON document into this value
func (b *Base64) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if bd, ok := m["data"].(string); ok {
		vb, err := base64.StdEncoding.DecodeString(bd)
		if err != nil {
			return err
		}
		*b = Base64(vb)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as base64: %w", ErrFormat)
}

func (d Duration) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": d.String()})
}

func (d *Duration) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if data, ok := m["data"].(string); ok {
		rd, err := ParseDuration(data)
		if err != nil {
			return err
		}
		*d = Duration(rd)
		return nil
	}

	return fmt.Errorf("couldn't unmarshal bson bytes value as Date: %w", ErrFormat)
}

// MarshalBSON renders the DateTime as a BSON document
func (t DateTime) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": t})
}

// UnmarshalBSON reads the DateTime from a BSON document
func (t *DateTime) UnmarshalBSON(data []byte) error {
	var obj struct {
		Data DateTime
	}

	if err := bson.Unmarshal(data, &obj); err != nil {
		return err
	}

	*t = obj.Data

	return nil
}

// MarshalBSONValue is an interface implemented by types that can marshal themselves
// into a BSON document represented as bytes. The bytes returned must be a valid
// BSON document if the error is nil.
//
// Marshals a DateTime as a bson.TypeDateTime, an int64 representing
// milliseconds since epoch.
func (t DateTime) MarshalBSONValue() (bsontype.Type, []byte, error) {
	// UnixNano cannot be used directly, the result of calling UnixNano on the zero
	// Time is undefined. Thats why we use time.Nanosecond() instead.

	tNorm := NormalizeTimeForMarshal(time.Time(t))
	i64 := tNorm.Unix()*millisec + int64(tNorm.Nanosecond())/microsec
	buf := make([]byte, bsonDateTimeSize)
	binary.LittleEndian.PutUint64(buf, uint64(i64)) //nolint:gosec // it's okay to handle negative int64 this way

	return bson.TypeDateTime, buf, nil
}

// UnmarshalBSONValue is an interface implemented by types that can unmarshal a
// BSON value representation of themselves. The BSON bytes and type can be
// assumed to be valid. UnmarshalBSONValue must copy the BSON value bytes if it
// wishes to retain the data after returning.
func (t *DateTime) UnmarshalBSONValue(tpe bsontype.Type, data []byte) error {
	if tpe == bson.TypeNull {
		*t = DateTime{}
		return nil
	}

	if len(data) != bsonDateTimeSize {
		return fmt.Errorf("bson date field length not exactly %d bytes: %w", bsonDateTimeSize, ErrFormat)
	}

	i64 := int64(binary.LittleEndian.Uint64(data)) //nolint:gosec // it's okay if we overflow and get a negative datetime
	*t = DateTime(time.Unix(i64/millisec, i64%millisec*microsec))

	return nil
}

// MarshalBSON document from this value
func (u ULID) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *ULID) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		id, err := ulid.ParseStrict(ud)
		if err != nil {
			return fmt.Errorf("couldn't parse bson bytes as ULID: %w: %w", err, ErrFormat)
		}
		u.ULID = id
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as ULID: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u URI) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *URI) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = URI(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as uri: %w", ErrFormat)
}

// MarshalBSON document from this value
func (e Email) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": e.String()})
}

// UnmarshalBSON document into this value
func (e *Email) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*e = Email(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as email: %w", ErrFormat)
}

// MarshalBSON document from this value
func (h Hostname) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": h.String()})
}

// UnmarshalBSON document into this value
func (h *Hostname) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*h = Hostname(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as hostname: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u IPv4) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *IPv4) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = IPv4(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as ipv4: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u IPv6) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *IPv6) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = IPv6(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as ipv6: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u CIDR) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *CIDR) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = CIDR(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as CIDR: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u MAC) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *MAC) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = MAC(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as MAC: %w", ErrFormat)
}

// MarshalBSON document from this value
func (r Password) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": r.String()})
}

// UnmarshalBSON document into this value
func (r *Password) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*r = Password(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as Password: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u UUID) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *UUID) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = UUID(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as UUID: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u UUID3) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *UUID3) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = UUID3(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as UUID3: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u UUID4) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *UUID4) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = UUID4(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as UUID4: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u UUID5) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *UUID5) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = UUID5(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as UUID5: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u UUID7) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *UUID7) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = UUID7(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as UUID7: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u ISBN) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *ISBN) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = ISBN(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as ISBN: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u ISBN10) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *ISBN10) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = ISBN10(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as ISBN10: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u ISBN13) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *ISBN13) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = ISBN13(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as ISBN13: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u CreditCard) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *CreditCard) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = CreditCard(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as CreditCard: %w", ErrFormat)
}

// MarshalBSON document from this value
func (u SSN) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": u.String()})
}

// UnmarshalBSON document into this value
func (u *SSN) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*u = SSN(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as SSN: %w", ErrFormat)
}

// MarshalBSON document from this value
func (h HexColor) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": h.String()})
}

// UnmarshalBSON document into this value
func (h *HexColor) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*h = HexColor(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as HexColor: %w", ErrFormat)
}

// MarshalBSON document from this value
func (r RGBColor) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": r.String()})
}

// UnmarshalBSON document into this value
func (r *RGBColor) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if ud, ok := m["data"].(string); ok {
		*r = RGBColor(ud)
		return nil
	}
	return fmt.Errorf("couldn't unmarshal bson bytes as RGBColor: %w", ErrFormat)
}

// MarshalBSON renders the object id as a BSON document
func (id ObjectId) MarshalBSON() ([]byte, error) {
	return bson.Marshal(bson.M{"data": bsonprim.ObjectID(id)})
}

// UnmarshalBSON reads the objectId from a BSON document
func (id *ObjectId) UnmarshalBSON(data []byte) error {
	var obj struct {
		Data bsonprim.ObjectID
	}
	if err := bson.Unmarshal(data, &obj); err != nil {
		return err
	}
	*id = ObjectId(obj.Data)
	return nil
}

// MarshalBSONValue is an interface implemented by types that can marshal themselves
// into a BSON document represented as bytes. The bytes returned must be a valid
// BSON document if the error is nil.
func (id ObjectId) MarshalBSONValue() (bsontype.Type, []byte, error) {
	oid := bsonprim.ObjectID(id)
	return bson.TypeObjectID, oid[:], nil
}

// UnmarshalBSONValue is an interface implemented by types that can unmarshal a
// BSON value representation of themselves. The BSON bytes and type can be
// assumed to be valid. UnmarshalBSONValue must copy the BSON value bytes if it
// wishes to retain the data after returning.
func (id *ObjectId) UnmarshalBSONValue(_ bsontype.Type, data []byte) error {
	var oid bsonprim.ObjectID
	copy(oid[:], data)
	*id = ObjectId(oid)
	return nil
}
