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

type BoxScanner interface {
	ScanBox(v Box) error
}

type BoxValuer interface {
	BoxValue() (Box, error)
}

type Box struct {
	P     [2]Vec2
	Valid bool
}

// ScanBox implements the [BoxScanner] interface.
func (b *Box) ScanBox(v Box) error {
	*b = v
	return nil
}

// BoxValue implements the [BoxValuer] interface.
func (b Box) BoxValue() (Box, error) {
	return b, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (dst *Box) Scan(src any) error {
	if src == nil {
		*dst = Box{}
		return nil
	}

	switch src := src.(type) {
	case string:
		return scanPlanTextAnyToBoxScanner{}.Scan([]byte(src), dst)
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (src Box) Value() (driver.Value, error) {
	if !src.Valid {
		return nil, nil
	}

	buf, err := BoxCodec{}.PlanEncode(nil, 0, TextFormatCode, src).Encode(src, nil)
	if err != nil {
		return nil, err
	}
	return string(buf), err
}

type BoxCodec struct{}

func (BoxCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (BoxCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (BoxCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(BoxValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return encodePlanBoxCodecBinary{}
	case TextFormatCode:
		return encodePlanBoxCodecText{}
	}

	return nil
}

type encodePlanBoxCodecBinary struct{}

func (encodePlanBoxCodecBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	box, err := value.(BoxValuer).BoxValue()
	if err != nil {
		return nil, err
	}

	if !box.Valid {
		return nil, nil
	}

	buf = pgio.AppendUint64(buf, math.Float64bits(box.P[0].X))
	buf = pgio.AppendUint64(buf, math.Float64bits(box.P[0].Y))
	buf = pgio.AppendUint64(buf, math.Float64bits(box.P[1].X))
	buf = pgio.AppendUint64(buf, math.Float64bits(box.P[1].Y))
	return buf, nil
}

type encodePlanBoxCodecText struct{}

func (encodePlanBoxCodecText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	box, err := value.(BoxValuer).BoxValue()
	if err != nil {
		return nil, err
	}

	if !box.Valid {
		return nil, nil
	}

	buf = append(buf, fmt.Sprintf(`(%s,%s),(%s,%s)`,
		strconv.FormatFloat(box.P[0].X, 'f', -1, 64),
		strconv.FormatFloat(box.P[0].Y, 'f', -1, 64),
		strconv.FormatFloat(box.P[1].X, 'f', -1, 64),
		strconv.FormatFloat(box.P[1].Y, 'f', -1, 64),
	)...)
	return buf, nil
}

func (BoxCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case BoxScanner:
			return scanPlanBinaryBoxToBoxScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case BoxScanner:
			return scanPlanTextAnyToBoxScanner{}
		}
	}

	return nil
}

type scanPlanBinaryBoxToBoxScanner struct{}

func (scanPlanBinaryBoxToBoxScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(BoxScanner)

	if src == nil {
		return scanner.ScanBox(Box{})
	}

	if len(src) != 32 {
		return fmt.Errorf("invalid length for Box: %v", len(src))
	}

	x1 := binary.BigEndian.Uint64(src)
	y1 := binary.BigEndian.Uint64(src[8:])
	x2 := binary.BigEndian.Uint64(src[16:])
	y2 := binary.BigEndian.Uint64(src[24:])

	return scanner.ScanBox(Box{
		P: [2]Vec2{
			{math.Float64frombits(x1), math.Float64frombits(y1)},
			{math.Float64frombits(x2), math.Float64frombits(y2)},
		},
		Valid: true,
	})
}

type scanPlanTextAnyToBoxScanner struct{}

func (scanPlanTextAnyToBoxScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(BoxScanner)

	if src == nil {
		return scanner.ScanBox(Box{})
	}

	if len(src) < 11 {
		return fmt.Errorf("invalid length for Box: %v", len(src))
	}

	str := string(src[1:])

	var end int
	end = strings.IndexByte(str, ',')

	x1, err := strconv.ParseFloat(str[:end], 64)
	if err != nil {
		return err
	}

	str = str[end+1:]
	end = strings.IndexByte(str, ')')

	y1, err := strconv.ParseFloat(str[:end], 64)
	if err != nil {
		return err
	}

	str = str[end+3:]
	end = strings.IndexByte(str, ',')

	x2, err := strconv.ParseFloat(str[:end], 64)
	if err != nil {
		return err
	}

	str = str[end+1 : len(str)-1]

	y2, err := strconv.ParseFloat(str, 64)
	if err != nil {
		return err
	}

	return scanner.ScanBox(Box{P: [2]Vec2{{x1, y1}, {x2, y2}}, Valid: true})
}

func (c BoxCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return codecDecodeToTextFormat(c, m, oid, format, src)
}

func (c BoxCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var box Box
	err := codecScan(c, m, oid, format, src, &box)
	if err != nil {
		return nil, err
	}
	return box, nil
}
