package matchfinder

import (
	"encoding/binary"
	"math"
	"math/bits"
	"slices"
)

// Pathfinder is a MatchFinder that uses hash chains to find matches, and a
// shortest-path optimizer to choose which matches to use.
type Pathfinder struct {
	// MaxDistance is the maximum distance (in bytes) to look back for
	// a match. The default is 65535.
	MaxDistance int

	// MinLength is the length of the shortest match to return.
	// The default is 4.
	MinLength int

	// HashLen is the number of bytes to use to calculate the hashes.
	// The maximum is 8 and the default is 6.
	HashLen int

	// TableBits is the number of bits in the hash table indexes.
	// The default is 17 (128K entries).
	TableBits int

	// ChainLength is how many entries to search on the "match chain" of older
	// locations with the same hash as the current location.
	ChainLength int

	table []uint32
	chain []uint32

	history []byte

	// holding onto buffers to reduce allocations:

	arrivals     []arrival
	foundMatches []absoluteMatch
	matches      []Match
}

func (q *Pathfinder) Reset() {
	for i := range q.table {
		q.table[i] = 0
	}
	q.history = q.history[:0]
	q.chain = q.chain[:0]
}

// An arrival represents how we got to a certain byte position.
// The cost is the total cost to get there from the beginning of the block.
// If distance > 0, the arrival is with a match.
// If distance == 0, the arrival is with a run of literals.
type arrival struct {
	length   uint32
	distance uint32
	cost     float32
}

const (
	baseMatchCost float32 = 4
)

