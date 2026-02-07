package query

import (
	"context"
	"math"
	"sync"
)

var (
	gm    *GoroutineManager
	getGm sync.Once
)

const MinimumRequiredPerCPUCore = 80

func GetGoroutineManager() *GoroutineManager {
	getGm.Do(func() {
		gm = &GoroutineManager{
			Count:                  0,
			CountMutex:             &sync.Mutex{},
			MinimumRequiredPerCore: MinimumRequiredPerCPUCore,
		}
	})
	return gm
}

type GoroutineManager struct {
	Count                  int
	CountMutex             *sync.Mutex
	MinimumRequiredPerCore int
}

func (m *GoroutineManager) AssignRoutineNumber(recordLen int, minimumRequiredPerCore int, cpuNum int) int {
	var greaterThanZero = func(i int) int {
		if i < 1 {
			return 1
		}
		return i
	}
	var min = func(i1 int, i2 int) int {
		if i1 < i2 {
			return i1
		}
		return i2
	}

	number := cpuNum
	if minimumRequiredPerCore < 1 {
		minimumRequiredPerCore = m.MinimumRequiredPerCore
	}

	number = min(number, greaterThanZero(int(math.Floor(float64(recordLen)/float64(minimumRequiredPerCore)))))

	m.CountMutex.Lock()
	defer m.CountMutex.Unlock()

	number = min(number, greaterThanZero(number-m.Count))

	m.Count += number - 1
	return number
}

func (m *GoroutineManager) Release() {
	m.CountMutex.Lock()
	if 0 < m.Count {
		m.Count--
	}
	m.CountMutex.Unlock()
}

type GoroutineTaskManager struct {
	Number int

	grTaskMutex *sync.Mutex
	grCount     int
	recordLen   int
	waitGroup   sync.WaitGroup
	err         error
}

func NewGoroutineTaskManager(recordLen int, minimumRequiredPerCore int, cpuNum int) *GoroutineTaskManager {
	number := GetGoroutineManager().AssignRoutineNumber(recordLen, minimumRequiredPerCore, cpuNum)

	return &GoroutineTaskManager{
		Number:      number,
		grTaskMutex: &sync.Mutex{},
		grCount:     number - 1,
		recordLen:   recordLen,
	}
}

func (m *GoroutineTaskManager) HasError() bool {
	return m.err != nil
}

func (m *GoroutineTaskManager) SetError(e error) {
	m.grTaskMutex.Lock()
	if m.err == nil {
		m.err = e
	}
	m.grTaskMutex.Unlock()
}

func (m *GoroutineTaskManager) Err() error {
	return m.err
}

func (m *GoroutineTaskManager) RecordRange(routineIndex int) (int, int) {
	calcLen := m.recordLen / m.Number

	var start = routineIndex * calcLen

	if m.recordLen <= start {
		return 0, 0
	}

	var end int
	if routineIndex == m.Number-1 {
		end = m.recordLen
	} else {
		end = (routineIndex + 1) * calcLen
	}
	return start, end
}

func (m *GoroutineTaskManager) Add() {
	m.waitGroup.Add(1)
}

func (m *GoroutineTaskManager) Done() {
	m.grTaskMutex.Lock()
	if 0 < m.grCount {
		m.grCount--
		GetGoroutineManager().Release()
	}
	m.grTaskMutex.Unlock()

	m.waitGroup.Done()
}

func (m *GoroutineTaskManager) Wait() {
	m.waitGroup.Wait()
}

func (m *GoroutineTaskManager) run(ctx context.Context, fn func(int) error, thIdx int) {
	defer func() {
		if !m.HasError() {
			if panicReport := recover(); panicReport != nil {
				m.SetError(NewFatalError(panicReport))
			}
		}

		if 1 < m.Number {
			m.Done()
		}
	}()

	start, end := m.RecordRange(thIdx)

	for i := start; i < end; i++ {
		if m.HasError() {
			break
		}
		if i&15 == 0 && ctx.Err() != nil {
			break
		}

		if err := fn(i); err != nil {
			m.SetError(err)
			break
		}
	}
}

func (m *GoroutineTaskManager) Run(ctx context.Context, fn func(int) error) error {
	if 1 < m.Number {
		for i := 0; i < m.Number; i++ {
			m.Add()
			go m.run(ctx, fn, i)
		}
		m.Wait()
	} else {
		m.run(ctx, fn, 0)
	}

	if m.HasError() {
		return m.Err()
	}
	if ctx.Err() != nil {
		return ConvertContextError(ctx.Err())
	}
	return nil
}
