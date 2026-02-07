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
	"encoding/binary"
	"hash/crc32"
)

const (
	FlagLogEventArtificial = 0x20
)

// This file contains utility methods to create binlog replication
// packets. They are mostly used for testing.

// NewMySQL56BinlogFormat returns a typical BinlogFormat for MySQL 5.6.
func NewMySQL56BinlogFormat() BinlogFormat {
	return BinlogFormat{
		FormatVersion:     4,
		ServerVersion:     "5.6.33-0ubuntu0.14.04.1-log",
		HeaderLength:      19,
		ChecksumAlgorithm: BinlogChecksumAlgCRC32, // most commonly used.
		HeaderSizes: []byte{
			56, 13, 0, 8, 0, 18, 0, 4, 4, 4,
			4, 18, 0, 0, 92, 0, 4, 26, 8, 0,
			0, 0, 8, 8, 8, 2, 0, 0, 0, 10,
			10, 10, 25, 25, 0},
	}
}

// NewMariaDBBinlogFormat returns a typical BinlogFormat for MariaDB 10.0.
func NewMariaDBBinlogFormat() BinlogFormat {
	return BinlogFormat{
		FormatVersion:     4,
		ServerVersion:     "10.0.13-MariaDB-1~precise-log",
		HeaderLength:      19,
		ChecksumAlgorithm: BinlogChecksumAlgOff,
		// HeaderSizes is very long because the MariaDB specific events are indexed at 160+
		HeaderSizes: []byte{
			56, 13, 0, 8, 0, 18, 0, 4, 4, 4,
			4, 18, 0, 0, 220, 0, 4, 26, 8, 0,
			0, 0, 8, 8, 8, 2, 0, 0, 0, 10,
			10, 10, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			4, 19, 4},
	}
}

// BinlogEventMetadata is a container for various metadata needed to create
// a binlog event.
type BinlogEventMetadata struct {
	// ServerID is the server ID of the server that created this event.
	ServerID uint32

	// Timestamp is a uint32 indicating when the event occurred.
	Timestamp uint32

	// NextLogPosition indicates the position in the binlog file for the start of the next event.
	NextLogPosition uint32
}

// packetize adds the binlog event header to a packet, and optionally
// the checksum.
func packetize(f BinlogFormat, typ byte, flags uint16, data []byte, m BinlogEventMetadata) []byte {
	length := int(f.HeaderLength) + len(data)
	if typ == eFormatDescriptionEvent || f.ChecksumAlgorithm == BinlogChecksumAlgCRC32 {
		// Just add 4 zeroes to the end.
		length += 4
	}

	result := make([]byte, length)
	switch typ {
	case eRotateEvent, eHeartbeatEvent:
		// timestamp remains zero
	default:
		binary.LittleEndian.PutUint32(result[0:4], m.Timestamp)
	}
	result[4] = typ
	binary.LittleEndian.PutUint32(result[5:9], m.ServerID)
	binary.LittleEndian.PutUint32(result[9:13], uint32(length))
	if f.HeaderLength >= 19 {
		binary.LittleEndian.PutUint32(result[13:17], m.NextLogPosition)
		binary.LittleEndian.PutUint16(result[17:19], flags)
	}
	copy(result[f.HeaderLength:], data)

	switch f.ChecksumAlgorithm {
	case BinlogChecksumAlgCRC32:
		checksum := crc32.ChecksumIEEE(result[0 : length-4])
		binary.LittleEndian.PutUint32(result[length-4:], checksum)
	}

	return result
}

// UpdateChecksum updates the checksum for the specified |event|. The BinlogFormat, |f|, indicates
// if checksums are enabled. If checksums are not enabled, then no change is made to |event|.
func UpdateChecksum(f BinlogFormat, event BinlogEvent) {
	result := event.Bytes()
	length := len(result)

	switch f.ChecksumAlgorithm {
	case BinlogChecksumAlgCRC32:
		checksum := crc32.ChecksumIEEE(result[0 : length-4])
		binary.LittleEndian.PutUint32(result[length-4:], checksum)
	}
}

// NewInvalidEvent returns an invalid event (its size is <19).
func NewInvalidEvent() BinlogEvent {
	return NewMysql56BinlogEvent([]byte{0})
}

// NewFormatDescriptionEvent creates a new FormatDescriptionEvent
// based on the provided BinlogFormat. It uses a mysql56BinlogEvent
// but could use a MariaDB one.
func NewFormatDescriptionEvent(f BinlogFormat, m BinlogEventMetadata) BinlogEvent {
	length := 2 + // binlog-version
		50 + // server version
		4 + // create timestamp
		1 + // event header length
		len(f.HeaderSizes) + // event type header lengths
		1 // (undocumented) checksum algorithm
	data := make([]byte, length)
	binary.LittleEndian.PutUint16(data[0:2], f.FormatVersion)
	copy(data[2:52], f.ServerVersion)
	binary.LittleEndian.PutUint32(data[52:56], m.Timestamp)
	data[56] = f.HeaderLength
	copy(data[57:], f.HeaderSizes)
	data[57+len(f.HeaderSizes)] = f.ChecksumAlgorithm

	ev := packetize(f, eFormatDescriptionEvent, 0, data, m)
	return NewMysql56BinlogEvent(ev)
}

