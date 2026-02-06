package util

import (
	"encoding/binary"
	"math/rand/v2"
)

func Shuffle(n int, swap func(i, j int)) {
	rand.Shuffle(n, swap)
}

func FastRand(n int) int {
	return rand.IntN(n)
}

func RandomBytes() []byte {
	val := make([]byte, 24)
	binary.BigEndian.PutUint64(val[0:8], rand.Uint64())
	binary.BigEndian.PutUint64(val[8:16], rand.Uint64())
	binary.BigEndian.PutUint64(val[16:24], rand.Uint64())
	return val
}
