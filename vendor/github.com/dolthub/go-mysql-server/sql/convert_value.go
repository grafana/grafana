package sql

import (
	"fmt"

	"github.com/dolthub/vitess/go/vt/proto/query"

	"github.com/dolthub/go-mysql-server/sql/values"
)

// ConvertToValue converts the interface to a sql value.
func ConvertToValue(v interface{}) (Value, error) {
	switch v := v.(type) {
	case nil:
		return Value{
			Typ: query.Type_NULL_TYPE,
			Val: nil,
		}, nil
	case int:
		return Value{
			Typ: query.Type_INT64,
			Val: values.WriteInt64(make([]byte, values.Int64Size), int64(v)),
		}, nil
	case int8:
		return Value{
			Typ: query.Type_INT8,
			Val: values.WriteInt8(make([]byte, values.Int8Size), v),
		}, nil
	case int16:
		return Value{
			Typ: query.Type_INT16,
			Val: values.WriteInt16(make([]byte, values.Int16Size), v),
		}, nil
	case int32:
		return Value{
			Typ: query.Type_INT32,
			Val: values.WriteInt32(make([]byte, values.Int32Size), v),
		}, nil
	case int64:
		return Value{
			Typ: query.Type_INT64,
			Val: values.WriteInt64(make([]byte, values.Int64Size), v),
		}, nil
	case uint:
		return Value{
			Typ: query.Type_UINT64,
			Val: values.WriteUint64(make([]byte, values.Uint64Size), uint64(v)),
		}, nil
	case uint8:
		return Value{
			Typ: query.Type_UINT8,
			Val: values.WriteUint8(make([]byte, values.Uint8Size), v),
		}, nil
	case uint16:
		return Value{
			Typ: query.Type_UINT16,
			Val: values.WriteUint16(make([]byte, values.Uint16Size), v),
		}, nil
	case uint32:
		return Value{
			Typ: query.Type_UINT32,
			Val: values.WriteUint32(make([]byte, values.Uint32Size), v),
		}, nil
	case uint64:
		return Value{
			Typ: query.Type_UINT64,
			Val: values.WriteUint64(make([]byte, values.Uint64Size), v),
		}, nil
	case float32:
		return Value{
			Typ: query.Type_FLOAT32,
			Val: values.WriteFloat32(make([]byte, values.Float32Size), v),
		}, nil
	case float64:
		return Value{
			Typ: query.Type_FLOAT64,
			Val: values.WriteFloat64(make([]byte, values.Float64Size), v),
		}, nil
	case string:
		return Value{
			Typ: query.Type_VARCHAR,
			Val: values.WriteString(make([]byte, len(v)), v, values.ByteOrderCollation),
		}, nil
	case []byte:
		return Value{
			Typ: query.Type_BLOB,
			Val: values.WriteBytes(make([]byte, len(v)), v, values.ByteOrderCollation),
		}, nil
	default:
		return Value{}, fmt.Errorf("type %T not implemented", v)
	}
}

func MustConvertToValue(v interface{}) Value {
	ret, err := ConvertToValue(v)
	if err != nil {
		panic(err)
	}
	return ret
}
