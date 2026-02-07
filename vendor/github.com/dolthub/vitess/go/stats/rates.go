/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package stats

import (
	"encoding/json"
	"math"
	"sync"
	"time"
)

var timeNow = time.Now

// CountTracker defines the interface that needs to
// be supported by a variable for being tracked by
// Rates.
type CountTracker interface {
	// Counts returns a map which maps each category to a count.
	// Subsequent calls must return a monotonously increasing count for the same
	// category.
	// Optionally, an implementation may include the "All" category which has
	// the total count across all categories (e.g. timing.go does this).
	Counts() map[string]int64
}

// wrappedCountTracker implements the CountTracker interface.
// It is used in multidimensional.go to publish specific, one-dimensional
// counters.
type wrappedCountTracker struct {
	f func() map[string]int64
}

func (t wrappedCountTracker) Counts() map[string]int64 { return t.f() }

// Rates is capable of reporting the rate (typically QPS)
// for any variable that satisfies the CountTracker interface.
type Rates struct {
	// mu guards all fields.
	mu           sync.Mutex
	timeStamps   *RingInt64
	counts       map[string]*RingInt64
	countTracker CountTracker
	samples      int
	interval     time.Duration
	// previousTotalCount is the total number of counts (across all categories)
	// seen in the last sampling interval.
	// It's used to calculate the latest total rate.
	previousTotalCount int64
	// timestampLastSampling is the time the periodic sampling was run last.
	timestampLastSampling time.Time
	// totalRate is the rate of total counts per second seen in the latest
	// sampling interval e.g. 100 queries / 5 seconds sampling interval = 20 QPS.
	totalRate float64
}

// NewRates reports rolling rate information for countTracker. samples specifies
// the number of samples to report, and interval specifies the time interval
// between samples. The minimum interval is 1 second.
// If passing the special value of -1s as interval, we don't snapshot.
// (use this for tests).
func NewRates(name string, countTracker CountTracker, samples int, interval time.Duration) *Rates {
	if interval < 1*time.Second && interval != -1*time.Second {
		panic("interval too small")
	}
	rt := &Rates{
		timeStamps:            NewRingInt64(samples + 1),
		counts:                make(map[string]*RingInt64),
		countTracker:          countTracker,
		samples:               samples + 1,
		interval:              interval,
		timestampLastSampling: timeNow(),
	}
	if name != "" {
		publish(name, rt)
	}
	if interval > 0 {
		go rt.track()
	}
	return rt
}

func (rt *Rates) track() {
	for {
		rt.snapshot()
		<-time.After(rt.interval)
	}
}

func (rt *Rates) snapshot() {
	rt.mu.Lock()
	defer rt.mu.Unlock()

	now := timeNow()
	rt.timeStamps.Add(now.UnixNano())

	// Record current count for each category.
	var totalCount int64
	for k, v := range rt.countTracker.Counts() {
		if k != "All" {
			// Include call categories except "All" (which is returned by the
			// "Timer.Counts()" implementation) to avoid double counting.
			totalCount += v
		}
		if values, ok := rt.counts[k]; ok {
			values.Add(v)
		} else {
			rt.counts[k] = NewRingInt64(rt.samples)
			rt.counts[k].Add(0)
			rt.counts[k].Add(v)
		}
	}

	// Calculate current total rate.
	// NOTE: We assume that every category with a non-zero value, which was
	// tracked in "rt.previousTotalCount" in a previous sampling interval, is
	// tracked in the current sampling interval in "totalCount" as well.
	// (I.e. categories and their count must not "disappear" in
	//  "rt.countTracker.Counts()".)
	durationSeconds := now.Sub(rt.timestampLastSampling).Seconds()
	rate := float64(totalCount-rt.previousTotalCount) / durationSeconds
	// Round rate with a precision of 0.1.
	rt.totalRate = math.Floor(rate*10+0.5) / 10
	rt.previousTotalCount = totalCount
	rt.timestampLastSampling = now
}

// Get returns for each category (string) its latest rates (up to X values
// where X is the configured number of samples of the Rates struct).
// Rates are ordered from least recent (index 0) to most recent (end of slice).
func (rt *Rates) Get() (rateMap map[string][]float64) {
	rt.mu.Lock()
	defer rt.mu.Unlock()

	rateMap = make(map[string][]float64)
	timeStamps := rt.timeStamps.Values()
	if len(timeStamps) <= 1 {
		return
	}
	for k, v := range rt.counts {
		rateMap[k] = make([]float64, len(timeStamps)-1)
		values := v.Values()
		valueIndex := len(values) - 1
		for i := len(timeStamps) - 1; i > 0; i-- {
			if valueIndex <= 0 {
				rateMap[k][i-1] = 0
				continue
			}
			elapsed := float64((timeStamps[i] - timeStamps[i-1]) / 1e9)
			rateMap[k][i-1] = float64(values[valueIndex]-values[valueIndex-1]) / elapsed
			valueIndex--
		}
	}
	return
}

// TotalRate returns the current total rate (counted across categories).
func (rt *Rates) TotalRate() float64 {
	rt.mu.Lock()
	defer rt.mu.Unlock()

	return rt.totalRate
}

func (rt *Rates) String() string {
	data, err := json.Marshal(rt.Get())
	if err != nil {
		data, _ = json.Marshal(err.Error())
	}
	return string(data)
}

type RatesFunc struct {
	F    func() map[string][]float64
	help string
}

func NewRateFunc(name string, help string, f func() map[string][]float64) *RatesFunc {
	c := &RatesFunc{
		F:    f,
		help: help,
	}

	if name != "" {
		publish(name, c)
	}
	return c
}

func (rf *RatesFunc) Help() string {
	return rf.help
}

func (rf *RatesFunc) String() string {
	data, err := json.Marshal(rf.F())
	if err != nil {
		data, _ = json.Marshal(err.Error())
	}
	return string(data)
}
