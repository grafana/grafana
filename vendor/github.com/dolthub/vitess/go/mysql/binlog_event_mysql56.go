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

	"github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/vterrors"
)

// mysql56BinlogEvent wraps a raw packet buffer and provides methods to examine
// it by implementing BinlogEvent. Some methods are pulled in from
// binlogEvent.
type mysql56BinlogEvent struct {
	binlogEvent
}

// NewMysql56BinlogEvent creates a BinlogEvent from given byte array
func NewMysql56BinlogEvent(buf []byte) BinlogEvent {
	return mysql56BinlogEvent{binlogEvent: binlogEvent(buf)}
}

// IsGTID implements BinlogEvent.IsGTID().
func (ev mysql56BinlogEvent) IsGTID() bool {
	return ev.Type() == eGTIDEvent
}

// GTID implements BinlogEvent.GTID().
//
// Expected format:
//   # bytes   field
//   1         flags
//   16        SID (server UUID)
//   8         GNO (sequence number, signed int)
func (ev mysql56BinlogEvent) GTID(f BinlogFormat) (GTID, bool, error) {
	data := ev.Bytes()[f.HeaderLength:]
	var sid SID
	copy(sid[:], data[1:1+16])
	gno := int64(binary.LittleEndian.Uint64(data[1+16 : 1+16+8]))
	return Mysql56GTID{Server: sid, Sequence: gno}, false /* hasBegin */, nil
}

// PreviousGTIDs implements BinlogEvent.PreviousGTIDs().
func (ev mysql56BinlogEvent) PreviousGTIDs(f BinlogFormat) (Position, error) {
	data := ev.Bytes()[f.HeaderLength:]
	set, err := NewMysql56GTIDSetFromSIDBlock(data)
	if err != nil {
		return Position{}, err
	}
	return Position{
		GTIDSet: set,
	}, nil
}

// StripChecksum implements BinlogEvent.StripChecksum().
func (ev mysql56BinlogEvent) StripChecksum(f BinlogFormat) (BinlogEvent, []byte, error) {
	switch f.ChecksumAlgorithm {
	case BinlogChecksumAlgOff, BinlogChecksumAlgUndef:
		// There is no checksum.
		return ev, nil, nil
	case BinlogChecksumAlgCRC32:
		// Checksum is the last 4 bytes of the event buffer.
		data := ev.Bytes()
		length := len(data)
		checksum := data[length-4:]
		data = data[:length-4]
		return mysql56BinlogEvent{binlogEvent: binlogEvent(data)}, checksum, nil
	default:
		// MySQL 5.6 does not guarantee that future checksum algorithms will be
		// 4 bytes, so we can't support them a priori.
		return ev, nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "unsupported checksum algorithm: %v", f.ChecksumAlgorithm)
	}
}
