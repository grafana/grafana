package pgtype

import (
	"database/sql/driver"
	"fmt"
)

type JSONBCodec struct {
	Marshal   func(v any) ([]byte, error)
	Unmarshal func(data []byte, v any) error
}

func (*JSONBCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (*JSONBCodec) PreferredFormat() int16 {
	return TextFormatCode
}

func (c *JSONBCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch format {
	case BinaryFormatCode:
		plan := (&JSONCodec{Marshal: c.Marshal, Unmarshal: c.Unmarshal}).PlanEncode(m, oid, TextFormatCode, value)
		if plan != nil {
			return &encodePlanJSONBCodecBinaryWrapper{textPlan: plan}
		}
	case TextFormatCode:
		return (&JSONCodec{Marshal: c.Marshal, Unmarshal: c.Unmarshal}).PlanEncode(m, oid, format, value)
	}

	return nil
}

type encodePlanJSONBCodecBinaryWrapper struct {
	textPlan EncodePlan
}

func (plan *encodePlanJSONBCodecBinaryWrapper) Encode(value any, buf []byte) (newBuf []byte, err error) {
	buf = append(buf, 1)
	return plan.textPlan.Encode(value, buf)
}

func (c *JSONBCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		plan := (&JSONCodec{Marshal: c.Marshal, Unmarshal: c.Unmarshal}).PlanScan(m, oid, TextFormatCode, target)
		if plan != nil {
			return &scanPlanJSONBCodecBinaryUnwrapper{textPlan: plan}
		}
	case TextFormatCode:
		return (&JSONCodec{Marshal: c.Marshal, Unmarshal: c.Unmarshal}).PlanScan(m, oid, format, target)
	}

	return nil
}

type scanPlanJSONBCodecBinaryUnwrapper struct {
	textPlan ScanPlan
}

func (plan *scanPlanJSONBCodecBinaryUnwrapper) Scan(src []byte, dst any) error {
	if src == nil {
		return plan.textPlan.Scan(src, dst)
	}

	if len(src) == 0 {
		return fmt.Errorf("jsonb too short")
	}

	if src[0] != 1 {
		return fmt.Errorf("unknown jsonb version number %d", src[0])
	}

	return plan.textPlan.Scan(src[1:], dst)
}

func (c *JSONBCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	if src == nil {
		return nil, nil
	}

	switch format {
	case BinaryFormatCode:
		if len(src) == 0 {
			return nil, fmt.Errorf("jsonb too short")
		}

		if src[0] != 1 {
			return nil, fmt.Errorf("unknown jsonb version number %d", src[0])
		}

		dstBuf := make([]byte, len(src)-1)
		copy(dstBuf, src[1:])
		return dstBuf, nil
	case TextFormatCode:
		dstBuf := make([]byte, len(src))
		copy(dstBuf, src)
		return dstBuf, nil
	default:
		return nil, fmt.Errorf("unknown format code: %v", format)
	}
}

func (c *JSONBCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	switch format {
	case BinaryFormatCode:
		if len(src) == 0 {
			return nil, fmt.Errorf("jsonb too short")
		}

		if src[0] != 1 {
			return nil, fmt.Errorf("unknown jsonb version number %d", src[0])
		}

		src = src[1:]
	case TextFormatCode:
	default:
		return nil, fmt.Errorf("unknown format code: %v", format)
	}

	var dst any
	err := c.Unmarshal(src, &dst)
	return dst, err
}
