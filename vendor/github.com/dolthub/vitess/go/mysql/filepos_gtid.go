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
	"strings"
)

const filePosFlavorID = "FilePos"

// parsefilePosGTID is registered as a GTID parser.
func parseFilePosGTID(s string) (GTID, error) {
	// Split into parts.
	parts := strings.Split(s, ":")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid FilePos GTID (%v): expecting file:pos", s)
	}

	return filePosGTID{
		file: parts[0],
		pos:  parts[1],
	}, nil
}

// parseFilePosGTIDSet is registered as a GTIDSet parser.
func parseFilePosGTIDSet(s string) (GTIDSet, error) {
	gtid, err := parseFilePosGTID(s)
	if err != nil {
		return nil, err
	}
	return gtid.(filePosGTID), err
}

// filePosGTID implements GTID.
type filePosGTID struct {
	file, pos string
}

// String implements GTID.String().
func (gtid filePosGTID) String() string {
	return gtid.file + ":" + gtid.pos
}

// Flavor implements GTID.Flavor().
func (gtid filePosGTID) Flavor() string {
	return filePosFlavorID
}

// SequenceDomain implements GTID.SequenceDomain().
func (gtid filePosGTID) SequenceDomain() interface{} {
	return nil
}

// SourceServer implements GTID.SourceServer().
func (gtid filePosGTID) SourceServer() interface{} {
	return nil
}

// SequenceNumber implements GTID.SequenceNumber().
func (gtid filePosGTID) SequenceNumber() interface{} {
	return nil
}

// GTIDSet implements GTID.GTIDSet().
func (gtid filePosGTID) GTIDSet() GTIDSet {
	return gtid
}

// ContainsGTID implements GTIDSet.ContainsGTID().
func (gtid filePosGTID) ContainsGTID(other GTID) bool {
	if other == nil {
		return true
	}
	filePosOther, ok := other.(filePosGTID)
	if !ok {
		return false
	}
	if filePosOther.file < gtid.file {
		return true
	}
	if filePosOther.file > gtid.file {
		return false
	}
	return filePosOther.pos <= gtid.pos
}

// Contains implements GTIDSet.Contains().
func (gtid filePosGTID) Contains(other GTIDSet) bool {
	if other == nil {
		return true
	}
	filePosOther, _ := other.(filePosGTID)
	return gtid.ContainsGTID(filePosOther)
}

func (gtid filePosGTID) Subtract(GTIDSet) GTIDSet {
	panic("not implemented")
}

// Equal implements GTIDSet.Equal().
func (gtid filePosGTID) Equal(other GTIDSet) bool {
	filePosOther, ok := other.(filePosGTID)
	if !ok {
		return false
	}
	return gtid == filePosOther
}

// AddGTID implements GTIDSet.AddGTID().
func (gtid filePosGTID) AddGTID(other GTID) GTIDSet {
	filePosOther, ok := other.(filePosGTID)
	if !ok {
		return gtid
	}
	return filePosOther
}

func init() {
	gtidParsers[filePosFlavorID] = parseFilePosGTID
	gtidSetParsers[filePosFlavorID] = parseFilePosGTIDSet
	flavors[filePosFlavorID] = newFilePosFlavor
}
