package pgtype

import (
	"database/sql"
	"database/sql/driver"
	"encoding/xml"
	"fmt"
	"reflect"
)

type XMLCodec struct {
	Marshal   func(v any) ([]byte, error)
	Unmarshal func(data []byte, v any) error
}

func (*XMLCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (*XMLCodec) PreferredFormat() int16 {
	return TextFormatCode
}

func (c *XMLCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch value.(type) {
	case string:
		return encodePlanXMLCodecEitherFormatString{}
	case []byte:
		return encodePlanXMLCodecEitherFormatByteSlice{}

	// Cannot rely on driver.Valuer being handled later because anything can be marshalled.
	//
	// https://github.com/jackc/pgx/issues/1430
	//
	// Check for driver.Valuer must come before xml.Marshaler so that it is guaranteed to be used
	// when both are implemented https://github.com/jackc/pgx/issues/1805
	case driver.Valuer:
		return &encodePlanDriverValuer{m: m, oid: oid, formatCode: format}

	// Must come before trying wrap encode plans because a pointer to a struct may be unwrapped to a struct that can be
	// marshalled.
	//
	// https://github.com/jackc/pgx/issues/1681
	case xml.Marshaler:
		return &encodePlanXMLCodecEitherFormatMarshal{
			marshal: c.Marshal,
		}
	}

	// Because anything can be marshalled the normal wrapping in Map.PlanScan doesn't get a chance to run. So try the
	// appropriate wrappers here.
	for _, f := range []TryWrapEncodePlanFunc{
		TryWrapDerefPointerEncodePlan,
		TryWrapFindUnderlyingTypeEncodePlan,
	} {
		if wrapperPlan, nextValue, ok := f(value); ok {
			if nextPlan := c.PlanEncode(m, oid, format, nextValue); nextPlan != nil {
				wrapperPlan.SetNext(nextPlan)
				return wrapperPlan
			}
		}
	}

	return &encodePlanXMLCodecEitherFormatMarshal{
		marshal: c.Marshal,
	}
}

type encodePlanXMLCodecEitherFormatString struct{}

func (encodePlanXMLCodecEitherFormatString) Encode(value any, buf []byte) (newBuf []byte, err error) {
	xmlString := value.(string)
	buf = append(buf, xmlString...)
	return buf, nil
}

type encodePlanXMLCodecEitherFormatByteSlice struct{}

func (encodePlanXMLCodecEitherFormatByteSlice) Encode(value any, buf []byte) (newBuf []byte, err error) {
	xmlBytes := value.([]byte)
	if xmlBytes == nil {
		return nil, nil
	}

	buf = append(buf, xmlBytes...)
	return buf, nil
}

type encodePlanXMLCodecEitherFormatMarshal struct {
	marshal func(v any) ([]byte, error)
}

func (e *encodePlanXMLCodecEitherFormatMarshal) Encode(value any, buf []byte) (newBuf []byte, err error) {
	xmlBytes, err := e.marshal(value)
	if err != nil {
		return nil, err
	}

	buf = append(buf, xmlBytes...)
	return buf, nil
}

func (c *XMLCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch target.(type) {
	case *string:
		return scanPlanAnyToString{}

	case **string:
		// This is to fix **string scanning. It seems wrong to special case **string, but it's not clear what a better
		// solution would be.
		//
		// https://github.com/jackc/pgx/issues/1470 -- **string
		// https://github.com/jackc/pgx/issues/1691 -- ** anything else

		if wrapperPlan, nextDst, ok := TryPointerPointerScanPlan(target); ok {
			if nextPlan := m.planScan(oid, format, nextDst, 0); nextPlan != nil {
				if _, failed := nextPlan.(*scanPlanFail); !failed {
					wrapperPlan.SetNext(nextPlan)
					return wrapperPlan
				}
			}
		}

	case *[]byte:
		return scanPlanXMLToByteSlice{}
	case BytesScanner:
		return scanPlanBinaryBytesToBytesScanner{}

	// Cannot rely on sql.Scanner being handled later because scanPlanXMLToXMLUnmarshal will take precedence.
	//
	// https://github.com/jackc/pgx/issues/1418
	case sql.Scanner:
		return &scanPlanSQLScanner{formatCode: format}
	}

	return &scanPlanXMLToXMLUnmarshal{
		unmarshal: c.Unmarshal,
	}
}

type scanPlanXMLToByteSlice struct{}

func (scanPlanXMLToByteSlice) Scan(src []byte, dst any) error {
	dstBuf := dst.(*[]byte)
	if src == nil {
		*dstBuf = nil
		return nil
	}

	*dstBuf = make([]byte, len(src))
	copy(*dstBuf, src)
	return nil
}

type scanPlanXMLToXMLUnmarshal struct {
	unmarshal func(data []byte, v any) error
}

func (s *scanPlanXMLToXMLUnmarshal) Scan(src []byte, dst any) error {
	if src == nil {
		dstValue := reflect.ValueOf(dst)
		if dstValue.Kind() == reflect.Ptr {
			el := dstValue.Elem()
			switch el.Kind() {
			case reflect.Ptr, reflect.Slice, reflect.Map, reflect.Interface, reflect.Struct:
				el.Set(reflect.Zero(el.Type()))
				return nil
			}
		}

		return fmt.Errorf("cannot scan NULL into %T", dst)
	}

	elem := reflect.ValueOf(dst).Elem()
	elem.Set(reflect.Zero(elem.Type()))

	return s.unmarshal(src, dst)
}

func (c *XMLCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	if src == nil {
		return nil, nil
	}

	dstBuf := make([]byte, len(src))
	copy(dstBuf, src)
	return dstBuf, nil
}

func (c *XMLCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var dst any
	err := c.Unmarshal(src, &dst)
	return dst, err
}
