package internal

import (
	"math/bits"
	"time"

	"github.com/Yiling-J/theine-go/internal/clock"
)

func next2Power(x uint) uint {
	x--
	x |= x >> 1
	x |= x >> 2
	x |= x >> 4
	x |= x >> 8
	x |= x >> 16
	x |= x >> 32
	x++
	return x
}

type TimerWheel[K comparable, V any] struct {
	clock   *clock.Clock
	buckets []uint
	spans   []uint
	shift   []uint
	wheel   [][]*List[K, V]
	nanos   int64
}

func NewTimerWheel[K comparable, V any](size uint) *TimerWheel[K, V] {
	clock := &clock.Clock{Start: time.Now()}
	buckets := []uint{64, 64, 32, 4, 1}
	spans := []uint{
		next2Power(uint((1 * time.Second).Nanoseconds())),
		next2Power(uint((1 * time.Minute).Nanoseconds())),
		next2Power(uint((1 * time.Hour).Nanoseconds())),
		next2Power(uint((24 * time.Hour).Nanoseconds())),
		next2Power(uint((24 * time.Hour).Nanoseconds())) * 4,
		next2Power(uint((24 * time.Hour).Nanoseconds())) * 4,
	}

	shift := []uint{
		uint(bits.TrailingZeros(spans[0])),
		uint(bits.TrailingZeros(spans[1])),
		uint(bits.TrailingZeros(spans[2])),
		uint(bits.TrailingZeros(spans[3])),
		uint(bits.TrailingZeros(spans[4])),
	}

	wheel := [][]*List[K, V]{}
	for i := 0; i < 5; i++ {
		tmp := []*List[K, V]{}
		for j := 0; j < int(buckets[i]); j++ {
			tmp = append(tmp, NewList[K, V](0, WHEEL_LIST))
		}
		wheel = append(wheel, tmp)
	}

	return &TimerWheel[K, V]{
		buckets: buckets,
		spans:   spans,
		shift:   shift,
		wheel:   wheel,
		nanos:   clock.NowNano(),
		clock:   clock,
	}
}

func (tw *TimerWheel[K, V]) findIndex(expire int64) (int, int) {
	duration := expire - tw.nanos
	for i := 0; i < 5; i++ {
		if duration < int64(tw.spans[i+1]) {
			ticks := expire >> int(tw.shift[i])
			slot := int(ticks) & (int(tw.buckets[i]) - 1)
			return i, slot
		}
	}
	return 4, 0
}

func (tw *TimerWheel[K, V]) deschedule(entry *Entry[K, V]) {
	entry.prev(WHEEL_LIST).setNext(entry.next(WHEEL_LIST), WHEEL_LIST)
	entry.next(WHEEL_LIST).setPrev(entry.prev(WHEEL_LIST), WHEEL_LIST)
	entry.setNext(nil, WHEEL_LIST)
	entry.setPrev(nil, WHEEL_LIST)
}

func (tw *TimerWheel[K, V]) schedule(entry *Entry[K, V]) {
	if entry.meta.wheelPrev != nil {
		tw.deschedule(entry)
	}
	x, y := tw.findIndex(entry.expire.Load())
	tw.wheel[x][y].PushFront(entry)
}

func (tw *TimerWheel[K, V]) advance(now int64, remove func(entry *Entry[K, V], reason RemoveReason)) {
	if now == 0 {
		now = tw.clock.NowNano()
	}
	previous := tw.nanos
	tw.nanos = now

	for i := 0; i < 5; i++ {
		prevTicks := previous >> int64(tw.shift[i])
		currentTicks := tw.nanos >> int64(tw.shift[i])
		if currentTicks <= prevTicks {
			break
		}
		tw.expire(i, prevTicks, currentTicks-prevTicks, remove)
	}
}

func (tw *TimerWheel[K, V]) expire(index int, prevTicks int64, delta int64, remove func(entry *Entry[K, V], reason RemoveReason)) {
	mask := tw.buckets[index] - 1
	steps := min(uint(1+int(delta)), tw.buckets[index])
	start := prevTicks & int64(mask)
	end := start + int64(steps)
	for i := start; i < end; i++ {
		list := tw.wheel[index][i&int64(mask)]
		entry := list.Front()
		for entry != nil {
			next := entry.Next(WHEEL_LIST)
			if entry.expire.Load() <= tw.nanos {
				tw.deschedule(entry)
				remove(entry, EXPIRED)
			} else {
				tw.schedule(entry)
			}
			entry = next
		}
	}
}