func (q *Pathfinder) FindMatches(dst []Match, src []byte) []Match {
	if q.MaxDistance == 0 {
		q.MaxDistance = 65535
	}
	if q.MinLength == 0 {
		q.MinLength = 4
	}
	if q.HashLen == 0 {
		q.HashLen = 6
	}
	if q.TableBits == 0 {
		q.TableBits = 17
	}
	if len(q.table) < 1<<q.TableBits {
		q.table = make([]uint32, 1<<q.TableBits)
	}

	var histogram [256]uint32
	for _, b := range src {
		histogram[b]++
	}
	var byteCost [256]float32
	for b, n := range histogram {
		cost := max(math.Log2(float64(len(src))/float64(n)), 1)
		byteCost[b] = float32(cost)
	}

	// Each element in arrivals corresponds to the position just after
	// the corresponding byte in src.
	arrivals := q.arrivals
	if len(arrivals) < len(src) {
		arrivals = make([]arrival, len(src))
		q.arrivals = arrivals
	} else {
		arrivals = arrivals[:len(src)]
		for i := range arrivals {
			arrivals[i] = arrival{}
		}
	}

	if len(q.history) > q.MaxDistance*2 {
		// Trim down the history buffer.
		delta := len(q.history) - q.MaxDistance
		copy(q.history, q.history[delta:])
		q.history = q.history[:q.MaxDistance]
		q.chain = q.chain[:q.MaxDistance]

		for i, v := range q.table {
			newV := max(int(v)-delta, 0)
			q.table[i] = uint32(newV)
		}
	}

	// Append src to the history buffer.
	historyLen := len(q.history)
	q.history = append(q.history, src...)
	q.chain = append(q.chain, make([]uint32, len(src))...)
	src = q.history

	// Calculate hashes and build the chain.
	for i := historyLen; i < len(src)-7; i++ {
		h := ((binary.LittleEndian.Uint64(src[i:]) & (1<<(8*q.HashLen) - 1)) * hashMul64) >> (64 - q.TableBits)
		candidate := int(q.table[h])
		q.table[h] = uint32(i)
		if candidate != 0 {
			delta := i - candidate
			q.chain[i] = uint32(delta)
		}
	}

	// Look for matches, and collect them in foundMatches. Later we'll figure out
	// which ones to actually use.
	foundMatches := q.foundMatches[:0]
	var prevMatch absoluteMatch
	i := historyLen
	for i < len(src)-7 {
		delta := q.chain[i]
		if delta == 0 {
			i++
			continue
		}
		candidate := i - int(delta)
		if candidate <= 0 || i-candidate > q.MaxDistance {
			i++
			continue
		}

		var currentMatch absoluteMatch

		if i >= prevMatch.End && prevMatch != (absoluteMatch{}) {
			// Look for a repeat match at i+1.
			prevDistance := prevMatch.Start - prevMatch.Match
			if binary.LittleEndian.Uint32(src[i+1:]) == binary.LittleEndian.Uint32(src[i+1-prevDistance:]) {
				m := extendMatch2(src, i+1, i+1-prevDistance, i+1)
				if m.End-m.Start > q.MinLength {
					currentMatch = m
					foundMatches = append(foundMatches, m)
				}
			}
		}

		if binary.LittleEndian.Uint32(src[candidate:]) == binary.LittleEndian.Uint32(src[i:]) {
			m := extendMatch2(src, i, candidate, max(historyLen, prevMatch.Start))
			if m.End-m.Start > q.MinLength {
				currentMatch = m
				foundMatches = append(foundMatches, m)
			}
		}

		for range q.ChainLength {
			delta := q.chain[candidate]
			if delta == 0 {
				break
			}
			candidate -= int(delta)
			if candidate <= 0 || i-candidate > q.MaxDistance {
				break
			}
			if binary.LittleEndian.Uint32(src[candidate:]) == binary.LittleEndian.Uint32(src[i:]) {
				m := extendMatch2(src, i, candidate, max(historyLen, prevMatch.Start))
				if m.End-m.Start > q.MinLength && m.End-m.Start > currentMatch.End-currentMatch.Start {
					currentMatch = m
					foundMatches = append(foundMatches, m)
				}
			}
		}

		if i < prevMatch.End && currentMatch.End-currentMatch.Start <= prevMatch.End-prevMatch.Start {
			// We were looking for an overlapping match, but we didn't find one longer
			// than the previous match. So we'll go back to sequential search,
			// starting right after the previous match.
			i = prevMatch.End
			continue
		}

		if currentMatch == (absoluteMatch{}) {
			// No match found. Continue with sequential search.
			i++
			continue
		}

		// We've found a match; now look for matches overlapping the end of it.
		prevMatch = currentMatch
		i = currentMatch.End + 2 - q.HashLen
	}

	q.foundMatches = foundMatches

	slices.SortFunc(foundMatches, func(a, b absoluteMatch) int { return a.Start - b.Start })
	matchIndex := 0
	var pending absoluteMatch

	for i := historyLen; i < len(src); i++ {
		var arrivedHere arrival
		if i > historyLen {
			arrivedHere = arrivals[i-historyLen-1]
		}

		unmatched := 0
		if arrivedHere.distance == 0 {
			unmatched = int(arrivedHere.length)
		}
		prevDistance := 0
		if i-unmatched > historyLen {
			prevDistance = int(arrivals[i-historyLen-1-unmatched].distance)
		}

		literalCost := byteCost[src[i]]
		nextArrival := &arrivals[i-historyLen]
		if nextArrival.cost == 0 || arrivedHere.cost+literalCost < nextArrival.cost {
			*nextArrival = arrival{
				cost:   arrivedHere.cost + literalCost,
				length: uint32(unmatched + 1),
			}
		}

		for matchIndex < len(foundMatches) && foundMatches[matchIndex].Start == i {
			m := foundMatches[matchIndex]
			matchIndex++
			if m.End > pending.End {
				pending = m
			}
			matchCost := baseMatchCost + float32(bits.Len(uint(unmatched)))
			if m.Start-m.Match != prevDistance {
				matchCost += float32(bits.Len(uint(m.Start - m.Match)))
			}
			for j := m.Start + q.MinLength; j <= m.End; j++ {
				adjustedCost := matchCost
				if j-m.Start < 6 {
					// Matches shorter than 6 are comparatively rare, and therefore
					// have longer codes.
					adjustedCost += float32(6-(j-m.Start)) * 2
				}
				a := &arrivals[j-historyLen-1]
				if a.cost == 0 || arrivedHere.cost+adjustedCost < a.cost {
					*a = arrival{
						length:   uint32(j - m.Start),
						distance: uint32(m.Start - m.Match),
						cost:     arrivedHere.cost + adjustedCost,
					}
				}
			}
		}

		// If a match from an earlier position extends far enough past the current
		// position, try using the tail of it, starting from here.
		if unmatched == 0 && pending.Start != i && pending.End >= i+q.MinLength &&
			!(arrivedHere.length != 0 && arrivedHere.distance == uint32(pending.Start-pending.Match)) {
			matchCost := baseMatchCost + float32(bits.Len(uint(pending.Start-pending.Match)))
			for j := i + q.MinLength; j <= pending.End; j++ {
				adjustedCost := matchCost
				if j-i < 6 {
					// Matches shorter than 6 are comparatively rare, and therefore
					// have longer codes.
					adjustedCost += float32(6-(j-i)) * 2
				}
				a := &arrivals[j-historyLen-1]
				if a.cost == 0 || arrivedHere.cost+adjustedCost < a.cost {
					*a = arrival{
						length:   uint32(j - i),
						distance: uint32(pending.Start - pending.Match),
						cost:     arrivedHere.cost + adjustedCost,
					}
				}
			}
		}

		delta := q.chain[i]
		if delta == 0 {
			continue
		}
		candidate := i - int(delta)
		if candidate <= 0 || i-candidate > q.MaxDistance {
			continue
		}
	}

	// We've found the shortest path; now walk it backward and store the matches.
	matches := q.matches[:0]
	i = len(arrivals) - 1
	for i >= 0 {
		a := arrivals[i]
		if a.distance > 0 {
			matches = append(matches, Match{
				Length:   int(a.length),
				Distance: int(a.distance),
			})
			i -= int(a.length)
		} else {
			if len(matches) == 0 {
				matches = append(matches, Match{})
			}
			matches[len(matches)-1].Unmatched = int(a.length)
			i -= int(a.length)
		}
	}
	q.matches = matches

	slices.Reverse(matches)

	return append(dst, matches...)
}
