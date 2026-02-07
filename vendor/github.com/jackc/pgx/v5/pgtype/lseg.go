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

type LsegScanner interface {
	ScanLseg(v Lseg) error
}

type LsegValuer interface {
	LsegValue() (Lseg, error)
}

type Lseg struct {
	P     [2]Vec2
	Valid bool
}

// ScanLseg implements the [LsegScanner] interface.
func (lseg *Lseg) ScanLseg(v Lseg) error {
	*lseg = v
	return nil
}

// LsegValue implements the [LsegValuer] interface.
func (lseg Lseg) LsegValue() (Lseg, error) {
	return lseg, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (lseg *Lseg) Scan(src any) error {
	if src == nil {
		*lseg = Lseg{}
		return nil
	}

	switch src := src.(type) {
	case string:
		return scanPlanTextAnyToLsegScanner{}.Scan([]byte(src), lseg)
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (lseg Lseg) Value() (driver.Value, error) {
	if !lseg.Valid {
		return nil, nil
	}

	buf, err := LsegCodec{}.PlanEncode(nil, 0, TextFormatCode, lseg).Encode(lseg, nil)
	if err != nil {
		return nil, err
	}
	return string(buf), err
}

type LsegCodec struct{}

func (LsegCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (LsegCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (LsegCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(LsegValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return encodePlanLsegCodecBinary{}
	case TextFormatCode:
		return encodePlanLsegCodecText{}
	}

	return nil
}

type encodePlanLsegCodecBinary struct{}

func (encodePlanLsegCodecBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	lseg, err := value.(LsegValuer).LsegValue()
	if err != nil {
		return nil, err
	}

	if !lseg.Valid {
		return nil, nil
	}

	buf = pgio.AppendUint64(buf, math.Float64bits(lseg.P[0].X))
	buf = pgio.AppendUint64(buf, math.Float64bits(lseg.P[0].Y))
	buf = pgio.AppendUint64(buf, math.Float64bits(lseg.P[1].X))
	buf = pgio.AppendUint64(buf, math.Float64bits(lseg.P[1].Y))
	return buf, nil
}

type encodePlanLsegCodecText struct{}

func (encodePlanLsegCodecText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	lseg, err := value.(LsegValuer).LsegValue()
	if err != nil {
		return nil, err
	}

	if !lseg.Valid {
		return nil, nil
	}

	buf = append(buf, fmt.Sprintf(`[(%s,%s),(%s,%s)]`,
		strconv.FormatFloat(lseg.P[0].X, 'f', -1, 64),
		strconv.FormatFloat(lseg.P[0].Y, 'f', -1, 64),
		strconv.FormatFloat(lseg.P[1].X, 'f', -1, 64),
		strconv.FormatFloat(lseg.P[1].Y, 'f', -1, 64),
	)...)
	return buf, nil
}

func (LsegCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case LsegScanner:
			return scanPlanBinaryLsegToLsegScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case LsegScanner:
			return scanPlanTextAnyToLsegScanner{}
		}
	}

	return nil
}

type scanPlanBinaryLsegToLsegScanner struct{}

func (scanPlanBinaryLsegToLsegScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(LsegScanner)

	if src == nil {
		return scanner.ScanLseg(Lseg{})
	}

	if len(src) != 32 {
		return fmt.Errorf("invalid length for lseg: %v", len(src))
	}

	x1 := binary.BigEndian.Uint64(src)
	y1 := binary.BigEndian.Uint64(src[8:])
	x2 := binary.BigEndian.Uint64(src[16:])
	y2 := binary.BigEndian.Uint64(src[24:])

	return scanner.ScanLseg(Lseg{
		P: [2]Vec2{
			{math.Float64frombits(x1), math.Float64frombits(y1)},
			{math.Float64frombits(x2), math.Float64frombits(y2)},
		},
		Valid: true,
	})
}

type scanPlanTextAnyToLsegScanner struct{}

func (scanPlanTextAnyToLsegScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(LsegScanner)

	if src == nil {
		return scanner.ScanLseg(Lseg{})
	}

	if len(src) < 11 {
		return fmt.Errorf("invalid length for lseg: %v", len(src))
	}

	str := string(src[2:])

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

	str = str[end+1 : len(str)-2]

	y2, err := strconv.ParseFloat(str, 64)
	if err != nil {
		return err
	}

	return scanner.ScanLseg(Lseg{P: [2]Vec2{{x1, y1}, {x2, y2}}, Valid: true})
}

func (c LsegCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return codecDecodeToTextFormat(c, m, oid, format, src)
}

func (c LsegCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var lseg Lseg
	err := codecScan(c, m, oid, format, src, &lseg)
	if err != nil {
		return nil, err
	}
	return lseg, nil
}
