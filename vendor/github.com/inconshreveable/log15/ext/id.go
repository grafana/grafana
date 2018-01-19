package ext

import (
	"fmt"
	"math/rand"
	"sync"
	"time"
)

var r = rand.New(&lockedSource{src: rand.NewSource(time.Now().Unix())})

// RandId creates a random identifier of the requested length.
// Useful for assigning mostly-unique identifiers for logging
// and identification that are unlikely to collide because of
// short lifespan or low set cardinality
func RandId(idlen int) string {
	b := make([]byte, idlen)
	var randVal uint32
	for i := 0; i < idlen; i++ {
		byteIdx := i % 4
		if byteIdx == 0 {
			randVal = r.Uint32()
		}
		b[i] = byte((randVal >> (8 * uint(byteIdx))) & 0xFF)
	}
	return fmt.Sprintf("%x", b)
}

// lockedSource is a wrapper to allow a rand.Source to be used
// concurrently (same type as the one used internally in math/rand).
type lockedSource struct {
	lk  sync.Mutex
	src rand.Source
}

func (r *lockedSource) Int63() (n int64) {
	r.lk.Lock()
	n = r.src.Int63()
	r.lk.Unlock()
	return
}

func (r *lockedSource) Seed(seed int64) {
	r.lk.Lock()
	r.src.Seed(seed)
	r.lk.Unlock()
}
