package pgtype

import (
	"database/sql/driver"
	"fmt"
)

// ArrayGetter is a type that can be converted into a PostgreSQL array.

// RecordCodec is a codec for the generic PostgreSQL record type such as is created with the "row" function. Record can
// only decode the binary format. The text format output format from PostgreSQL does not include type information and
// is therefore impossible to decode. Encoding is impossible because PostgreSQL does not support input of generic
// records.
type RecordCodec struct{}

func (RecordCodec) FormatSupported(format int16) bool {
	return format == BinaryFormatCode
}

func (RecordCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (RecordCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	return nil
}

func (RecordCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	if format == BinaryFormatCode {
		switch target.(type) {
		case CompositeIndexScanner:
			return &scanPlanBinaryRecordToCompositeIndexScanner{m: m}
		}
	}

	return nil
}

type scanPlanBinaryRecordToCompositeIndexScanner struct {
	m *Map
}

func (plan *scanPlanBinaryRecordToCompositeIndexScanner) Scan(src []byte, target any) error {
	targetScanner := (target).(CompositeIndexScanner)

	if src == nil {
		return targetScanner.ScanNull()
	}

	scanner := NewCompositeBinaryScanner(plan.m, src)
	for i := 0; scanner.Next(); i++ {
		fieldTarget := targetScanner.ScanIndex(i)
		if fieldTarget != nil {
			fieldPlan := plan.m.PlanScan(scanner.OID(), BinaryFormatCode, fieldTarget)
			if fieldPlan == nil {
				return fmt.Errorf("unable to scan OID %d in binary format into %v", scanner.OID(), fieldTarget)
			}

			err := fieldPlan.Scan(scanner.Bytes(), fieldTarget)
			if err != nil {
				return err
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return err
	}

	return nil
}

func (RecordCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
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

func (RecordCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	switch format {
	case TextFormatCode:
		return string(src), nil
	case BinaryFormatCode:
		scanner := NewCompositeBinaryScanner(m, src)
		values := make([]any, scanner.FieldCount())
		for i := 0; scanner.Next(); i++ {
			var v any
			fieldPlan := m.PlanScan(scanner.OID(), BinaryFormatCode, &v)
			if fieldPlan == nil {
				return nil, fmt.Errorf("unable to scan OID %d in binary format into %v", scanner.OID(), v)
			}

			err := fieldPlan.Scan(scanner.Bytes(), &v)
			if err != nil {
				return nil, err
			}

			values[i] = v
		}

		if err := scanner.Err(); err != nil {
			return nil, err
		}

		return values, nil
	default:
		return nil, fmt.Errorf("unknown format code %d", format)
	}
}
