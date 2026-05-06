package internal

type Stats struct {
	hits   uint64
	misses uint64
}

func newStats(hits uint64, misses uint64) Stats {
	return Stats{
		hits:   hits,
		misses: misses,
	}
}

func (s Stats) Hits() uint64 {
	return s.hits
}

func (s Stats) Misses() uint64 {
	return s.misses
}

func (s Stats) HitRatio() float64 {
	total := s.hits + s.misses
	if total == 0 {
		return 0.0
	}
	return float64(s.hits) / float64(total)
}
