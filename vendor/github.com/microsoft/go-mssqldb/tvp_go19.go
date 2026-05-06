//go:build go1.9
// +build go1.9

package mssql

import (
	"bytes"
	"database/sql"
	"encoding/binary"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/microsoft/go-mssqldb/msdsn"
)

const (
	jsonTag      = "json"
	tvpTag       = "tvp"
	tvpIdentity  = "@identity"
	skipTagValue = "-"
	sqlSeparator = "."
)

var (
	ErrorEmptyTVPTypeName = errors.New("TypeName must not be empty")
	ErrorTypeSlice        = errors.New("TVP must be slice type")
	ErrorTypeSliceIsEmpty = errors.New("TVP mustn't be null value")
	ErrorSkip             = errors.New("all fields mustn't skip")
	ErrorObjectName       = errors.New("wrong tvp name")
	ErrorWrongTyping      = errors.New("the number of elements in columnStr and tvpFieldIndexes do not align")
)

// TVP is driver type, which allows supporting Table Valued Parameters (TVP) in SQL Server
type TVP struct {
	//TypeName mustn't be default value
	TypeName string
	//Value must be the slice, mustn't be nil
	Value interface{}
}

func (tvp TVP) check() error {
	if len(tvp.TypeName) == 0 {
		return ErrorEmptyTVPTypeName
	}
	if !isProc(tvp.TypeName) {
		return ErrorEmptyTVPTypeName
	}
	if sepCount := getCountSQLSeparators(tvp.TypeName); sepCount > 1 {
		return ErrorObjectName
	}
	valueOf := reflect.ValueOf(tvp.Value)
	if valueOf.Kind() != reflect.Slice {
		return ErrorTypeSlice
	}
	if valueOf.IsNil() {
		return ErrorTypeSliceIsEmpty
	}
	if reflect.TypeOf(tvp.Value).Elem().Kind() != reflect.Struct {
		return ErrorTypeSlice
	}
	return nil
}

