// Copyright 2022 Dolthub, Inc.
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

package binlogreplication

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/dolthub/go-mysql-server/sql"

	"github.com/dolthub/vitess/go/mysql"
)

// BinlogReplicaController allows callers to control a binlog replica. Providers built on go-mysql-server may optionally
// implement this interface and use it when constructing a SQL engine in order to receive callbacks when replication
// statements (e.g. START REPLICA, SHOW REPLICA STATUS) are being handled.
type BinlogReplicaController interface {
	// StartReplica tells the binlog replica controller to start up replication processes for the current replication
	// configuration. An error is returned if replication was unable to be started. Note the error response only signals
	// whether there was a problem with the initial replication start up. Replication could fail after being started up
	// successfully with no error response returned.
	StartReplica(ctx *sql.Context) error

	// StopReplica tells the binlog replica controller to stop all replication processes. An error is returned if there
	// were any problems stopping replication. If no replication processes were running, no error is returned.
	StopReplica(ctx *sql.Context) error

	// SetReplicationSourceOptions configures the binlog replica controller with the specified source options. The
	// replica controller must store this configuration. If any errors are encountered processing and storing the
	// configuration options, an error is returned.
	SetReplicationSourceOptions(ctx *sql.Context, options []ReplicationOption) error

	// SetReplicationFilterOptions configures the binlog replica controller with the specified filter options. Although
	// the official MySQL implementation does *NOT* persist these options, the replica controller should persist them.
	// (MySQL requires these options to be manually set after every server restart, or to be specified as command line
	// arguments when starting the MySQL process.) If any errors are encountered processing and storing the filter
	// options, an error is returned.
	SetReplicationFilterOptions(ctx *sql.Context, options []ReplicationOption) error

	// GetReplicaStatus returns the current status of the replica, or nil if no replication processes are running. If
	// any problems are encountered assembling the replica's status, an error is returned.
	GetReplicaStatus(ctx *sql.Context) (*ReplicaStatus, error)

	// ResetReplica resets the state for the replica. When the |resetAll| parameter is false, a "soft" or minimal reset
	// is performed – replication errors are reset, but connection information and filters are NOT reset. If |resetAll|
	// is true, a "hard" reset is performed – replication filters are removed, replication source options are removed,
	// and `SHOW REPLICA STATUS` shows no results. If replication is currently running, this function should return an
	// error indicating that replication needs to be stopped before it can be reset. If any errors were encountered
	// resetting the replica state, an error is returned, otherwise nil is returned if the reset was successful.
	ResetReplica(ctx *sql.Context, resetAll bool) error
}

// BinlogPrimaryController allows an integrator to extend GMS with support for operating as a binlog primary server.
// Providers built on go-mysql-server may optionally implement this interface and use it when constructing a SQL
// engine in order to receive callbacks when replication statements for a primary server are received
// (e.g. SHOW BINARY LOG STATUS) or when MySQL protocol commands related to replication are received
// (e.g. COM_REGISTER_REPLICA).
type BinlogPrimaryController interface {
	// RegisterReplica tells the binlog primary controller to register a new replica on connection |c| with the
	// primary server. |replicaHost| and |replicaPort| specify where the replica can be accessed, and are returned
	// from the SHOW REPLICAS statement. Integrators should return from this method as soon as the replica is
	// registered.
	RegisterReplica(ctx *sql.Context, c *mysql.Conn, replicaHost string, replicaPort uint16) error

	// BinlogDumpGtid tells this binlog primary controller to start streaming binlog events to the replica over the
	// current connection, |c|. |gtidSet| specifies the point at which to start replication, or if it is nil, then
	// it indicates the complete history of all transactions should be sent over the connection. Note that unlike
	// other methods, this method does NOT return immediately (unless an error is encountered) – the connection is
	// left open for the duration of the replication stream, which could be days, or longer. For errors that are
	// not recoverable and should not be retried, integrators should return a mysql.SQLError with the error code
	// set to 1236 (ER_MASTER_FATAL_ERROR_READING_BINLOG). This causes the replica to display this error in the
	// output from SHOW REPLICA STATUS and to not retry the connection. Otherwise, the error is only logged to
	// MySQL's error log and the replica will continue retrying to connect.
	BinlogDumpGtid(ctx *sql.Context, c *mysql.Conn, gtidSet mysql.GTIDSet) error

	// ListReplicas is called when the SHOW REPLICAS statement is executed. The integrator should return a list
	// of all registered replicas who are healthy and still responsive. Note that this function will be expanded
	// with an additional response parameter once it is wired up to the SQL engine.
	ListReplicas(ctx *sql.Context) error

	// ListBinaryLogs is called when the SHOW BINARY LOGS statement is executed. The integrator should return a list
	// of the binary logs currently being managed. Note that this function will be expanded
	// with an additional response parameter once it is wired up to the SQL engine.
	ListBinaryLogs(ctx *sql.Context) ([]BinaryLogFileMetadata, error)

	// GetBinaryLogStatus is called when the SHOW BINARY LOG STATUS statement is executed. The integrator should return
	// the current status of all available (i.e. non-purged) binary logs.
	GetBinaryLogStatus(ctx *sql.Context) ([]BinaryLogStatus, error)
}

// BinaryLogFileMetadata holds high level metadata about a binary log file, used for the `SHOW BINARY LOGS` statement.
type BinaryLogFileMetadata struct {
	Name      string
	Size      uint64
	Encrypted bool
}

// BinaryLogStatus holds the data for one row of results from the `SHOW BINARY LOG STATUS` statement (or the deprecated
// `SHOW MASTER LOGS` statement). Integrators should return one instance for each binary log file that is being tracked
// by the server.
// https://dev.mysql.com/doc/refman/8.3/en/show-binary-log-status.html
type BinaryLogStatus struct {
	File          string
	DoDbs         string
	IgnoreDbs     string
	ExecutedGtids string
	Position      uint
}

