package gls

// so, basically, we're going to encode integer tags in base-16 on the stack

const (
	bitWidth       = 4
	stackBatchSize = 16
)

var (
	pc_lookup   = make(map[uintptr]int8, 17)
	mark_lookup [16]func(uint, func())
)

func init() {
	setEntries := func(f func(uint, func()), v int8) {
		var ptr uintptr
		f(0, func() {
			ptr = findPtr()
		})
		pc_lookup[ptr] = v
		if v >= 0 {
			mark_lookup[v] = f
		}
	}
	setEntries(github_com_jtolds_gls_markS, -0x1)
	setEntries(github_com_jtolds_gls_mark0, 0x0)
	setEntries(github_com_jtolds_gls_mark1, 0x1)
	setEntries(github_com_jtolds_gls_mark2, 0x2)
	setEntries(github_com_jtolds_gls_mark3, 0x3)
	setEntries(github_com_jtolds_gls_mark4, 0x4)
	setEntries(github_com_jtolds_gls_mark5, 0x5)
	setEntries(github_com_jtolds_gls_mark6, 0x6)
	setEntries(github_com_jtolds_gls_mark7, 0x7)
	setEntries(github_com_jtolds_gls_mark8, 0x8)
	setEntries(github_com_jtolds_gls_mark9, 0x9)
	setEntries(github_com_jtolds_gls_markA, 0xa)
	setEntries(github_com_jtolds_gls_markB, 0xb)
	setEntries(github_com_jtolds_gls_markC, 0xc)
	setEntries(github_com_jtolds_gls_markD, 0xd)
	setEntries(github_com_jtolds_gls_markE, 0xe)
	setEntries(github_com_jtolds_gls_markF, 0xf)
}

func addStackTag(tag uint, context_call func()) {
	if context_call == nil {
		return
	}
	github_com_jtolds_gls_markS(tag, context_call)
}

// these private methods are named this horrendous name so gopherjs support
// is easier. it shouldn't add any runtime cost in non-js builds.
func github_com_jtolds_gls_markS(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_mark0(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_mark1(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_mark2(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_mark3(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_mark4(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_mark5(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_mark6(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_mark7(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_mark8(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_mark9(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_markA(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_markB(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_markC(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_markD(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_markE(tag uint, cb func()) { _m(tag, cb) }
func github_com_jtolds_gls_markF(tag uint, cb func()) { _m(tag, cb) }

func _m(tag_remainder uint, cb func()) {
	if tag_remainder == 0 {
		cb()
	} else {
		mark_lookup[tag_remainder&0xf](tag_remainder>>bitWidth, cb)
	}
}

func readStackTag() (tag uint, ok bool) {
	var current_tag uint
	offset := 0
	for {
		batch, next_offset := getStack(offset, stackBatchSize)
		for _, pc := range batch {
			val, ok := pc_lookup[pc]
			if !ok {
				continue
			}
			if val < 0 {
				return current_tag, true
			}
			current_tag <<= bitWidth
			current_tag += uint(val)
		}
		if next_offset == 0 {
			break
		}
		offset = next_offset
	}
	return 0, false
}

func (m *ContextManager) preventInlining() {
	// dunno if findPtr or getStack are likely to get inlined in a future release
	// of go, but if they are inlined and their callers are inlined, that could
	// hork some things. let's do our best to explain to the compiler that we
	// really don't want those two functions inlined by saying they could change
	// at any time. assumes preventInlining doesn't get compiled out.
	// this whole thing is probably overkill.
	findPtr = m.values[0][0].(func() uintptr)
	getStack = m.values[0][1].(func(int, int) ([]uintptr, int))
}
