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
	"fmt"

	binlogdatapb "github.com/dolthub/vitess/go/vt/proto/binlogdata"
)

// BinlogEvent represents a single event from a raw MySQL binlog dump stream.
// The implementation is provided by each supported flavor in go/vt/mysqlctl.
//
// binlog.Streamer receives these events through a mysqlctl.SlaveConnection and
// processes them, grouping statements into BinlogTransactions as appropriate.
//
// Methods that only access header fields can't fail as long as IsValid()
// returns true, so they have a single return value. Methods that might fail
// even when IsValid() is true return an error value.
//
// Methods that require information from the initial FORMAT_DESCRIPTION_EVENT
// will have a BinlogFormat parameter.
//
// A BinlogEvent should never be sent over the wire. UpdateStream service
// will send BinlogTransactions from these events.
type BinlogEvent interface {
	// IsValid returns true if the underlying data buffer contains a valid
	// event. This should be called first on any BinlogEvent, and other
	// methods should only be called if this one returns true. This ensures
	// you won't get panics due to bounds checking on the byte array.
	IsValid() bool

	// General protocol events.

	// IsFormatDescription returns true if this is a
	// FORMAT_DESCRIPTION_EVENT. Do not call StripChecksum before
	// calling Format (Format returns the BinlogFormat anyway,
	// required for calling StripChecksum).
	IsFormatDescription() bool
	// IsQuery returns true if this is a QUERY_EVENT, which encompasses
	// all SQL statements.
	IsQuery() bool
	// IsXID returns true if this is an XID_EVENT, which is an alternate
	// form of COMMIT.
	IsXID() bool
	// IsGTID returns true if this is a GTID_EVENT.
	IsGTID() bool
	// IsRotate returns true if this is a ROTATE_EVENT.
	IsRotate() bool
	// IsIntVar returns true if this is an INTVAR_EVENT.
	IsIntVar() bool
	// IsRand returns true if this is a RAND_EVENT.
	IsRand() bool
	// IsPreviousGTIDs returns true if this event is a PREVIOUS_GTIDS_EVENT.
	IsPreviousGTIDs() bool

	// RBR events.

	// IsTableMap returns true if this is a TABLE_MAP_EVENT.
	IsTableMap() bool
	// IsWriteRows returns true if this is a WRITE_ROWS_EVENT.
	IsWriteRows() bool
	// IsUpdateRows returns true if this is a UPDATE_ROWS_EVENT.
	IsUpdateRows() bool
	// IsDeleteRows returns true if this is a DELETE_ROWS_EVENT.
	IsDeleteRows() bool

	// Timestamp returns the timestamp from the event header.
	Timestamp() uint32
	// Length returns the size in bytes of this binlog event from the event header.
	Length() uint32

	// Format returns a BinlogFormat struct based on the event data.
	// This is only valid if IsFormatDescription() returns true.
	Format() (BinlogFormat, error)
	// GTID returns the GTID from the event, and if this event
	// also serves as a BEGIN statement.
	// This is only valid if IsGTID() returns true.
	GTID(BinlogFormat) (GTID, bool, error)
	// Query returns a Query struct representing data from a QUERY_EVENT.
	// This is only valid if IsQuery() returns true.
	Query(BinlogFormat) (Query, error)
	// IntVar returns the type and value of the variable for an INTVAR_EVENT.
	// This is only valid if IsIntVar() returns true.
	IntVar(BinlogFormat) (byte, uint64, error)
	// Rand returns the two seed values for a RAND_EVENT.
	// This is only valid if IsRand() returns true.
	Rand(BinlogFormat) (uint64, uint64, error)
	// PreviousGTIDs returns the Position from the event.
	// This is only valid if IsPreviousGTIDs() returns true.
	PreviousGTIDs(BinlogFormat) (Position, error)

	// TableID returns the table ID for a TableMap, UpdateRows,
	// WriteRows or DeleteRows event.
	TableID(BinlogFormat) uint64
	// TableMap returns a TableMap struct representing data from a
	// TABLE_MAP_EVENT.  This is only valid if IsTableMapEvent() returns
	// true.
	TableMap(BinlogFormat) (*TableMap, error)
	// Rows returns a Rows struct representing data from a
	// {WRITE,UPDATE,DELETE}_ROWS_EVENT.  This is only valid if
	// IsWriteRows(), IsUpdateRows(), or IsDeleteRows() returns
	// true.
	Rows(BinlogFormat, *TableMap) (Rows, error)

	// StripChecksum returns the checksum and a modified event with the
	// checksum stripped off, if any. If there is no checksum, it returns
	// the same event and a nil checksum.
	StripChecksum(BinlogFormat) (ev BinlogEvent, checksum []byte, err error)

	// IsPseudo is for custom implementations of GTID.
	IsPseudo() bool

	// Bytes returns the binary representation of the event
	Bytes() []byte
}

// BinlogFormat contains relevant data from the FORMAT_DESCRIPTION_EVENT.
// This structure is passed to subsequent event types to let them know how to
// parse themselves.
type BinlogFormat struct {
	// FormatVersion is the version number of the binlog file format.
	// We only support version 4.
	FormatVersion uint16

	// ServerVersion is the name of the MySQL server version.
	// It starts with something like 5.6.33-xxxx.
	ServerVersion string

	// HeaderLength is the size in bytes of event headers other
	// than FORMAT_DESCRIPTION_EVENT. Almost always 19.
	HeaderLength byte

	// ChecksumAlgorithm is the ID number of the binlog checksum algorithm.
	// See three possible values below.
	ChecksumAlgorithm byte

	// HeaderSizes is an array of sizes of the headers for each message.
	HeaderSizes []byte
}