// NewPreviousGtidsEvent creates a new Previous GTIDs BinlogEvent. The BinlogFormat, |f|, indicates if checksums are
// enabled, the BinlogEventMeatadata, |m|, specifies the unique server ID, and |gtids| is the MySQL 5.6 GTID set
// to include in the event, indicating the events that have been previously executed by the server.
func NewPreviousGtidsEvent(f BinlogFormat, m BinlogEventMetadata, gtids Mysql56GTIDSet) BinlogEvent {
	data := gtids.SIDBlock()

	ev := packetize(f, ePreviousGTIDsEvent, 0, data, m)
	return NewMysql56BinlogEvent(ev)
}

// NewInvalidFormatDescriptionEvent returns an invalid FormatDescriptionEvent.
// The binlog version is set to 3. It IsValid() though.
func NewInvalidFormatDescriptionEvent(f BinlogFormat, m BinlogEventMetadata) BinlogEvent {
	length := 75
	data := make([]byte, length)
	data[0] = 3

	ev := packetize(f, eFormatDescriptionEvent, 0, data, m)
	return NewMysql56BinlogEvent(ev)
}

// NewRotateEvent returns a RotateEvent.
// The timestamp of such an event should be zero, so we patch it in.
func NewRotateEvent(f BinlogFormat, m BinlogEventMetadata, position uint64, filename string) BinlogEvent {
	length := 8 + // position
		len(filename)
	data := make([]byte, length)
	binary.LittleEndian.PutUint64(data[0:8], position)
	copy(data[8:], filename)

	ev := packetize(f, eRotateEvent, 0, data, m)
	return NewMysql56BinlogEvent(ev)
}

func NewFakeRotateEvent(f BinlogFormat, m BinlogEventMetadata, filename string) BinlogEvent {
	length := 8 + // position
		len(filename)
	data := make([]byte, length)
	binary.LittleEndian.PutUint64(data[0:8], 4)
	copy(data[8:], filename)

	ev := packetize(f, eRotateEvent, FlagLogEventArtificial, data, m)
	return NewMysql56BinlogEvent(ev)
}

// NewHeartbeatEvent returns a HeartbeatEvent.
// see https://dev.mysql.com/doc/internals/en/heartbeat-event.html
func NewHeartbeatEvent(f BinlogFormat, m BinlogEventMetadata) BinlogEvent {
	ev := packetize(f, eHeartbeatEvent, 0, []byte{}, m)
	return NewMysql56BinlogEvent(ev)
}

// NewHeartbeatEvent returns a HeartbeatEvent.
// see https://dev.mysql.com/doc/internals/en/heartbeat-event.html
func NewHeartbeatEventWithLogFile(f BinlogFormat, m BinlogEventMetadata, filename string) BinlogEvent {
	length := len(filename)
	data := make([]byte, length)
	copy(data, filename)

	ev := packetize(f, eHeartbeatEvent, 0, data, m)
	return NewMysql56BinlogEvent(ev)
}

// NewQueryEvent makes up a QueryEvent based on the Query structure.
func NewQueryEvent(f BinlogFormat, m BinlogEventMetadata, q Query) BinlogEvent {
	statusVarLength := 0
	if q.Charset != nil {
		statusVarLength += 1 + 2 + 2 + 2
	}
	length := 4 + // proxy id
		4 + // execution time
		1 + // schema length
		2 + // error code
		2 + // status vars length
		statusVarLength +
		len(q.Database) + // schema
		1 + // [00]
		len(q.SQL) // query
	data := make([]byte, length)

	pos := 8
	data[pos] = byte(len(q.Database))
	pos += 1 + 2
	data[pos] = byte(statusVarLength)
	data[pos+1] = byte(statusVarLength >> 8)
	pos += 2
	if q.Charset != nil {
		data[pos] = QCharsetCode
		data[pos+1] = byte(q.Charset.Client)
		data[pos+2] = byte(q.Charset.Client >> 8)
		data[pos+3] = byte(q.Charset.Conn)
		data[pos+4] = byte(q.Charset.Conn >> 8)
		data[pos+5] = byte(q.Charset.Server)
		data[pos+6] = byte(q.Charset.Server >> 8)
		pos += 7
	}
	pos += copy(data[pos:pos+len(q.Database)], q.Database)
	data[pos] = 0
	pos++
	copy(data[pos:], q.SQL)

	ev := packetize(f, eQueryEvent, 0, data, m)
	return NewMysql56BinlogEvent(ev)
}

