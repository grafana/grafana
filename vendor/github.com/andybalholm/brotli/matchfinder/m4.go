package matchfinder

import (
	"bytes"
	"encoding/binary"
	"math/bits"
	"runtime"
)

// M4 is an implementation of the MatchFinder
// interface that uses a hash table to find matches,
// optional match chains,
// and the advanced parsing technique from
// https://fastcompression.blogspot.com/2011/12/advanced-parsing-strategies.html.
type M4 struct {
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

	// DistanceBitCost is used when comparing two matches to see
	// which is better. The comparison is primarily based on the length
	// of the matches, but it can also take the distance into account,
	// in terms of the number of bits needed to represent the distance.
	// One byte of length is given a score of 256, so 32 (256/8) would
	// be a reasonable first guess for the value of one bit.
	// (The default is 0, which bases the comparison solely on length.)
	DistanceBitCost int

	table []uint32
	chain []uint32

	history []byte
}

func (q *M4) Reset() {
	for i := range q.table {
		q.table[i] = 0
	}
	q.history = q.history[:0]
	q.chain = q.chain[:0]
}

func (q *M4) score(m absoluteMatch) int {
	return (m.End-m.Start)*256 + (bits.LeadingZeros32(uint32(m.Start-m.Match))-32)*q.DistanceBitCost
}

func (q *M4) FindMatches(dst []Match, src []byte) []Match {
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

	e := matchEmitter{Dst: dst}

	if len(q.history) > q.MaxDistance*2 {
		// Trim down the history buffer.
		delta := len(q.history) - q.MaxDistance
		copy(q.history, q.history[delta:])
		q.history = q.history[:q.MaxDistance]
		if q.ChainLength > 0 {
			q.chain = q.chain[:q.MaxDistance]
		}

		for i, v := range q.table {
			newV := int(v) - delta
			if newV < 0 {
				newV = 0
			}
			q.table[i] = uint32(newV)
		}
	}

	// Append src to the history buffer.
	e.NextEmit = len(q.history)
	q.history = append(q.history, src...)
	if q.ChainLength > 0 {
		q.chain = append(q.chain, make([]uint32, len(src))...)
	}
	src = q.history

	// matches stores the matches that have been found but not emitted,
	// in reverse order. (matches[0] is the most recent one.)
	var matches [3]absoluteMatch
	for i := e.NextEmit; i < len(src)-7; i++ {
		if matches[0] != (absoluteMatch{}) && i >= matches[0].End {
			// We have found some matches, and we're far enough along that we probably
			// won't find overlapping matches, so we might as well emit them.
			if matches[1] != (absoluteMatch{}) {
				if matches[1].End > matches[0].Start {
					matches[1].End = matches[0].Start
				}
				if matches[1].End-matches[1].Start >= q.MinLength && q.score(matches[1]) > 0 {
					e.emit(matches[1])
				}
			}
			e.emit(matches[0])
			matches = [3]absoluteMatch{}
		}

		// Look for a repeat match one byte after the current position.
		if matches[0] == (absoluteMatch{}) && len(e.Dst) > 0 {
			prevDistance := e.Dst[len(e.Dst)-1].Distance
			if binary.LittleEndian.Uint32(src[i+1:]) == binary.LittleEndian.Uint32(src[i+1-prevDistance:]) {
				// We have a 4-byte match.
				m := extendMatch2(src, i+1, i+1-prevDistance, e.NextEmit+1)
				if m.End-m.Start >= q.MinLength {
					matches[0] = m
				}
			}
		}

		// Calculate and store the hash.
		h := ((binary.LittleEndian.Uint64(src[i:]) & (1<<(8*q.HashLen) - 1)) * hashMul64) >> (64 - q.TableBits)
		candidate := int(q.table[h])
		q.table[h] = uint32(i)
		if q.ChainLength > 0 && candidate != 0 {
			delta := i - candidate
			q.chain[i] = uint32(delta)
		}

		if i < matches[0].End && i != matches[0].End+2-q.HashLen {
			continue
		}
		if candidate == 0 || i-candidate > q.MaxDistance {
			continue
		}

		// Look for a match.
		var currentMatch absoluteMatch

		if binary.LittleEndian.Uint32(src[candidate:]) == binary.LittleEndian.Uint32(src[i:]) {
			m := extendMatch2(src, i, candidate, e.NextEmit)
			if m.End-m.Start > q.MinLength && q.score(m) > 0 {
				currentMatch = m
			}
		}

		for j := 0; j < q.ChainLength; j++ {
			delta := q.chain[candidate]
			if delta == 0 {
				break
			}
			candidate -= int(delta)
			if candidate <= 0 || i-candidate > q.MaxDistance {
				break
			}
			if binary.LittleEndian.Uint32(src[candidate:]) == binary.LittleEndian.Uint32(src[i:]) {
				m := extendMatch2(src, i, candidate, e.NextEmit)
				if m.End-m.Start > q.MinLength && q.score(m) > q.score(currentMatch) {
					currentMatch = m
				}
			}
		}

		if currentMatch.End-currentMatch.Start < q.MinLength {
			continue
		}

		overlapPenalty := 0
		if matches[0] != (absoluteMatch{}) {
			overlapPenalty = 275
			if currentMatch.Start <= matches[1].End {
				// This match would completely replace the previous match,
				// so there is no penalty for overlap.
				overlapPenalty = 0
			}
		}

		if q.score(currentMatch) <= q.score(matches[0])+overlapPenalty {
			continue
		}

		matches = [3]absoluteMatch{
			currentMatch,
			matches[0],
			matches[1],
		}

		if matches[2] == (absoluteMatch{}) {
			continue
		}

		// We have three matches, so it's time to emit one and/or eliminate one.
		switch {
		case matches[0].Start < matches[2].End:
			// The first and third matches overlap; discard the one in between.
			matches = [3]absoluteMatch{
				matches[0],
				matches[2],
				absoluteMatch{},
			}

		case matches[0].Start < matches[2].End+q.MinLength:
			// The first and third matches don't overlap, but there's no room for
			// another match between them. Emit the first match and discard the second.
			e.emit(matches[2])
			matches = [3]absoluteMatch{
				matches[0],
				absoluteMatch{},
				absoluteMatch{},
			}

		default:
			// Emit the first match, shortening it if necessary to avoid overlap with the second.
			if matches[2].End > matches[1].Start {
				matches[2].End = matches[1].Start
				if q.ChainLength > 0 && matches[2].End-matches[2].Start >= q.MinLength {
					// Since the match length was trimmed, we may be able to find a closer match
					// to replace it.
					pos := matches[2].Start
					for {
						delta := int(q.chain[pos])
						if delta == 0 {
							break
						}
						pos -= delta
						if pos <= matches[2].Match {
							break
						}
						if bytes.Equal(src[matches[2].Start:matches[2].End], src[pos:pos+matches[2].End-matches[2].Start]) {
							matches[2].Match = pos
							break
						}
					}
				}
			}
			if matches[2].End-matches[2].Start >= q.MinLength && q.score(matches[2]) > 0 {
				e.emit(matches[2])
			}
			matches[2] = absoluteMatch{}
		}
	}

	// We've found all the matches now; emit the remaining ones.
	if matches[1] != (absoluteMatch{}) {
		if matches[1].End > matches[0].Start {
			matches[1].End = matches[0].Start
		}
		if matches[1].End-matches[1].Start >= q.MinLength && q.score(matches[1]) > 0 {
			e.emit(matches[1])
		}
	}
	if matches[0] != (absoluteMatch{}) {
		e.emit(matches[0])
	}

	dst = e.Dst
	if e.NextEmit < len(src) {
		dst = append(dst, Match{
			Unmatched: len(src) - e.NextEmit,
		})
	}

	return dst
}

