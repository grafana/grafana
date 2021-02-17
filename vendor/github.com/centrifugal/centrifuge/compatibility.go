package centrifuge

const (
	// UseSeqGen enables using Seq and Gen fields instead of Offset.
	UseSeqGen uint64 = 1 << iota
)

// CompatibilityFlags is a global set of legacy features we support
// for backwards compatibility.
//
// Should be removed with v1 library release.
// TODO v1: remove.
var CompatibilityFlags uint64

func hasFlag(flags, flag uint64) bool {
	return flags&flag != 0
}
