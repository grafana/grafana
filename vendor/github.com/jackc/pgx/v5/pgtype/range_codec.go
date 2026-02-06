package pgtype

import (
	"database/sql/driver"
	"fmt"

	"github.com/jackc/pgx/v5/internal/pgio"
)

// RangeValuer is a type that can be converted into a PostgreSQL range.
type RangeValuer interface {
	// IsNull returns true if the value is SQL NULL.
	IsNull() bool

	// BoundTypes returns the lower and upper bound types.
	BoundTypes() (lower, upper BoundType)

	// Bounds returns the lower and upper range values.
	Bounds() (lower, upper any)
}

// RangeScanner is a type can be scanned from a PostgreSQL range.
type RangeScanner interface {
	// ScanNull sets the value to SQL NULL.
	ScanNull() error

	// ScanBounds returns values usable as a scan target. The returned values may not be scanned if the range is empty or
	// the bound type is unbounded.
	ScanBounds() (lowerTarget, upperTarget any)

	// SetBoundTypes sets the lower and upper bound types. ScanBounds will be called and the returned values scanned
	// (if appropriate) before SetBoundTypes is called. If the bound types are unbounded or empty this method must
	// also set the bound values.
	SetBoundTypes(lower, upper BoundType) error
}

// RangeCodec is a codec for any range type.
type RangeCodec struct {
	ElementType *Type
}

func (c *RangeCodec) FormatSupported(format int16) bool {
	return c.ElementType.Codec.FormatSupported(format)
}

func (c *RangeCodec) PreferredFormat() int16 {
	if c.FormatSupported(BinaryFormatCode) {
		return BinaryFormatCode
	}
	return TextFormatCode
}

func (c *RangeCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(RangeValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return &encodePlanRangeCodecRangeValuerToBinary{rc: c, m: m}
	case TextFormatCode:
		return &encodePlanRangeCodecRangeValuerToText{rc: c, m: m}
	}

	return nil
}

type encodePlanRangeCodecRangeValuerToBinary struct {
	rc *RangeCodec
	m  *Map
}

func (plan *encodePlanRangeCodecRangeValuerToBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	getter := value.(RangeValuer)

	if getter.IsNull() {
		return nil, nil
	}

	lowerType, upperType := getter.BoundTypes()
	lower, upper := getter.Bounds()

	var rangeType byte
	switch lowerType {
	case Inclusive:
		rangeType |= lowerInclusiveMask
	case Unbounded:
		rangeType |= lowerUnboundedMask
	case Exclusive:
	case Empty:
		return append(buf, emptyMask), nil
	default:
		return nil, fmt.Errorf("unknown LowerType: %v", lowerType)
	}

	switch upperType {
	case Inclusive:
		rangeType |= upperInclusiveMask
	case Unbounded:
		rangeType |= upperUnboundedMask
	case Exclusive:
	default:
		return nil, fmt.Errorf("unknown UpperType: %v", upperType)
	}

	buf = append(buf, rangeType)

	if lowerType != Unbounded {
		if lower == nil {
			return nil, fmt.Errorf("Lower cannot be NULL unless LowerType is Unbounded")
		}

		sp := len(buf)
		buf = pgio.AppendInt32(buf, -1)

		lowerPlan := plan.m.PlanEncode(plan.rc.ElementType.OID, BinaryFormatCode, lower)
		if lowerPlan == nil {
			return nil, fmt.Errorf("cannot encode %v as element of range", lower)
		}

		buf, err = lowerPlan.Encode(lower, buf)
		if err != nil {
			return nil, fmt.Errorf("failed to encode %v as element of range: %w", lower, err)
		}
		if buf == nil {
			return nil, fmt.Errorf("Lower cannot be NULL unless LowerType is Unbounded")
		}

		pgio.SetInt32(buf[sp:], int32(len(buf[sp:])-4))
	}

	if upperType != Unbounded {
		if upper == nil {
			return nil, fmt.Errorf("Upper cannot be NULL unless UpperType is Unbounded")
		}

		sp := len(buf)
		buf = pgio.AppendInt32(buf, -1)

		upperPlan := plan.m.PlanEncode(plan.rc.ElementType.OID, BinaryFormatCode, upper)
		if upperPlan == nil {
			return nil, fmt.Errorf("cannot encode %v as element of range", upper)
		}

		buf, err = upperPlan.Encode(upper, buf)
		if err != nil {
			return nil, fmt.Errorf("failed to encode %v as element of range: %w", upper, err)
		}
		if buf == nil {
			return nil, fmt.Errorf("Upper cannot be NULL unless UpperType is Unbounded")
		}

		pgio.SetInt32(buf[sp:], int32(len(buf[sp:])-4))
	}

	return buf, nil
}

type encodePlanRangeCodecRangeValuerToText struct {
	rc *RangeCodec
	m  *Map
}

