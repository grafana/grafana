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

import (
	"strings"
)

const (
	// MaxPacketSize is the maximum payload length of a packet
	// the server supports.
	MaxPacketSize = (1 << 24) - 1

	// protocolVersion is the current version of the protocol.
	// Always 10.
	protocolVersion = 10
)

// AuthMethodDescription is the type for different supported and
// implemented authentication methods.
type AuthMethodDescription string

// Supported auth forms.
const (
	// MysqlNativePassword uses a salt and transmits a hash on the wire.
	MysqlNativePassword = AuthMethodDescription("mysql_native_password")

	// MysqlClearPassword transmits the password in the clear.
	MysqlClearPassword = AuthMethodDescription("mysql_clear_password")

	// CachingSha2Password uses a salt and transmits a SHA256 hash on the wire.
	CachingSha2Password = AuthMethodDescription("caching_sha2_password")

	// MysqlDialog uses the dialog plugin on the client side.
	// It transmits data in the clear.
	MysqlDialog = AuthMethodDescription("dialog")
)

// Capability flags.
// Originally found in include/mysql/mysql_com.h
const (
	// CapabilityClientLongPassword is CLIENT_LONG_PASSWORD.
	// New more secure passwords. Assumed to be set since 4.1.1.
	// We do not check this anywhere.
	CapabilityClientLongPassword = 1

	// CapabilityClientFoundRows is CLIENT_FOUND_ROWS.
	CapabilityClientFoundRows = 1 << 1

	// CapabilityClientLongFlag is CLIENT_LONG_FLAG.
	// Longer flags in Protocol::ColumnDefinition320.
	// Set it everywhere, not used, as we use Protocol::ColumnDefinition41.
	CapabilityClientLongFlag = 1 << 2

	// CapabilityClientConnectWithDB is CLIENT_CONNECT_WITH_DB.
	// One can specify db on connect.
	CapabilityClientConnectWithDB = 1 << 3

	// CLIENT_NO_SCHEMA 1 << 4
	// Do not permit database.table.column. We do permit it.

	// CLIENT_COMPRESS 1 << 5
	// We do not support compression. CPU is usually our bottleneck.

	// CLIENT_ODBC 1 << 6
	// No special behavior since 3.22.

	// CapabilityClientLocalFiles is CLIENT_LOCAL_FILES. We can use LOCAL INFILE request of LOAD DATA|XML.
	CapabilityClientLocalFiles = 1 << 7

	// CLIENT_IGNORE_SPACE 1 << 8
	// Parser can ignore spaces before '('.
	// We ignore this.

	// CapabilityClientProtocol41 is CLIENT_PROTOCOL_41.
	// New 4.1 protocol. Enforced everywhere.
	CapabilityClientProtocol41 = 1 << 9

	// CLIENT_INTERACTIVE 1 << 10
	// Not specified, ignored.

	// CapabilityClientSSL is CLIENT_SSL.
	// Switch to SSL after handshake.
	CapabilityClientSSL = 1 << 11

	// CLIENT_IGNORE_SIGPIPE 1 << 12
	// Do not issue SIGPIPE if network failures occur (libmysqlclient only).

	// CapabilityClientTransactions is CLIENT_TRANSACTIONS.
	// Can send status flags in EOF_Packet.
	// This flag is optional in 3.23, but always set by the server since 4.0.
	// We just do it all the time.
	CapabilityClientTransactions = 1 << 13

	// CLIENT_RESERVED 1 << 14

	// CapabilityClientSecureConnection is CLIENT_SECURE_CONNECTION.
	// New 4.1 authentication. Always set, expected, never checked.
	CapabilityClientSecureConnection = 1 << 15

	// CapabilityClientMultiStatements is CLIENT_MULTI_STATEMENTS
	// Can handle multiple statements per COM_QUERY and COM_STMT_PREPARE.
	CapabilityClientMultiStatements = 1 << 16

	// CapabilityClientMultiResults is CLIENT_MULTI_RESULTS
	// Can send multiple resultsets for COM_QUERY.
	CapabilityClientMultiResults = 1 << 17

	// CapabilityClientPluginAuth is CLIENT_PLUGIN_AUTH.
	// Client supports plugin authentication.
	CapabilityClientPluginAuth = 1 << 19

	// CapabilityClientConnAttr is CLIENT_CONNECT_ATTRS
	// Permits connection attributes in Protocol::HandshakeResponse41.
	CapabilityClientConnAttr = 1 << 20

	// CapabilityClientPluginAuthLenencClientData is CLIENT_PLUGIN_AUTH_LENENC_CLIENT_DATA
	CapabilityClientPluginAuthLenencClientData = 1 << 21

	// CLIENT_CAN_HANDLE_EXPIRED_PASSWORDS 1 << 22
	// Announces support for expired password extension.
	// Not yet supported.

	// CLIENT_SESSION_TRACK 1 << 23
	// Can set SERVER_SESSION_STATE_CHANGED in the Status Flags
	// and send session-state change data after a OK packet.
	// Not yet supported.
	CapabilityClientSessionTrack = 1 << 23

	// CapabilityClientDeprecateEOF is CLIENT_DEPRECATE_EOF
	// Expects an OK (instead of EOF) after the resultset rows of a Text Resultset.
	CapabilityClientDeprecateEOF = 1 << 24
)

