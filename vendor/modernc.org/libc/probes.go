// Copyright 2022 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package libc // import "modernc.org/libc"

import (
	"bytes"
	"fmt"
	"math"
	"runtime/debug"
	"sort"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/dustin/go-humanize"
)

type PerfCounter struct {
	a      []int32
	labels []string

	enabled bool
}

func NewPerfCounter(labels []string) *PerfCounter {
	return &PerfCounter{
		a:       make([]int32, len(labels)),
		labels:  labels,
		enabled: true,
	}
}

func (c *PerfCounter) Disable() { c.enabled = false }
func (c *PerfCounter) Enable()  { c.enabled = true }

func (c *PerfCounter) Clear() {
	for i := range c.a {
		c.a[i] = 0
	}
}

func (c *PerfCounter) Inc(n int) {
	if c.enabled {
		atomic.AddInt32(&c.a[n], 1)
	}
}

func (c *PerfCounter) IncN(n, m int) {
	if c.enabled {
		atomic.AddInt32(&c.a[n], int32(m))
	}
}

func (c *PerfCounter) String() string {
	sv := c.enabled

	defer func() { c.enabled = sv }()

	c.enabled = false

	var a []string
	for i, v := range c.a {
		if v != 0 {
			a = append(a, fmt.Sprintf("%q: %s", c.labels[i], h(v)))
		}
	}
	return fmt.Sprint(a)
}

func h(v interface{}) string {
	switch x := v.(type) {
	case int:
		return humanize.Comma(int64(x))
	case int32:
		return humanize.Comma(int64(x))
	case int64:
		return humanize.Comma(x)
	case uint32:
		return humanize.Comma(int64(x))
	case uint64:
		if x <= math.MaxInt64 {
			return humanize.Comma(int64(x))
		}

		return "-" + humanize.Comma(-int64(x))
	}
	return fmt.Sprint(v)
}

type StackCapture struct {
	sync.Mutex
	m map[string]int

	depth int

	enabled bool
}

func NewStackCapture(depth int) *StackCapture {
	return &StackCapture{
		m:       map[string]int{},
		depth:   depth,
		enabled: true,
	}
}

func (c *StackCapture) Disable() { c.enabled = false }
func (c *StackCapture) Enable()  { c.enabled = true }

func (c *StackCapture) Clear() {
	c.Lock()

	defer c.Unlock()
	c.m = map[string]int{}
}

var (
	stackCapturePrefix = []byte("\n\t")
)

func (c *StackCapture) Record() {
	if !c.enabled {
		return
	}

	b := debug.Stack()
	var s strings.Builder
out:
	for i := 0; len(b) > 0 && i < c.depth+2; i++ {
		l := bytes.Index(b, stackCapturePrefix)
		if l < 0 {
			break out
		}

		b = b[l+len(stackCapturePrefix):]
		h := bytes.IndexByte(b, '\n')
		if h < 0 {
			h = len(b)
		}
		if i > 1 {
			fmt.Fprintf(&s, "\n\t%s", b[:h])
		}
		b = b[h:]
	}
	c.Lock()

	defer c.Unlock()

	c.m[s.String()]++
}

func (c *StackCapture) String() string {
	c.Lock()

	defer c.Unlock()

	var b strings.Builder
	var a []string
	for k := range c.m {
		a = append(a, k)
	}
	sort.Slice(a, func(i, j int) bool { return c.m[a[i]] < c.m[a[j]] })
	for _, k := range a {
		fmt.Fprintf(&b, "%d%s\n", c.m[k], k)
	}
	return b.String()
}