const hashMul64 = 0x1E35A7BD1E35A7BD

// extendMatch returns the largest k such that k <= len(src) and that
// src[i:i+k-j] and src[j:k] have the same contents.
//
// It assumes that:
//
//	0 <= i && i < j && j <= len(src)
func extendMatch(src []byte, i, j int) int {
	switch runtime.GOARCH {
	case "amd64", "arm64":
		// As long as we are 8 or more bytes before the end of src, we can load and
		// compare 8 bytes at a time. If those 8 bytes are equal, repeat.
		for j+8 < len(src) {
			iBytes := binary.LittleEndian.Uint64(src[i:])
			jBytes := binary.LittleEndian.Uint64(src[j:])
			if iBytes != jBytes {
				// If those 8 bytes were not equal, XOR the two 8 byte values, and return
				// the index of the first byte that differs. The BSF instruction finds the
				// least significant 1 bit, the amd64 architecture is little-endian, and
				// the shift by 3 converts a bit index to a byte index.
				return j + bits.TrailingZeros64(iBytes^jBytes)>>3
			}
			i, j = i+8, j+8
		}
	case "386":
		// On a 32-bit CPU, we do it 4 bytes at a time.
		for j+4 < len(src) {
			iBytes := binary.LittleEndian.Uint32(src[i:])
			jBytes := binary.LittleEndian.Uint32(src[j:])
			if iBytes != jBytes {
				return j + bits.TrailingZeros32(iBytes^jBytes)>>3
			}
			i, j = i+4, j+4
		}
	}
	for ; j < len(src) && src[i] == src[j]; i, j = i+1, j+1 {
	}
	return j
}

// Given a 4-byte match at src[start] and src[candidate], extendMatch2 extends it
// upward as far as possible, and downward no farther than to min.
func extendMatch2(src []byte, start, candidate, min int) absoluteMatch {
	end := extendMatch(src, candidate+4, start+4)
	for start > min && candidate > 0 && src[start-1] == src[candidate-1] {
		start--
		candidate--
	}
	return absoluteMatch{
		Start: start,
		End:   end,
		Match: candidate,
	}
}
