package pgtype

import (
	"database/sql/driver"
	"encoding/binary"
	"fmt"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/internal/pgio"
)

type TIDScanner interface {
	ScanTID(v TID) error
}

type TIDValuer interface {
	TIDValue() (TID, error)
}

// TID is PostgreSQL's Tuple Identifier type.
//
// When one does
//
//	select ctid, * from some_table;
//
// it is the data type of the ctid hidden system column.
//
// It is currently implemented as a pair unsigned two byte integers.
// Its conversion functions can be found in src/backend/utils/adt/tid.c
// in the PostgreSQL sources.
type TID struct {
	BlockNumber  uint32
	OffsetNumber uint16
	Valid        bool
}

// ScanTID implements the [TIDScanner] interface.
func (b *TID) ScanTID(v TID) error {
	*b = v
	return nil
}

// TIDValue implements the [TIDValuer] interface.
func (b TID) TIDValue() (TID, error) {
	return b, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (dst *TID) Scan(src any) error {
	if src == nil {
		*dst = TID{}
		return nil
	}

	switch src := src.(type) {
	case string:
		return scanPlanTextAnyToTIDScanner{}.Scan([]byte(src), dst)
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (src TID) Value() (driver.Value, error) {
	if !src.Valid {
		return nil, nil
	}

	buf, err := TIDCodec{}.PlanEncode(nil, 0, TextFormatCode, src).Encode(src, nil)
	if err != nil {
		return nil, err
	}
	return string(buf), err
}

type TIDCodec struct{}

func (TIDCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (TIDCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (TIDCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(TIDValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return encodePlanTIDCodecBinary{}
	case TextFormatCode:
		return encodePlanTIDCodecText{}
	}

	return nil
}

type encodePlanTIDCodecBinary struct{}

func (encodePlanTIDCodecBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	tid, err := value.(TIDValuer).TIDValue()
	if err != nil {
		return nil, err
	}

	if !tid.Valid {
		return nil, nil
	}

	buf = pgio.AppendUint32(buf, tid.BlockNumber)
	buf = pgio.AppendUint16(buf, tid.OffsetNumber)
	return buf, nil
}

type encodePlanTIDCodecText struct{}

func (encodePlanTIDCodecText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	tid, err := value.(TIDValuer).TIDValue()
	if err != nil {
		return nil, err
	}

	if !tid.Valid {
		return nil, nil
	}

	buf = append(buf, fmt.Sprintf(`(%d,%d)`, tid.BlockNumber, tid.OffsetNumber)...)
	return buf, nil
}

func (TIDCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case TIDScanner:
			return scanPlanBinaryTIDToTIDScanner{}
		case TextScanner:
			return scanPlanBinaryTIDToTextScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case TIDScanner:
			return scanPlanTextAnyToTIDScanner{}
		}
	}

	return nil
}

type scanPlanBinaryTIDToTIDScanner struct{}

func (scanPlanBinaryTIDToTIDScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(TIDScanner)

	if src == nil {
		return scanner.ScanTID(TID{})
	}

	if len(src) != 6 {
		return fmt.Errorf("invalid length for tid: %v", len(src))
	}

	return scanner.ScanTID(TID{
		BlockNumber:  binary.BigEndian.Uint32(src),
		OffsetNumber: binary.BigEndian.Uint16(src[4:]),
		Valid:        true,
	})
}

type scanPlanBinaryTIDToTextScanner struct{}

func (scanPlanBinaryTIDToTextScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(TextScanner)

	if src == nil {
		return scanner.ScanText(Text{})
	}

	if len(src) != 6 {
		return fmt.Errorf("invalid length for tid: %v", len(src))
	}

	blockNumber := binary.BigEndian.Uint32(src)
	offsetNumber := binary.BigEndian.Uint16(src[4:])

	return scanner.ScanText(Text{
		String: fmt.Sprintf(`(%d,%d)`, blockNumber, offsetNumber),
		Valid:  true,
	})
}

type scanPlanTextAnyToTIDScanner struct{}

func (scanPlanTextAnyToTIDScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(TIDScanner)

	if src == nil {
		return scanner.ScanTID(TID{})
	}

	if len(src) < 5 {
		return fmt.Errorf("invalid length for tid: %v", len(src))
	}

	block, offset, found := strings.Cut(string(src[1:len(src)-1]), ",")
	if !found {
		return fmt.Errorf("invalid format for tid")
	}

	blockNumber, err := strconv.ParseUint(block, 10, 32)
	if err != nil {
		return err
	}

	offsetNumber, err := strconv.ParseUint(offset, 10, 16)
	if err != nil {
		return err
	}

	return scanner.ScanTID(TID{BlockNumber: uint32(blockNumber), OffsetNumber: uint16(offsetNumber), Valid: true})
}

func (c TIDCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return codecDecodeToTextFormat(c, m, oid, format, src)
}

func (c TIDCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var tid TID
	err := codecScan(c, m, oid, format, src, &tid)
	if err != nil {
		return nil, err
	}
	return tid, nil
}
