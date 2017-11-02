// Copyright (c) 2012 The gocql Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gocql

import (
	"fmt"
	"math/big"
	"reflect"
	"strings"
	"time"

	"gopkg.in/inf.v0"
)

type RowData struct {
	Columns []string
	Values  []interface{}
}

func goType(t TypeInfo) reflect.Type {
	switch t.Type() {
	case TypeVarchar, TypeAscii, TypeInet, TypeText:
		return reflect.TypeOf(*new(string))
	case TypeBigInt, TypeCounter:
		return reflect.TypeOf(*new(int64))
	case TypeTimestamp:
		return reflect.TypeOf(*new(time.Time))
	case TypeBlob:
		return reflect.TypeOf(*new([]byte))
	case TypeBoolean:
		return reflect.TypeOf(*new(bool))
	case TypeFloat:
		return reflect.TypeOf(*new(float32))
	case TypeDouble:
		return reflect.TypeOf(*new(float64))
	case TypeInt:
		return reflect.TypeOf(*new(int))
	case TypeSmallInt:
		return reflect.TypeOf(*new(int16))
	case TypeTinyInt:
		return reflect.TypeOf(*new(int8))
	case TypeDecimal:
		return reflect.TypeOf(*new(*inf.Dec))
	case TypeUUID, TypeTimeUUID:
		return reflect.TypeOf(*new(UUID))
	case TypeList, TypeSet:
		return reflect.SliceOf(goType(t.(CollectionType).Elem))
	case TypeMap:
		return reflect.MapOf(goType(t.(CollectionType).Key), goType(t.(CollectionType).Elem))
	case TypeVarint:
		return reflect.TypeOf(*new(*big.Int))
	case TypeTuple:
		// what can we do here? all there is to do is to make a list of interface{}
		tuple := t.(TupleTypeInfo)
		return reflect.TypeOf(make([]interface{}, len(tuple.Elems)))
	case TypeUDT:
		return reflect.TypeOf(make(map[string]interface{}))
	case TypeDate:
		return reflect.TypeOf(*new(time.Time))
	default:
		return nil
	}
}

func dereference(i interface{}) interface{} {
	return reflect.Indirect(reflect.ValueOf(i)).Interface()
}

func getCassandraType(name string) Type {
	switch name {
	case "ascii":
		return TypeAscii
	case "bigint":
		return TypeBigInt
	case "blob":
		return TypeBlob
	case "boolean":
		return TypeBoolean
	case "counter":
		return TypeCounter
	case "decimal":
		return TypeDecimal
	case "double":
		return TypeDouble
	case "float":
		return TypeFloat
	case "int":
		return TypeInt
	case "timestamp":
		return TypeTimestamp
	case "uuid":
		return TypeUUID
	case "varchar", "text":
		return TypeVarchar
	case "varint":
		return TypeVarint
	case "timeuuid":
		return TypeTimeUUID
	case "inet":
		return TypeInet
	case "MapType":
		return TypeMap
	case "ListType":
		return TypeList
	case "SetType":
		return TypeSet
	case "TupleType":
		return TypeTuple
	default:
		if strings.HasPrefix(name, "set") {
			return TypeSet
		} else if strings.HasPrefix(name, "list") {
			return TypeList
		} else if strings.HasPrefix(name, "map") {
			return TypeMap
		} else if strings.HasPrefix(name, "tuple") {
			return TypeTuple
		}
		return TypeCustom
	}
}

func getApacheCassandraType(class string) Type {
	switch strings.TrimPrefix(class, apacheCassandraTypePrefix) {
	case "AsciiType":
		return TypeAscii
	case "LongType":
		return TypeBigInt
	case "BytesType":
		return TypeBlob
	case "BooleanType":
		return TypeBoolean
	case "CounterColumnType":
		return TypeCounter
	case "DecimalType":
		return TypeDecimal
	case "DoubleType":
		return TypeDouble
	case "FloatType":
		return TypeFloat
	case "Int32Type":
		return TypeInt
	case "ShortType":
		return TypeSmallInt
	case "ByteType":
		return TypeTinyInt
	case "DateType", "TimestampType":
		return TypeTimestamp
	case "UUIDType", "LexicalUUIDType":
		return TypeUUID
	case "UTF8Type":
		return TypeVarchar
	case "IntegerType":
		return TypeVarint
	case "TimeUUIDType":
		return TypeTimeUUID
	case "InetAddressType":
		return TypeInet
	case "MapType":
		return TypeMap
	case "ListType":
		return TypeList
	case "SetType":
		return TypeSet
	case "TupleType":
		return TypeTuple
	default:
		return TypeCustom
	}
}

