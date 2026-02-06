package matchfinder

// An absoluteMatch is like a Match, but it stores indexes into the byte
// stream instead of lengths.
type absoluteMatch struct {
	// Start is the index of the first byte.
	Start int

	// End is the index of the byte after the last byte
	// (so that End - Start = Length).
	End int

	// Match is the index of the previous data that matches
	// (Start - Match = Distance).
	Match int
}

// A matchEmitter manages the output of matches for a MatchFinder.
type matchEmitter struct {
	// Dst is the destination slice that Matches are added to.
	Dst []Match

	// NextEmit is the index of the next byte to emit.
	NextEmit int
}

func (e *matchEmitter) emit(m absoluteMatch) {
	e.Dst = append(e.Dst, Match{
		Unmatched: m.Start - e.NextEmit,
		Length:    m.End - m.Start,
		Distance:  m.Start - m.Match,
	})
	e.NextEmit = m.End
}