// Status flags. They are returned by the server in a few cases.
// Originally found in include/mysql/mysql_com.h
// See https://dev.mysql.com/doc/dev/mysql-server/latest/mysql__com_8h.html#a1d854e841086925be1883e4d7b4e8cad
// See https://mariadb.com/kb/en/ok_packet/ if you actually want useful information
const (
	// ServerInTransaction is SERVER_STATUS_IN_TRANS (a transaction is active)
	ServerInTransaction = 0x0001

	// ServerStatusAutocommit is SERVER_STATUS_AUTOCOMMIT.
	ServerStatusAutocommit = 0x0002

	// ServerMoreResultsExists is SERVER_MORE_RESULTS_EXISTS
	ServerMoreResultsExists = 0x0008

	// ServerCursorExists is SERVER_STATUS_CURSOR_EXISTS
	ServerCursorExists = 0x0040

	// ServerCursorLastRowSent is SERVER_STATUS_LAST_ROW_SENT
	ServerCursorLastRowSent = 0x0080
)

// Cursor Types. They are received on COM_STMT_EXECUTE()
// See https://dev.mysql.com/doc/dev/mysql-server/9.3.0/mysql__com_8h.html#a3e5e9e744ff6f7b989a604fd669977da
const (
	NoCursor                uint8 = 0x00
	ReadOnly                uint8 = 0x01
	ForUpdate               uint8 = 0x02
	Scrollable              uint8 = 0x04
	ParameterCountAvailable uint8 = 0x08
)

// State Change Information
const (
	// one or more system variables changed.
	SessionTrackSystemVariables uint8 = 0x00
	// schema changed.
	SessionTrackSchema uint8 = 0x01
	// "track state change" changed.
	SessionTrackStateChange uint8 = 0x02
	// "track GTIDs" changed.
	SessionTrackGtids uint8 = 0x03
)

// Packet types.
// Originally found in include/mysql/mysql_com.h
const (
	// ComQuit is COM_QUIT.
	ComQuit = 0x01

	// ComInitDB is COM_INIT_DB.
	ComInitDB = 0x02

	// ComQuery is COM_QUERY.
	ComQuery = 0x03

	// ComFieldList is COM_FIELD_LIST
	ComFieldList = 0x04

	// ComPing is COM_PING.
	ComPing = 0x0e

	// ComBinlogDump is COM_BINLOG_DUMP.
	ComBinlogDump = 0x12

	// ComPrepare is COM_PREPARE.
	ComPrepare = 0x16

	// ComStmtExecute is COM_STMT_EXECUTE.
	ComStmtExecute = 0x17

	// ComStmtSendLongData is COM_STMT_SEND_LONG_DATA
	ComStmtSendLongData = 0x18

	// ComStmtClose is COM_STMT_CLOSE.
	ComStmtClose = 0x19

	// ComStmtReset is COM_STMT_RESET
	ComStmtReset = 0x1a

	// ComStmtFetch is COM_STMT_FETCH
	ComStmtFetch = 0x1c

	// ComSetOption is COM_SET_OPTION
	ComSetOption = 0x1b

	// ComResetConnection is COM_RESET_CONNECTION
	ComResetConnection = 0x1f

	// ComBinlogDumpGTID is COM_BINLOG_DUMP_GTID.
	ComBinlogDumpGTID = 0x1e

	// ComRegisterReplica is COM_REGISTER_REPLICA
	ComRegisterReplica = 0x15

	// OKPacket is the header of the OK packet.
	OKPacket = 0x00

	// EOFPacket is the header of the EOF packet.
	EOFPacket = 0xfe

	LocalInfilePacket = 0xFB

	// ErrPacket is the header of the error packet.
	ErrPacket = 0xff

	// NullValue is the encoded value of NULL.
	NullValue = 0xfb
)

