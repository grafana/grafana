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
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"

	"github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/vterrors"
)

const mysql56FlavorID = "MySQL56"

// parseMysql56GTID is registered as a GTID parser.
func parseMysql56GTID(s string) (GTID, error) {
	// Split into parts.
	parts := strings.Split(s, ":")
	if len(parts) != 2 {
		return nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "invalid MySQL 5.6 GTID (%v): expecting UUID:Sequence", s)
	}

	// Parse Server ID.
	sid, err := ParseSID(parts[0])
	if err != nil {
		return nil, vterrors.Wrapf(err, "invalid MySQL 5.6 GTID Server ID (%v)", parts[0])
	}

	// Parse Sequence number.
	seq, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return nil, vterrors.Wrapf(err, "invalid MySQL 5.6 GTID Sequence number (%v)", parts[1])
	}

	return Mysql56GTID{Server: sid, Sequence: seq}, nil
}

// SID is the 16-byte unique ID of a MySQL 5.6 server.
type SID [16]byte

// String prints an SID in the form used by MySQL 5.6.
func (sid SID) String() string {
	dst := []byte("xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx")
	hex.Encode(dst, sid[:4])
	hex.Encode(dst[9:], sid[4:6])
	hex.Encode(dst[14:], sid[6:8])
	hex.Encode(dst[19:], sid[8:10])
	hex.Encode(dst[24:], sid[10:16])
	return string(dst)
}

// ParseSID parses an SID in the form used by MySQL 5.6.
func ParseSID(s string) (sid SID, err error) {
	if len(s) != 36 || s[8] != '-' || s[13] != '-' || s[18] != '-' || s[23] != '-' {
		return sid, vterrors.Errorf(vtrpc.Code_INTERNAL, "invalid MySQL 5.6 SID %q", s)
	}

	// Drop the dashes so we can just check the error of Decode once.
	b := make([]byte, 0, 32)
	b = append(b, s[:8]...)
	b = append(b, s[9:13]...)
	b = append(b, s[14:18]...)
	b = append(b, s[19:23]...)
	b = append(b, s[24:]...)

	if _, err := hex.Decode(sid[:], b); err != nil {
		return sid, vterrors.Wrapf(err, "invalid MySQL 5.6 SID %q", s)
	}
	return sid, nil
}

// Mysql56GTID implements GTID
type Mysql56GTID struct {
	// Server is the SID of the server that originally committed the transaction.
	Server SID
	// Sequence is the sequence number of the transaction within a given Server's
	// scope.
	Sequence int64
}

// String implements GTID.String().
func (gtid Mysql56GTID) String() string {
	return fmt.Sprintf("%s:%d", gtid.Server, gtid.Sequence)
}

// Flavor implements GTID.Flavor().
func (gtid Mysql56GTID) Flavor() string {
	return mysql56FlavorID
}

// SequenceDomain implements GTID.SequenceDomain().
func (gtid Mysql56GTID) SequenceDomain() interface{} {
	return nil
}

// SourceServer implements GTID.SourceServer().
func (gtid Mysql56GTID) SourceServer() interface{} {
	return gtid.Server
}

// SequenceNumber implements GTID.SequenceNumber().
func (gtid Mysql56GTID) SequenceNumber() interface{} {
	return gtid.Sequence
}

// GTIDSet implements GTID.GTIDSet().
func (gtid Mysql56GTID) GTIDSet() GTIDSet {
	return Mysql56GTIDSet{}.AddGTID(gtid)
}

func init() {
	gtidParsers[mysql56FlavorID] = parseMysql56GTID
}
