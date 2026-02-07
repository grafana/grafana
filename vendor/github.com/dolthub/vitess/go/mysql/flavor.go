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
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/vterrors"
)

var (
	// ErrNotSlave means there is no slave status.
	// Returned by ShowSlaveStatus().
	ErrNotSlave = errors.New("no slave status")
)

const (
	// mariaDBReplicationHackPrefix is the prefix of a version for MariaDB 10.0
	// versions, to work around replication bugs.
	mariaDBReplicationHackPrefix = "5.5.5-"
	// mariaDBVersionString is present in
	mariaDBVersionString = "MariaDB"
)

// flavor is the abstract interface for a flavor.
// Flavors are auto-detected upon connection using the server version.
// We have two major implementations (the main difference is the GTID
// handling):
// 1. Oracle MySQL 5.6, 5.7, 8.0, ...
// 2. MariaDB 10.X
type flavor interface {
	// masterGTIDSet returns the current GTIDSet of a server.
	masterGTIDSet(c *Conn) (GTIDSet, error)

	// startSlave returns the command to start the slave.
	startSlaveCommand() string

	// startSlaveUntilAfter will restart replication, but only allow it
	// to run until `pos` is reached. After reaching pos, replication will be stopped again
	startSlaveUntilAfter(pos Position) string

	// stopSlave returns the command to stop the slave.
	stopSlaveCommand() string

	// sendBinlogDumpCommand sends the packet required to start
	// dumping binlogs from the specified location.
	sendBinlogDumpCommand(c *Conn, slaveID uint32, startPos Position) error

	// readBinlogEvent reads the next BinlogEvent from the connection.
	readBinlogEvent(c *Conn) (BinlogEvent, error)

	// resetReplicationCommands returns the commands to completely reset
	// replication on the host.
	resetReplicationCommands(c *Conn) []string

	// setSlavePositionCommands returns the commands to set the
	// replication position at which the slave will resume.
	setSlavePositionCommands(pos Position) []string

	// changeMasterArg returns the specific parameter to add to
	// a change master command.
	changeMasterArg() string

	// status returns the result of 'SHOW SLAVE STATUS',
	// with parsed replication position.
	status(c *Conn) (SlaveStatus, error)

	// waitUntilPositionCommand returns the SQL command to issue
	// to wait until the given position, until the context
	// expires.  The command returns -1 if it times out. It
	// returns NULL if GTIDs are not enabled.
	waitUntilPositionCommand(ctx context.Context, pos Position) (string, error)

	// enableBinlogPlaybackCommand and disableBinlogPlaybackCommand return an
	// optional command to run to enable or disable binlog
	// playback. This is used internally in Google, as the
	// timestamp cannot be set by regular clients.
	enableBinlogPlaybackCommand() string
	disableBinlogPlaybackCommand() string
}

// flavors maps flavor names to their implementation.
// Flavors need to register only if they support being specified in the
// connection parameters.
var flavors = make(map[string]func() flavor)

// fillFlavor fills in c.Flavor. If the params specify the flavor,
// that is used. Otherwise, we auto-detect.
//
// This is the same logic as the ConnectorJ java client. We try to recognize
// MariaDB as much as we can, but default to MySQL.
//
// MariaDB note: the server version returned here might look like:
// 5.5.5-10.0.21-MariaDB-...
// If that is the case, we are removing the 5.5.5- prefix.
// Note on such servers, 'select version()' would return 10.0.21-MariaDB-...
// as well (not matching what c.ServerVersion is, but matching after we remove
// the prefix).
func (c *Conn) fillFlavor(params *ConnParams) {
	if flavorFunc := flavors[params.Flavor]; flavorFunc != nil {
		c.flavor = flavorFunc()
		return
	}

	if strings.HasPrefix(c.ServerVersion, mariaDBReplicationHackPrefix) {
		c.ServerVersion = c.ServerVersion[len(mariaDBReplicationHackPrefix):]
		c.flavor = mariadbFlavor{}
		return
	}

	if strings.Contains(c.ServerVersion, mariaDBVersionString) {
		c.flavor = mariadbFlavor{}
		return
	}

	c.flavor = mysqlFlavor{}
}

//
// The following methods are dependent on the flavor.
// Only valid for client connections (will panic for server connections).
//

// IsMariaDB returns true iff the other side of the client connection
// is identified as MariaDB. Most applications should not care, but
// this is useful in tests.
func (c *Conn) IsMariaDB() bool {
	_, ok := c.flavor.(mariadbFlavor)
	return ok
}

// MasterPosition returns the current master replication position.
func (c *Conn) MasterPosition() (Position, error) {
	gtidSet, err := c.flavor.masterGTIDSet(c)
	if err != nil {
		return Position{}, err
	}
	return Position{
		GTIDSet: gtidSet,
	}, nil
}

// StartSlaveCommand returns the command to start the slave.
func (c *Conn) StartSlaveCommand() string {
	return c.flavor.startSlaveCommand()
}

// StartSlaveUntilAfterCommand returns the command to start the slave.
func (c *Conn) StartSlaveUntilAfterCommand(pos Position) string {
	return c.flavor.startSlaveUntilAfter(pos)
}

// StopSlaveCommand returns the command to stop the slave.
func (c *Conn) StopSlaveCommand() string {
	return c.flavor.stopSlaveCommand()
}

