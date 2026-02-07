package snowballstem

import (
	"log"
	"strings"
	"unicode/utf8"
)

// Env represents the Snowball execution environment
type Env struct {
	current       string
	Cursor        int
	Limit         int
	LimitBackward int
	Bra           int
	Ket           int
}

// NewEnv creates a new Snowball execution environment on the provided string
func NewEnv(val string) *Env {
	return &Env{
		current:       val,
		Cursor:        0,
		Limit:         len(val),
		LimitBackward: 0,
		Bra:           0,
		Ket:           len(val),
	}
}

func (env *Env) Current() string {
	return env.current
}

func (env *Env) SetCurrent(s string) {
	env.current = s
	env.Cursor = 0
	env.Limit = len(s)
	env.LimitBackward = 0
	env.Bra = 0
	env.Ket = len(s)
}

func (env *Env) ReplaceS(bra, ket int, s string) int32 {
	adjustment := int32(len(s)) - (int32(ket) - int32(bra))
	result, _ := splitAt(env.current, bra)
	rsplit := ket
	if ket < bra {
		rsplit = bra
	}
	_, rhs := splitAt(env.current, rsplit)
	result += s
	result += rhs

	newLim := int32(env.Limit) + adjustment
	env.Limit = int(newLim)

	if env.Cursor >= ket {
		newCur := int32(env.Cursor) + adjustment
		env.Cursor = int(newCur)
	} else if env.Cursor > bra {
		env.Cursor = bra
	}

	env.current = result
	return adjustment
}

func (env *Env) EqS(s string) bool {
	if env.Cursor >= env.Limit {
		return false
	}

	if strings.HasPrefix(env.current[env.Cursor:], s) {
		env.Cursor += len(s)
		for !onCharBoundary(env.current, env.Cursor) {
			env.Cursor++
		}
		return true
	}
	return false
}

func (env *Env) EqSB(s string) bool {
	if int32(env.Cursor)-int32(env.LimitBackward) < int32(len(s)) {
		return false
	} else if !onCharBoundary(env.current, env.Cursor-len(s)) ||
		!strings.HasPrefix(env.current[env.Cursor-len(s):], s) {
		return false
	} else {
		env.Cursor -= len(s)
		return true
	}
}

func (env *Env) SliceFrom(s string) bool {
	bra, ket := env.Bra, env.Ket
	env.ReplaceS(bra, ket, s)
	return true
}

func (env *Env) NextChar() {
	env.Cursor++
	for !onCharBoundary(env.current, env.Cursor) {
		env.Cursor++
	}
}

func (env *Env) PrevChar() {
	env.Cursor--
	for !onCharBoundary(env.current, env.Cursor) {
		env.Cursor--
	}
}

func (env *Env) ByteIndexForHop(delta int32) int32 {
	if delta > 0 {
		res := env.Cursor
		for delta > 0 {
			res++
			delta--
			for res <= len(env.current) && !onCharBoundary(env.current, res) {
				res++
			}
		}
		return int32(res)
	} else if delta < 0 {
		res := env.Cursor
		for delta < 0 {
			res--
			delta++
			for res >= 0 && !onCharBoundary(env.current, res) {
				res--
			}
		}
		return int32(res)
	} else {
		return int32(env.Cursor)
	}
}

func (env *Env) InGrouping(chars []byte, min, max int32) bool {
	if env.Cursor >= env.Limit {
		return false
	}

	r, _ := utf8.DecodeRuneInString(env.current[env.Cursor:])
	if r != utf8.RuneError {
		if r > max || r < min {
			return false
		}
		r -= min
		if (chars[uint(r>>3)] & (0x1 << uint(r&0x7))) == 0 {
			return false
		}
		env.NextChar()
		return true
	}
	return false
}

func (env *Env) InGroupingB(chars []byte, min, max int32) bool {
	if env.Cursor <= env.LimitBackward {
		return false
	}
	env.PrevChar()
	r, _ := utf8.DecodeRuneInString(env.current[env.Cursor:])
	if r != utf8.RuneError {
		env.NextChar()
		if r > max || r < min {
			return false
		}
		r -= min
		if (chars[uint(r>>3)] & (0x1 << uint(r&0x7))) == 0 {
			return false
		}
		env.PrevChar()
		return true
	}
	return false
}