// NewInvalidQueryEvent returns an invalid QueryEvent. IsValid is however true.
// sqlPos is out of bounds.
func NewInvalidQueryEvent(f BinlogFormat, m BinlogEventMetadata) BinlogEvent {
	length := 100
	data := make([]byte, length)
	data[4+4] = 200 // > 100

	ev := packetize(f, eQueryEvent, 0, data, m)
	return NewMysql56BinlogEvent(ev)
}

// NewXIDEvent returns a XID event. We do not use the data, so keep it 0.
func NewXIDEvent(f BinlogFormat, m BinlogEventMetadata) BinlogEvent {
	length := 8
	data := make([]byte, length)

	ev := packetize(f, eXIDEvent, 0, data, m)
	return NewMysql56BinlogEvent(ev)
}

// NewIntVarEvent returns an IntVar event.
func NewIntVarEvent(f BinlogFormat, m BinlogEventMetadata, typ byte, value uint64) BinlogEvent {
	length := 9
	data := make([]byte, length)

	data[0] = typ
	data[1] = byte(value)
	data[2] = byte(value >> 8)
	data[3] = byte(value >> 16)
	data[4] = byte(value >> 24)
	data[5] = byte(value >> 32)
	data[6] = byte(value >> 40)
	data[7] = byte(value >> 48)
	data[8] = byte(value >> 56)

	ev := packetize(f, eIntVarEvent, 0, data, m)
	return NewMysql56BinlogEvent(ev)
}

// NewMariaDBGTIDEvent returns a MariaDB specific GTID event.
// It ignores the Server in the gtid, instead uses the BinlogStream.ServerID.
func NewMariaDBGTIDEvent(f BinlogFormat, m BinlogEventMetadata, gtid MariadbGTID, hasBegin bool) BinlogEvent {
	length := 8 + // sequence
		4 + // domain
		1 // flags2
	data := make([]byte, length)

	data[0] = byte(gtid.Sequence)
	data[1] = byte(gtid.Sequence >> 8)
	data[2] = byte(gtid.Sequence >> 16)
	data[3] = byte(gtid.Sequence >> 24)
	data[4] = byte(gtid.Sequence >> 32)
	data[5] = byte(gtid.Sequence >> 40)
	data[6] = byte(gtid.Sequence >> 48)
	data[7] = byte(gtid.Sequence >> 56)
	data[8] = byte(gtid.Domain)
	data[9] = byte(gtid.Domain >> 8)
	data[10] = byte(gtid.Domain >> 16)
	data[11] = byte(gtid.Domain >> 24)

	const FLStandalone = 1
	var flags2 byte
	if !hasBegin {
		flags2 |= FLStandalone
	}
	data[12] = flags2

	ev := packetize(f, eMariaGTIDEvent, 0, data, m)
	return NewMariadbBinlogEvent(ev)
}

// NewMySQLGTIDEvent returns a MySQL specific GTID event.
func NewMySQLGTIDEvent(f BinlogFormat, m BinlogEventMetadata, gtid Mysql56GTID, hasBegin bool) BinlogEvent {
	length := 1 + // flags
		16 + // SID (server UUID)
		8 // GNO (sequence number, signed int)
	data := make([]byte, length)

	// flags
	data[0] = 0

	// SID (server UUID)
	sid := gtid.Server
	copy(data[1:17], sid[:])

	// GNO (sequence number, signed int)
	sequence := gtid.Sequence
	binary.LittleEndian.PutUint64(data[17:25], uint64(sequence))

	const FLStandalone = 1
	var flags2 byte
	if !hasBegin {
		flags2 |= FLStandalone
	}
	data[0] = flags2

	ev := packetize(f, eGTIDEvent, 0, data, m)
	return NewMysql56BinlogEvent(ev)
}

