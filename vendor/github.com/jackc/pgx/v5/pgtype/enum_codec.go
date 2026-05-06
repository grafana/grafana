package pgtype

import (
	"database/sql/driver"
	"fmt"
)

// EnumCodec is a codec that caches the strings it decodes. If the same string is read multiple times only one copy is
// allocated. These strings are only garbage collected when the EnumCodec is garbage collected. EnumCodec can be used
// for any text type not only enums, but it should only be used when there are a small number of possible values.
type EnumCodec struct {
	membersMap map[string]string // map to quickly lookup member and reuse string instead of allocating
}

func (EnumCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (EnumCodec) PreferredFormat() int16 {
	return TextFormatCode
}

func (EnumCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch format {
	case TextFormatCode, BinaryFormatCode:
		switch value.(type) {
		case string:
			return encodePlanTextCodecString{}
		case []byte:
			return encodePlanTextCodecByteSlice{}
		case TextValuer:
			return encodePlanTextCodecTextValuer{}
		}
	}

	return nil
}

func (c *EnumCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case TextFormatCode, BinaryFormatCode:
		switch target.(type) {
		case *string:
			return &scanPlanTextAnyToEnumString{codec: c}
		case *[]byte:
			return scanPlanAnyToNewByteSlice{}
		case TextScanner:
			return &scanPlanTextAnyToEnumTextScanner{codec: c}
		}
	}

	return nil
}

func (c *EnumCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return c.DecodeValue(m, oid, format, src)
}

func (c *EnumCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	return c.lookupAndCacheString(src), nil
}

// lookupAndCacheString looks for src in the members map. If it is not found it is added to the map.
func (c *EnumCodec) lookupAndCacheString(src []byte) string {
	if c.membersMap == nil {
		c.membersMap = make(map[string]string)
	}

	if s, found := c.membersMap[string(src)]; found {
		return s
	}

	s := string(src)
	c.membersMap[s] = s
	return s
}

type scanPlanTextAnyToEnumString struct {
	codec *EnumCodec
}

func (plan *scanPlanTextAnyToEnumString) Scan(src []byte, dst any) error {
	if src == nil {
		return fmt.Errorf("cannot scan NULL into %T", dst)
	}

	p := (dst).(*string)
	*p = plan.codec.lookupAndCacheString(src)

	return nil
}

type scanPlanTextAnyToEnumTextScanner struct {
	codec *EnumCodec
}

func (plan *scanPlanTextAnyToEnumTextScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(TextScanner)

	if src == nil {
		return scanner.ScanText(Text{})
	}

	return scanner.ScanText(Text{String: plan.codec.lookupAndCacheString(src), Valid: true})
}
