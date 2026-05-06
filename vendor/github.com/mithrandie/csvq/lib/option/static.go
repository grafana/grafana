package option

import (
	"fmt"
	"math/rand"
	"sync"
	"time"
)

var (
	TestTime  time.Time // For Tests
	Timezones = NewTimezoneMap()

	random  *rand.Rand
	getRand sync.Once
)

func GetRand() *rand.Rand {
	getRand.Do(func() {
		random = rand.New(rand.NewSource(time.Now().UnixNano()))
	})
	return random
}

func GetLocation(timezone string) (*time.Location, error) {
	return Timezones.Get(timezone)
}

func Now(location *time.Location) time.Time {
	if !TestTime.IsZero() {
		return TestTime
	}
	return time.Now().In(location)
}

type TimezoneMap struct {
	m   *sync.Map
	mtx *sync.Mutex
}

func NewTimezoneMap() TimezoneMap {
	return TimezoneMap{
		m:   &sync.Map{},
		mtx: &sync.Mutex{},
	}
}

func (tzmap TimezoneMap) store(key string, value *time.Location) {
	tzmap.m.Store(key, value)
}

func (tzmap TimezoneMap) load(key string) (*time.Location, bool) {
	v, ok := tzmap.m.Load(key)
	if ok {
		return v.(*time.Location), ok
	}
	return nil, ok
}

func (tzmap TimezoneMap) Get(timezone string) (*time.Location, error) {
	if v, ok := tzmap.load(timezone); ok {
		return v, nil
	}

	tzmap.mtx.Lock()
	defer tzmap.mtx.Unlock()

	if v, ok := tzmap.load(timezone); ok {
		return v, nil
	}

	l, err := time.LoadLocation(timezone)
	if err != nil {
		return nil, fmt.Errorf("timezone %q does not exist", timezone)
	}

	tzmap.store(timezone, l)
	return l, nil
}
