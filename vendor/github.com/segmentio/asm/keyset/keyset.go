package keyset

import (
	"bytes"

	"github.com/segmentio/asm/cpu"
	"github.com/segmentio/asm/cpu/arm64"
	"github.com/segmentio/asm/cpu/x86"
)

// New prepares a set of keys for use with Lookup.
//
// An optimized routine is used if the processor supports AVX instructions and
// the maximum length of any of the keys is less than or equal to 16. If New
// returns nil, this indicates that an optimized routine is not available, and
// the caller should use a fallback.
func New(keys [][]byte) []byte {
	maxWidth, hasNullByte := checkKeys(keys)
	if hasNullByte || maxWidth > 16 || !(cpu.X86.Has(x86.AVX) || cpu.ARM64.Has(arm64.ASIMD)) {
		return nil
	}

	set := make([]byte, len(keys)*16)
	for i, k := range keys {
		copy(set[i*16:], k)
	}
	return set
}

func checkKeys(keys [][]byte) (maxWidth int, hasNullByte bool) {
	for _, k := range keys {
		if len(k) > maxWidth {
			maxWidth = len(k)
		}
		if bytes.IndexByte(k, 0) >= 0 {
			hasNullByte = true
		}
	}
	return
}
