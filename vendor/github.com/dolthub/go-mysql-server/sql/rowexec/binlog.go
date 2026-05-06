// Copyright 2025 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package rowexec

import (
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"io"
	"strings"

	"github.com/dolthub/vitess/go/mysql"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/binlogreplication"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// buildBinlog decodes base64 binlog events, parses them into individual events, and delegates processing to the
// BinlogReplicaController. This allows integrators like Dolt to handle BINLOG statement execution using their
// existing binlog replication infrastructure.
//
// The BINLOG statement is used by tools like mysqldump and mysqlbinlog to replay binary log events. The base64-encoded
// event data is decoded, parsed into individual BinlogEvents, and each event is passed to the BinlogReplicaController's
// ConsumeBinlogEvent method for processing.
//
// See https://dev.mysql.com/doc/refman/8.4/en/binlog.html for the BINLOG statement specification.
func (b *BaseBuilder) buildBinlog(ctx *sql.Context, n *plan.Binlog, row sql.Row) (sql.RowIter, error) {
	if n.Consumer == nil {
		return nil, fmt.Errorf("BINLOG statement requires BinlogConsumer")
	}

	var decoded []byte
	lines := strings.Split(n.Base64Str, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		block, err := base64.StdEncoding.DecodeString(line)
		if err != nil {
			return nil, sql.ErrBase64DecodeError.New()
		}

		decoded = append(decoded, block...)
	}

	return &binlogIter{
		consumer: n.Consumer,
		decoded:  decoded,
	}, nil
}

// binlogIter processes decoded binlog events one at a time, returning an OkResult when all events are processed.
type binlogIter struct {
	consumer binlogreplication.BinlogConsumer
	decoded  []byte
	offset   int
}

var _ sql.RowIter = (*binlogIter)(nil)

const (
	eventHeaderSize   = 19
	eventLengthOffset = 9
)

// Next processes one binlog event per call and recursively processes remaining events.
// Only the final call returns OkResult, which bubbles up through the recursive calls.
func (bi *binlogIter) Next(ctx *sql.Context) (sql.Row, error) {
	// Check if offset is negative (already returned OkResult)
	if bi.offset < 0 {
		return nil, io.EOF
	}

	// If all events processed, mark as done and return OkResult once
	if bi.offset >= len(bi.decoded) {
		bi.offset = -1 // Mark as completed
		return sql.Row{types.OkResult{}}, nil
	}

	// Validate we have enough bytes for the event header
	if bi.offset+eventHeaderSize > len(bi.decoded) {
		return nil, fmt.Errorf("incomplete event header at offset %d", bi.offset)
	}

	// Read the event length from the header
	eventLength := binary.LittleEndian.Uint32(bi.decoded[bi.offset+eventLengthOffset : bi.offset+eventLengthOffset+4])

	// Validate we have the complete event
	if bi.offset+int(eventLength) > len(bi.decoded) {
		return nil, fmt.Errorf("incomplete event at offset %d: event length %d exceeds buffer", bi.offset, eventLength)
	}

	eventBytes := bi.decoded[bi.offset : bi.offset+int(eventLength)]

	// Parse the event using Vitess's binlog event parser
	// MariaDB format is backward compatible with MySQL events
	event := mysql.NewMariadbBinlogEvent(eventBytes)

	if !event.IsFormatDescription() && !event.IsQuery() && !event.IsTableMap() &&
		!event.IsWriteRows() && !event.IsUpdateRows() && !event.IsDeleteRows() {
		return nil, sql.ErrOnlyFDAndRBREventsAllowedInBinlogStatement.New(event.TypeName())
	}

	// Check that TABLE_MAP and row events have a FORMAT_DESCRIPTION first
	if event.IsTableMap() || event.IsWriteRows() || event.IsUpdateRows() || event.IsDeleteRows() {
		if !bi.consumer.HasFormatDescription() {
			return nil, sql.ErrNoFormatDescriptionEventBeforeBinlogStatement.New(event.TypeName())
		}
	}

	// Process this event using the consumer
	err := bi.consumer.ProcessEvent(ctx, event)
	if err != nil {
		return nil, err
	}

	bi.offset += int(eventLength)

	// Recursively process next event - final OkResult bubbles up
	return bi.Next(ctx)
}

// Close implements sql.RowIter.
func (bi *binlogIter) Close(ctx *sql.Context) error {
	return nil
}
