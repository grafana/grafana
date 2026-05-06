package tempopb

import (
	"os"
	"strconv"

	"github.com/grafana/tempo/pkg/pool"
)

var bytePool *pool.Pool

func init() {
	bktSize := intFromEnv("PREALLOC_BKT_SIZE", 400)
	numBuckets := intFromEnv("PREALLOC_NUM_BUCKETS", 250)
	minBucket := intFromEnv("PREALLOC_MIN_BUCKET", 0)

	bytePool = pool.New("ingester_prealloc", minBucket, numBuckets, bktSize)
}

// PreallocBytes is a (repeated bytes slices) which preallocs slices on Unmarshal.
type PreallocBytes struct {
	Slice []byte
}

// Unmarshal implements proto.Message.
func (r *PreallocBytes) Unmarshal(dAtA []byte) error {
	r.Slice = bytePool.Get(len(dAtA))
	r.Slice = r.Slice[:len(dAtA)]
	copy(r.Slice, dAtA)
	return nil
}

// MarshalTo implements proto.Marshaller.
// returned int is not used
func (r *PreallocBytes) MarshalTo(dAtA []byte) (int, error) {
	copy(dAtA[:], r.Slice[:])
	return len(r.Slice), nil
}

// Size implements proto.Sizer.
func (r *PreallocBytes) Size() (n int) {
	if r == nil {
		return 0
	}
	return len(r.Slice)
}

// ReuseByteSlices puts the byte slice back into bytePool for reuse.
func ReuseByteSlices(buffs [][]byte) {
	for _, b := range buffs {
		_ = bytePool.Put(b[:0])
	}
}

func intFromEnv(env string, defaultValue int) int {
	// get the value from the environment
	val, ok := os.LookupEnv(env)
	if !ok {
		return defaultValue
	}

	// try to parse the value
	intVal, err := strconv.Atoi(val)
	if err != nil {
		panic("failed to parse " + env + " as int")
	}

	return intVal
}