// Auth packet types
const (
	// AuthMoreDataPacket is sent when server requires more data to authenticate
	AuthMoreDataPacket = 0x01

	// CachingSha2FastAuth is sent before OKPacket when server authenticates using cache
	CachingSha2FastAuth = 0x03

	// CachingSha2FullAuth is sent when server requests un-scrambled password to authenticate
	CachingSha2FullAuth = 0x04

	// AuthSwitchRequestPacket is used to switch auth method.
	AuthSwitchRequestPacket = 0xfe
)

// Error codes for client-side errors.
// Originally found in include/mysql/errmsg.h and
// https://dev.mysql.com/doc/mysql-errors/en/client-error-reference.html
const (
	// CRUnknownError is CR_UNKNOWN_ERROR
	CRUnknownError = 2000

	// CRConnectionError is CR_CONNECTION_ERROR
	// This is returned if a connection via a Unix socket fails.
	CRConnectionError = 2002

	// CRConnHostError is CR_CONN_HOST_ERROR
	// This is returned if a connection via a TCP socket fails.
	CRConnHostError = 2003

	// CRUnknownHost is CR_UNKNOWN_HOST
	// This is returned if the host name cannot be resolved.
	CRUnknownHost = 2005

	// CRServerGone is CR_SERVER_GONE_ERROR.
	// This is returned if the client tries to send a command but it fails.
	CRServerGone = 2006

	// CRVersionError is CR_VERSION_ERROR
	// This is returned if the server versions don't match what we support.
	CRVersionError = 2007

	// CRServerHandshakeErr is CR_SERVER_HANDSHAKE_ERR
	CRServerHandshakeErr = 2012

	// CRServerLost is CR_SERVER_LOST.
	// Used when:
	// - the client cannot write an initial auth packet.
	// - the client cannot read an initial auth packet.
	// - the client cannot read a response from the server.
	//     This happens when a running query is killed.
	CRServerLost = 2013

	// CRCommandsOutOfSync is CR_COMMANDS_OUT_OF_SYNC
	// Sent when the streaming calls are not done in the right order.
	CRCommandsOutOfSync = 2014

	// CRNamedPipeStateError is CR_NAMEDPIPESETSTATE_ERROR.
	// This is the highest possible number for a connection error.
	CRNamedPipeStateError = 2018

	// CRCantReadCharset is CR_CANT_READ_CHARSET
	CRCantReadCharset = 2019

	// CRSSLConnectionError is CR_SSL_CONNECTION_ERROR
	CRSSLConnectionError = 2026

	// CRMalformedPacket is CR_MALFORMED_PACKET
	CRMalformedPacket = 2027
)

// Error codes return in SQLErrors generated by vitess. These error codes
// are in a high range to avoid conflicting with mysql error codes below.
const (
	// ERVitessMaxRowsExceeded is when a user tries to select more rows than the max rows as enforced by vitess.
	ERVitessMaxRowsExceeded = 10001
)