func (plan *encodePlanRangeCodecRangeValuerToText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	getter := value.(RangeValuer)

	if getter.IsNull() {
		return nil, nil
	}

	lowerType, upperType := getter.BoundTypes()
	lower, upper := getter.Bounds()

	switch lowerType {
	case Exclusive, Unbounded:
		buf = append(buf, '(')
	case Inclusive:
		buf = append(buf, '[')
	case Empty:
		return append(buf, "empty"...), nil
	default:
		return nil, fmt.Errorf("unknown lower bound type %v", lowerType)
	}

	if lowerType != Unbounded {
		if lower == nil {
			return nil, fmt.Errorf("Lower cannot be NULL unless LowerType is Unbounded")
		}

		lowerPlan := plan.m.PlanEncode(plan.rc.ElementType.OID, TextFormatCode, lower)
		if lowerPlan == nil {
			return nil, fmt.Errorf("cannot encode %v as element of range", lower)
		}

		buf, err = lowerPlan.Encode(lower, buf)
		if err != nil {
			return nil, fmt.Errorf("failed to encode %v as element of range: %w", lower, err)
		}
		if buf == nil {
			return nil, fmt.Errorf("Lower cannot be NULL unless LowerType is Unbounded")
		}
	}

	buf = append(buf, ',')

	if upperType != Unbounded {
		if upper == nil {
			return nil, fmt.Errorf("Upper cannot be NULL unless UpperType is Unbounded")
		}

		upperPlan := plan.m.PlanEncode(plan.rc.ElementType.OID, TextFormatCode, upper)
		if upperPlan == nil {
			return nil, fmt.Errorf("cannot encode %v as element of range", upper)
		}

		buf, err = upperPlan.Encode(upper, buf)
		if err != nil {
			return nil, fmt.Errorf("failed to encode %v as element of range: %w", upper, err)
		}
		if buf == nil {
			return nil, fmt.Errorf("Upper cannot be NULL unless UpperType is Unbounded")
		}
	}

	switch upperType {
	case Exclusive, Unbounded:
		buf = append(buf, ')')
	case Inclusive:
		buf = append(buf, ']')
	default:
		return nil, fmt.Errorf("unknown upper bound type %v", upperType)
	}

	return buf, nil
}

func (c *RangeCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case RangeScanner:
			return &scanPlanBinaryRangeToRangeScanner{rc: c, m: m}
		}
	case TextFormatCode:
		switch target.(type) {
		case RangeScanner:
			return &scanPlanTextRangeToRangeScanner{rc: c, m: m}
		}
	}

	return nil
}

type scanPlanBinaryRangeToRangeScanner struct {
	rc *RangeCodec
	m  *Map
}

func (plan *scanPlanBinaryRangeToRangeScanner) Scan(src []byte, target any) error {
	rangeScanner := (target).(RangeScanner)

	if src == nil {
		return rangeScanner.ScanNull()
	}

	ubr, err := parseUntypedBinaryRange(src)
	if err != nil {
		return err
	}

	if ubr.LowerType == Empty {
		return rangeScanner.SetBoundTypes(ubr.LowerType, ubr.UpperType)
	}

	lowerTarget, upperTarget := rangeScanner.ScanBounds()

	if ubr.LowerType == Inclusive || ubr.LowerType == Exclusive {
		lowerPlan := plan.m.PlanScan(plan.rc.ElementType.OID, BinaryFormatCode, lowerTarget)
		if lowerPlan == nil {
			return fmt.Errorf("cannot scan into %v from range element", lowerTarget)
		}

		err = lowerPlan.Scan(ubr.Lower, lowerTarget)
		if err != nil {
			return fmt.Errorf("cannot scan into %v from range element: %w", lowerTarget, err)
		}
	}

	if ubr.UpperType == Inclusive || ubr.UpperType == Exclusive {
		upperPlan := plan.m.PlanScan(plan.rc.ElementType.OID, BinaryFormatCode, upperTarget)
		if upperPlan == nil {
			return fmt.Errorf("cannot scan into %v from range element", upperTarget)
		}

		err = upperPlan.Scan(ubr.Upper, upperTarget)
		if err != nil {
			return fmt.Errorf("cannot scan into %v from range element: %w", upperTarget, err)
		}
	}

	return rangeScanner.SetBoundTypes(ubr.LowerType, ubr.UpperType)
}

type scanPlanTextRangeToRangeScanner struct {
	rc *RangeCodec
	m  *Map
}

func (plan *scanPlanTextRangeToRangeScanner) Scan(src []byte, target any) error {
	rangeScanner := (target).(RangeScanner)

	if src == nil {
		return rangeScanner.ScanNull()
	}

	utr, err := parseUntypedTextRange(string(src))
	if err != nil {
		return err
	}

	if utr.LowerType == Empty {
		return rangeScanner.SetBoundTypes(utr.LowerType, utr.UpperType)
	}

	lowerTarget, upperTarget := rangeScanner.ScanBounds()

	if utr.LowerType == Inclusive || utr.LowerType == Exclusive {
		lowerPlan := plan.m.PlanScan(plan.rc.ElementType.OID, TextFormatCode, lowerTarget)
		if lowerPlan == nil {
			return fmt.Errorf("cannot scan into %v from range element", lowerTarget)
		}

		err = lowerPlan.Scan([]byte(utr.Lower), lowerTarget)
		if err != nil {
			return fmt.Errorf("cannot scan into %v from range element: %w", lowerTarget, err)
		}
	}

	if utr.UpperType == Inclusive || utr.UpperType == Exclusive {
		upperPlan := plan.m.PlanScan(plan.rc.ElementType.OID, TextFormatCode, upperTarget)
		if upperPlan == nil {
			return fmt.Errorf("cannot scan into %v from range element", upperTarget)
		}

		err = upperPlan.Scan([]byte(utr.Upper), upperTarget)
		if err != nil {
			return fmt.Errorf("cannot scan into %v from range element: %w", upperTarget, err)
		}
	}

	return rangeScanner.SetBoundTypes(utr.LowerType, utr.UpperType)
}

func (c *RangeCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	if src == nil {
		return nil, nil
	}

	switch format {
	case TextFormatCode:
		return string(src), nil
	case BinaryFormatCode:
		buf := make([]byte, len(src))
		copy(buf, src)
		return buf, nil
	default:
		return nil, fmt.Errorf("unknown format code %d", format)
	}
}

func (c *RangeCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var r Range[any]
	err := c.PlanScan(m, oid, format, &r).Scan(src, &r)
	return r, err
}
