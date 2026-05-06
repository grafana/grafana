package pgtype

import (
	"database/sql/driver"
	"encoding/binary"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/internal/pgio"
)

type LineScanner interface {
	ScanLine(v Line) error
}

type LineValuer interface {
	LineValue() (Line, error)
}

type Line struct {
	A, B, C float64
	Valid   bool
}

// ScanLine implements the [LineScanner] interface.
func (line *Line) ScanLine(v Line) error {
	*line = v
	return nil
}

// LineValue implements the [LineValuer] interface.
func (line Line) LineValue() (Line, error) {
	return line, nil
}

func (line *Line) Set(src any) error {
	return fmt.Errorf("cannot convert %v to Line", src)
}

// Scan implements the [database/sql.Scanner] interface.
func (line *Line) Scan(src any) error {
	if src == nil {
		*line = Line{}
		return nil
	}

	switch src := src.(type) {
	case string:
		return scanPlanTextAnyToLineScanner{}.Scan([]byte(src), line)
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (line Line) Value() (driver.Value, error) {
	if !line.Valid {
		return nil, nil
	}

	buf, err := LineCodec{}.PlanEncode(nil, 0, TextFormatCode, line).Encode(line, nil)
	if err != nil {
		return nil, err
	}
	return string(buf), err
}

type LineCodec struct{}

func (LineCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (LineCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (LineCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(LineValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return encodePlanLineCodecBinary{}
	case TextFormatCode:
		return encodePlanLineCodecText{}
	}

	return nil
}

type encodePlanLineCodecBinary struct{}

func (encodePlanLineCodecBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	line, err := value.(LineValuer).LineValue()
	if err != nil {
		return nil, err
	}

	if !line.Valid {
		return nil, nil
	}

	buf = pgio.AppendUint64(buf, math.Float64bits(line.A))
	buf = pgio.AppendUint64(buf, math.Float64bits(line.B))
	buf = pgio.AppendUint64(buf, math.Float64bits(line.C))
	return buf, nil
}

type encodePlanLineCodecText struct{}

func (encodePlanLineCodecText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	line, err := value.(LineValuer).LineValue()
	if err != nil {
		return nil, err
	}

	if !line.Valid {
		return nil, nil
	}

	buf = append(buf, fmt.Sprintf(`{%s,%s,%s}`,
		strconv.FormatFloat(line.A, 'f', -1, 64),
		strconv.FormatFloat(line.B, 'f', -1, 64),
		strconv.FormatFloat(line.C, 'f', -1, 64),
	)...)
	return buf, nil
}

func (LineCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case LineScanner:
			return scanPlanBinaryLineToLineScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case LineScanner:
			return scanPlanTextAnyToLineScanner{}
		}
	}

	return nil
}

type scanPlanBinaryLineToLineScanner struct{}

func (scanPlanBinaryLineToLineScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(LineScanner)

	if src == nil {
		return scanner.ScanLine(Line{})
	}

	if len(src) != 24 {
		return fmt.Errorf("invalid length for line: %v", len(src))
	}

	a := binary.BigEndian.Uint64(src)
	b := binary.BigEndian.Uint64(src[8:])
	c := binary.BigEndian.Uint64(src[16:])

	return scanner.ScanLine(Line{
		A:     math.Float64frombits(a),
		B:     math.Float64frombits(b),
		C:     math.Float64frombits(c),
		Valid: true,
	})
}

type scanPlanTextAnyToLineScanner struct{}

func (scanPlanTextAnyToLineScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(LineScanner)

	if src == nil {
		return scanner.ScanLine(Line{})
	}

	if len(src) < 7 {
		return fmt.Errorf("invalid length for line: %v", len(src))
	}

	parts := strings.SplitN(string(src[1:len(src)-1]), ",", 3)
	if len(parts) < 3 {
		return fmt.Errorf("invalid format for line")
	}

	a, err := strconv.ParseFloat(parts[0], 64)
	if err != nil {
		return err
	}

	b, err := strconv.ParseFloat(parts[1], 64)
	if err != nil {
		return err
	}

	c, err := strconv.ParseFloat(parts[2], 64)
	if err != nil {
		return err
	}

	return scanner.ScanLine(Line{A: a, B: b, C: c, Valid: true})
}

func (c LineCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return codecDecodeToTextFormat(c, m, oid, format, src)
}

func (c LineCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var line Line
	err := codecScan(c, m, oid, format, src, &line)
	if err != nil {
		return nil, err
	}
	return line, nil
}
