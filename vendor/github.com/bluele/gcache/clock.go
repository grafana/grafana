package gcache

import (
	"sync"
	"time"
)

type Clock interface {
	Now() time.Time
}

type RealClock struct{}

func NewRealClock() Clock {
	return RealClock{}
}

func (rc RealClock) Now() time.Time {
	t := time.Now()
	return t
}

type FakeClock interface {
	Clock

	Advance(d time.Duration)
}

func NewFakeClock() FakeClock {
	return &fakeclock{
		// Taken from github.com/jonboulle/clockwork: use a fixture that does not fulfill Time.IsZero()
		now: time.Date(1984, time.April, 4, 0, 0, 0, 0, time.UTC),
	}
}

type fakeclock struct {
	now time.Time

	mutex sync.RWMutex
}

func (fc *fakeclock) Now() time.Time {
	fc.mutex.RLock()
	defer fc.mutex.RUnlock()
	t := fc.now
	return t
}

func (fc *fakeclock) Advance(d time.Duration) {
	fc.mutex.Lock()
	defer fc.mutex.Unlock()
	fc.now = fc.now.Add(d)
}
