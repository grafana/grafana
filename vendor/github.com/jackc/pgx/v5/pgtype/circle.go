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

type CircleScanner interface {
	ScanCircle(v Circle) error
}

type CircleValuer interface {
	CircleValue() (Circle, error)
}

type Circle struct {
	P     Vec2
	R     float64
	Valid bool
}

// ScanCircle implements the [CircleScanner] interface.
func (c *Circle) ScanCircle(v Circle) error {
	*c = v
	return nil
}

// CircleValue implements the [CircleValuer] interface.
func (c Circle) CircleValue() (Circle, error) {
	return c, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (dst *Circle) Scan(src any) error {
	if src == nil {
		*dst = Circle{}
		return nil
	}

	switch src := src.(type) {
	case string:
		return scanPlanTextAnyToCircleScanner{}.Scan([]byte(src), dst)
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (src Circle) Value() (driver.Value, error) {
	if !src.Valid {
		return nil, nil
	}

	buf, err := CircleCodec{}.PlanEncode(nil, 0, TextFormatCode, src).Encode(src, nil)
	if err != nil {
		return nil, err
	}
	return string(buf), err
}

type CircleCodec struct{}

func (CircleCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (CircleCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (CircleCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(CircleValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return encodePlanCircleCodecBinary{}
	case TextFormatCode:
		return encodePlanCircleCodecText{}
	}

	return nil
}

type encodePlanCircleCodecBinary struct{}

func (encodePlanCircleCodecBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	circle, err := value.(CircleValuer).CircleValue()
	if err != nil {
		return nil, err
	}

	if !circle.Valid {
		return nil, nil
	}

	buf = pgio.AppendUint64(buf, math.Float64bits(circle.P.X))
	buf = pgio.AppendUint64(buf, math.Float64bits(circle.P.Y))
	buf = pgio.AppendUint64(buf, math.Float64bits(circle.R))
	return buf, nil
}

type encodePlanCircleCodecText struct{}

func (encodePlanCircleCodecText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	circle, err := value.(CircleValuer).CircleValue()
	if err != nil {
		return nil, err
	}

	if !circle.Valid {
		return nil, nil
	}

	buf = append(buf, fmt.Sprintf(`<(%s,%s),%s>`,
		strconv.FormatFloat(circle.P.X, 'f', -1, 64),
		strconv.FormatFloat(circle.P.Y, 'f', -1, 64),
		strconv.FormatFloat(circle.R, 'f', -1, 64),
	)...)
	return buf, nil
}

func (CircleCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case CircleScanner:
			return scanPlanBinaryCircleToCircleScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case CircleScanner:
			return scanPlanTextAnyToCircleScanner{}
		}
	}

	return nil
}

func (c CircleCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return codecDecodeToTextFormat(c, m, oid, format, src)
}

func (c CircleCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var circle Circle
	err := codecScan(c, m, oid, format, src, &circle)
	if err != nil {
		return nil, err
	}
	return circle, nil
}

type scanPlanBinaryCircleToCircleScanner struct{}

func (scanPlanBinaryCircleToCircleScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(CircleScanner)

	if src == nil {
		return scanner.ScanCircle(Circle{})
	}

	if len(src) != 24 {
		return fmt.Errorf("invalid length for Circle: %v", len(src))
	}

	x := binary.BigEndian.Uint64(src)
	y := binary.BigEndian.Uint64(src[8:])
	r := binary.BigEndian.Uint64(src[16:])

	return scanner.ScanCircle(Circle{
		P:     Vec2{math.Float64frombits(x), math.Float64frombits(y)},
		R:     math.Float64frombits(r),
		Valid: true,
	})
}

type scanPlanTextAnyToCircleScanner struct{}

func (scanPlanTextAnyToCircleScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(CircleScanner)

	if src == nil {
		return scanner.ScanCircle(Circle{})
	}

	if len(src) < 9 {
		return fmt.Errorf("invalid length for Circle: %v", len(src))
	}

	str := string(src[2:])
	end := strings.IndexByte(str, ',')
	x, err := strconv.ParseFloat(str[:end], 64)
	if err != nil {
		return err
	}

	str = str[end+1:]
	end = strings.IndexByte(str, ')')

	y, err := strconv.ParseFloat(str[:end], 64)
	if err != nil {
		return err
	}

	str = str[end+2 : len(str)-1]

	r, err := strconv.ParseFloat(str, 64)
	if err != nil {
		return err
	}

	return scanner.ScanCircle(Circle{P: Vec2{x, y}, R: r, Valid: true})
}
