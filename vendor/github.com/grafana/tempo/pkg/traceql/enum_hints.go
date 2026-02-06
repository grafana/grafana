package traceql

import (
	"time"
)

// The list of all traceql query hints.  Although most of these are implementation-specific
// and not part of the language or engine, we organize them here in one place.
const (
	HintSample            = "sample"
	HintJobSize           = "job_size"
	HintTimeOverlapCutoff = "time_overlap_cutoff"
	HintConcurrentBlocks  = "concurrent_blocks"
	HintExemplars         = "exemplars"
	HintMostRecent        = "most_recent" // traceql search hint to return most recent results ordered by time
)

func isUnsafe(h string) bool {
	switch h {
	case HintSample, HintExemplars, HintMostRecent:
		return false
	default:
		return true
	}
}

type Hint struct {
	Name  string
	Value Static
}

func newHint(k string, v Static) *Hint {
	return &Hint{k, v}
}

type Hints struct {
	Hints []*Hint
}

func newHints(h []*Hint) *Hints {
	return &Hints{h}
}

func (h *Hints) GetFloat(k string, allowUnsafe bool) (v float64, ok bool) {
	if v, ok := h.Get(k, TypeFloat, allowUnsafe); ok {
		return v.Float(), ok
	}

	// If float not found, then try integer.
	if v, ok := h.Get(k, TypeInt, allowUnsafe); ok {
		n, _ := v.Int()
		return float64(n), ok
	}

	return
}

func (h *Hints) GetInt(k string, allowUnsafe bool) (v int, ok bool) {
	if v, ok := h.Get(k, TypeInt, allowUnsafe); ok {
		n, _ := v.Int()
		return n, ok
	}

	return
}

func (h *Hints) GetDuration(k string, allowUnsafe bool) (v time.Duration, ok bool) {
	if v, ok := h.Get(k, TypeDuration, allowUnsafe); ok {
		d, _ := v.Duration()
		return d, ok
	}

	return
}

func (h *Hints) GetBool(k string, allowUnsafe bool) (v, ok bool) {
	if v, ok := h.Get(k, TypeBoolean, allowUnsafe); ok {
		b, _ := v.Bool()
		return b, ok
	}

	return
}

func (h *Hints) Get(k string, t StaticType, allowUnsafe bool) (v Static, ok bool) {
	if h == nil {
		return
	}

	if isUnsafe(k) && !allowUnsafe {
		return
	}

	for _, hh := range h.Hints {
		if hh.Name == k && hh.Value.Type == t {
			return hh.Value, true
		}
	}

	return
}

var _ Element = (*Hints)(nil)
