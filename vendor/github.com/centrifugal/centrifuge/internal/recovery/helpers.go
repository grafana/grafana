package recovery

import (
	"slices"
	"sort"

	"github.com/centrifugal/protocol"
)

// uniqueNonFilteredPublications returns slice of unique Publications which were not filtered.
func uniqueNonFilteredPublications(s []*protocol.Publication) ([]*protocol.Publication, uint64, []uint64) {
	keys := make(map[uint64]struct{})
	list := make([]*protocol.Publication, 0, len(s))
	var skippedOffsets []uint64
	var maxSeenOffset uint64
	for _, entry := range s {
		if entry.Offset > maxSeenOffset {
			maxSeenOffset = entry.Offset
		}
		if entry.Time == -1 { // Special value -1 indicates filtered publication, see in hub.go.
			skippedOffsets = append(skippedOffsets, entry.Offset)
			continue
		}
		val := entry.Offset
		if _, value := keys[val]; !value {
			keys[val] = struct{}{}
			list = append(list, entry)
		}
	}
	return list, maxSeenOffset, skippedOffsets
}

// MergePublications allows to merge recovered pubs with buffered pubs
// collected during extracting recovered so result is ordered and with
// duplicates removed.
func MergePublications(recoveredPubs []*protocol.Publication, bufferedPubs []*protocol.Publication) ([]*protocol.Publication, uint64, bool) {
	var maxSeenOffset uint64
	if len(bufferedPubs) > 0 {
		recoveredPubs = append(recoveredPubs, bufferedPubs...)
	}
	sort.Slice(recoveredPubs, func(i, j int) bool {
		return recoveredPubs[i].Offset < recoveredPubs[j].Offset
	})
	if len(bufferedPubs) > 0 {
		var (
			skippedOffsets []uint64
		)
		if len(recoveredPubs) > 1 {
			recoveredPubs, maxSeenOffset, skippedOffsets = uniqueNonFilteredPublications(recoveredPubs)
		}
		prevOffset := recoveredPubs[0].Offset
		for _, p := range recoveredPubs[1:] {
			pubOffset := p.Offset
			expectedOffset := prevOffset + 1
			isWrongOffset := pubOffset != expectedOffset
			if isWrongOffset {
				if len(skippedOffsets) == 0 {
					return nil, 0, false
				}
				// All offsets from expectedOffset till pubOffset-1 must be in skippedOffsets.
				// Otherwise, we have a gap in recovered publications.
				for o := expectedOffset; o < pubOffset; o++ {
					if !slices.Contains(skippedOffsets, o) {
						return nil, 0, false
					}
				}
				// All offsets are present in skippedOffsets, can continue.
			}
			prevOffset = pubOffset
		}
	}
	return recoveredPubs, maxSeenOffset, true
}
