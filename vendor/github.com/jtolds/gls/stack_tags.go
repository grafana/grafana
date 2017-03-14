package gls

// so, basically, we're going to encode integer tags in base-16 on the stack

import (
	"reflect"
	"runtime"
)

const (
	bitWidth = 4
)

func addStackTag(tag uint, context_call func()) {
	if context_call == nil {
		return
	}
	markS(tag, context_call)
}

func markS(tag uint, cb func()) { _m(tag, cb) }
func mark0(tag uint, cb func()) { _m(tag, cb) }
func mark1(tag uint, cb func()) { _m(tag, cb) }
func mark2(tag uint, cb func()) { _m(tag, cb) }
func mark3(tag uint, cb func()) { _m(tag, cb) }
func mark4(tag uint, cb func()) { _m(tag, cb) }
func mark5(tag uint, cb func()) { _m(tag, cb) }
func mark6(tag uint, cb func()) { _m(tag, cb) }
func mark7(tag uint, cb func()) { _m(tag, cb) }
func mark8(tag uint, cb func()) { _m(tag, cb) }
func mark9(tag uint, cb func()) { _m(tag, cb) }
func markA(tag uint, cb func()) { _m(tag, cb) }
func markB(tag uint, cb func()) { _m(tag, cb) }
func markC(tag uint, cb func()) { _m(tag, cb) }
func markD(tag uint, cb func()) { _m(tag, cb) }
func markE(tag uint, cb func()) { _m(tag, cb) }
func markF(tag uint, cb func()) { _m(tag, cb) }

var pc_lookup = make(map[uintptr]int8, 17)
var mark_lookup [16]func(uint, func())

func init() {
	setEntries := func(f func(uint, func()), v int8) {
		pc_lookup[reflect.ValueOf(f).Pointer()] = v
		if v >= 0 {
			mark_lookup[v] = f
		}
	}
	setEntries(markS, -0x1)
	setEntries(mark0, 0x0)
	setEntries(mark1, 0x1)
	setEntries(mark2, 0x2)
	setEntries(mark3, 0x3)
	setEntries(mark4, 0x4)
	setEntries(mark5, 0x5)
	setEntries(mark6, 0x6)
	setEntries(mark7, 0x7)
	setEntries(mark8, 0x8)
	setEntries(mark9, 0x9)
	setEntries(markA, 0xa)
	setEntries(markB, 0xb)
	setEntries(markC, 0xc)
	setEntries(markD, 0xd)
	setEntries(markE, 0xe)
	setEntries(markF, 0xf)
}

func _m(tag_remainder uint, cb func()) {
	if tag_remainder == 0 {
		cb()
	} else {
		mark_lookup[tag_remainder&0xf](tag_remainder>>bitWidth, cb)
	}
}

func readStackTags(stack []uintptr) (tags []uint) {
	var current_tag uint
	for _, pc := range stack {
		pc = runtime.FuncForPC(pc).Entry()
		val, ok := pc_lookup[pc]
		if !ok {
			continue
		}
		if val < 0 {
			tags = append(tags, current_tag)
			current_tag = 0
			continue
		}
		current_tag <<= bitWidth
		current_tag += uint(val)
	}
	return
}
