package pgtype

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"reflect"
)

type JSONCodec struct {
	Marshal   func(v any) ([]byte, error)
	Unmarshal func(data []byte, v any) error
}

func (*JSONCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (*JSONCodec) PreferredFormat() int16 {
	return TextFormatCode
}

func (c *JSONCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch value.(type) {
	case string:
		return encodePlanJSONCodecEitherFormatString{}
	case []byte:
		return encodePlanJSONCodecEitherFormatByteSlice{}

	// Handle json.RawMessage specifically because if it is run through json.Marshal it may be mutated.
	// e.g. `{"foo": "bar"}` -> `{"foo":"bar"}`.
	case json.RawMessage:
		return encodePlanJSONCodecEitherFormatJSONRawMessage{}

	// Cannot rely on driver.Valuer being handled later because anything can be marshalled.
	//
	// https://github.com/jackc/pgx/issues/1430
	//
	// Check for driver.Valuer must come before json.Marshaler so that it is guaranteed to be used
	// when both are implemented https://github.com/jackc/pgx/issues/1805
	case driver.Valuer:
		return &encodePlanDriverValuer{m: m, oid: oid, formatCode: format}

	// Must come before trying wrap encode plans because a pointer to a struct may be unwrapped to a struct that can be
	// marshalled.
	//
	// https://github.com/jackc/pgx/issues/1681
	case json.Marshaler:
		return &encodePlanJSONCodecEitherFormatMarshal{
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

	return &encodePlanJSONCodecEitherFormatMarshal{
		marshal: c.Marshal,
	}
}

// JSON needs its on scan plan for pointers to handle 'null'::json(b).
// Consider making pointerPointerScanPlan more flexible in the future.
type jsonPointerScanPlan struct {
	next ScanPlan
}

func (p jsonPointerScanPlan) Scan(src []byte, dst any) error {
	el := reflect.ValueOf(dst).Elem()
	if src == nil || string(src) == "null" {
		el.SetZero()
		return nil
	}

	el.Set(reflect.New(el.Type().Elem()))
	if p.next != nil {
		return p.next.Scan(src, el.Interface())
	}

	return nil
}

type encodePlanJSONCodecEitherFormatString struct{}

func (encodePlanJSONCodecEitherFormatString) Encode(value any, buf []byte) (newBuf []byte, err error) {
	jsonString := value.(string)
	buf = append(buf, jsonString...)
	return buf, nil
}

type encodePlanJSONCodecEitherFormatByteSlice struct{}

func (encodePlanJSONCodecEitherFormatByteSlice) Encode(value any, buf []byte) (newBuf []byte, err error) {
	jsonBytes := value.([]byte)
	if jsonBytes == nil {
		return nil, nil
	}

	buf = append(buf, jsonBytes...)
	return buf, nil
}

type encodePlanJSONCodecEitherFormatJSONRawMessage struct{}

func (encodePlanJSONCodecEitherFormatJSONRawMessage) Encode(value any, buf []byte) (newBuf []byte, err error) {
	jsonBytes := value.(json.RawMessage)
	if jsonBytes == nil {
		return nil, nil
	}

	buf = append(buf, jsonBytes...)
	return buf, nil
}

type encodePlanJSONCodecEitherFormatMarshal struct {
	marshal func(v any) ([]byte, error)
}

func (e *encodePlanJSONCodecEitherFormatMarshal) Encode(value any, buf []byte) (newBuf []byte, err error) {
	jsonBytes, err := e.marshal(value)
	if err != nil {
		return nil, err
	}

	buf = append(buf, jsonBytes...)
	return buf, nil
}

func (c *JSONCodec) PlanScan(m *Map, oid uint32, formatCode int16, target any) ScanPlan {
	return c.planScan(m, oid, formatCode, target, 0)
}

// JSON cannot fallback to pointerPointerScanPlan because of 'null'::json(b),
// so we need to duplicate the logic here.
func (c *JSONCodec) planScan(m *Map, oid uint32, formatCode int16, target any, depth int) ScanPlan {
	if depth > 8 {
		return &scanPlanFail{m: m, oid: oid, formatCode: formatCode}
	}

	switch target.(type) {
	case *string:
		return &scanPlanAnyToString{}
	case *[]byte:
		return &scanPlanJSONToByteSlice{}
	case BytesScanner:
		return &scanPlanBinaryBytesToBytesScanner{}
	case sql.Scanner:
		return &scanPlanCodecSQLScanner{c: c, m: m, oid: oid, formatCode: formatCode}
	}

	rv := reflect.ValueOf(target)
	if rv.Kind() == reflect.Pointer && rv.Elem().Kind() == reflect.Pointer {
		var plan jsonPointerScanPlan
		plan.next = c.planScan(m, oid, formatCode, rv.Elem().Interface(), depth+1)
		return plan
	} else {
		return &scanPlanJSONToJSONUnmarshal{unmarshal: c.Unmarshal}
	}
}

type scanPlanAnyToString struct{}

func (scanPlanAnyToString) Scan(src []byte, dst any) error {
	p := dst.(*string)
	*p = string(src)
	return nil
}

type scanPlanJSONToByteSlice struct{}

func (scanPlanJSONToByteSlice) Scan(src []byte, dst any) error {
	dstBuf := dst.(*[]byte)
	if src == nil {
		*dstBuf = nil
		return nil
	}

	*dstBuf = make([]byte, len(src))
	copy(*dstBuf, src)
	return nil
}

type scanPlanJSONToJSONUnmarshal struct {
	unmarshal func(data []byte, v any) error
}

func (s *scanPlanJSONToJSONUnmarshal) Scan(src []byte, dst any) error {
	if src == nil {
		dstValue := reflect.ValueOf(dst)
		if dstValue.Kind() == reflect.Ptr {
			el := dstValue.Elem()
			switch el.Kind() {
			case reflect.Ptr, reflect.Slice, reflect.Map, reflect.Interface:
				el.Set(reflect.Zero(el.Type()))
				return nil
			}
		}

		return fmt.Errorf("cannot scan NULL into %T", dst)
	}

	v := reflect.ValueOf(dst)
	if v.Kind() != reflect.Pointer || v.IsNil() {
		return fmt.Errorf("cannot scan into non-pointer or nil destinations %T", dst)
	}

	elem := v.Elem()
	elem.Set(reflect.Zero(elem.Type()))

	return s.unmarshal(src, dst)
}

func (c *JSONCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	if src == nil {
		return nil, nil
	}

	dstBuf := make([]byte, len(src))
	copy(dstBuf, src)
	return dstBuf, nil
}

func (c *JSONCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var dst any
	err := c.Unmarshal(src, &dst)
	return dst, err
}
