/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package mysql

// This file contains the constant definitions for this package.

// This is the data type for a field.
// Values taken from include/mysql/mysql_com.h
const (
	// TypeDecimal is MYSQL_TYPE_DECIMAL. It is deprecated.
	TypeDecimal = 0

	// TypeTiny is MYSQL_TYPE_TINY
	TypeTiny = 1

	// TypeShort is MYSQL_TYPE_SHORT
	TypeShort = 2

	// TypeLong is MYSQL_TYPE_LONG
	TypeLong = 3

	// TypeFloat is MYSQL_TYPE_FLOAT
	TypeFloat = 4

	// TypeDouble is MYSQL_TYPE_DOUBLE
	TypeDouble = 5

	// TypeNull is MYSQL_TYPE_NULL
	TypeNull = 6

	// TypeTimestamp is MYSQL_TYPE_TIMESTAMP
	TypeTimestamp = 7

	// TypeLongLong is MYSQL_TYPE_LONGLONG
	TypeLongLong = 8

	// TypeInt24 is MYSQL_TYPE_INT24
	TypeInt24 = 9

	// TypeDate is MYSQL_TYPE_DATE
	TypeDate = 10

	// TypeTime is MYSQL_TYPE_TIME
	TypeTime = 11

	// TypeDateTime is MYSQL_TYPE_DATETIME
	TypeDateTime = 12

	// TypeYear is MYSQL_TYPE_YEAR
	TypeYear = 13

	// TypeNewDate is MYSQL_TYPE_NEWDATE
	TypeNewDate = 14

	// TypeVarchar is MYSQL_TYPE_VARCHAR
	TypeVarchar = 15

	// TypeBit is MYSQL_TYPE_BIT
	TypeBit = 16

	// TypeTimestamp2 is MYSQL_TYPE_TIMESTAMP2
	TypeTimestamp2 = 17

	// TypeDateTime2 is MYSQL_TYPE_DATETIME2
	TypeDateTime2 = 18

	// TypeTime2 is MYSQL_TYPE_TIME2
	TypeTime2 = 19

	// TypeJSON is MYSQL_TYPE_JSON
	TypeJSON = 245

	// TypeNewDecimal is MYSQL_TYPE_NEWDECIMAL
	TypeNewDecimal = 246

	// TypeEnum is MYSQL_TYPE_ENUM
	TypeEnum = 247

	// TypeSet is MYSQL_TYPE_SET
	TypeSet = 248

	// TypeTinyBlob is MYSQL_TYPE_TINY_BLOB
	TypeTinyBlob = 249

	// TypeMediumBlob is MYSQL_TYPE_MEDIUM_BLOB
	TypeMediumBlob = 250

	// TypeLongBlob is MYSQL_TYPE_LONG_BLOB
	TypeLongBlob = 251

	// TypeBlob is MYSQL_TYPE_BLOB
	TypeBlob = 252

	// TypeVarString is MYSQL_TYPE_VAR_STRING
	TypeVarString = 253

	// TypeString is MYSQL_TYPE_STRING
	TypeString = 254

	// TypeGeometry is MYSQL_TYPE_GEOMETRY
	TypeGeometry = 255
)

// Constants for the type of an INTVAR_EVENT.
const (
	// IntVarInvalidInt is INVALID_INT_EVENT
	IntVarInvalidInt = 0

	// IntVarLastInsertID is LAST_INSERT_ID_EVENT
	IntVarLastInsertID = 1

	// IntVarInsertID is INSERT_ID_EVENT
	IntVarInsertID = 2
)

// Name of the variable represented by an IntVar.
var (
	// IntVarNames maps a InVar type to the variable name it represents.
	IntVarNames = map[byte]string{
		IntVarLastInsertID: "LAST_INSERT_ID",
		IntVarInsertID:     "INSERT_ID",
	}
)

// Constants about the type of checksum in a packet.
// These constants are common between MariaDB 10.0 and MySQL 5.6.
const (
	// BinlogChecksumAlgOff indicates that checksums are supported but off.
	BinlogChecksumAlgOff = 0

	// BinlogChecksumAlgCRC32 indicates that CRC32 checksums are used.
	BinlogChecksumAlgCRC32 = 1

	// BinlogChecksumAlgUndef indicates that checksums are not supported.
	BinlogChecksumAlgUndef = 255
)

