package memstream

import (
	"container/list"
	"time"

	"github.com/centrifugal/centrifuge/internal/saferand"
)

var random = saferand.New(time.Now().UnixNano())

var letters = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

func randString(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = letters[random.Intn(len(letters))]
	}
	return string(b)
}

func genEpoch() string {
	return randString(4)
}

// Item to be kept inside stream.
type Item struct {
	Offset uint64
	Value  any
}

// Stream is a non-thread safe in-memory data structure that
// maintains a stream of values limited by size and provides
// methods to access a range of values from provided position.
type Stream struct {
	top   uint64
	list  *list.List
	index map[uint64]*list.Element
	epoch string
}

// New creates new Stream.
func New() *Stream {
	return &Stream{
		list:  list.New(),
		index: make(map[uint64]*list.Element),
		epoch: genEpoch(),
	}
}

// Add item to stream.
func (s *Stream) Add(v any, size int) (uint64, error) {
	s.top++
	item := Item{
		Offset: s.top,
		Value:  v,
	}
	el := s.list.PushBack(item)
	s.index[item.Offset] = el
	for s.list.Len() > size {
		el := s.list.Front()
		item := el.Value.(Item)
		s.list.Remove(el)
		delete(s.index, item.Offset)
	}
	return s.top, nil
}

// Top returns top of stream.
func (s *Stream) Top() uint64 {
	return s.top
}

// Epoch returns epoch of stream.
func (s *Stream) Epoch() string {
	return s.epoch
}

// Reset stream.
func (s *Stream) Reset() {
	s.top = 0
	s.epoch = genEpoch()
	s.Clear()
}

// Clear stream data.
func (s *Stream) Clear() {
	s.list = list.New()
	s.index = make(map[uint64]*list.Element)
}

// Get items since provided position.
// If seq is zero then elements since current first element in stream will be returned.
func (s *Stream) Get(offset uint64, useOffset bool, limit int, reverse bool) ([]Item, uint64, error) {
	if useOffset && offset >= s.top+1 {
		return nil, s.top, nil
	}

	var el *list.Element
	if useOffset {
		var ok bool
		el, ok = s.index[offset]
		if !ok {
			if reverse {
				el = nil
			} else {
				el = s.list.Front()
			}
		}
	} else {
		if reverse {
			el = s.list.Back()
		} else {
			el = s.list.Front()
		}
	}

	if el == nil || limit == 0 {
		return nil, s.top, nil
	}

	var resultCap int
	if limit > 0 {
		resultCap = limit
		if resultCap > s.list.Len() {
			resultCap = s.list.Len()
		}
	} else {
		resultCap = s.list.Len()
	}

	result := make([]Item, 0, resultCap)

	if reverse {
		item := el.Value.(Item)
		result = append(result, item)
		i := 1
		for e := el.Prev(); e != nil; e = e.Prev() {
			if limit >= 0 && i >= limit {
				break
			}
			i++
			item := e.Value.(Item)
			result = append(result, item)
		}
	} else {
		item := el.Value.(Item)
		result = append(result, item)
		i := 1
		for e := el.Next(); e != nil; e = e.Next() {
			if limit >= 0 && i >= limit {
				break
			}
			i++
			item := e.Value.(Item)
			result = append(result, item)
		}
	}
	return result, s.top, nil
}
