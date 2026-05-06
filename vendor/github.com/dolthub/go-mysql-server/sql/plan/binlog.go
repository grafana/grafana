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

package plan

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/binlogreplication"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// DynamicPrivilege_BinlogAdmin enables binary log control by means of the PURGE BINARY LOGS and BINLOG statements.
// https://dev.mysql.com/doc/refman/8.0/en/privileges-provided.html#priv_binlog-admin
const DynamicPrivilege_BinlogAdmin = "binlog_admin"

// Binlog replays binary log events, which record database changes in a binary format for efficiency. Tools like
// mysqldump, mysqlbinlog, and mariadb-binlog read these binary events from log files and output them as base64-encoded
// BINLOG statements for replay.
//
// The BINLOG statement execution is delegated to the BinlogConsumer. The base64-encoded event data is decoded
// and passed to the consumer's ProcessEvent method for processing. This allows integrators like Dolt to handle
// BINLOG statement execution using their binlog event processing infrastructure.
//
// See https://dev.mysql.com/doc/refman/8.4/en/binlog.html for the BINLOG statement specification.
type Binlog struct {
	Base64Str string
	Consumer  binlogreplication.BinlogConsumer
}

var _ sql.Node = (*Binlog)(nil)
var _ BinlogConsumerCommand = (*Binlog)(nil)

// NewBinlog creates a new Binlog node.
func NewBinlog(base64Str string) *Binlog {
	return &Binlog{
		Base64Str: base64Str,
	}
}

// WithBinlogConsumer implements the BinlogConsumerCommand interface.
func (b *Binlog) WithBinlogConsumer(consumer binlogreplication.BinlogConsumer) sql.Node {
	nc := *b
	nc.Consumer = consumer
	return &nc
}

func (b *Binlog) String() string {
	return "BINLOG"
}

func (b *Binlog) Resolved() bool {
	return true
}

func (b *Binlog) Schema() sql.Schema {
	return types.OkResultSchema
}

func (b *Binlog) Children() []sql.Node {
	return nil
}

func (b *Binlog) IsReadOnly() bool {
	return false
}

// WithChildren implements the Node interface.
func (b *Binlog) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(b, len(children), 0)
	}
	return b, nil
}