func typeCanBeNull(typ TypeInfo) bool {
	switch typ.(type) {
	case CollectionType, UDTTypeInfo, TupleTypeInfo:
		return false
	}

	return true
}

func (r *RowData) rowMap(m map[string]interface{}) {
	for i, column := range r.Columns {
		val := dereference(r.Values[i])
		if valVal := reflect.ValueOf(val); valVal.Kind() == reflect.Slice {
			valCopy := reflect.MakeSlice(valVal.Type(), valVal.Len(), valVal.Cap())
			reflect.Copy(valCopy, valVal)
			m[column] = valCopy.Interface()
		} else {
			m[column] = val
		}
	}
}

// TupeColumnName will return the column name of a tuple value in a column named
// c at index n. It should be used if a specific element within a tuple is needed
// to be extracted from a map returned from SliceMap or MapScan.
func TupleColumnName(c string, n int) string {
	return fmt.Sprintf("%s[%d]", c, n)
}

func (iter *Iter) RowData() (RowData, error) {
	if iter.err != nil {
		return RowData{}, iter.err
	}

	columns := make([]string, 0, len(iter.Columns()))
	values := make([]interface{}, 0, len(iter.Columns()))

	for _, column := range iter.Columns() {
		if c, ok := column.TypeInfo.(TupleTypeInfo); !ok {
			val := column.TypeInfo.New()
			columns = append(columns, column.Name)
			values = append(values, val)
		} else {
			for i, elem := range c.Elems {
				columns = append(columns, TupleColumnName(column.Name, i))
				values = append(values, elem.New())
			}
		}
	}

	rowData := RowData{
		Columns: columns,
		Values:  values,
	}

	return rowData, nil
}

// TODO(zariel): is it worth exporting this?
func (iter *Iter) rowMap() (map[string]interface{}, error) {
	if iter.err != nil {
		return nil, iter.err
	}

	rowData, _ := iter.RowData()
	iter.Scan(rowData.Values...)
	m := make(map[string]interface{}, len(rowData.Columns))
	rowData.rowMap(m)
	return m, nil
}

// SliceMap is a helper function to make the API easier to use
// returns the data from the query in the form of []map[string]interface{}
func (iter *Iter) SliceMap() ([]map[string]interface{}, error) {
	if iter.err != nil {
		return nil, iter.err
	}

	// Not checking for the error because we just did
	rowData, _ := iter.RowData()
	dataToReturn := make([]map[string]interface{}, 0)
	for iter.Scan(rowData.Values...) {
		m := make(map[string]interface{}, len(rowData.Columns))
		rowData.rowMap(m)
		dataToReturn = append(dataToReturn, m)
	}
	if iter.err != nil {
		return nil, iter.err
	}
	return dataToReturn, nil
}

// MapScan takes a map[string]interface{} and populates it with a row
// that is returned from cassandra.
//
// Each call to MapScan() must be called with a new map object.
// During the call to MapScan() any pointers in the existing map
// are replaced with non pointer types before the call returns
//
//	iter := session.Query(`SELECT * FROM mytable`).Iter()
//	for {
//		// New map each iteration
//		row = make(map[string]interface{})
//		if !iter.MapScan(row) {
//			break
//		}
//		// Do things with row
//		if fullname, ok := row["fullname"]; ok {
//			fmt.Printf("Full Name: %s\n", fullname)
//		}
//	}
//
// You can also pass pointers in the map before each call
//
//	var fullName FullName // Implements gocql.Unmarshaler and gocql.Marshaler interfaces
//	var address net.IP
//	var age int
//	iter := session.Query(`SELECT * FROM scan_map_table`).Iter()
//	for {
//		// New map each iteration
//		row := map[string]interface{}{
//			"fullname": &fullName,
//			"age":      &age,
//			"address":  &address,
//		}
//		if !iter.MapScan(row) {
//			break
//		}
//		fmt.Printf("First: %s Age: %d Address: %q\n", fullName.FirstName, age, address)
//	}
func (iter *Iter) MapScan(m map[string]interface{}) bool {
	if iter.err != nil {
		return false
	}

	// Not checking for the error because we just did
	rowData, _ := iter.RowData()

	for i, col := range rowData.Columns {
		if dest, ok := m[col]; ok {
			rowData.Values[i] = dest
		}
	}

	if iter.Scan(rowData.Values...) {
		rowData.rowMap(m)
		return true
	}
	return false
}

func copyBytes(p []byte) []byte {
	b := make([]byte, len(p))
	copy(b, p)
	return b
}