// SendBinlogDumpCommand sends the flavor-specific version of
// the COM_BINLOG_DUMP command to start dumping raw binlog
// events over a slave connection, starting at a given GTID.
func (c *Conn) SendBinlogDumpCommand(slaveID uint32, startPos Position) error {
	return c.flavor.sendBinlogDumpCommand(c, slaveID, startPos)
}

// ReadBinlogEvent reads the next BinlogEvent. This must be used
// in conjunction with SendBinlogDumpCommand.
func (c *Conn) ReadBinlogEvent() (BinlogEvent, error) {
	return c.flavor.readBinlogEvent(c)
}

// ResetReplicationCommands returns the commands to completely reset
// replication on the host.
func (c *Conn) ResetReplicationCommands() []string {
	return c.flavor.resetReplicationCommands(c)
}

// SetSlavePositionCommands returns the commands to set the
// replication position at which the slave will resume
// when it is later reparented with SetMasterCommands.
func (c *Conn) SetSlavePositionCommands(pos Position) []string {
	return c.flavor.setSlavePositionCommands(pos)
}

// SetMasterCommand returns the command to use the provided master
// as the new master (without changing any GTID position).
// It is guaranteed to be called with replication stopped.
// It should not start or stop replication.
func (c *Conn) SetMasterCommand(params *ConnParams, masterHost string, masterPort int, masterConnectRetry int) string {
	args := []string{
		fmt.Sprintf("MASTER_HOST = '%s'", masterHost),
		fmt.Sprintf("MASTER_PORT = %d", masterPort),
		fmt.Sprintf("MASTER_USER = '%s'", params.Uname),
		fmt.Sprintf("MASTER_PASSWORD = '%s'", params.Pass),
		fmt.Sprintf("MASTER_CONNECT_RETRY = %d", masterConnectRetry),
	}
	if params.SslEnabled() {
		args = append(args, "MASTER_SSL = 1")
	}
	if params.SslCa != "" {
		args = append(args, fmt.Sprintf("MASTER_SSL_CA = '%s'", params.SslCa))
	}
	if params.SslCaPath != "" {
		args = append(args, fmt.Sprintf("MASTER_SSL_CAPATH = '%s'", params.SslCaPath))
	}
	if params.SslCert != "" {
		args = append(args, fmt.Sprintf("MASTER_SSL_CERT = '%s'", params.SslCert))
	}
	if params.SslKey != "" {
		args = append(args, fmt.Sprintf("MASTER_SSL_KEY = '%s'", params.SslKey))
	}
	args = append(args, c.flavor.changeMasterArg())
	return "CHANGE MASTER TO\n  " + strings.Join(args, ",\n  ")
}

// resultToMap is a helper function used by ShowSlaveStatus.
func resultToMap(qr *sqltypes.Result) (map[string]string, error) {
	if len(qr.Rows) == 0 {
		// The query succeeded, but there is no data.
		return nil, nil
	}
	if len(qr.Rows) > 1 {
		return nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "query returned %d rows, expected 1", len(qr.Rows))
	}
	if len(qr.Fields) != len(qr.Rows[0]) {
		return nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "query returned %d column names, expected %d", len(qr.Fields), len(qr.Rows[0]))
	}

	result := make(map[string]string, len(qr.Fields))
	for i, field := range qr.Fields {
		result[field.Name] = qr.Rows[0][i].ToString()
	}
	return result, nil
}

// parseSlaveStatus parses the common fields of SHOW SLAVE STATUS.
func parseSlaveStatus(fields map[string]string) SlaveStatus {
	status := SlaveStatus{
		MasterHost:      fields["Master_Host"],
		SlaveIORunning:  fields["Slave_IO_Running"] == "Yes",
		SlaveSQLRunning: fields["Slave_SQL_Running"] == "Yes",
	}
	parseInt, _ := strconv.ParseInt(fields["Master_Port"], 10, 0)
	status.MasterPort = int(parseInt)
	parseInt, _ = strconv.ParseInt(fields["Connect_Retry"], 10, 0)
	status.MasterConnectRetry = int(parseInt)
	parseUint, _ := strconv.ParseUint(fields["Seconds_Behind_Master"], 10, 0)
	status.SecondsBehindMaster = uint(parseUint)
	return status
}

// ShowSlaveStatus executes the right SHOW SLAVE STATUS command,
// and returns a parse Position with other fields.
func (c *Conn) ShowSlaveStatus() (SlaveStatus, error) {
	return c.flavor.status(c)
}

// WaitUntilPositionCommand returns the SQL command to issue
// to wait until the given position, until the context
// expires.  The command returns -1 if it times out. It
// returns NULL if GTIDs are not enabled.
func (c *Conn) WaitUntilPositionCommand(ctx context.Context, pos Position) (string, error) {
	return c.flavor.waitUntilPositionCommand(ctx, pos)
}

// EnableBinlogPlaybackCommand returns a command to run to enable
// binlog playback.
func (c *Conn) EnableBinlogPlaybackCommand() string {
	return c.flavor.enableBinlogPlaybackCommand()
}

// DisableBinlogPlaybackCommand returns a command to run to disable
// binlog playback.
func (c *Conn) DisableBinlogPlaybackCommand() string {
	return c.flavor.disableBinlogPlaybackCommand()
}
