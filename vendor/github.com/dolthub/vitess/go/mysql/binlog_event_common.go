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
	"bytes"
	"encoding/binary"

	binlogdatapb "github.com/dolthub/vitess/go/vt/proto/binlogdata"
	"github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/vterrors"
)

// binlogEvent wraps a raw packet buffer and provides methods to examine it
// by partially implementing BinlogEvent. These methods can be composed
// into flavor-specific event types to pull in common parsing code.
//
// The default v4 header format is:
//                  offset : size
//   +============================+
//   | timestamp         0 : 4    |
//   +----------------------------+
//   | type_code         4 : 1    |
//   +----------------------------+
//   | server_id         5 : 4    |
//   +----------------------------+
//   | event_length      9 : 4    |
//   +----------------------------+
//   | next_position    13 : 4    |
//   +----------------------------+
//   | flags            17 : 2    |
//   +----------------------------+
//   | extra_headers    19 : x-19 |
//   +============================+
//   http://dev.mysql.com/doc/internals/en/event-header-fields.html
type binlogEvent []byte

// IsValid implements BinlogEvent.IsValid().
func (ev binlogEvent) IsValid() bool {
	bufLen := len(ev.Bytes())

	// The buffer must be at least 19 bytes to contain a valid header.
	if bufLen < 19 {
		return false
	}

	// It's now safe to use methods that examine header fields.
	// Let's see if the event is right about its own size.
	evLen := ev.Length()
	if evLen < 19 || evLen != uint32(bufLen) {
		return false
	}

	// Everything's there, so we shouldn't have any out-of-bounds issues while
	// reading header fields or constant-offset data fields. We should still check
	// bounds any time we compute an offset based on values in the buffer itself.
	return true
}

// Bytes returns the underlying byte buffer.
func (ev binlogEvent) Bytes() []byte {
	return []byte(ev)
}

// Type returns the type_code field from the header.
func (ev binlogEvent) Type() byte {
	return ev.Bytes()[4]
}

// Flags returns the flags field from the header.
func (ev binlogEvent) Flags() uint16 {
	return binary.LittleEndian.Uint16(ev.Bytes()[17 : 17+2])
}

// Timestamp returns the timestamp field from the header.
func (ev binlogEvent) Timestamp() uint32 {
	return binary.LittleEndian.Uint32(ev.Bytes()[:4])
}

// ServerID returns the server_id field from the header.
func (ev binlogEvent) ServerID() uint32 {
	return binary.LittleEndian.Uint32(ev.Bytes()[5 : 5+4])
}

// Length returns the event_length field from the header.
func (ev binlogEvent) Length() uint32 {
	return binary.LittleEndian.Uint32(ev.Bytes()[9 : 9+4])
}

// IsFormatDescription implements BinlogEvent.IsFormatDescription().
func (ev binlogEvent) IsFormatDescription() bool {
	return ev.Type() == eFormatDescriptionEvent
}

// IsQuery implements BinlogEvent.IsQuery().
func (ev binlogEvent) IsQuery() bool {
	return ev.Type() == eQueryEvent
}

// IsRotate implements BinlogEvent.IsRotate().
func (ev binlogEvent) IsRotate() bool {
	return ev.Type() == eRotateEvent
}

// IsXID implements BinlogEvent.IsXID().
func (ev binlogEvent) IsXID() bool {
	return ev.Type() == eXIDEvent
}

// IsIntVar implements BinlogEvent.IsIntVar().
func (ev binlogEvent) IsIntVar() bool {
	return ev.Type() == eIntVarEvent
}

// IsRand implements BinlogEvent.IsRand().
func (ev binlogEvent) IsRand() bool {
	return ev.Type() == eRandEvent
}

// IsPreviousGTIDs implements BinlogEvent.IsPreviousGTIDs().
func (ev binlogEvent) IsPreviousGTIDs() bool {
	return ev.Type() == ePreviousGTIDsEvent
}

// IsTableMap implements BinlogEvent.IsTableMap().
func (ev binlogEvent) IsTableMap() bool {
	return ev.Type() == eTableMapEvent
}