func (env *Env) OutGrouping(chars []byte, min, max int32) bool {
	if env.Cursor >= env.Limit {
		return false
	}
	r, _ := utf8.DecodeRuneInString(env.current[env.Cursor:])
	if r != utf8.RuneError {
		if r > max || r < min {
			env.NextChar()
			return true
		}
		r -= min
		if (chars[uint(r>>3)] & (0x1 << uint(r&0x7))) == 0 {
			env.NextChar()
			return true
		}
	}
	return false
}

func (env *Env) OutGroupingB(chars []byte, min, max int32) bool {
	if env.Cursor <= env.LimitBackward {
		return false
	}
	env.PrevChar()
	r, _ := utf8.DecodeRuneInString(env.current[env.Cursor:])
	if r != utf8.RuneError {
		env.NextChar()
		if r > max || r < min {
			env.PrevChar()
			return true
		}
		r -= min
		if (chars[uint(r>>3)] & (0x1 << uint(r&0x7))) == 0 {
			env.PrevChar()
			return true
		}
	}
	return false
}

func (env *Env) SliceDel() bool {
	return env.SliceFrom("")
}

func (env *Env) Insert(bra, ket int, s string) {
	adjustment := env.ReplaceS(bra, ket, s)
	if bra <= env.Bra {
		env.Bra = int(int32(env.Bra) + adjustment)
	}
	if bra <= env.Ket {
		env.Ket = int(int32(env.Ket) + adjustment)
	}
}

func (env *Env) SliceTo() string {
	return env.current[env.Bra:env.Ket]
}

func (env *Env) FindAmong(amongs []*Among, ctx interface{}) int32 {
	var i int32
	j := int32(len(amongs))

	c := env.Cursor
	l := env.Limit

	var commonI, commonJ int

	firstKeyInspected := false
	for {
		k := i + ((j - i) >> 1)
		var diff int32
		common := min(commonI, commonJ)
		w := amongs[k]
		for lvar := common; lvar < len(w.Str); lvar++ {
			if c+common == l {
				diff--
				break
			}
			diff = int32(env.current[c+common]) - int32(w.Str[lvar])
			if diff != 0 {
				break
			}
			common++
		}
		if diff < 0 {
			j = k
			commonJ = common
		} else {
			i = k
			commonI = common
		}
		if j-i <= 1 {
			if i > 0 {
				break
			}
			if j == i {
				break
			}
			if firstKeyInspected {
				break
			}
			firstKeyInspected = true
		}
	}

	for {
		w := amongs[i]
		if commonI >= len(w.Str) {
			env.Cursor = c + len(w.Str)
			if w.F != nil {
				res := w.F(env, ctx)
				env.Cursor = c + len(w.Str)
				if res {
					return w.B
				}
			} else {
				return w.B
			}
		}
		i = w.A
		if i < 0 {
			return 0
		}
	}
}

func (env *Env) FindAmongB(amongs []*Among, ctx interface{}) int32 {
	var i int32
	j := int32(len(amongs))

	c := env.Cursor
	lb := env.LimitBackward

	var commonI, commonJ int

	firstKeyInspected := false

	for {
		k := i + ((j - i) >> 1)
		diff := int32(0)
		common := min(commonI, commonJ)
		w := amongs[k]
		for lvar := len(w.Str) - int(common) - 1; lvar >= 0; lvar-- {
			if c-common == lb {
				diff--
				break
			}
			diff = int32(env.current[c-common-1]) - int32(w.Str[lvar])
			if diff != 0 {
				break
			}
			// Count up commons. But not one character but the byte width of that char
			common++
		}
		if diff < 0 {
			j = k
			commonJ = common
		} else {
			i = k
			commonI = common
		}
		if j-i <= 1 {
			if i > 0 {
				break
			}
			if j == i {
				break
			}
			if firstKeyInspected {
				break
			}
			firstKeyInspected = true
		}
	}
	for {
		w := amongs[i]
		if commonI >= len(w.Str) {
			env.Cursor = c - len(w.Str)
			if w.F != nil {
				res := w.F(env, ctx)
				env.Cursor = c - len(w.Str)
				if res {
					return w.B
				}
			} else {
				return w.B
			}
		}
		i = w.A
		if i < 0 {
			return 0
		}
	}
}

func (env *Env) Debug(count, lineNumber int) {
	log.Printf("snowball debug, count: %d, line: %d", count, lineNumber)
}

func (env *Env) Clone() *Env {
	clone := *env
	return &clone
}

func (env *Env) AssignTo() string {
	return env.Current()
}
