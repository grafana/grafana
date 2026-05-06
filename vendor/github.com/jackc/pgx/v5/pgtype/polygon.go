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

type PolygonScanner interface {
	ScanPolygon(v Polygon) error
}

type PolygonValuer interface {
	PolygonValue() (Polygon, error)
}

type Polygon struct {
	P     []Vec2
	Valid bool
}

// ScanPolygon implements the [PolygonScanner] interface.
func (p *Polygon) ScanPolygon(v Polygon) error {
	*p = v
	return nil
}

// PolygonValue implements the [PolygonValuer] interface.
func (p Polygon) PolygonValue() (Polygon, error) {
	return p, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (p *Polygon) Scan(src any) error {
	if src == nil {
		*p = Polygon{}
		return nil
	}

	switch src := src.(type) {
	case string:
		return scanPlanTextAnyToPolygonScanner{}.Scan([]byte(src), p)
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (p Polygon) Value() (driver.Value, error) {
	if !p.Valid {
		return nil, nil
	}

	buf, err := PolygonCodec{}.PlanEncode(nil, 0, TextFormatCode, p).Encode(p, nil)
	if err != nil {
		return nil, err
	}

	return string(buf), err
}

type PolygonCodec struct{}

func (PolygonCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (PolygonCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (PolygonCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(PolygonValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return encodePlanPolygonCodecBinary{}
	case TextFormatCode:
		return encodePlanPolygonCodecText{}
	}

	return nil
}

type encodePlanPolygonCodecBinary struct{}

func (encodePlanPolygonCodecBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	polygon, err := value.(PolygonValuer).PolygonValue()
	if err != nil {
		return nil, err
	}

	if !polygon.Valid {
		return nil, nil
	}

	buf = pgio.AppendInt32(buf, int32(len(polygon.P)))

	for _, p := range polygon.P {
		buf = pgio.AppendUint64(buf, math.Float64bits(p.X))
		buf = pgio.AppendUint64(buf, math.Float64bits(p.Y))
	}

	return buf, nil
}

type encodePlanPolygonCodecText struct{}

func (encodePlanPolygonCodecText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	polygon, err := value.(PolygonValuer).PolygonValue()
	if err != nil {
		return nil, err
	}

	if !polygon.Valid {
		return nil, nil
	}

	buf = append(buf, '(')

	for i, p := range polygon.P {
		if i > 0 {
			buf = append(buf, ',')
		}
		buf = append(buf, fmt.Sprintf(`(%s,%s)`,
			strconv.FormatFloat(p.X, 'f', -1, 64),
			strconv.FormatFloat(p.Y, 'f', -1, 64),
		)...)
	}

	buf = append(buf, ')')

	return buf, nil
}

func (PolygonCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case PolygonScanner:
			return scanPlanBinaryPolygonToPolygonScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case PolygonScanner:
			return scanPlanTextAnyToPolygonScanner{}
		}
	}

	return nil
}

type scanPlanBinaryPolygonToPolygonScanner struct{}

func (scanPlanBinaryPolygonToPolygonScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(PolygonScanner)

	if src == nil {
		return scanner.ScanPolygon(Polygon{})
	}

	if len(src) < 5 {
		return fmt.Errorf("invalid length for polygon: %v", len(src))
	}

	pointCount := int(binary.BigEndian.Uint32(src))
	rp := 4

	if 4+pointCount*16 != len(src) {
		return fmt.Errorf("invalid length for Polygon with %d points: %v", pointCount, len(src))
	}

	points := make([]Vec2, pointCount)
	for i := range points {
		x := binary.BigEndian.Uint64(src[rp:])
		rp += 8
		y := binary.BigEndian.Uint64(src[rp:])
		rp += 8
		points[i] = Vec2{math.Float64frombits(x), math.Float64frombits(y)}
	}

	return scanner.ScanPolygon(Polygon{
		P:     points,
		Valid: true,
	})
}

type scanPlanTextAnyToPolygonScanner struct{}

func (scanPlanTextAnyToPolygonScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(PolygonScanner)

	if src == nil {
		return scanner.ScanPolygon(Polygon{})
	}

	if len(src) < 7 {
		return fmt.Errorf("invalid length for Polygon: %v", len(src))
	}

	points := make([]Vec2, 0)

	str := string(src[2:])

	for {
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

		points = append(points, Vec2{x, y})

		if end+3 < len(str) {
			str = str[end+3:]
		} else {
			break
		}
	}

	return scanner.ScanPolygon(Polygon{P: points, Valid: true})
}

func (c PolygonCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return codecDecodeToTextFormat(c, m, oid, format, src)
}

func (c PolygonCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var polygon Polygon
	err := codecScan(c, m, oid, format, src, &polygon)
	if err != nil {
		return nil, err
	}
	return polygon, nil
}
