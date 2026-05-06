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

	"github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/vterrors"
)

// GTID represents a Global Transaction ID, also known as Transaction Group ID.
// Each flavor of MySQL has its own format for the GTID. This interface is used
// along with various MysqlFlavor implementations to abstract the differences.
//
// Types that implement GTID should use a non-pointer receiver. This ensures
// that comparing GTID interface values with == has the expected semantics.
type GTID interface {
	// String returns the canonical printed form of the GTID as expected by a
	// particular flavor of MySQL.
	String() string

	// Flavor returns the key under which the corresponding GTID parser function
	// is registered in the gtidParsers map.
	Flavor() string

	// SourceServer returns the ID of the server that generated the transaction.
	SourceServer() interface{}

	// SequenceNumber returns the ID number that increases with each transaction.
	// It is only valid to compare the sequence numbers of two GTIDs if they have
	// the same domain value.
	SequenceNumber() interface{}

	// SequenceDomain returns the ID of the domain within which two sequence
	// numbers can be meaningfully compared.
	SequenceDomain() interface{}

	// GTIDSet returns a GTIDSet of the same flavor as this GTID, containing only
	// this GTID.
	GTIDSet() GTIDSet
}

// gtidParsers maps flavor names to parser functions.
var gtidParsers = make(map[string]func(string) (GTID, error))

// ParseGTID calls the GTID parser for the specified flavor.
func ParseGTID(flavor, value string) (GTID, error) {
	parser := gtidParsers[flavor]
	if parser == nil {
		return nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "parse error: unknown GTID flavor %#v", flavor)
	}
	return parser(value)
}

// MustParseGTID calls ParseGTID and panics on error.
func MustParseGTID(flavor, value string) GTID {
	gtid, err := ParseGTID(flavor, value)
	if err != nil {
		panic(err)
	}
	return gtid
}

// EncodeGTID returns a string that contains both the flavor and value of the
// GTID, so that the correct parser can be selected when that string is passed
// to DecodeGTID.
func EncodeGTID(gtid GTID) string {
	if gtid == nil {
		return ""
	}

	return fmt.Sprintf("%s/%s", gtid.Flavor(), gtid.String())
}

// DecodeGTID converts a string in the format returned by EncodeGTID back into
// a GTID interface value with the correct underlying flavor.
func DecodeGTID(s string) (GTID, error) {
	if s == "" {
		return nil, nil
	}

	parts := strings.SplitN(s, "/", 2)
	if len(parts) != 2 {
		// There is no flavor. Try looking for a default parser.
		return ParseGTID("", s)
	}
	return ParseGTID(parts[0], parts[1])
}

// MustDecodeGTID calls DecodeGTID and panics on error.
func MustDecodeGTID(s string) GTID {
	gtid, err := DecodeGTID(s)
	if err != nil {
		panic(err)
	}
	return gtid
}
