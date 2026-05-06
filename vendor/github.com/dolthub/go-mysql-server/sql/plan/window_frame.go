package plan

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
)

//go:generate go run ../../optgen/cmd/optgen/main.go -out window_frame.og.go -pkg plan frame window_frame.go

// windowFrameBase maintains window frame bounds if
// set for a plan.Window's over clause.
// If no bounds set, plan.Window uses a nil windowFrameBase.
// We assume the parser errors for bound pairings that
// violate PRECEDING < CURRENT ROW < FOLLOWING ordering,
// and only a valid subset of fields will be set.
type windowFrameBase struct {
	startNPreceding sql.Expression
	startNFollowing sql.Expression
	endNPreceding   sql.Expression
	endNFollowing   sql.Expression

	isRows             bool
	isRange            bool
	unboundedFollowing bool
	unboundedPreceding bool
	startCurrentRow    bool
	endCurrentRow      bool
}

func (f *windowFrameBase) String() string {
	if f == nil {
		return ""
	}

	var boundType string
	if f.isRange {
		boundType = "RANGE"
	} else {
		boundType = "ROWS"
	}

	var startExtent string
	switch {
	case f.unboundedPreceding:
		startExtent = "UNBOUNDED PRECEDING"
	case f.startCurrentRow:
		startExtent = "CURRENT ROW"
	case f.startNFollowing != nil:
		startExtent = fmt.Sprintf("%s FOLLOWING", f.startNFollowing.String())
	case f.startNPreceding != nil:
		startExtent = fmt.Sprintf("%s PRECEDING", f.startNPreceding.String())
	default:
	}

	var endExtent string
	switch {
	case f.unboundedPreceding:
		endExtent = "UNBOUNDED FOLLOWING"
	case f.endCurrentRow:
		endExtent = "CURRENT ROW"
	case f.endNFollowing != nil:
		endExtent = fmt.Sprintf("%s FOLLOWING", f.endNFollowing.String())
	case f.endNPreceding != nil:
		endExtent = fmt.Sprintf("%s PRECEDING", f.endNPreceding.String())
	default:
	}

	if endExtent != "" {
		return fmt.Sprintf("%s BETWEEN %s AND %s", boundType, startExtent, endExtent)
	} else {
		return fmt.Sprintf("%s %s", boundType, startExtent)
	}
}

func (f *windowFrameBase) DebugString() string {
	if f == nil {
		return ""
	}
	return f.String()
}
