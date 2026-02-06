package orderedmap

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"

	"github.com/google/go-cmp/cmp"
)

func SortStrings(i string, j string) bool {
	return i < j
}

type Pair[K, V any] struct {
	Key   K
	Value V
}

type Map[K comparable, V any] struct {
	records map[K]V
	order   []K
}

func FromMap[K string, V any](original map[K]V) *Map[K, V] {
	orderedMap := New[K, V]()

	keys := make([]K, 0, len(original))
	for key := range original {
		keys = append(keys, key)
	}

	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })

	for _, k := range keys {
		orderedMap.Set(k, original[k])
	}

	return orderedMap
}

func New[K comparable, V any]() *Map[K, V] {
	return &Map[K, V]{
		records: make(map[K]V),
	}
}

func (orderedMap *Map[K, V]) Set(key K, value V) {
	if _, found := orderedMap.records[key]; !found {
		orderedMap.order = append(orderedMap.order, key)
	}

	orderedMap.records[key] = value
}

func (orderedMap *Map[K, V]) Get(key K) V {
	return orderedMap.records[key]
}

func (orderedMap *Map[K, V]) At(index int) V {
	return orderedMap.records[orderedMap.order[index]]
}

func (orderedMap *Map[K, V]) Has(key K) bool {
	_, exists := orderedMap.records[key]
	return exists
}

func (orderedMap *Map[K, V]) Remove(key K) {
	delete(orderedMap.records, key)

	newOrder := make([]K, 0, len(orderedMap.order)-1)
	for _, elem := range orderedMap.order {
		if elem == key {
			continue
		}

		newOrder = append(newOrder, elem)
	}

	orderedMap.order = newOrder
}

func (orderedMap *Map[K, V]) Len() int {
	return len(orderedMap.order)
}

func (orderedMap *Map[K, V]) Iterate(callback func(key K, value V)) {
	for _, key := range orderedMap.order {
		callback(key, orderedMap.records[key])
	}
}

func (orderedMap *Map[K, V]) Map(callback func(key K, value V) V) *Map[K, V] {
	newMap := New[K, V]()
	for _, key := range orderedMap.order {
		newMap.Set(key, callback(key, orderedMap.records[key]))
	}
	return newMap
}

func (orderedMap *Map[K, V]) Filter(callback func(key K, value V) bool) *Map[K, V] {
	newMap := New[K, V]()
	for _, key := range orderedMap.order {
		if callback(key, orderedMap.records[key]) {
			newMap.Set(key, orderedMap.records[key])
		}
	}
	return newMap
}

func (orderedMap *Map[K, V]) Values() []V {
	values := make([]V, 0, orderedMap.Len())
	for _, key := range orderedMap.order {
		values = append(values, orderedMap.records[key])
	}
	return values
}

func (orderedMap *Map[K, V]) Equal(other *Map[K, V]) bool {
	return cmp.Equal(orderedMap.order, other.order) &&
		cmp.Equal(orderedMap.records, other.records)
}

// Sort sorts the keys using the provided less function, keeping equal elements
// in their original order.
func (orderedMap *Map[K, V]) Sort(lessFunc func(i K, j K) bool) {
	sort.SliceStable(orderedMap.order, func(i, j int) bool {
		return lessFunc(orderedMap.order[i], orderedMap.order[j])
	})
}

func (orderedMap *Map[K, V]) MarshalJSON() ([]byte, error) {
	var err error
	buffer := bytes.Buffer{}
	encoder := json.NewEncoder(&buffer)

	buffer.WriteByte('{')

	i := 0
	orderedMap.Iterate(func(key K, value V) {
		if innerErr := encoder.Encode(key); innerErr != nil {
			err = innerErr
			return
		}

		buffer.WriteByte(':')

		if innerErr := encoder.Encode(value); innerErr != nil {
			err = innerErr
			return
		}

		if i != orderedMap.Len()-1 {
			buffer.WriteByte(',')
		}

		i++
	})
	if err != nil {
		return nil, err
	}

	buffer.WriteByte('}')

	return buffer.Bytes(), nil
}

// FIXME: does not preserve order
func (orderedMap *Map[K, V]) UnmarshalJSON(raw []byte) error {
	if orderedMap.records == nil {
		orderedMap.records = make(map[K]V)
	}

	decoder := json.NewDecoder(bytes.NewReader(raw))

	// must open with a delim token '{'
	t, err := decoder.Token()
	if err != nil {
		return err
	}
	if delim, ok := t.(json.Delim); !ok || delim != '{' {
		return fmt.Errorf("expect JSON object open with '{'")
	}

	for decoder.More() {
		t, err = decoder.Token()
		if err != nil {
			return err
		}

		key, ok := t.(K)
		if !ok {
			return fmt.Errorf("type mismatch for JSON key: %T: %v", t, t)
		}

		var value V
		if err = decoder.Decode(&value); err != nil {
			return err
		}

		orderedMap.Set(key, value)
	}

	t, err = decoder.Token()
	if err != nil {
		return err
	}
	if delim, ok := t.(json.Delim); !ok || delim != '}' {
		return fmt.Errorf("expected JSON object to end with '}'")
	}

	t, err = decoder.Token()
	if !errors.Is(err, io.EOF) {
		return fmt.Errorf("expect end of JSON object but got more token: %T: %v or err: %w", t, t, err)
	}

	return nil
}