// Error codes for server-side errors.
// Originally found in include/mysql/mysqld_error.h and
// https://dev.mysql.com/doc/mysql-errors/en/server-error-reference.html
// The below are in sorted order by value, grouped by vterror code they should be bucketed into.
// See above reference for more information on each code.
const (
	// unknown
	ERUnknownError = 1105

	// internal
	ERInternalError = 1815

	// unimplemented
	ERNotSupportedYet = 1235

	// resource exhausted
	ERDiskFull               = 1021
	EROutOfMemory            = 1037
	EROutOfSortMemory        = 1038
	ERConCount               = 1040
	EROutOfResources         = 1041
	ERRecordFileFull         = 1114
	ERHostIsBlocked          = 1129
	ERCantCreateThread       = 1135
	ERTooManyDelayedThreads  = 1151
	ERNetPacketTooLarge      = 1153
	ERTooManyUserConnections = 1203
	ERLockTableFull          = 1206
	ERUserLimitReached       = 1226

	// deadline exceeded
	ERLockWaitTimeout = 1205

	// unavailable
	ERServerShutdown = 1053

	// not found
	ERFormNotFound          = 1029
	ERKeyNotFound           = 1032
	ERBadFieldError         = 1054
	ERNoSuchThread          = 1094
	ERUnknownTable          = 1109
	ERCantFindUDF           = 1122
	ERNonExistingGrant      = 1141
	ERNoSuchTable           = 1146
	ERNonExistingTableGrant = 1147
	ERKeyDoesNotExist       = 1176
	ERDbDropExists          = 1008

	// permissions
	ERDBAccessDenied            = 1044
	ERAccessDeniedError         = 1045
	ERKillDenied                = 1095
	ERNoPermissionToCreateUsers = 1211
	ERSpecifiedAccessDenied     = 1227

	// failed precondition
	ERNoDb                          = 1046
	ERNoSuchIndex                   = 1082
	ERCantDropFieldOrKey            = 1091
	ERTableNotLockedForWrite        = 1099
	ERTableNotLocked                = 1100
	ERTooBigSelect                  = 1104
	ERNotAllowedCommand             = 1148
	ERTooLongString                 = 1162
	ERDelayedInsertTableLocked      = 1165
	ERDupUnique                     = 1169
	ERRequiresPrimaryKey            = 1173
	ERCantDoThisDuringAnTransaction = 1179
	ERReadOnlyTransaction           = 1207
	ERCannotAddForeign              = 1215
	ERNoReferencedRow               = 1216
	ERRowIsReferenced               = 1217
	ERCantUpdateWithReadLock        = 1223
	ERNoDefault                     = 1230
	ERMasterFatalReadingBinlog      = 1236
	EROperandColumns                = 1241
	ERSubqueryNo1Row                = 1242
	ERWarnDataOutOfRange            = 1264
	ERNonUpdateableTable            = 1288
	ERFeatureDisabled               = 1289
	EROptionPreventsStatement       = 1290
	ERDuplicatedValueInType         = 1291
	ERSPDoesNotExist                = 1305
	ERNoDefaultForField             = 1364
	ErSPNotVarArg                   = 1414
	ERRowIsReferenced2              = 1451
	ErNoReferencedRow2              = 1452
	ERDupIndex                      = 1831
	ERInnodbReadOnly                = 1874

	// already exists
	ERDbCreateExists = 1007
	ERTableExists    = 1050
	ERDupEntry       = 1062
	ERFileExists     = 1086
	ERUDFExists      = 1125

	// aborted
	ERGotSignal          = 1078
	ERForcingClose       = 1080
	ERAbortingConnection = 1152
	ERLockDeadlock       = 1213

	// invalid arg
	ERUnknownComError              = 1047
	ERBadNullError                 = 1048
	ERBadDb                        = 1049
	ERBadTable                     = 1051
	ERNonUniq                      = 1052
	ERWrongFieldWithGroup          = 1055
	ERWrongGroupField              = 1056
	ERWrongSumSelect               = 1057
	ERWrongValueCount              = 1058
	ERTooLongIdent                 = 1059
	ERDupFieldName                 = 1060
	ERDupKeyName                   = 1061
	ERWrongFieldSpec               = 1063
	ERParseError                   = 1064
	EREmptyQuery                   = 1065
	ERNonUniqTable                 = 1066
	ERInvalidDefault               = 1067
	ERMultiplePriKey               = 1068
	ERTooManyKeys                  = 1069
	ERTooManyKeyParts              = 1070
	ERTooLongKey                   = 1071
	ERKeyColumnDoesNotExist        = 1072
	ERBlobUsedAsKey                = 1073
	ERTooBigFieldLength            = 1074
	ERWrongAutoKey                 = 1075
	ERWrongFieldTerminators        = 1083
	ERBlobsAndNoTerminated         = 1084
	ERTextFileNotReadable          = 1085
	ERWrongSubKey                  = 1089
	ERCantRemoveAllFields          = 1090
	ERUpdateTableUsed              = 1093
	ERNoTablesUsed                 = 1096
	ERTooBigSet                    = 1097
	ERBlobCantHaveDefault          = 1101
	ERWrongDbName                  = 1102
	ERWrongTableName               = 1103
	ERUnknownProcedure             = 1106
	ERWrongParamCountToProcedure   = 1107
	ERWrongParametersToProcedure   = 1108
	ERFieldSpecifiedTwice          = 1110
	ERInvalidGroupFuncUse          = 1111
	ERTableMustHaveColumns         = 1113
	ERUnknownCharacterSet          = 1115
	ERTooManyTables                = 1116
	ERTooManyFields                = 1117
	ERTooBigRowSize                = 1118
	ERWrongOuterJoin               = 1120
	ERNullColumnInIndex            = 1121
	ERFunctionNotDefined           = 1128
	ERWrongValueCountOnRow         = 1136
	ERInvalidUseOfNull             = 1138
	ERRegexpError                  = 1139
	ERMixOfGroupFuncAndFields      = 1140
	ERIllegalGrantForTable         = 1144
	ERSyntaxError                  = 1149
	ERWrongColumnName              = 1166
	ERWrongKeyColumn               = 1167
	ERBlobKeyWithoutLength         = 1170
	ERPrimaryCantHaveNull          = 1171
	ERTooManyRows                  = 1172
	ERLockOrActiveTransaction      = 1192
	ERUnknownSystemVariable        = 1193
	ERSetConstantsOnly             = 1204
	ERWrongArguments               = 1210
	ERWrongUsage                   = 1221
	ERWrongNumberOfColumnsInSelect = 1222
	ERDupArgument                  = 1225
	ERLocalVariable                = 1228
	ERGlobalVariable               = 1229
	ERWrongValueForVar             = 1231
	ERWrongTypeForVar              = 1232
	ERVarCantBeRead                = 1233
	ERCantUseOptionHere            = 1234
	ERIncorrectGlobalLocalVar      = 1238
	ERWrongFKDef                   = 1239
	ERKeyRefDoNotMatchTableRef     = 1240
	ERCyclicReference              = 1245
	ERIllegalReference             = 1247
	ERDerivedMustHaveAlias         = 1248
	ERTableNameNotAllowedHere      = 1250
	ERCollationCharsetMismatch     = 1253
	ERWarnDataTruncated            = 1265
	ERCantAggregate2Collations     = 1267
	ERCantAggregate3Collations     = 1270
	ERCantAggregateNCollations     = 1271
	ERVariableIsNotStruct          = 1272
	ERUnknownCollation             = 1273
	ERWrongNameForIndex            = 1280
	ERWrongNameForCatalog          = 1281
	ERBadFTColumn                  = 1283
	ERTruncatedWrongValue          = 1292
	ERTooMuchAutoTimestampCols     = 1293
	ERInvalidOnUpdate              = 1294
	ERUnknownTimeZone              = 1298
	ERInvalidCharacterString       = 1300
	ERQueryInterrupted             = 1317
	ERTruncatedWrongValueForField  = 1366
	ERIllegalValueForType          = 1367
	ERDataTooLong                  = 1406
	ErrWrongValueForType           = 1411
	ERForbidSchemaChange           = 1450
	ERWrongValue                   = 1525
	ERDataOutOfRange               = 1690
	ERInvalidJSONText              = 3140
	ERInvalidJSONTextInParams      = 3141
	ERInvalidJSONBinaryData        = 3142
	ERInvalidJSONCharset           = 3144
	ERInvalidCastToJSON            = 3147
	ERJSONValueTooBig              = 3150
	ERJSONDocumentTooDeep          = 3157

	// max execution time exceeded
	ERQueryTimeout = 3024

	ErrCantCreateGeometryObject      = 1416
	ErrGISDataWrongEndianess         = 3055
	ErrUnresolvedTableLock           = 3568
	ErrNotImplementedForCartesianSRS = 3704
	ErrNotImplementedForProjectedSRS = 3705
	ErrNonPositiveRadius             = 3706

	// server not available
	ERServerIsntAvailable = 3168
)

