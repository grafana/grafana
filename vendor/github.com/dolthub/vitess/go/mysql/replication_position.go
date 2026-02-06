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
	"encoding/json"
	"fmt"
	"strings"

	"github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/vterrors"
)

const (
	// MaximumPositionSize is the maximum size of a
	// replication position. It is used as the maximum column size in the _vt.reparent_journal and
	// other related tables. A row has a maximum size of 65535 bytes. So
	// we want to stay under that. We use VARBINARY so the
	// character set doesn't matter, we only store ascii
	// characters anyway.
	MaximumPositionSize = 64000
)

// Position represents the information necessary to describe which
// transactions a server has seen, so that it can request a replication stream
// from a new master that picks up where it left off.
//
// This must be a concrete struct because custom Unmarshalers can't be
// registered on an interface.
//
// The == operator should not be used with Position, because the
// underlying GTIDSet might use slices, which are not comparable. Using == in
// those cases will result in a run-time panic.
type Position struct {
	// This is a zero byte compile-time check that no one is trying to
	// use == or != with Position. Without this, we won't know there's
	// a problem until the runtime panic. Note that this must not be
	// the last field of the struct, or else the Go compiler will add
	// padding to prevent pointers to this field from becoming invalid.
	_ [0]struct{ _ []byte }

	// GTIDSet is the underlying GTID set. It must not be anonymous,
	// or else Position would itself also implement the GTIDSet interface.
	GTIDSet GTIDSet
}

// Equal returns true if this position is equal to another.
func (rp Position) Equal(other Position) bool {
	if rp.GTIDSet == nil {
		return other.GTIDSet == nil
	}
	return rp.GTIDSet.Equal(other.GTIDSet)
}

// AtLeast returns true if this position is equal to or after another.
func (rp Position) AtLeast(other Position) bool {
	if rp.GTIDSet == nil {
		return other.GTIDSet == nil
	}
	return rp.GTIDSet.Contains(other.GTIDSet)
}

// String returns a string representation of the underlying GTIDSet.
// If the set is nil, it returns "<nil>" in the style of Sprintf("%v", nil).
func (rp Position) String() string {
	if rp.GTIDSet == nil {
		return "<nil>"
	}
	return rp.GTIDSet.String()
}

// IsZero returns true if this is the zero value, Position{}.
func (rp Position) IsZero() bool {
	return rp.GTIDSet == nil
}

// AppendGTID returns a new Position that represents the position
// after the given GTID is replicated.
func AppendGTID(rp Position, gtid GTID) Position {
	if gtid == nil {
		return rp
	}
	if rp.GTIDSet == nil {
		return Position{GTIDSet: gtid.GTIDSet()}
	}
	return Position{GTIDSet: rp.GTIDSet.AddGTID(gtid)}
}

// MustParsePosition calls ParsePosition and panics
// on error.
func MustParsePosition(flavor, value string) Position {
	rp, err := ParsePosition(flavor, value)
	if err != nil {
		panic(err)
	}
	return rp
}

// EncodePosition returns a string that contains both the flavor
// and value of the Position, so that the correct parser can be
// selected when that string is passed to DecodePosition.
func EncodePosition(rp Position) string {
	if rp.GTIDSet == nil {
		return ""
	}
	return fmt.Sprintf("%s/%s", rp.GTIDSet.Flavor(), rp.GTIDSet.String())
}

// DecodePosition converts a string in the format returned by
// EncodePosition back into a Position value with the
// correct underlying flavor.
func DecodePosition(s string) (rp Position, err error) {
	if s == "" {
		return rp, nil
	}

	parts := strings.SplitN(s, "/", 2)
	if len(parts) != 2 {
		// There is no flavor. Try looking for a default parser.
		return ParsePosition("", s)
	}
	return ParsePosition(parts[0], parts[1])
}

// ParsePosition calls the parser for the specified flavor.
func ParsePosition(flavor, value string) (rp Position, err error) {
	parser := gtidSetParsers[flavor]
	if parser == nil {
		return rp, vterrors.Errorf(vtrpc.Code_INTERNAL, "parse error: unknown GTIDSet flavor %#v", flavor)
	}
	gtidSet, err := parser(value)
	if err != nil {
		return rp, err
	}
	rp.GTIDSet = gtidSet
	return rp, err
}

// MarshalJSON implements encoding/json.Marshaler.
func (rp Position) MarshalJSON() ([]byte, error) {
	return json.Marshal(EncodePosition(rp))
}

// UnmarshalJSON implements encoding/json.Unmarshaler.
func (rp *Position) UnmarshalJSON(buf []byte) error {
	var s string
	err := json.Unmarshal(buf, &s)
	if err != nil {
		return err
	}

	*rp, err = DecodePosition(s)
	if err != nil {
		return err
	}
	return nil
}