// ReplicaStatus stores the status of a single binlog replica and is returned by `SHOW REPLICA STATUS`.
// https://dev.mysql.com/doc/refman/8.0/en/show-replica-status.html
type ReplicaStatus struct {
	LastSqlErrorTimestamp *time.Time
	LastIoErrorTimestamp  *time.Time
	LastSqlError          string // Alias for LastError
	LastIoError           string
	SourceHost            string
	SourceUser            string
	SourceServerId        string
	SourceServerUuid      string
	RetrievedGtidSet      string
	ExecutedGtidSet       string
	ReplicaIoRunning      string
	ReplicaSqlRunning     string
	ReplicateDoTables     []string
	ReplicateIgnoreTables []string
	SourceRetryCount      uint64
	SourcePort            uint
	LastIoErrNumber       uint
	LastSqlErrNumber      uint // Alias for LastErrNumber
	ConnectRetry          uint32
	AutoPosition          bool
	SourceSsl             bool
}

// BinlogReplicaCatalog extends the Catalog interface and provides methods for accessing a BinlogReplicaController
// for a Catalog.
type BinlogReplicaCatalog interface {
	// HasBinlogReplicaController returns true if a non-nil BinlogReplicaController is available for this BinlogReplicaCatalog.
	HasBinlogReplicaController() bool
	// GetBinlogReplicaController returns the BinlogReplicaController registered with this BinlogReplicaCatalog.
	GetBinlogReplicaController() BinlogReplicaController
}

// BinlogPrimaryCatalog extends the Catalog interface and provides methods for accessing a BinlogPrimaryController
// for a Catalog.
type BinlogPrimaryCatalog interface {
	// HasBinlogPrimaryController returns true if a non-nil BinlogPrimaryController is available for this BinlogPrimaryCatalog.
	HasBinlogPrimaryController() bool
	// GetBinlogPrimaryController returns the BinlogPrimaryController registered with this BinlogPrimaryCatalog.
	GetBinlogPrimaryController() BinlogPrimaryController
}

const (
	ReplicaIoNotRunning  = "No"
	ReplicaIoConnecting  = "Connecting"
	ReplicaIoRunning     = "Yes"
	ReplicaSqlNotRunning = "No"
	ReplicaSqlRunning    = "Yes"
)

// ReplicationOption represents a single option for replication configuration, as specified through the
// CHANGE REPLICATION SOURCE TO command: https://dev.mysql.com/doc/refman/8.0/en/change-replication-source-to.html
type ReplicationOption struct {
	Value ReplicationOptionValue
	Name  string
}

// ReplicationOptionValue defines an interface for configuration option values for binlog replication. It holds the
// values of options for configuring the replication source (i.e. "CHANGE REPLICATION SOURCE TO" options) and for
// replication filtering (i.g. "SET REPLICATION FILTER" options).
type ReplicationOptionValue interface {
	fmt.Stringer

	// GetValue returns the raw, untyped option value. This method should generally not be used; callers should instead
	// find the specific type implementing the ReplicationOptionValue interface and use its functions in order to get
	// typed values.
	GetValue() interface{}
}

// StringReplicationOptionValue is a ReplicationOptionValue implementation that holds a string value.
type StringReplicationOptionValue struct {
	Value string
}

var _ ReplicationOptionValue = (*StringReplicationOptionValue)(nil)

func (ov StringReplicationOptionValue) GetValue() interface{} {
	return ov.GetValueAsString()
}

func (ov StringReplicationOptionValue) GetValueAsString() string {
	return ov.Value
}

// String implements the Stringer interface and returns a string representation of this option value.
func (ov StringReplicationOptionValue) String() string {
	return ov.Value
}

// TableNamesReplicationOptionValue is a ReplicationOptionValue implementation that holds a list of table names for
// its value.
type TableNamesReplicationOptionValue struct {
	Value []sql.UnresolvedTable
}

var _ ReplicationOptionValue = (*TableNamesReplicationOptionValue)(nil)

func (ov TableNamesReplicationOptionValue) GetValue() interface{} {
	return ov.GetValueAsTableList()
}

func (ov TableNamesReplicationOptionValue) GetValueAsTableList() []sql.UnresolvedTable {
	return ov.Value
}

// String implements the Stringer interface and returns a string representation of this option value.
func (ov TableNamesReplicationOptionValue) String() string {
	sb := strings.Builder{}
	for i, urt := range ov.Value {
		if i > 0 {
			sb.WriteString(", ")
		}
		if urt.Database().Name() != "" {
			sb.WriteString(urt.Database().Name())
			sb.WriteString(".")
		}
		sb.WriteString(urt.Name())
	}
	return sb.String()
}

// IntegerReplicationOptionValue is a ReplicationOptionValue implementation that holds an integer value.
type IntegerReplicationOptionValue struct {
	Value int
}

var _ ReplicationOptionValue = (*IntegerReplicationOptionValue)(nil)

func (ov IntegerReplicationOptionValue) GetValue() interface{} {
	return ov.GetValueAsInt()
}

func (ov IntegerReplicationOptionValue) GetValueAsInt() int {
	return ov.Value
}

// String implements the Stringer interface and returns a string representation of this option value.
func (ov IntegerReplicationOptionValue) String() string {
	return strconv.Itoa(ov.Value)
}

// NewReplicationOption creates a new ReplicationOption instance, with the specified |name| and |value|.
func NewReplicationOption(name string, value ReplicationOptionValue) *ReplicationOption {
	return &ReplicationOption{
		Name:  name,
		Value: value,
	}
}
