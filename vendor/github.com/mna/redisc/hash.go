package redisc

import (
	"sort"
	"strings"
)

// Slot returns the hash slot for the key.
func Slot(key string) int {
	if start := strings.Index(key, "{"); start >= 0 {
		if end := strings.Index(key[start+1:], "}"); end > 0 { // if end == 0, then it's {}, so we ignore it
			end += start + 1
			key = key[start+1 : end]
		}
	}
	return int(crc16(key) % hashSlots)
}

// SplitBySlot takes a list of keys and returns a list of list of keys,
// grouped by identical cluster slot. For example:
//
//     bySlot := SplitBySlot("k1", "k2", "k3")
//     for _, keys := range bySlot {
//       // keys is a list of keys that belong to the same slot
//     }
func SplitBySlot(keys ...string) [][]string {
	var slots []int
	m := make(map[int][]string)
	for _, k := range keys {
		slot := Slot(k)
		_, ok := m[slot]
		m[slot] = append(m[slot], k)

		if !ok {
			slots = append(slots, slot)
		}
	}

	sort.Ints(slots)
	bySlot := make([][]string, 0, len(m))
	for _, slot := range slots {
		bySlot = append(bySlot, m[slot])
	}
	return bySlot
}
