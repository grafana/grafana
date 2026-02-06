// Copyright 2019 Gregory Petrosyan <gregory.petrosyan@gmail.com>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

package rapid

import (
	"encoding/binary"
	"fmt"
	"math"
	"math/bits"
	"os"
	"strings"
	"time"
)

const (
	labelLowerFloatExp       = "lower_float_exp"
	labelLowerFloatSignif    = "lower_float_signif"
	labelLowerFloatFrac      = "lower_float_frac"
	labelMinBlockBinSearch   = "minblock_binsearch"
	labelMinBlockShift       = "minblock_shift"
	labelMinBlockSort        = "minblock_sort"
	labelMinBlockTrySmall    = "minblock_trysmall"
	labelMinBlockUnset       = "minblock_unset"
	labelRemoveGroup         = "remove_group"
	labelRemoveGroupAndLower = "remove_group_lower"
	labelRemoveGroupSpan     = "remove_groupspan"
	labelSortGroups          = "sort_groups"
)

func shrink(tb tb, deadline time.Time, rec recordedBits, err *testError, prop func(*T)) ([]uint64, *testError) {
	rec.prune()

	s := &shrinker{
		tb:      tb,
		rec:     rec,
		err:     err,
		prop:    prop,
		visBits: []recordedBits{rec},
		tries:   map[string]int{},
		cache:   map[string]struct{}{},
	}

	buf, err := s.shrink(deadline)

	if flags.debugvis {
		name := fmt.Sprintf("vis-%v.html", strings.Replace(tb.Name(), "/", "_", -1))
		f, err := os.Create(name)
		if err != nil {
			tb.Logf("failed to create debugvis file %v: %v", name, err)
		} else {
			defer func() { _ = f.Close() }()

			if err = visWriteHTML(f, tb.Name(), s.visBits); err != nil {
				tb.Logf("failed to write debugvis file %v: %v", name, err)
			}
		}
	}

	return buf, err
}

type shrinker struct {
	tb      tb
	rec     recordedBits
	err     *testError
	prop    func(*T)
	visBits []recordedBits
	tries   map[string]int
	shrinks int
	cache   map[string]struct{}
	hits    int
}

func (s *shrinker) debugf(verbose_ bool, format string, args ...any) {
	if flags.debug && (!verbose_ || flags.verbose) {
		s.tb.Helper()
		s.tb.Logf("[shrink] "+format, args...)
	}
}

func (s *shrinker) shrink(deadline time.Time) (buf []uint64, err *testError) {
	defer func() {
		if r := recover(); r != nil {
			buf, err = s.rec.data, r.(*testError)
		}
	}()

	i := 0
	for shrinks := -1; s.shrinks > shrinks && time.Now().Before(deadline); i++ {
		shrinks = s.shrinks

		s.debugf(false, "round %v start", i)
		s.removeGroups(deadline)
		s.minimizeBlocks(deadline)

		if s.shrinks == shrinks {
			s.debugf(false, "trying expensive algorithms for round %v", i)
			s.lowerFloatHack(deadline)
			s.removeGroupsAndLower(deadline)
			s.sortGroups(deadline)
			s.removeGroupSpans(deadline)
		}
	}

	tries := 0
	for _, n := range s.tries {
		tries += n
	}
	s.debugf(false, "done, %v rounds total (%v tries, %v shrinks, %v cache hits):\n%v", i, tries, s.shrinks, s.hits, s.tries)

	return s.rec.data, s.err
}

func (s *shrinker) removeGroups(deadline time.Time) {
	for i := 0; i < len(s.rec.groups) && time.Now().Before(deadline); i++ {
		g := s.rec.groups[i]
		if !g.standalone || g.end < 0 {
			continue
		}

		if s.accept(without(s.rec.data, g), labelRemoveGroup, "remove group %q at %v: [%v, %v)", g.label, i, g.begin, g.end) {
			i--
		}
	}
}

