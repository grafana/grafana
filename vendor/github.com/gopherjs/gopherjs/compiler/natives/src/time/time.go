// +build js

package time

import (
	"runtime"

	"github.com/gopherjs/gopherjs/js"
)

// Make sure time.Unix func and time.Time struct it returns are always included with this package (despite DCE),
// because they're needed for internalization/externalization of time.Time/Date. See issue https://github.com/gopherjs/gopherjs/issues/279.
func init() {
	// avoid dead code elimination
	var _ Time = Unix(0, 0)
}

type runtimeTimer struct {
	i       int32
	when    int64
	period  int64
	f       func(interface{}, uintptr)
	arg     interface{}
	timeout *js.Object
	active  bool
}

func initLocal() {
	d := js.Global.Get("Date").New()
	s := d.String()
	i := indexByte(s, '(')
	j := indexByte(s, ')')
	if i == -1 || j == -1 {
		localLoc.name = "UTC"
		return
	}
	localLoc.name = s[i+1 : j]
	localLoc.zone = []zone{{localLoc.name, d.Call("getTimezoneOffset").Int() * -60, false}}
}

func runtimeNano() int64 {
	return js.Global.Get("Date").New().Call("getTime").Int64() * int64(Millisecond)
}

func now() (sec int64, nsec int32, mono int64) {
	n := runtimeNano()
	return n / int64(Second), int32(n % int64(Second)), n
}

func Sleep(d Duration) {
	c := make(chan struct{})
	js.Global.Call("$setTimeout", js.InternalObject(func() { close(c) }), int(d/Millisecond))
	<-c
}

func startTimer(t *runtimeTimer) {
	t.active = true
	diff := (t.when - runtimeNano()) / int64(Millisecond)
	if diff > 1<<31-1 { // math.MaxInt32
		return
	}
	if diff < 0 {
		diff = 0
	}
	t.timeout = js.Global.Call("$setTimeout", js.InternalObject(func() {
		t.active = false
		if t.period != 0 {
			t.when += t.period
			startTimer(t)
		}
		go t.f(t.arg, 0)
	}), diff+1)
}

func stopTimer(t *runtimeTimer) bool {
	js.Global.Call("clearTimeout", t.timeout)
	wasActive := t.active
	t.active = false
	return wasActive
}

func loadLocation(name string) (*Location, error) {
	return loadZoneFile(runtime.GOROOT()+"/lib/time/zoneinfo.zip", name)
}

func forceZipFileForTesting(zipOnly bool) {
}

func initTestingZone() {
	z, err := loadLocation("America/Los_Angeles")
	if err != nil {
		panic("cannot load America/Los_Angeles for testing: " + err.Error())
	}
	z.name = "Local"
	localLoc = *z
}

// indexByte is copied from strings package to avoid importing it (since the real time package doesn't).
func indexByte(s string, c byte) int {
	return js.InternalObject(s).Call("indexOf", js.Global.Get("String").Call("fromCharCode", c)).Int()
}
