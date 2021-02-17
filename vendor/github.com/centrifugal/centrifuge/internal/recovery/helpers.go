package recovery

import (
	"math"
	"sort"

	"github.com/centrifugal/protocol"
)

// uniquePublications returns slice of unique Publications.
func uniquePublications(s []*protocol.Publication) []*protocol.Publication {
	keys := make(map[uint64]struct{})
	list := make([]*protocol.Publication, 0, len(s))
	for _, entry := range s {
		val := entry.Offset
		if _, value := keys[val]; !value {
			keys[val] = struct{}{}
			list = append(list, entry)
		}
	}
	return list
}

// MergePublications allows to merge recovered pubs with buffered pubs
// collected during extracting recovered so result is ordered and with
// duplicates removed.
func MergePublications(recoveredPubs []*protocol.Publication, bufferedPubs []*protocol.Publication, isLegacyOrder bool) ([]*protocol.Publication, bool) {
	if len(bufferedPubs) > 0 {
		recoveredPubs = append(recoveredPubs, bufferedPubs...)
	}
	if isLegacyOrder {
		sort.Slice(recoveredPubs, func(i, j int) bool {
			return recoveredPubs[i].Offset > recoveredPubs[j].Offset
		})
	} else {
		sort.Slice(recoveredPubs, func(i, j int) bool {
			return recoveredPubs[i].Offset < recoveredPubs[j].Offset
		})
	}
	if len(bufferedPubs) > 0 {
		if len(recoveredPubs) > 1 {
			recoveredPubs = uniquePublications(recoveredPubs)
		}
		prevOffset := recoveredPubs[0].Offset
		for _, p := range recoveredPubs[1:] {
			pubOffset := p.Offset
			var isWrongOffset bool
			if isLegacyOrder {
				isWrongOffset = pubOffset != prevOffset-1
			} else {
				isWrongOffset = pubOffset != prevOffset+1
			}
			if isWrongOffset {
				return nil, false
			}
			prevOffset = pubOffset
		}
	}
	return recoveredPubs, true
}

// PackUint64 ...
func PackUint64(seq, gen uint32) uint64 {
	return uint64(gen)*uint64(math.MaxUint32) + uint64(seq)
}

// UnpackUint64 ...
func UnpackUint64(val uint64) (uint32, uint32) {
	return uint32(val), uint32(val >> 32)
}
