package pgtype

import (
	"database/sql/driver"
	"encoding/hex"
	"fmt"
)

type BytesScanner interface {
	// ScanBytes receives a byte slice of driver memory that is only valid until the next database method call.
	ScanBytes(v []byte) error
}

type BytesValuer interface {
	// BytesValue returns a byte slice of the byte data. The caller must not change the returned slice.
	BytesValue() ([]byte, error)
}

// DriverBytes is a byte slice that holds a reference to memory owned by the driver. It is only valid from the time it
// is scanned until Rows.Next or Rows.Close is called. It is never safe to use DriverBytes with QueryRow as Row.Scan
// internally calls Rows.Close before returning.
type DriverBytes []byte

func (b *DriverBytes) ScanBytes(v []byte) error {
	*b = v
	return nil
}

// PreallocBytes is a byte slice of preallocated memory that scanned bytes will be copied to. If it is too small a new
// slice will be allocated.
type PreallocBytes []byte

func (b *PreallocBytes) ScanBytes(v []byte) error {
	if v == nil {
		*b = nil
		return nil
	}

	if len(v) <= len(*b) {
		*b = (*b)[:len(v)]
	} else {
		*b = make(PreallocBytes, len(v))
	}
	copy(*b, v)
	return nil
}

// UndecodedBytes can be used as a scan target to get the raw bytes from PostgreSQL without any decoding.
type UndecodedBytes []byte

type scanPlanAnyToUndecodedBytes struct{}

func (scanPlanAnyToUndecodedBytes) Scan(src []byte, dst any) error {
	dstBuf := dst.(*UndecodedBytes)
	if src == nil {
		*dstBuf = nil
		return nil
	}

	*dstBuf = make([]byte, len(src))
	copy(*dstBuf, src)
	return nil
}

type ByteaCodec struct{}

func (ByteaCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (ByteaCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (ByteaCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch format {
	case BinaryFormatCode:
		switch value.(type) {
		case []byte:
			return encodePlanBytesCodecBinaryBytes{}
		case BytesValuer:
			return encodePlanBytesCodecBinaryBytesValuer{}
		}
	case TextFormatCode:
		switch value.(type) {
		case []byte:
			return encodePlanBytesCodecTextBytes{}
		case BytesValuer:
			return encodePlanBytesCodecTextBytesValuer{}
		}
	}

	return nil
}

type encodePlanBytesCodecBinaryBytes struct{}

func (encodePlanBytesCodecBinaryBytes) Encode(value any, buf []byte) (newBuf []byte, err error) {
	b := value.([]byte)
	if b == nil {
		return nil, nil
	}

	return append(buf, b...), nil
}

type encodePlanBytesCodecBinaryBytesValuer struct{}

func (encodePlanBytesCodecBinaryBytesValuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	b, err := value.(BytesValuer).BytesValue()
	if err != nil {
		return nil, err
	}
	if b == nil {
		return nil, nil
	}

	return append(buf, b...), nil
}

type encodePlanBytesCodecTextBytes struct{}

func (encodePlanBytesCodecTextBytes) Encode(value any, buf []byte) (newBuf []byte, err error) {
	b := value.([]byte)
	if b == nil {
		return nil, nil
	}

	buf = append(buf, `\x`...)
	buf = append(buf, hex.EncodeToString(b)...)
	return buf, nil
}

type encodePlanBytesCodecTextBytesValuer struct{}

func (encodePlanBytesCodecTextBytesValuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	b, err := value.(BytesValuer).BytesValue()
	if err != nil {
		return nil, err
	}
	if b == nil {
		return nil, nil
	}

	buf = append(buf, `\x`...)
	buf = append(buf, hex.EncodeToString(b)...)
	return buf, nil
}

func (ByteaCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case *[]byte:
			return scanPlanBinaryBytesToBytes{}
		case BytesScanner:
			return scanPlanBinaryBytesToBytesScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case *[]byte:
			return scanPlanTextByteaToBytes{}
		case BytesScanner:
			return scanPlanTextByteaToBytesScanner{}
		}
	}

	return nil
}

type scanPlanBinaryBytesToBytes struct{}

func (scanPlanBinaryBytesToBytes) Scan(src []byte, dst any) error {
	dstBuf := dst.(*[]byte)
	if src == nil {
		*dstBuf = nil
		return nil
	}

	*dstBuf = make([]byte, len(src))
	copy(*dstBuf, src)
	return nil
}

type scanPlanBinaryBytesToBytesScanner struct{}

func (scanPlanBinaryBytesToBytesScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(BytesScanner)
	return scanner.ScanBytes(src)
}

type scanPlanTextByteaToBytes struct{}

func (scanPlanTextByteaToBytes) Scan(src []byte, dst any) error {
	dstBuf := dst.(*[]byte)
	if src == nil {
		*dstBuf = nil
		return nil
	}

	buf, err := decodeHexBytea(src)
	if err != nil {
		return err
	}
	*dstBuf = buf

	return nil
}

type scanPlanTextByteaToBytesScanner struct{}

func (scanPlanTextByteaToBytesScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(BytesScanner)
	buf, err := decodeHexBytea(src)
	if err != nil {
		return err
	}
	return scanner.ScanBytes(buf)
}

func decodeHexBytea(src []byte) ([]byte, error) {
	if src == nil {
		return nil, nil
	}

	if len(src) < 2 || src[0] != '\\' || src[1] != 'x' {
		return nil, fmt.Errorf("invalid hex format")
	}

	buf := make([]byte, (len(src)-2)/2)
	_, err := hex.Decode(buf, src[2:])
	if err != nil {
		return nil, err
	}

	return buf, nil
}

func (c ByteaCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return c.DecodeValue(m, oid, format, src)
}

func (c ByteaCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var buf []byte
	err := codecScan(c, m, oid, format, src, &buf)
	if err != nil {
		return nil, err
	}
	return buf, nil
}