// IsZero returns true if the BinlogFormat has not been initialized.
func (f BinlogFormat) IsZero() bool {
	return f.FormatVersion == 0 && f.HeaderLength == 0
}

// HeaderSize returns the header size of any event type.
func (f BinlogFormat) HeaderSize(typ byte) byte {
	return f.HeaderSizes[typ-1]
}

// Query contains data from a QUERY_EVENT.
type Query struct {
	Database string
	Charset  *binlogdatapb.Charset
	SQL      string
	Options  uint32
	SqlMode  uint64
}

// String pretty-prints a Query.
func (q Query) String() string {
	return fmt.Sprintf("{Database: %q, Charset: %v, SQL: %q, Options: %v, SqlMode: %v}",
		q.Database, q.Charset, q.SQL, q.Options, q.SqlMode)
}

// TableMap contains data from a TABLE_MAP_EVENT.
type TableMap struct {
	// Flags is the table's flags.
	Flags uint16

	// Database is the database name.
	Database string

	// Name is the name of the table.
	Name string

	// Types is an array of MySQL types for the fields.
	Types []byte

	// CanBeNull's bits are set if the column can be NULL.
	CanBeNull Bitmap

	// Metadata is an array of uint16, one per column.
	// It contains a few extra information about each column,
	// that is dependent on the type.
	// - If the metadata is not present, this is zero.
	// - If the metadata is one byte, only the lower 8 bits are used.
	// - If the metadata is two bytes, all 16 bits are used.
	Metadata []uint16
}

// String implements the Stringer interface
func (t *TableMap) String() string {
	return fmt.Sprintf("{Flags: %v, Database: %q, Name: %q, Types: %v, CanBeNull: %v, Metadata: %v}",
		t.Flags, t.Database, t.Name, t.Types, t.CanBeNull, t.Metadata)
}

// Rows contains data from a {WRITE,UPDATE,DELETE}_ROWS_EVENT.
type Rows struct {
	// Flags has the flags from the event.
	Flags uint16

	// IdentifyColumns describes which columns are included to
	// identify the row. It is a bitmap indexed by the TableMap
	// list of columns.
	// Set for UPDATE and DELETE.
	IdentifyColumns Bitmap

	// DataColumns describes which columns are included. It is
	// a bitmap indexed by the TableMap list of columns.
	// Set for WRITE and UPDATE.
	DataColumns Bitmap

	// Rows is an array of Row in the event.
	Rows []Row
}

// String implements the Stringer interface
func (r *Rows) String() string {
	rows := "[]"
	if r.Rows != nil {
		rows = "["
		for _, row := range r.Rows {
			rows += row.String() + ", "
		}
		rows += "]"
	}

	return fmt.Sprintf("{Flags: %v, IdentifyColumns: %v, DataColumns: %v, Rows: %s}",
		r.Flags, r.IdentifyColumns, r.DataColumns, rows)
}

// Row contains data for a single Row in a Rows event.
type Row struct {
	// NullIdentifyColumns describes which of the identify columns are NULL.
	// It is only set for UPDATE and DELETE events.
	NullIdentifyColumns Bitmap

	// NullColumns describes which of the present columns are NULL.
	// It is only set for WRITE and UPDATE events.
	NullColumns Bitmap

	// Identify is the raw data for the columns used to identify a row.
	// It is only set for UPDATE and DELETE events.
	Identify []byte

	// Data is the raw data.
	// It is only set for WRITE and UPDATE events.
	Data []byte
}

// String implements the Stringer interface
func (r *Row) String() string {
	return fmt.Sprintf("{NullIdentifyColumns: %v, NullColumns: %v, Identify: %v, Data: %v}",
		r.NullIdentifyColumns, r.NullColumns, r.Identify, r.Data)
}

// Bitmap is used by the previous structures.
type Bitmap struct {
	// data is the slice this is based on.
	data []byte

	// count is how many bits we have in the map.
	count int
}

func newBitmap(data []byte, pos int, count int) (Bitmap, int) {
	byteSize := (count + 7) / 8
	return Bitmap{
		data:  data[pos : pos+byteSize],
		count: count,
	}, pos + byteSize
}

// NewServerBitmap returns a bitmap that can hold 'count' bits.
func NewServerBitmap(count int) Bitmap {
	byteSize := (count + 7) / 8
	return Bitmap{
		data:  make([]byte, byteSize),
		count: count,
	}
}

// Count returns the number of bits in this Bitmap.
func (b *Bitmap) Count() int {
	return b.count
}

// Bit returned the value of a given bit in the Bitmap.
func (b *Bitmap) Bit(index int) bool {
	byteIndex := index / 8
	bitMask := byte(1 << (uint(index) & 0x7))
	return b.data[byteIndex]&bitMask > 0
}

// Set sets the given boolean value.
func (b *Bitmap) Set(index int, value bool) {
	byteIndex := index / 8
	bitMask := byte(1 << (uint(index) & 0x7))
	if value {
		b.data[byteIndex] |= bitMask
	} else {
		b.data[byteIndex] &= 0xff - bitMask
	}
}

// BitCount returns how many bits are set in the bitmap.
// Note values that are not used may be set to 0 or 1,
// hence the non-efficient logic.
func (b *Bitmap) BitCount() int {
	sum := 0
	for i := 0; i < b.count; i++ {
		if b.Bit(i) {
			sum++
		}
	}
	return sum
}