func (s *shrinker) minimizeBlocks(deadline time.Time) {
	for i := 0; i < len(s.rec.data) && time.Now().Before(deadline); i++ {
		minimize(s.rec.data[i], func(u uint64, label string) bool {
			buf := append([]uint64(nil), s.rec.data...)
			buf[i] = u
			return s.accept(buf, label, "minimize block %v: %v to %v", i, s.rec.data[i], u)
		})
	}
}

func (s *shrinker) lowerFloatHack(deadline time.Time) {
	for i := 0; i < len(s.rec.groups) && time.Now().Before(deadline); i++ {
		g := s.rec.groups[i]
		if !g.standalone || g.end != g.begin+7 {
			continue
		}

		buf := append([]uint64(nil), s.rec.data...)
		buf[g.begin+3] -= 1
		buf[g.begin+4] = math.MaxUint64
		buf[g.begin+5] = math.MaxUint64
		buf[g.begin+6] = math.MaxUint64

		if !s.accept(buf, labelLowerFloatExp, "lower float exponent of group %q at %v to %v", g.label, i, buf[g.begin+3]) {
			buf := append([]uint64(nil), s.rec.data...)
			buf[g.begin+4] -= 1
			buf[g.begin+5] = math.MaxUint64
			buf[g.begin+6] = math.MaxUint64

			if !s.accept(buf, labelLowerFloatSignif, "lower float significant of group %q at %v to %v", g.label, i, buf[g.begin+4]) {
				buf := append([]uint64(nil), s.rec.data...)
				buf[g.begin+5] -= 1
				buf[g.begin+6] = math.MaxUint64

				s.accept(buf, labelLowerFloatFrac, "lower float frac of group %q at %v to %v", g.label, i, buf[g.begin+5])
			}
		}
	}
}

func (s *shrinker) removeGroupsAndLower(deadline time.Time) {
	for i := 0; i < len(s.rec.data) && time.Now().Before(deadline); i++ {
		if s.rec.data[i] == 0 {
			continue
		}

		buf := append([]uint64(nil), s.rec.data...)
		buf[i] -= 1

		for j := 0; j < len(s.rec.groups); j++ {
			g := s.rec.groups[j]
			if !g.standalone || g.end < 0 || (i >= g.begin && i < g.end) {
				continue
			}

			if s.accept(without(buf, g), labelRemoveGroupAndLower, "lower block %v to %v and remove group %q at %v: [%v, %v)", i, buf[i], g.label, j, g.begin, g.end) {
				i--
				break
			}
		}
	}
}

func (s *shrinker) sortGroups(deadline time.Time) {
	for i := 1; i < len(s.rec.groups) && time.Now().Before(deadline); i++ {
		for j := i; j > 0; {
			g := s.rec.groups[j]
			if !g.standalone || g.end < 0 {
				break
			}

			j_ := j
			for j--; j >= 0; j-- {
				h := s.rec.groups[j]
				if !h.standalone || h.end < 0 || h.end > g.begin || h.label != g.label {
					continue
				}

				buf := append([]uint64(nil), s.rec.data[:h.begin]...)
				buf = append(buf, s.rec.data[g.begin:g.end]...)
				buf = append(buf, s.rec.data[h.end:g.begin]...)
				buf = append(buf, s.rec.data[h.begin:h.end]...)
				buf = append(buf, s.rec.data[g.end:]...)

				if s.accept(buf, labelSortGroups, "swap groups %q at %v: [%v, %v) and %q at %v: [%v, %v)", g.label, j_, g.begin, g.end, h.label, j, h.begin, h.end) {
					break
				}
			}
		}
	}
}

func (s *shrinker) removeGroupSpans(deadline time.Time) {
	for i := 0; i < len(s.rec.groups) && time.Now().Before(deadline); i++ {
		g := s.rec.groups[i]
		if !g.standalone || g.end < 0 {
			continue
		}

		groups := []groupInfo{g}
		for j := i + 1; j < len(s.rec.groups); j++ {
			h := s.rec.groups[j]
			if !h.standalone || h.end < 0 || h.begin < groups[len(groups)-1].end {
				continue
			}

			groups = append(groups, h)
			buf := without(s.rec.data, groups...)

			if s.accept(buf, labelRemoveGroupSpan, "remove %v groups %v", len(groups), groups) {
				i--
				break
			}
		}
	}
}