// Sql states for errors.
// Originally found in include/mysql/sql_state.h
const (
	// SSUnknownSqlstate is ER_SIGNAL_EXCEPTION in
	// include/mysql/sql_state.h, but:
	// const char *unknown_sqlstate= "HY000"
	// in client.c. So using that one.
	SSUnknownSQLState = "HY000"

	// SSNetError is network related error
	SSNetError = "08S01"

	// SSUnknownComError is ER_UNKNOWN_COM_ERROR
	SSUnknownComError = "08S01"

	// SSWrongNumberOfColumns is related to columns error
	SSWrongNumberOfColumns = "21000"

	// SSWrongValueCountOnRow is related to columns count mismatch error
	SSWrongValueCountOnRow = "21S01"

	// SSServerShutdown is ER_SERVER_SHUTDOWN
	SSServerShutdown = "08S01"

	// SSDataTooLong is ER_DATA_TOO_LONG
	SSDataTooLong = "22001"

	// SSDataOutOfRange is ER_DATA_OUT_OF_RANGE
	SSDataOutOfRange = "22003"

	// SSConstraintViolation is constraint violation
	SSConstraintViolation = "23000"

	// SSDupKey is ER_DUP_KEY
	SSDupKey = "23000"

	// SSCantDoThisDuringAnTransaction is
	// ER_CANT_DO_THIS_DURING_AN_TRANSACTION
	SSCantDoThisDuringAnTransaction = "25000"

	// SSAccessDeniedError is ER_ACCESS_DENIED_ERROR
	SSAccessDeniedError = "28000"

	// SSNoDB is ER_NO_DB_ERROR
	SSNoDB = "3D000"

	// SSLockDeadlock is ER_LOCK_DEADLOCK
	SSLockDeadlock = "40001"

	// SSClientError is the state on client errors
	SSClientError = "42000"

	// SSDupFieldName is ER_DUP_FIELD_NAME
	SSDupFieldName = "42S21"

	// SSBadFieldError is ER_BAD_FIELD_ERROR
	SSBadFieldError = "42S22"

	// SSUnknownTable is ER_UNKNOWN_TABLE
	SSUnknownTable = "42S02"

	// SSQueryInterrupted is ER_QUERY_INTERRUPTED;
	SSQueryInterrupted = "70100"
)

