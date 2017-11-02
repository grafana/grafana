package streams

import (
	"math"
	"strconv"
	"sync/atomic"
)

const bucketBits = 64

// IDGenerator tracks and allocates streams which are in use.
type IDGenerator struct {
	NumStreams   int
	inuseStreams int32
	numBuckets   uint32

	// streams is a bitset where each bit represents a stream, a 1 implies in use
	streams []uint64
	offset  uint32
}

func New(protocol int) *IDGenerator {
	maxStreams := 128
	if protocol > 2 {
		maxStreams = 32768
	}

	buckets := maxStreams / 64
	// reserve stream 0
	streams := make([]uint64, buckets)
	streams[0] = 1 << 63

	return &IDGenerator{
		NumStreams: maxStreams,
		streams:    streams,
		numBuckets: uint32(buckets),
		offset:     uint32(buckets) - 1,
	}
}

func streamFromBucket(bucket, streamInBucket int) int {
	return (bucket * bucketBits) + streamInBucket
}

func (s *IDGenerator) GetStream() (int, bool) {
	// based closely on the java-driver stream ID generator
	// avoid false sharing subsequent requests.
	offset := atomic.LoadUint32(&s.offset)
	for !atomic.CompareAndSwapUint32(&s.offset, offset, (offset+1)%s.numBuckets) {
		offset = atomic.LoadUint32(&s.offset)
	}
	offset = (offset + 1) % s.numBuckets

	for i := uint32(0); i < s.numBuckets; i++ {
		pos := int((i + offset) % s.numBuckets)

		bucket := atomic.LoadUint64(&s.streams[pos])
		if bucket == math.MaxUint64 {
			// all streams in use
			continue
		}

		for j := 0; j < bucketBits; j++ {
			mask := uint64(1 << streamOffset(j))
			for bucket&mask == 0 {
				if atomic.CompareAndSwapUint64(&s.streams[pos], bucket, bucket|mask) {
					atomic.AddInt32(&s.inuseStreams, 1)
					return streamFromBucket(int(pos), j), true
				}
				bucket = atomic.LoadUint64(&s.streams[pos])
			}
		}
	}

	return 0, false
}

func bitfmt(b uint64) string {
	return strconv.FormatUint(b, 16)
}

// returns the bucket offset of a given stream
func bucketOffset(i int) int {
	return i / bucketBits
}

func streamOffset(stream int) uint64 {
	return bucketBits - uint64(stream%bucketBits) - 1
}

func isSet(bits uint64, stream int) bool {
	return bits>>streamOffset(stream)&1 == 1
}

func (s *IDGenerator) isSet(stream int) bool {
	bits := atomic.LoadUint64(&s.streams[bucketOffset(stream)])
	return isSet(bits, stream)
}

func (s *IDGenerator) String() string {
	size := s.numBuckets * (bucketBits + 1)
	buf := make([]byte, 0, size)
	for i := 0; i < int(s.numBuckets); i++ {
		bits := atomic.LoadUint64(&s.streams[i])
		buf = append(buf, bitfmt(bits)...)
		buf = append(buf, ' ')
	}
	return string(buf[:size-1 : size-1])
}

func (s *IDGenerator) Clear(stream int) (inuse bool) {
	offset := bucketOffset(stream)
	bucket := atomic.LoadUint64(&s.streams[offset])

	mask := uint64(1) << streamOffset(stream)
	if bucket&mask != mask {
		// already cleared
		return false
	}

	for !atomic.CompareAndSwapUint64(&s.streams[offset], bucket, bucket & ^mask) {
		bucket = atomic.LoadUint64(&s.streams[offset])
		if bucket&mask != mask {
			// already cleared
			return false
		}
	}

	// TODO: make this account for 0 stream being reserved
	if atomic.AddInt32(&s.inuseStreams, -1) < 0 {
		// TODO(zariel): remove this
		panic("negative streams inuse")
	}

	return true
}

func (s *IDGenerator) Available() int {
	return s.NumStreams - int(atomic.LoadInt32(&s.inuseStreams)) - 1
}