func (tvp TVP) encode(schema, name string, columnStr []columnStruct, tvpFieldIndexes []int, encoding msdsn.EncodeParameters) ([]byte, error) {
	if len(columnStr) != len(tvpFieldIndexes) {
		return nil, ErrorWrongTyping
	}
	preparedBuffer := make([]byte, 0, 20+(10*len(columnStr)))
	buf := bytes.NewBuffer(preparedBuffer)
	err := writeBVarChar(buf, "")
	if err != nil {
		return nil, err
	}

	writeBVarChar(buf, schema)
	writeBVarChar(buf, name)
	binary.Write(buf, binary.LittleEndian, uint16(len(columnStr)))

	for i, column := range columnStr {
		binary.Write(buf, binary.LittleEndian, column.UserType)
		binary.Write(buf, binary.LittleEndian, column.Flags)
		writeTypeInfo(buf, &columnStr[i].ti, false, encoding)
		writeBVarChar(buf, "")
	}
	// The returned error is always nil
	buf.WriteByte(_TVP_END_TOKEN)

	conn := new(Conn)
	conn.sess = new(tdsSession)
	conn.sess.loginAck = loginAckStruct{TDSVersion: verTDS73}
	stmt := &Stmt{
		c: conn,
	}

	val := reflect.ValueOf(tvp.Value)
	for i := 0; i < val.Len(); i++ {
		refStr := reflect.ValueOf(val.Index(i).Interface())
		buf.WriteByte(_TVP_ROW_TOKEN)
		for columnStrIdx, fieldIdx := range tvpFieldIndexes {
			if columnStr[columnStrIdx].Flags == fDefault {
				continue
			}
			field := refStr.Field(fieldIdx)
			tvpVal := field.Interface()
			if tvp.verifyStandardTypeOnNull(buf, tvpVal) {
				continue
			}
			valOf := reflect.ValueOf(tvpVal)
			elemKind := field.Kind()
			if elemKind == reflect.Ptr && valOf.IsNil() {
				switch tvpVal.(type) {
				case *bool, *time.Time, *int8, *int16, *int32, *int64, *float32, *float64, *int,
					*uint8, *uint16, *uint32, *uint64, *uint:
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
			columnStr[columnStrIdx].ti.Writer(buf, param.ti, param.buffer, encoding)
		}
	}
	buf.WriteByte(_TVP_END_TOKEN)
	return buf.Bytes(), nil
}

func (tvp TVP) columnTypes() ([]columnStruct, []int, error) {
	type fieldDetailStore struct {
		defaultValue interface{}
		isIdentity   bool
	}

	val := reflect.ValueOf(tvp.Value)
	var firstRow interface{}
	if val.Len() != 0 {
		firstRow = val.Index(0).Interface()
	} else {
		firstRow = reflect.New(reflect.TypeOf(tvp.Value).Elem()).Elem().Interface()
	}

	tvpRow := reflect.TypeOf(firstRow)
	columnCount := tvpRow.NumField()
	defaultValues := make([]fieldDetailStore, 0, columnCount)
	tvpFieldIndexes := make([]int, 0, columnCount)
	for i := 0; i < columnCount; i++ {
		field := tvpRow.Field(i)
		tvpTagValue, isTvpTag := field.Tag.Lookup(tvpTag)
		jsonTagValue, isJsonTag := field.Tag.Lookup(jsonTag)
		if IsSkipField(tvpTagValue, isTvpTag, jsonTagValue, isJsonTag) {
			continue
		}
		tvpFieldIndexes = append(tvpFieldIndexes, i)
		isIdentity := tvpTagValue == tvpIdentity
		if field.Type.Kind() == reflect.Ptr {
			v := reflect.New(field.Type.Elem())
			defaultValues = append(defaultValues, fieldDetailStore{
				defaultValue: v.Interface(),
				isIdentity:   isIdentity,
			})
			continue
		}
		defaultValues = append(defaultValues, fieldDetailStore{
			defaultValue: tvp.createZeroType(reflect.Zero(field.Type).Interface()),
			isIdentity:   isIdentity,
		})
	}

	if columnCount-len(tvpFieldIndexes) == columnCount {
		return nil, nil, ErrorSkip
	}

	conn := new(Conn)
	conn.sess = new(tdsSession)
	conn.sess.loginAck = loginAckStruct{TDSVersion: verTDS73}
	stmt := &Stmt{
		c: conn,
	}

	columnConfiguration := make([]columnStruct, 0, columnCount)
	for index, val := range defaultValues {
		cval, err := convertInputParameter(val.defaultValue)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to convert tvp parameter row %d col %d: %s", index, val.defaultValue, err)
		}
		param, err := stmt.makeParam(cval)
		if err != nil {
			return nil, nil, err
		}
		column := columnStruct{
			ti: param.ti,
		}
		if val.isIdentity {
			column.Flags = fDefault
		}
		switch param.ti.TypeId {
		case typeNVarChar, typeBigVarBin:
			column.ti.Size = 0
		}
		columnConfiguration = append(columnConfiguration, column)
	}

	return columnConfiguration, tvpFieldIndexes, nil
}

func IsSkipField(tvpTagValue string, isTvpValue bool, jsonTagValue string, isJsonTagValue bool) bool {
	if !isTvpValue && !isJsonTagValue {
		return false
	} else if isTvpValue && tvpTagValue != skipTagValue {
		return false
	} else if !isTvpValue && isJsonTagValue && jsonTagValue != skipTagValue {
		return false
	}
	return true
}

func getSchemeAndName(tvpName string) (string, string, error) {
	if len(tvpName) == 0 {
		return "", "", ErrorEmptyTVPTypeName
	}
	splitVal := strings.Split(tvpName, ".")
	if len(splitVal) > 2 {
		return "", "", ErrorObjectName
	}
	const (
		openSquareBrackets  = "["
		closeSquareBrackets = "]"
	)
	if len(splitVal) == 2 {
		res := make([]string, 2)
		for key, value := range splitVal {
			tmp := strings.Replace(value, openSquareBrackets, "", -1)
			tmp = strings.Replace(tmp, closeSquareBrackets, "", -1)
			res[key] = tmp
		}
		return res[0], res[1], nil
	}
	tmp := strings.Replace(splitVal[0], openSquareBrackets, "", -1)
	tmp = strings.Replace(tmp, closeSquareBrackets, "", -1)

	return "", tmp, nil
}

func getCountSQLSeparators(str string) int {
	return strings.Count(str, sqlSeparator)
}

// verify types https://golang.org/pkg/database/sql/
func (tvp TVP) createZeroType(fieldVal interface{}) interface{} {
	const (
		defaultBool    = false
		defaultFloat64 = float64(0)
		defaultInt64   = int64(0)
		defaultString  = ""
	)

	switch fieldVal.(type) {
	case sql.NullBool:
		return defaultBool
	case sql.NullFloat64:
		return defaultFloat64
	case sql.NullInt64:
		return defaultInt64
	case sql.NullString:
		return defaultString
	}
	return fieldVal
}

// verify types https://golang.org/pkg/database/sql/
func (tvp TVP) verifyStandardTypeOnNull(buf *bytes.Buffer, tvpVal interface{}) bool {
	const (
		defaultNull = uint8(0)
	)

	switch val := tvpVal.(type) {
	case sql.NullBool:
		if !val.Valid {
			binary.Write(buf, binary.LittleEndian, defaultNull)
			return true
		}
	case sql.NullFloat64:
		if !val.Valid {
			binary.Write(buf, binary.LittleEndian, defaultNull)
			return true
		}
	case sql.NullInt64:
		if !val.Valid {
			binary.Write(buf, binary.LittleEndian, defaultNull)
			return true
		}
	case sql.NullString:
		if !val.Valid {
			binary.Write(buf, binary.LittleEndian, uint64(_PLP_NULL))
			return true
		}
	}
	return false
}
