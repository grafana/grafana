package ring

import (
	"math"
	"slices"

	"github.com/pkg/errors"
)

// TokenRanges describes token ranges owned by an instance.
// It consists of [start, end] pairs, where both start and end are inclusive.
// For example TokenRanges with values [5, 10, 20, 30] covers tokens [5..10] and [20..30].
type TokenRanges []uint32

func (tr TokenRanges) IncludesKey(key uint32) bool {
	switch {
	case len(tr) == 0:
		return false
	case key < tr[0]:
		// key comes before the first range
		return false
	case key > tr[len(tr)-1]:
		// key comes after the last range
		return false
	}

	index, found := slices.BinarySearch(tr, key)
	switch {
	case found:
		// ranges are closed
		return true
	case index%2 == 1:
		// hash would be inserted after the start of a range (even index)
		return true
	default:
		return false
	}
}

func (tr TokenRanges) Equal(other TokenRanges) bool {
	if len(tr) != len(other) {
		return false
	}

	for i := 0; i < len(tr); i++ {
		if tr[i] != other[i] {
			return false
		}
	}

	return true
}

// GetTokenRangesForInstance returns the token ranges owned by an instance in the ring.
//
// Current implementation only works with multizone setup, where number of zones is equal to replication factor.
func (r *Ring) GetTokenRangesForInstance(instanceID string) (TokenRanges, error) {
	r.mtx.RLock()
	defer r.mtx.RUnlock()

	instance, ok := r.ringDesc.Ingesters[instanceID]
	if !ok {
		return nil, ErrInstanceNotFound
	}
	if instance.Zone == "" {
		return nil, errors.New("zone not set")
	}

	rf := r.cfg.ReplicationFactor
	numZones := len(r.ringTokensByZone)

	// To simplify computation of token ranges, we currently only support case where zone-awareness is enabled,
	// and replicaction factor is equal to number of zones.
	if !r.cfg.ZoneAwarenessEnabled || rf != numZones {
		// if zoneAwareness is disabled we need to treat the whole ring as one big zone, and we would
		// need to walk the ring backwards looking for RF-1 tokens from other instances to determine the range.
		return nil, errors.New("can't use ring configuration for computing token ranges")
	}

	// at this point zone-aware replication is enabled, and rf == numZones
	// this means that we will write to one replica in each zone, so we can just consider the zonal ring for our instance
	subringTokens, ok := r.ringTokensByZone[instance.Zone]
	if !ok || len(subringTokens) == 0 {
		return nil, errors.New("no tokens for zone")
	}

	// 1 range (2 values) per token + one additional if we need to split the rollover range.
	ranges := make(TokenRanges, 0, 2*(len(instance.Tokens)+1))
	// non-zero value means we're now looking for start of the range. Zero value means we're looking for next end of range (ie. token owned by this instance).
	rangeEnd := uint32(0)

	// if this instance claimed the first token, it owns the wrap-around range, which we'll break into two separate ranges
	firstToken := subringTokens[0]
	firstTokenInfo, ok := r.ringInstanceByToken[firstToken]
	if !ok {
		// This should never happen unless there's a bug in the ring code.
		return nil, ErrInconsistentTokensInfo
	}

	if firstTokenInfo.InstanceID == instanceID {
		// we'll start by looking for the beginning of the range that ends with math.MaxUint32
		rangeEnd = math.MaxUint32
	}

	// walk the ring backwards, alternating looking for ends and starts of ranges
	for i := len(subringTokens) - 1; i > 0; i-- {
		token := subringTokens[i]
		info, ok := r.ringInstanceByToken[token]
		if !ok {
			// This should never happen unless a bug in the ring code.
			return nil, ErrInconsistentTokensInfo
		}

		if rangeEnd == 0 {
			// we're looking for the end of the next range
			if info.InstanceID == instanceID {
				rangeEnd = token - 1
			}
		} else {
			// we have a range end, and are looking for the start of the range
			if info.InstanceID != instanceID {
				ranges = append(ranges, rangeEnd, token)
				rangeEnd = 0
			}
		}
	}

	// finally look at the first token again
	// - if we have a range end, check if we claimed token 0
	//   - if we don't, we have our start
	//   - if we do, the start is 0
	// - if we don't have a range end, check if we claimed token 0
	//   - if we don't, do nothing
	//   - if we do, add the range of [0, token-1]
	//     - BUT, if the token itself is 0, do nothing, because we don't own the tokens themselves (we should be covered by the already added range that ends with MaxUint32)

	if rangeEnd == 0 {
		if firstTokenInfo.InstanceID == instanceID && firstToken != 0 {
			ranges = append(ranges, firstToken-1, 0)
		}
	} else {
		if firstTokenInfo.InstanceID == instanceID {
			ranges = append(ranges, rangeEnd, 0)
		} else {
			ranges = append(ranges, rangeEnd, firstToken)
		}
	}

	// Ensure returned ranges are sorted.
	slices.Sort(ranges)

	return ranges, nil
}