// IsWriteRows implements BinlogEvent.IsWriteRows().
// We do not support v0.
func (ev binlogEvent) IsWriteRows() bool {
	return ev.Type() == eWriteRowsEventV1 ||
		ev.Type() == eWriteRowsEventV2
}

// IsUpdateRows implements BinlogEvent.IsUpdateRows().
// We do not support v0.
func (ev binlogEvent) IsUpdateRows() bool {
	return ev.Type() == eUpdateRowsEventV1 ||
		ev.Type() == eUpdateRowsEventV2
}

// IsDeleteRows implements BinlogEvent.IsDeleteRows().
// We do not support v0.
func (ev binlogEvent) IsDeleteRows() bool {
	return ev.Type() == eDeleteRowsEventV1 ||
		ev.Type() == eDeleteRowsEventV2
}

// IsPseudo is always false for a native binlogEvent.
func (ev binlogEvent) IsPseudo() bool {
	return false
}

// Format implements BinlogEvent.Format().
//
// Expected format (L = total length of event data):
//   # bytes   field
//   2         format version
//   50        server version string, 0-padded but not necessarily 0-terminated
//   4         timestamp (same as timestamp header field)
//   1         header length
//   p         (one byte per packet type) event type header lengths
//             Rest was inferred from reading source code:
//   1         checksum algorithm
//   4         checksum
func (ev binlogEvent) Format() (f BinlogFormat, err error) {
	// FORMAT_DESCRIPTION_EVENT has a fixed header size of 19
	// because we have to read it before we know the header_length.
	data := ev.Bytes()[19:]

	f.FormatVersion = binary.LittleEndian.Uint16(data[:2])
	if f.FormatVersion != 4 {
		return f, vterrors.Errorf(vtrpc.Code_INVALID_ARGUMENT, "format version = %d, we only support version 4", f.FormatVersion)
	}
	f.ServerVersion = string(bytes.TrimRight(data[2:2+50], "\x00"))
	f.HeaderLength = data[2+50+4]
	if f.HeaderLength < 19 {
		return f, vterrors.Errorf(vtrpc.Code_INVALID_ARGUMENT, "header length = %d, should be >= 19", f.HeaderLength)
	}

	// MySQL/MariaDB 5.6.1+ always adds a 4-byte checksum to the end of a
	// FORMAT_DESCRIPTION_EVENT, regardless of the server setting. The byte
	// immediately before that checksum tells us which checksum algorithm
	// (if any) is used for the rest of the events.
	f.ChecksumAlgorithm = data[len(data)-5]

	f.HeaderSizes = data[2+50+4+1 : len(data)-5]
	return f, nil
}

