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
	"strconv"
	"strings"

	"github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/vterrors"
)

const mariadbFlavorID = "MariaDB"

// parseMariadbGTID is registered as a GTID parser.
func parseMariadbGTID(s string) (GTID, error) {
	// Split into parts.
	parts := strings.Split(s, "-")
	if len(parts) != 3 {
		return nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "invalid MariaDB GTID (%v): expecting Domain-Server-Sequence", s)
	}

	// Parse Domain ID.
	Domain, err := strconv.ParseUint(parts[0], 10, 32)
	if err != nil {
		return nil, vterrors.Wrapf(err, "invalid MariaDB GTID Domain ID (%v)", parts[0])
	}

	// Parse Server ID.
	Server, err := strconv.ParseUint(parts[1], 10, 32)
	if err != nil {
		return nil, vterrors.Wrapf(err, "invalid MariaDB GTID Server ID (%v)", parts[1])
	}

	// Parse Sequence number.
	Sequence, err := strconv.ParseUint(parts[2], 10, 64)
	if err != nil {
		return nil, vterrors.Wrapf(err, "invalid MariaDB GTID Sequence number (%v)", parts[2])
	}

	return MariadbGTID{
		Domain:   uint32(Domain),
		Server:   uint32(Server),
		Sequence: Sequence,
	}, nil
}

// parseMariadbGTIDSet is registered as a GTIDSet parser.
func parseMariadbGTIDSet(s string) (GTIDSet, error) {
	gtidStrings := strings.Split(s, ",")
	gtidSet := make(MariadbGTIDSet, len(gtidStrings))
	for i, gtidString := range gtidStrings {
		gtid, err := parseMariadbGTID(gtidString)
		if err != nil {
			return nil, err
		}
		gtidSet[i] = gtid.(MariadbGTID)
	}
	return gtidSet, nil
}

// MariadbGTID implements GTID.
type MariadbGTID struct {
	// Domain is the ID number of the domain within which sequence numbers apply.
	Domain uint32
	// Server is the ID of the server that generated the transaction.
	Server uint32
	// Sequence is the sequence number of the transaction within the domain.
	Sequence uint64
}

// MariadbGTIDSet implements GTIDSet
type MariadbGTIDSet []MariadbGTID

// String implements GTID.String().
func (gtid MariadbGTID) String() string {
	return fmt.Sprintf("%d-%d-%d", gtid.Domain, gtid.Server, gtid.Sequence)
}

// Flavor implements GTID.Flavor().
func (gtid MariadbGTID) Flavor() string {
	return mariadbFlavorID
}

// SequenceDomain implements GTID.SequenceDomain().
func (gtid MariadbGTID) SequenceDomain() interface{} {
	return gtid.Domain
}

// SourceServer implements GTID.SourceServer().
func (gtid MariadbGTID) SourceServer() interface{} {
	return gtid.Server
}

// SequenceNumber implements GTID.SequenceNumber().
func (gtid MariadbGTID) SequenceNumber() interface{} {
	return gtid.Sequence
}

// GTIDSet implements GTID.GTIDSet().
func (gtid MariadbGTID) GTIDSet() GTIDSet {
	return MariadbGTIDSet{gtid}
}

// String implements GTIDSet.String()
func (gtidSet MariadbGTIDSet) String() string {
	s := make([]string, len(gtidSet))
	for i, gtid := range gtidSet {
		s[i] = gtid.String()
	}
	return strings.Join(s, ",")
}

// Flavor implements GTIDSet.Flavor()
func (gtidSet MariadbGTIDSet) Flavor() string {
	return mariadbFlavorID
}

// ContainsGTID implements GTIDSet.ContainsGTID().
func (gtidSet MariadbGTIDSet) ContainsGTID(other GTID) bool {
	if other == nil {
		return true
	}
	mdbOther, ok := other.(MariadbGTID)
	if !ok {
		return false
	}
	for _, gtid := range gtidSet {
		if gtid.Domain != mdbOther.Domain {
			continue
		}
		return gtid.Sequence >= mdbOther.Sequence
	}
	return false
}

// Contains implements GTIDSet.Contains().
func (gtidSet MariadbGTIDSet) Contains(other GTIDSet) bool {
	if other == nil {
		return true
	}
	mdbOther, ok := other.(MariadbGTIDSet)
	if !ok {
		return false
	}
	for _, gtid := range mdbOther {
		if !gtidSet.ContainsGTID(gtid) {
			return false
		}
	}
	return true
}

func (gtidSet MariadbGTIDSet) Subtract(GTIDSet) GTIDSet {
	panic("not implemented")
}

// Equal implements GTIDSet.Equal().
func (gtidSet MariadbGTIDSet) Equal(other GTIDSet) bool {
	mdbOther, ok := other.(MariadbGTIDSet)
	if !ok {
		return false
	}
	if len(gtidSet) != len(mdbOther) {
		return false
	}
	for i, gtid := range gtidSet {
		if gtid != mdbOther[i] {
			return false
		}
	}
	return true
}

// AddGTID implements GTIDSet.AddGTID().
func (gtidSet MariadbGTIDSet) AddGTID(other GTID) GTIDSet {
	mdbOther, ok := other.(MariadbGTID)
	if !ok || other == nil {
		return gtidSet
	}
	for i, gtid := range gtidSet {
		if mdbOther.Domain == gtid.Domain {
			if mdbOther.Sequence > gtid.Sequence {
				gtidSet[i] = mdbOther
			}
			return gtidSet
		}
	}
	return append(gtidSet, mdbOther)
}

func init() {
	gtidParsers[mariadbFlavorID] = parseMariadbGTID
	gtidSetParsers[mariadbFlavorID] = parseMariadbGTIDSet
}
