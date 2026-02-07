/*
Copyright 2022 The Vitess Authors.

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
	vtrpcpb "github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/vterrors"
)

var (
	comRegisterReplicaPacketErr = vterrors.Errorf(vtrpcpb.Code_INTERNAL, "error reading BinlogDumpGTID packet")
)

func (c *Conn) parseComRegisterReplica(data []byte) (
	replicaHost string,
	replicaPort uint16,
	replicaUser string,
	replicaPassword string,
	err error,
) {
	pos := 1
	pos += 4 // server-id

	// hostname
	hostnameLen, pos, ok := readUint8(data, pos)
	if !ok {
		return replicaHost, replicaPort, replicaUser, replicaPassword, comRegisterReplicaPacketErr
	}
	replicaHost = string(data[pos : pos+int(hostnameLen)])
	pos += int(hostnameLen)

	// username
	usernameLen, pos, ok := readUint8(data, pos)
	if !ok {
		return replicaHost, replicaPort, replicaUser, replicaPassword, comRegisterReplicaPacketErr
	}
	replicaUser = string(data[pos : pos+int(usernameLen)])
	pos += int(usernameLen)

	// password
	passwordLen, pos, ok := readUint8(data, pos)
	if !ok {
		return replicaHost, replicaPort, replicaUser, replicaPassword, comRegisterReplicaPacketErr
	}
	replicaPassword = string(data[pos : pos+int(passwordLen)])
	pos += int(passwordLen)

	// port
	replicaPort, _, ok = readUint16(data, pos)
	if !ok {
		return replicaHost, replicaPort, replicaUser, replicaPassword, comRegisterReplicaPacketErr
	}
	// remaining: (commented because of ineffectual assignment)
	// pos += 4 // replication rank
	// pos += 4 // master-id

	return replicaHost, replicaPort, replicaUser, replicaPassword, nil
}
