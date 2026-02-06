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

type PathScanner interface {
	ScanPath(v Path) error
}

type PathValuer interface {
	PathValue() (Path, error)
}

type Path struct {
	P      []Vec2
	Closed bool
	Valid  bool
}

// ScanPath implements the [PathScanner] interface.
func (path *Path) ScanPath(v Path) error {
	*path = v
	return nil
}

// PathValue implements the [PathValuer] interface.
func (path Path) PathValue() (Path, error) {
	return path, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (path *Path) Scan(src any) error {
	if src == nil {
		*path = Path{}
		return nil
	}

	switch src := src.(type) {
	case string:
		return scanPlanTextAnyToPathScanner{}.Scan([]byte(src), path)
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (path Path) Value() (driver.Value, error) {
	if !path.Valid {
		return nil, nil
	}

	buf, err := PathCodec{}.PlanEncode(nil, 0, TextFormatCode, path).Encode(path, nil)
	if err != nil {
		return nil, err
	}

	return string(buf), err
}

type PathCodec struct{}

func (PathCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (PathCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (PathCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(PathValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return encodePlanPathCodecBinary{}
	case TextFormatCode:
		return encodePlanPathCodecText{}
	}

	return nil
}

type encodePlanPathCodecBinary struct{}

func (encodePlanPathCodecBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	path, err := value.(PathValuer).PathValue()
	if err != nil {
		return nil, err
	}

	if !path.Valid {
		return nil, nil
	}

	var closeByte byte
	if path.Closed {
		closeByte = 1
	}
	buf = append(buf, closeByte)

	buf = pgio.AppendInt32(buf, int32(len(path.P)))

	for _, p := range path.P {
		buf = pgio.AppendUint64(buf, math.Float64bits(p.X))
		buf = pgio.AppendUint64(buf, math.Float64bits(p.Y))
	}

	return buf, nil
}

type encodePlanPathCodecText struct{}

func (encodePlanPathCodecText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	path, err := value.(PathValuer).PathValue()
	if err != nil {
		return nil, err
	}

	if !path.Valid {
		return nil, nil
	}

	var startByte, endByte byte
	if path.Closed {
		startByte = '('
		endByte = ')'
	} else {
		startByte = '['
		endByte = ']'
	}
	buf = append(buf, startByte)

	for i, p := range path.P {
		if i > 0 {
			buf = append(buf, ',')
		}
		buf = append(buf, fmt.Sprintf(`(%s,%s)`,
			strconv.FormatFloat(p.X, 'f', -1, 64),
			strconv.FormatFloat(p.Y, 'f', -1, 64),
		)...)
	}

	buf = append(buf, endByte)

	return buf, nil
}

func (PathCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case PathScanner:
			return scanPlanBinaryPathToPathScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case PathScanner:
			return scanPlanTextAnyToPathScanner{}
		}
	}

	return nil
}

type scanPlanBinaryPathToPathScanner struct{}

func (scanPlanBinaryPathToPathScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(PathScanner)

	if src == nil {
		return scanner.ScanPath(Path{})
	}

	if len(src) < 5 {
		return fmt.Errorf("invalid length for Path: %v", len(src))
	}

	closed := src[0] == 1
	pointCount := int(binary.BigEndian.Uint32(src[1:]))

	rp := 5

	if 5+pointCount*16 != len(src) {
		return fmt.Errorf("invalid length for Path with %d points: %v", pointCount, len(src))
	}

	points := make([]Vec2, pointCount)
	for i := 0; i < len(points); i++ {
		x := binary.BigEndian.Uint64(src[rp:])
		rp += 8
		y := binary.BigEndian.Uint64(src[rp:])
		rp += 8
		points[i] = Vec2{math.Float64frombits(x), math.Float64frombits(y)}
	}

	return scanner.ScanPath(Path{
		P:      points,
		Closed: closed,
		Valid:  true,
	})
}

type scanPlanTextAnyToPathScanner struct{}

func (scanPlanTextAnyToPathScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(PathScanner)

	if src == nil {
		return scanner.ScanPath(Path{})
	}

	if len(src) < 7 {
		return fmt.Errorf("invalid length for Path: %v", len(src))
	}

	closed := src[0] == '('
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

	return scanner.ScanPath(Path{P: points, Closed: closed, Valid: true})
}

func (c PathCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return codecDecodeToTextFormat(c, m, oid, format, src)
}

func (c PathCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var path Path
	err := codecScan(c, m, oid, format, src, &path)
	if err != nil {
		return nil, err
	}
	return path, nil
}
