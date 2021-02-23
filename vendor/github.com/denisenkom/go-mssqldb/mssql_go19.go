// +build go1.9

package mssql

import (
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"reflect"
	"time"

	// "github.com/cockroachdb/apd"
	"github.com/golang-sql/civil"
)

// Type alias provided for compatibility.

type MssqlDriver = Driver           // Deprecated: users should transition to the new name when possible.
type MssqlBulk = Bulk               // Deprecated: users should transition to the new name when possible.
type MssqlBulkOptions = BulkOptions // Deprecated: users should transition to the new name when possible.
type MssqlConn = Conn               // Deprecated: users should transition to the new name when possible.
type MssqlResult = Result           // Deprecated: users should transition to the new name when possible.
type MssqlRows = Rows               // Deprecated: users should transition to the new name when possible.
type MssqlStmt = Stmt               // Deprecated: users should transition to the new name when possible.

var _ driver.NamedValueChecker = &Conn{}

// VarChar parameter types.
type VarChar string

type NVarCharMax string
type VarCharMax string

// DateTime1 encodes parameters to original DateTime SQL types.
type DateTime1 time.Time

// DateTimeOffset encodes parameters to DateTimeOffset, preserving the UTC offset.
type DateTimeOffset time.Time

func convertInputParameter(val interface{}) (interface{}, error) {
	switch v := val.(type) {
	case VarChar:
		return val, nil
	case NVarCharMax:
		return val, nil
	case VarCharMax:
		return val, nil
	case DateTime1:
		return val, nil
	case DateTimeOffset:
		return val, nil
	case civil.Date:
		return val, nil
	case civil.DateTime:
		return val, nil
	case civil.Time:
		return val, nil
		// case *apd.Decimal:
		// 	return nil
	default:
		return driver.DefaultParameterConverter.ConvertValue(v)
	}
}

func (c *Conn) CheckNamedValue(nv *driver.NamedValue) error {
	switch v := nv.Value.(type) {
	case sql.Out:
		if c.outs == nil {
			c.outs = make(map[string]interface{})
		}
		c.outs[nv.Name] = v.Dest

		if v.Dest == nil {
			return errors.New("destination is a nil pointer")
		}

		dest_info := reflect.ValueOf(v.Dest)
		if dest_info.Kind() != reflect.Ptr {
			return errors.New("destination not a pointer")
		}

		if dest_info.IsNil() {
			return errors.New("destination is a nil pointer")
		}

		pointed_value := reflect.Indirect(dest_info)

		// don't allow pointer to a pointer, only pointer to a value can be handled
		// correctly
		if pointed_value.Kind() == reflect.Ptr {
			return errors.New("destination is a pointer to a pointer")
		}

		// Unwrap the Out value and check the inner value.
		val := pointed_value.Interface()
		if val == nil {
			return errors.New("MSSQL does not allow NULL value without type for OUTPUT parameters")
		}
		conv, err := convertInputParameter(val)
		if err != nil {
			return err
		}
		if conv == nil {
			// if we replace with nil we would lose type information
			nv.Value = sql.Out{Dest: val}
		} else {
			nv.Value = sql.Out{Dest: conv}
		}
		return nil
	case *ReturnStatus:
		*v = 0 // By default the return value should be zero.
		c.returnStatus = v
		return driver.ErrRemoveArgument
	case TVP:
		return nil
	default:
		var err error
		nv.Value, err = convertInputParameter(nv.Value)
		return err
	}
}

func (s *Stmt) makeParamExtra(val driver.Value) (res param, err error) {
	switch val := val.(type) {
	case VarChar:
		res.ti.TypeId = typeBigVarChar
		res.buffer = []byte(val)
		res.ti.Size = len(res.buffer)
	case VarCharMax:
		res.ti.TypeId = typeBigVarChar
		res.buffer = []byte(val)
		res.ti.Size = 0 // currently zero forces varchar(max)
	case NVarCharMax:
		res.ti.TypeId = typeNVarChar
		res.buffer = str2ucs2(string(val))
		res.ti.Size = 0 // currently zero forces nvarchar(max)
	case DateTime1:
		t := time.Time(val)
		res.ti.TypeId = typeDateTimeN
		res.buffer = encodeDateTime(t)
		res.ti.Size = len(res.buffer)
	case DateTimeOffset:
		res.ti.TypeId = typeDateTimeOffsetN
		res.ti.Scale = 7
		res.buffer = encodeDateTimeOffset(time.Time(val), int(res.ti.Scale))
		res.ti.Size = len(res.buffer)
	case civil.Date:
		res.ti.TypeId = typeDateN
		res.buffer = encodeDate(val.In(time.UTC))
		res.ti.Size = len(res.buffer)
	case civil.DateTime:
		res.ti.TypeId = typeDateTime2N
		res.ti.Scale = 7
		res.buffer = encodeDateTime2(val.In(time.UTC), int(res.ti.Scale))
		res.ti.Size = len(res.buffer)
	case civil.Time:
		res.ti.TypeId = typeTimeN
		res.ti.Scale = 7
		res.buffer = encodeTime(val.Hour, val.Minute, val.Second, val.Nanosecond, int(res.ti.Scale))
		res.ti.Size = len(res.buffer)
	case sql.Out:
		res, err = s.makeParam(val.Dest)
		res.Flags = fByRevValue
	case TVP:
		err = val.check()
		if err != nil {
			return
		}
		schema, name, errGetName := getSchemeAndName(val.TypeName)
		if errGetName != nil {
			return
		}
		res.ti.UdtInfo.TypeName = name
		res.ti.UdtInfo.SchemaName = schema
		res.ti.TypeId = typeTvp
		columnStr, tvpFieldIndexes, errCalTypes := val.columnTypes()
		if errCalTypes != nil {
			err = errCalTypes
			return
		}
		res.buffer, err = val.encode(schema, name, columnStr, tvpFieldIndexes)
		if err != nil {
			return
		}
		res.ti.Size = len(res.buffer)

	default:
		err = fmt.Errorf("mssql: unknown type for %T", val)
	}
	return
}

func scanIntoOut(name string, fromServer, scanInto interface{}) error {
	return convertAssign(scanInto, fromServer)
}