// NewTableMapEvent returns a TableMap event.
// Only works with post_header_length=8.
func NewTableMapEvent(f BinlogFormat, m BinlogEventMetadata, tableID uint64, tm *TableMap) BinlogEvent {
	if f.HeaderSize(eTableMapEvent) != 8 {
		panic("Not implemented, post_header_length!=8")
	}

	metadataLength := metadataTotalLength(tm.Types)

	length := 6 + // table_id
		2 + // flags
		1 + // schema name length
		len(tm.Database) +
		1 + // [00]
		1 + // table name length
		len(tm.Name) +
		1 + // [00]
		lenEncIntSize(uint64(len(tm.Types))) + // column-count len enc
		len(tm.Types) +
		lenEncIntSize(uint64(metadataLength)) + // lenenc-str column-meta-def
		metadataLength +
		len(tm.CanBeNull.data)
	data := make([]byte, length)

	data[0] = byte(tableID)
	data[1] = byte(tableID >> 8)
	data[2] = byte(tableID >> 16)
	data[3] = byte(tableID >> 24)
	data[4] = byte(tableID >> 32)
	data[5] = byte(tableID >> 40)
	data[6] = byte(tm.Flags)
	data[7] = byte(tm.Flags >> 8)
	data[8] = byte(len(tm.Database))
	pos := 6 + 2 + 1 + copy(data[9:], tm.Database)
	data[pos] = 0
	pos++
	data[pos] = byte(len(tm.Name))
	pos += 1 + copy(data[pos+1:], tm.Name)
	data[pos] = 0
	pos++

	pos = writeLenEncInt(data, pos, uint64(len(tm.Types)))
	pos += copy(data[pos:], tm.Types)

	pos = writeLenEncInt(data, pos, uint64(metadataLength))
	for c, typ := range tm.Types {
		pos = metadataWrite(data, pos, typ, tm.Metadata[c])
	}

	pos += copy(data[pos:], tm.CanBeNull.data)
	if pos != len(data) {
		panic("bad encoding")
	}

	ev := packetize(f, eTableMapEvent, 0, data, m)
	return NewMariadbBinlogEvent(ev)
}

// NewWriteRowsEvent returns a WriteRows event. Uses v2.
func NewWriteRowsEvent(f BinlogFormat, m BinlogEventMetadata, tableID uint64, rows Rows) BinlogEvent {
	return newRowsEvent(f, m, eWriteRowsEventV2, tableID, rows)
}

// NewUpdateRowsEvent returns an UpdateRows event. Uses v2.
func NewUpdateRowsEvent(f BinlogFormat, m BinlogEventMetadata, tableID uint64, rows Rows) BinlogEvent {
	return newRowsEvent(f, m, eUpdateRowsEventV2, tableID, rows)
}

// NewDeleteRowsEvent returns an DeleteRows event. Uses v2.
func NewDeleteRowsEvent(f BinlogFormat, m BinlogEventMetadata, tableID uint64, rows Rows) BinlogEvent {
	return newRowsEvent(f, m, eDeleteRowsEventV2, tableID, rows)
}

// newRowsEvent can create an event of type:
// eWriteRowsEventV1, eWriteRowsEventV2,
// eUpdateRowsEventV1, eUpdateRowsEventV2,
// eDeleteRowsEventV1, eDeleteRowsEventV2.
func newRowsEvent(f BinlogFormat, m BinlogEventMetadata, typ byte, tableID uint64, rows Rows) BinlogEvent {
	if f.HeaderSize(typ) == 6 {
		panic("Not implemented, post_header_length==6")
	}

	hasIdentify := typ == eUpdateRowsEventV1 || typ == eUpdateRowsEventV2 ||
		typ == eDeleteRowsEventV1 || typ == eDeleteRowsEventV2
	hasData := typ == eWriteRowsEventV1 || typ == eWriteRowsEventV2 ||
		typ == eUpdateRowsEventV1 || typ == eUpdateRowsEventV2

	rowLen := rows.DataColumns.Count()
	if hasIdentify {
		rowLen = rows.IdentifyColumns.Count()
	}

	length := 6 + // table id
		2 + // flags
		2 + // extra data length, no extra data.
		lenEncIntSize(uint64(rowLen)) + // num columns
		len(rows.IdentifyColumns.data) + // only > 0 for Update & Delete
		len(rows.DataColumns.data) // only > 0 for Write & Update
	for _, row := range rows.Rows {
		length += len(row.NullIdentifyColumns.data) +
			len(row.NullColumns.data) +
			len(row.Identify) +
			len(row.Data)
	}
	data := make([]byte, length)

	data[0] = byte(tableID)
	data[1] = byte(tableID >> 8)
	data[2] = byte(tableID >> 16)
	data[3] = byte(tableID >> 24)
	data[4] = byte(tableID >> 32)
	data[5] = byte(tableID >> 40)
	data[6] = byte(rows.Flags)
	data[7] = byte(rows.Flags >> 8)
	data[8] = 0x02
	data[9] = 0x00

	pos := writeLenEncInt(data, 10, uint64(rowLen))

	if hasIdentify {
		pos += copy(data[pos:], rows.IdentifyColumns.data)
	}
	if hasData {
		pos += copy(data[pos:], rows.DataColumns.data)
	}

	for _, row := range rows.Rows {
		if hasIdentify {
			pos += copy(data[pos:], row.NullIdentifyColumns.data)
			pos += copy(data[pos:], row.Identify)
		}
		if hasData {
			pos += copy(data[pos:], row.NullColumns.data)
			pos += copy(data[pos:], row.Data)
		}
	}

	ev := packetize(f, typ, 0, data, m)
	return NewMysql56BinlogEvent(ev)
}
