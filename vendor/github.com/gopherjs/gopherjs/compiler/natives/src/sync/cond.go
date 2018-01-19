// +build js

package sync

type Cond struct {
	// fields used by vanilla implementation
	noCopy  noCopy
	L       Locker
	notify  notifyList
	checker copyChecker

	// fields used by new implementation
	n  int
	ch chan bool
}

func (c *Cond) Wait() {
	c.n++
	if c.ch == nil {
		c.ch = make(chan bool)
	}
	c.L.Unlock()
	<-c.ch
	c.L.Lock()
}

func (c *Cond) Signal() {
	if c.n == 0 {
		return
	}
	c.n--
	c.ch <- true
}

func (c *Cond) Broadcast() {
	n := c.n
	c.n = 0
	for i := 0; i < n; i++ {
		c.ch <- true
	}
}