func (s *shrinker) accept(buf []uint64, label string, format string, args ...any) bool {
	if compareData(buf, s.rec.data) >= 0 {
		return false
	}
	bufStr := dataStr(buf)
	if _, ok := s.cache[bufStr]; ok {
		s.hits++
		return false
	}

	s.debugf(true, label+": trying to reproduce the failure with a smaller test case: "+format, args...)
	s.tries[label]++
	s1 := newBufBitStream(buf, false)
	err1 := checkOnce(newT(s.tb, s1, flags.debug && flags.verbose, nil), s.prop)
	if traceback(err1) != traceback(s.err) {
		s.cache[bufStr] = struct{}{}
		return false
	}

	s.debugf(true, label+": trying to reproduce the failure")
	s.tries[label]++
	s.err = err1
	s2 := newBufBitStream(buf, true)
	err2 := checkOnce(newT(s.tb, s2, flags.debug && flags.verbose, nil), s.prop)
	s.rec = s2.recordedBits
	s.rec.prune()
	assert(compareData(s.rec.data, buf) <= 0)
	if flags.debugvis {
		s.visBits = append(s.visBits, s.rec)
	}
	if !sameError(err1, err2) {
		panic(err2)
	}

	s.debugf(false, label+" success: "+format, args...)
	s.shrinks++

	return true
}

func minimize(u uint64, cond func(uint64, string) bool) uint64 {
	if u == 0 {
		return 0
	}
	for i := uint64(0); i < u && i < small; i++ {
		if cond(i, labelMinBlockTrySmall) {
			return i
		}
	}
	if u <= small {
		return u
	}

	m := &minimizer{best: u, cond: cond}

	m.rShift()
	m.unsetBits()
	m.sortBits()
	m.binSearch()

	return m.best
}

type minimizer struct {
	best uint64
	cond func(uint64, string) bool
}

func (m *minimizer) accept(u uint64, label string) bool {
	if u >= m.best || u < small || !m.cond(u, label) {
		return false
	}
	m.best = u
	return true
}

func (m *minimizer) rShift() {
	for m.accept(m.best>>1, labelMinBlockShift) {
	}
}

func (m *minimizer) unsetBits() {
	size := bits.Len64(m.best)

	for i := size - 1; i >= 0; i-- {
		m.accept(m.best^1<<uint(i), labelMinBlockUnset)
	}
}

func (m *minimizer) sortBits() {
	size := bits.Len64(m.best)

	for i := size - 1; i >= 0; i-- {
		h := uint64(1 << uint(i))
		if m.best&h != 0 {
			for j := 0; j < i; j++ {
				l := uint64(1 << uint(j))
				if m.best&l == 0 {
					if m.accept(m.best^(l|h), labelMinBlockSort) {
						break
					}
				}
			}
		}
	}
}

func (m *minimizer) binSearch() {
	if !m.accept(m.best-1, labelMinBlockBinSearch) {
		return
	}

	i := uint64(0)
	j := m.best
	for i < j {
		h := i + (j-i)/2
		if m.accept(h, labelMinBlockBinSearch) {
			j = h
		} else {
			i = h + 1
		}
	}
}

func without(data []uint64, groups ...groupInfo) []uint64 {
	buf := append([]uint64(nil), data...)

	for i := len(groups) - 1; i >= 0; i-- {
		g := groups[i]
		buf = append(buf[:g.begin], buf[g.end:]...)
	}

	return buf
}

func dataStr(data []uint64) string {
	b := &strings.Builder{}
	err := binary.Write(b, binary.LittleEndian, data)
	assert(err == nil)
	return b.String()
}

func compareData(a []uint64, b []uint64) int {
	if len(a) < len(b) {
		return -1
	}
	if len(a) > len(b) {
		return 1
	}

	for i := range a {
		if a[i] < b[i] {
			return -1
		}
		if a[i] > b[i] {
			return 1
		}
	}

	return 0
}