// A few interesting character set values.
// See https://web.archive.org/web/20221007183051/http://dev.mysql.com/doc/internals/en/character-set.html
const (
	// CharacterSetUtf8 is for UTF8.
	CharacterSetUtf8 = 33

	// CharacterSetUtf8mb4 is for UTF8MB4.
	CharacterSetUtf8mb4 = 255

	// CharacterSetBinary is for binary. Use by integer fields for instance.
	CharacterSetBinary = 63
)

// CharacterSetMap maps the charset name (used in ConnParams) to the
// integer value.  Interesting ones have their own constant above.
var CharacterSetMap = map[string]uint8{
	"big5":     1,
	"dec8":     3,
	"cp850":    4,
	"hp8":      6,
	"koi8r":    7,
	"latin1":   8,
	"latin2":   9,
	"swe7":     10,
	"ascii":    11,
	"ujis":     12,
	"sjis":     13,
	"hebrew":   16,
	"tis620":   18,
	"euckr":    19,
	"koi8u":    22,
	"gb2312":   24,
	"greek":    25,
	"cp1250":   26,
	"gbk":      28,
	"latin5":   30,
	"armscii8": 32,
	"utf8":     CharacterSetUtf8,
	"ucs2":     35,
	"cp866":    36,
	"keybcs2":  37,
	"macce":    38,
	"macroman": 39,
	"cp852":    40,
	"latin7":   41,
	"cp1251":   51,
	"utf16":    54,
	"utf16le":  56,
	"cp1256":   57,
	"cp1257":   59,
	"utf32":    60,
	"binary":   CharacterSetBinary,
	"geostd8":  92,
	"cp932":    95,
	"eucjpms":  97,
	"gb18030":  248,
	"utf8mb4":  CharacterSetUtf8mb4,
}

// IsNum returns true if a MySQL type is a numeric value.
// It is the same as IS_NUM defined in mysql.h.
func IsNum(typ uint8) bool {
	return (typ <= TypeInt24 && typ != TypeTimestamp) ||
		typ == TypeYear ||
		typ == TypeNewDecimal
}

// IsConnErr returns true if the error is a connection error.
func IsConnErr(err error) bool {
	if IsTooManyConnectionsErr(err) {
		return false
	}
	if sqlErr, ok := err.(*SQLError); ok {
		num := sqlErr.Number()
		return (num >= CRUnknownError && num <= CRNamedPipeStateError) || num == ERQueryInterrupted
	}
	return false
}

// IsTooManyConnectionsErr returns true if the error is due to too many connections.
func IsTooManyConnectionsErr(err error) bool {
	if sqlErr, ok := err.(*SQLError); ok {
		if sqlErr.Number() == CRServerHandshakeErr && strings.Contains(sqlErr.Message, "Too many connections") {
			return true
		}
	}
	return false
}