// Query implements BinlogEvent.Query().
//
// Expected format (L = total length of event data):
//   # bytes   field
//   4         thread_id
//   4         execution time
//   1         length of db_name, not including NULL terminator (X)
//   2         error code
//   2         length of status vars block (Y)
//   Y         status vars block
//   X+1       db_name + NULL terminator
//   L-X-1-Y   SQL statement (no NULL terminator)
func (ev binlogEvent) Query(f BinlogFormat) (query Query, err error) {
	const varsPos = 4 + 4 + 1 + 2 + 2

	data := ev.Bytes()[f.HeaderLength:]

	// length of database name
	dbLen := int(data[4+4])
	// length of status variables block
	varsLen := int(binary.LittleEndian.Uint16(data[4+4+1+2 : 4+4+1+2+2]))

	// position of database name
	dbPos := varsPos + varsLen
	// position of SQL query
	sqlPos := dbPos + dbLen + 1 // +1 for NULL terminator
	if sqlPos > len(data) {
		return query, vterrors.Errorf(vtrpc.Code_INTERNAL, "SQL query position overflows buffer (%v > %v)", sqlPos, len(data))
	}

	// We've checked that the buffer is big enough for sql, so everything before
	// it (db and vars) is in-bounds too.
	query.Database = string(data[dbPos : dbPos+dbLen])
	query.SQL = string(data[sqlPos:])

	// Scan the status vars for ones we care about. This requires us to know the
	// size of every var that comes before the ones we're interested in.
	vars := data[varsPos : varsPos+varsLen]

varsLoop:
	for pos := 0; pos < len(vars); {
		code := vars[pos]
		pos++

		// All codes are optional, but if present they must occur in numerically
		// increasing order (except for 6 which occurs in the place of 2) to allow
		// for backward compatibility.
		switch code {
		case QFlags2Code:
			query.Options = binary.LittleEndian.Uint32(vars[pos : pos+4])
			pos += 4
		case QSQLModeCode:
			query.SqlMode = binary.LittleEndian.Uint64(vars[pos : pos+8])
			pos += 8
		case QAutoIncrement:
			pos += 4
		case QCatalog: // Used in MySQL 5.0.0 - 5.0.3
			if pos+1 > len(vars) {
				return query, vterrors.Errorf(vtrpc.Code_INTERNAL, "Q_CATALOG status var overflows buffer (%v + 1 > %v)", pos, len(vars))
			}
			pos += 1 + int(vars[pos]) + 1
		case QCatalogNZCode: // Used in MySQL > 5.0.3 to replace QCatalog
			if pos+1 > len(vars) {
				return query, vterrors.Errorf(vtrpc.Code_INTERNAL, "Q_CATALOG_NZ_CODE status var overflows buffer (%v + 1 > %v)", pos, len(vars))
			}
			pos += 1 + int(vars[pos])
		case QCharsetCode:
			if pos+6 > len(vars) {
				return query, vterrors.Errorf(vtrpc.Code_INTERNAL, "Q_CHARSET_CODE status var overflows buffer (%v + 6 > %v)", pos, len(vars))
			}
			query.Charset = &binlogdatapb.Charset{
				Client: int32(binary.LittleEndian.Uint16(vars[pos : pos+2])),
				Conn:   int32(binary.LittleEndian.Uint16(vars[pos+2 : pos+4])),
				Server: int32(binary.LittleEndian.Uint16(vars[pos+4 : pos+6])),
			}
			pos += 6
		default:
			// If we see something higher than what we're interested in, we can stop.
			break varsLoop
		}
	}

	return query, nil
}

// IntVar implements BinlogEvent.IntVar().
//
// Expected format (L = total length of event data):
//   # bytes   field
//   1         variable ID
//   8         variable value
func (ev binlogEvent) IntVar(f BinlogFormat) (byte, uint64, error) {
	data := ev.Bytes()[f.HeaderLength:]

	typ := data[0]
	if typ != IntVarLastInsertID && typ != IntVarInsertID {
		return 0, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "invalid IntVar ID: %v", data[0])
	}

	value := binary.LittleEndian.Uint64(data[1 : 1+8])
	return typ, value, nil
}

// Rand implements BinlogEvent.Rand().
//
// Expected format (L = total length of event data):
//   # bytes   field
//   8         seed 1
//   8         seed 2
func (ev binlogEvent) Rand(f BinlogFormat) (seed1 uint64, seed2 uint64, err error) {
	data := ev.Bytes()[f.HeaderLength:]
	seed1 = binary.LittleEndian.Uint64(data[0:8])
	seed2 = binary.LittleEndian.Uint64(data[8 : 8+8])
	return seed1, seed2, nil
}

func (ev binlogEvent) TableID(f BinlogFormat) uint64 {
	typ := ev.Type()
	pos := f.HeaderLength
	if f.HeaderSize(typ) == 6 {
		// Encoded in 4 bytes.
		return uint64(binary.LittleEndian.Uint32(ev[pos : pos+4]))
	}

	// Encoded in 6 bytes.
	return uint64(ev[pos]) |
		uint64(ev[pos+1])<<8 |
		uint64(ev[pos+2])<<16 |
		uint64(ev[pos+3])<<24 |
		uint64(ev[pos+4])<<32 |
		uint64(ev[pos+5])<<40
}
