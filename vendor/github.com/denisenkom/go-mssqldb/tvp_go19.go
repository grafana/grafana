// +build go1.9

package mssql

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"reflect"
	"time"
)

var (
	ErrorEmptyTVPName        = errors.New("TVPTypeName must not be empty")
	ErrorTVPTypeSlice        = errors.New("TVPType must be slice type")
	ErrorTVPTypeSliceIsEmpty = errors.New("TVPType mustn't be null value")
)

//TVPType is driver type, which allows supporting Table Valued Parameters (TVP) in SQL Server
type TVPType struct {
	//TVP param name, mustn't be default value
	TVPTypeName string
	//TVP scheme name
	TVPScheme string
	//TVP Value. Param must be the slice, mustn't be nil
	TVPValue interface{}
}

func (tvp TVPType) check() error {
	if len(tvp.TVPTypeName) == 0 {
		return ErrorEmptyTVPName
	}
	valueOf := reflect.ValueOf(tvp.TVPValue)
	if valueOf.Kind() != reflect.Slice {
		return ErrorTVPTypeSlice
	}
	if valueOf.IsNil() {
		return ErrorTVPTypeSliceIsEmpty
	}
	if reflect.TypeOf(tvp.TVPValue).Elem().Kind() != reflect.Struct {
		return ErrorTVPTypeSlice
	}
	return nil
}

func (tvp TVPType) encode() ([]byte, error) {
	columnStr, err := tvp.columnTypes()
	if err != nil {
		return nil, err
	}
	preparedBuffer := make([]byte, 0, 20+(10*len(columnStr)))
	buf := bytes.NewBuffer(preparedBuffer)
	err = writeBVarChar(buf, "")
	if err != nil {
		return nil, err
	}
	writeBVarChar(buf, tvp.TVPScheme)
	writeBVarChar(buf, tvp.TVPTypeName)

	binary.Write(buf, binary.LittleEndian, uint16(len(columnStr)))

	for i, column := range columnStr {
		binary.Write(buf, binary.LittleEndian, uint32(column.UserType))
		binary.Write(buf, binary.LittleEndian, uint16(column.Flags))
		writeTypeInfo(buf, &columnStr[i].ti)
		writeBVarChar(buf, "")
	}
	buf.WriteByte(_TVP_END_TOKEN)
	conn := new(Conn)
	conn.sess = new(tdsSession)
	conn.sess.loginAck = loginAckStruct{TDSVersion: verTDS73}
	stmt := &Stmt{
		c: conn,
	}

	val := reflect.ValueOf(tvp.TVPValue)
	for i := 0; i < val.Len(); i++ {
		refStr := reflect.ValueOf(val.Index(i).Interface())
		buf.WriteByte(_TVP_ROW_TOKEN)
		for j := 0; j < refStr.NumField(); j++ {
			field := refStr.Field(j)
			tvpVal := field.Interface()
			valOf := reflect.ValueOf(tvpVal)
			elemKind := field.Kind()
			if elemKind == reflect.Ptr && valOf.IsNil() {
				switch tvpVal.(type) {
				case *bool, *time.Time, *int8, *int16, *int32, *int64, *float32, *float64:
					binary.Write(buf, binary.LittleEndian, uint8(0))
					continue
				default:
					binary.Write(buf, binary.LittleEndian, uint64(_PLP_NULL))
					continue
				}
			}
			if elemKind == reflect.Slice && valOf.IsNil() {
				binary.Write(buf, binary.LittleEndian, uint64(_PLP_NULL))
				continue
			}

			cval, err := convertInputParameter(tvpVal)
			if err != nil {
				return nil, fmt.Errorf("failed to convert tvp parameter row col: %s", err)
			}
			param, err := stmt.makeParam(cval)
			if err != nil {
				return nil, fmt.Errorf("failed to make tvp parameter row col: %s", err)
			}
			columnStr[j].ti.Writer(buf, param.ti, param.buffer)
		}
	}
	buf.WriteByte(_TVP_END_TOKEN)
	return buf.Bytes(), nil
}

func (tvp TVPType) columnTypes() ([]columnStruct, error) {
	val := reflect.ValueOf(tvp.TVPValue)
	var firstRow interface{}
	if val.Len() != 0 {
		firstRow = val.Index(0).Interface()
	} else {
		firstRow = reflect.New(reflect.TypeOf(tvp.TVPValue).Elem()).Elem().Interface()
	}

	tvpRow := reflect.TypeOf(firstRow)
	columnCount := tvpRow.NumField()
	defaultValues := make([]interface{}, 0, columnCount)

	for i := 0; i < columnCount; i++ {
		typeField := tvpRow.Field(i).Type
		if typeField.Kind() == reflect.Ptr {
			v := reflect.New(typeField.Elem())
			defaultValues = append(defaultValues, v.Interface())
			continue
		}
		defaultValues = append(defaultValues, reflect.Zero(typeField).Interface())
	}

	conn := new(Conn)
	conn.sess = new(tdsSession)
	conn.sess.loginAck = loginAckStruct{TDSVersion: verTDS73}
	stmt := &Stmt{
		c: conn,
	}

	columnConfiguration := make([]columnStruct, 0, columnCount)
	for index, val := range defaultValues {
		cval, err := convertInputParameter(val)
		if err != nil {
			return nil, fmt.Errorf("failed to convert tvp parameter row %d col %d: %s", index, val, err)
		}
		param, err := stmt.makeParam(cval)
		if err != nil {
			return nil, err
		}
		column := columnStruct{
			ti: param.ti,
		}
		switch param.ti.TypeId {
		case typeNVarChar, typeBigVarBin:
			column.ti.Size = 0
		}
		columnConfiguration = append(columnConfiguration, column)
	}

	return columnConfiguration, nil
}
