package mysql

const (
	// In case we get something unexpected
	FieldTypeUnknown = "UNKNOWN"

	// Human-readable names for each distinct type byte
	FieldTypeNameDecimal    = "DECIMAL"
	FieldTypeNameTiny       = "TINY"
	FieldTypeNameShort      = "SHORT"
	FieldTypeNameLong       = "LONG"
	FieldTypeNameFloat      = "FLOAT"
	FieldTypeNameDouble     = "DOUBLE"
	FieldTypeNameNULL       = "NULL"
	FieldTypeNameTimestamp  = "TIMESTAMP"
	FieldTypeNameLongLong   = "LONGLONG"
	FieldTypeNameInt24      = "INT24"
	FieldTypeNameDate       = "DATE"
	FieldTypeNameTime       = "TIME"
	FieldTypeNameDateTime   = "DATETIME"
	FieldTypeNameYear       = "YEAR"
	FieldTypeNameNewDate    = "NEWDATE"
	FieldTypeNameVarChar    = "VARCHAR"
	FieldTypeNameBit        = "BIT"
	FieldTypeNameJSON       = "JSON"
	FieldTypeNameNewDecimal = "NEWDECIMAL"
	FieldTypeNameEnum       = "ENUM"
	FieldTypeNameSet        = "SET"
	FieldTypeNameTinyBLOB   = "TINYBLOB"
	FieldTypeNameMediumBLOB = "MEDIUMBLOB"
	FieldTypeNameLongBLOB   = "LONGBLOB"
	FieldTypeNameBLOB       = "BLOB"
	FieldTypeNameVarString  = "VARSTRING"
	FieldTypeNameString     = "STRING"
	FieldTypeNameGeometry   = "GEOMETRY"
)

// mapping from each type identifier to human readable string
var mysqlTypeMap = map[byte]string{
	fieldTypeDecimal:    FieldTypeNameDecimal,
	fieldTypeTiny:       FieldTypeNameTiny,
	fieldTypeShort:      FieldTypeNameShort,
	fieldTypeLong:       FieldTypeNameLong,
	fieldTypeFloat:      FieldTypeNameFloat,
	fieldTypeDouble:     FieldTypeNameDouble,
	fieldTypeNULL:       FieldTypeNameNULL,
	fieldTypeTimestamp:  FieldTypeNameTimestamp,
	fieldTypeLongLong:   FieldTypeNameLongLong,
	fieldTypeInt24:      FieldTypeNameInt24,
	fieldTypeDate:       FieldTypeNameDate,
	fieldTypeTime:       FieldTypeNameTime,
	fieldTypeDateTime:   FieldTypeNameDateTime,
	fieldTypeYear:       FieldTypeNameYear,
	fieldTypeNewDate:    FieldTypeNameNewDate,
	fieldTypeVarChar:    FieldTypeNameVarChar,
	fieldTypeBit:        FieldTypeNameBit,
	fieldTypeJSON:       FieldTypeNameJSON,
	fieldTypeNewDecimal: FieldTypeNameNewDecimal,
	fieldTypeEnum:       FieldTypeNameEnum,
	fieldTypeSet:        FieldTypeNameSet,
	fieldTypeTinyBLOB:   FieldTypeNameTinyBLOB,
	fieldTypeMediumBLOB: FieldTypeNameMediumBLOB,
	fieldTypeLongBLOB:   FieldTypeNameLongBLOB,
	fieldTypeBLOB:       FieldTypeNameBLOB,
	fieldTypeVarString:  FieldTypeNameVarString,
	fieldTypeString:     FieldTypeNameString,
	fieldTypeGeometry:   FieldTypeNameGeometry,
}

// Make Rows implement the optional RowsColumnTypeDatabaseTypeName interface.
// See https://github.com/golang/go/commit/2a85578b0ecd424e95b29d810b7a414a299fd6a7
// - (go 1.8 required for this to have any effect)
func (rows *mysqlRows) ColumnTypeDatabaseTypeName(index int) string {
	if typeName, ok := mysqlTypeMap[rows.rs.columns[index].fieldType]; ok {
		return typeName
	}
	return FieldTypeUnknown
}