// These constants describe the event types.
// See: http://dev.mysql.com/doc/internals/en/binlog-event-type.html
const (
	eUnknownEvent           = 0
	eStartEventV3           = 1
	eQueryEvent             = 2
	eStopEvent              = 3
	eRotateEvent            = 4
	eIntVarEvent            = 5
	eLoadEvent              = 6
	eSlaveEvent             = 7
	eCreateFileEvent        = 8
	eAppendBlockEvent       = 9
	eExecLoadEvent          = 10
	eDeleteFileEvent        = 11
	eNewLoadEvent           = 12
	eRandEvent              = 13
	eUserVarEvent           = 14
	eFormatDescriptionEvent = 15
	eXIDEvent               = 16
	eBeginLoadQueryEvent    = 17
	eExecuteLoadQueryEvent  = 18
	eTableMapEvent          = 19
	eWriteRowsEventV0       = 20
	eUpdateRowsEventV0      = 21
	eDeleteRowsEventV0      = 22
	eWriteRowsEventV1       = 23
	eUpdateRowsEventV1      = 24
	eDeleteRowsEventV1      = 25
	eIncidentEvent          = 26
	eHeartbeatEvent         = 27
	eIgnorableEvent         = 28
	eRowsQueryEvent         = 29
	eWriteRowsEventV2       = 30
	eUpdateRowsEventV2      = 31
	eDeleteRowsEventV2      = 32
	eGTIDEvent              = 33
	eAnonymousGTIDEvent     = 34
	ePreviousGTIDsEvent     = 35

	// MySQL 5.7 events
	eTransactionContextEvent = 36
	eViewChangeEvent         = 37
	eXAPrepareLogEvent       = 38

	// MariaDB specific values. They start at 160.
	eMariaAnnotateRowsEvent     = 160
	eMariaBinlogCheckpointEvent = 161
	eMariaGTIDEvent             = 162
	eMariaGTIDListEvent         = 163
	eMariaStartEncryptionEvent  = 164
)

// These constants describe the type of status variables in q Query packet.
const (
	// QFlags2Code is Q_FLAGS2_CODE
	QFlags2Code = 0

	// QSQLModeCode is Q_SQL_MODE_CODE
	QSQLModeCode = 1

	// QCatalog is Q_CATALOG
	QCatalog = 2

	// QAutoIncrement is Q_AUTO_INCREMENT
	QAutoIncrement = 3

	// QCharsetCode is Q_CHARSET_CODE
	QCharsetCode = 4

	// QTimeZoneCode is Q_TIME_ZONE_CODE
	QTimeZoneCode = 5

	// QCatalogNZCode is Q_CATALOG_NZ_CODE
	QCatalogNZCode = 6
)

// These constants describe the values in the QFlags2Code bitmask field of Query events.
// From: https://dev.mysql.com/doc/dev/mysql-server/latest/page_protocol_replication_binlog_event.html#sect_protocol_replication_event_query_03
const (
	QFlagOptionAutoIsNull          = 0x00004000
	QFlagOptionNotAutocommit       = 0x00080000
	QFlagOptionNoForeignKeyChecks  = 0x04000000
	QFlagOptionRelaxedUniqueChecks = 0x08000000
)

// These constants describe the values in the QSQLModeCode bitmask field of Query events.
// From: https://dev.mysql.com/doc/dev/mysql-server/latest/page_protocol_replication_binlog_event.html#sect_protocol_replication_event_query_03
const (
	QSqlModeRealAsFloat            = 0x00000001
	QSqlModePipesAsConcat          = 0x00000002
	QSqlModeAnsiQuotes             = 0x00000004
	QSqlModeIgnoreSpace            = 0x00000008
	QSqlModeNotUsed                = 0x00000010
	QSqlModeOnlyFullGroupBy        = 0x00000020
	QSqlModeNoUnsignedSubtraction  = 0x00000040
	QSqlModeNoDirInCreate          = 0x00000080
	QSqlModePostgreSql             = 0x00000100
	QSqlModeOracle                 = 0x00000200
	QSqlModeMsSql                  = 0x00000400
	QSqlModeDb2                    = 0x00000800
	QSqlModeMaxDb                  = 0x00001000
	QSqlModeNoKeyOptions           = 0x00002000
	QSqlModeNoTableOptions         = 0x00004000
	QSqlModeNoFieldOptions         = 0x00008000
	QSqlModeMySql323               = 0x00010000
	QSqlModeMySql40                = 0x00020000
	QSqlModeAnsi                   = 0x00040000
	QSqlModeNoAutoValueOnZero      = 0x00080000
	QSqlModeNoBackslashEscapes     = 0x00100000
	QSqlModeStrictTransTables      = 0x00200000
	QSqlModeStrictAllTables        = 0x00400000
	QSqlModeNoZeroInDate           = 0x00800000
	QSqlModeNoZeroDate             = 0x01000000
	QSqlModeInvalidDates           = 0x02000000
	QSqlModeErrorForDivisionByZero = 0x04000000
	QSqlModeTraditional            = 0x08000000
	QSqlModeNoAutoCreateUser       = 0x10000000
	QSqlModeHighNotPrecedence      = 0x20000000
	QSqlModeNoEngineSubstitution   = 0x40000000
	QSqlModePadCharToFullLength    = 0x80000000
)
