package roaring64

import (
	"fmt"
	"runtime"

	"github.com/RoaringBitmap/roaring/v2"
)

var defaultWorkerCount = runtime.NumCPU()

// ParOr computes the union (OR) of all provided bitmaps in parallel,
// where the parameter "parallelism" determines how many workers are to be used
// (if it is set to 0, a default number of workers is chosen)
func ParOr(parallelism int, bitmaps ...*Bitmap) *Bitmap {
	var lKey uint32 = maxUint32
	var hKey uint32

	bitmapsFiltered := bitmaps[:0]
	for _, b := range bitmaps {
		if !b.IsEmpty() {
			bitmapsFiltered = append(bitmapsFiltered, b)
		}
	}
	bitmaps = bitmapsFiltered

	for _, b := range bitmaps {
		lKey = minOfUint32(lKey, b.highlowcontainer.keys[0])
		hKey = maxOfUint32(hKey, b.highlowcontainer.keys[b.highlowcontainer.size()-1])
	}

	if lKey == maxUint32 && hKey == 0 {
		return New()
	} else if len(bitmaps) == 1 {
		return bitmaps[0]
	}
	// The following might overflow and we do not want that!
	// as it might lead to a channel of size 0 later which,
	// on some systems, would block indefinitely.
	keyRange := uint64(hKey) - uint64(lKey) + 1
	if keyRange == 1 {
		// revert to FastOr. Since the key range is 0
		// no container-level aggregation parallelism is achievable
		return FastOr(bitmaps...)
	}

	if parallelism == 0 {
		parallelism = defaultWorkerCount
	}
	// We cannot use int since int is 32-bit on 32-bit systems.
	var chunkSize int64
	var chunkCount int64
	if int64(parallelism)*4 > int64(keyRange) {
		chunkSize = 1
		chunkCount = int64(keyRange)
	} else {
		chunkCount = int64(parallelism) * 4
		chunkSize = (int64(keyRange) + chunkCount - 1) / chunkCount
	}

	if chunkCount*chunkSize < int64(keyRange) {
		// it's fine to panic to indicate an implementation error
		panic(fmt.Sprintf("invariant check failed: chunkCount * chunkSize < keyRange, %d * %d < %d", chunkCount, chunkSize, keyRange))
	}

	chunks := make([]*roaringArray64, chunkCount)

	chunkSpecChan := make(chan parChunkSpec, minOfInt(maxOfInt(64, 2*parallelism), int(chunkCount)))
	chunkChan := make(chan parChunk, minOfInt(32, int(chunkCount)))

	orFunc := func() {
		for spec := range chunkSpecChan {
			ra := orOnRange(&bitmaps[0].highlowcontainer, &bitmaps[1].highlowcontainer, spec.start, spec.end)
			for _, b := range bitmaps[2:] {
				ra = iorOnRange(ra, &b.highlowcontainer, spec.start, spec.end)
			}

			chunkChan <- parChunk{ra, spec.idx}
		}
	}

	for i := 0; i < parallelism; i++ {
		go orFunc()
	}

	go func() {
		for i := int64(0); i < chunkCount; i++ {
			spec := parChunkSpec{
				start: uint32(int64(lKey) + i*chunkSize),
				end:   uint32(minOfInt64(int64(lKey)+(i+1)*chunkSize-1, int64(hKey))),
				idx:   int(i),
			}
			chunkSpecChan <- spec
		}
	}()

	chunksRemaining := chunkCount
	for chunk := range chunkChan {
		chunks[chunk.idx] = chunk.ra
		chunksRemaining--
		if chunksRemaining == 0 {
			break
		}
	}
	close(chunkChan)
	close(chunkSpecChan)

	containerCount := 0
	for _, chunk := range chunks {
		containerCount += chunk.size()
	}

	result := Bitmap{
		roaringArray64{
			containers:      make([]*roaring.Bitmap, containerCount),
			keys:            make([]uint32, containerCount),
			needCopyOnWrite: make([]bool, containerCount),
		},
	}

	resultOffset := 0
	for _, chunk := range chunks {
		copy(result.highlowcontainer.containers[resultOffset:], chunk.containers)
		copy(result.highlowcontainer.keys[resultOffset:], chunk.keys)
		copy(result.highlowcontainer.needCopyOnWrite[resultOffset:], chunk.needCopyOnWrite)
		resultOffset += chunk.size()
	}

	return &result
}

type parChunkSpec struct {
	start uint32
	end   uint32
	idx   int
}

type parChunk struct {
	ra  *roaringArray64
	idx int
}

func (c parChunk) size() int {
	return c.ra.size()
}

// parNaiveStartAt returns the index of the first key that is inclusive between start and last
// Returns the size if there is no such key
func parNaiveStartAt(ra *roaringArray64, start uint32, last uint32) int {
	for idx, key := range ra.keys {
		if key >= start && key <= last {
			return idx
		} else if key > last {
			break
		}
	}
	return ra.size()
}

func orOnRange(ra1, ra2 *roaringArray64, start, last uint32) *roaringArray64 {
	answer := &roaringArray64{}
	length1 := ra1.size()
	length2 := ra2.size()

	idx1 := parNaiveStartAt(ra1, start, last)
	idx2 := parNaiveStartAt(ra2, start, last)

	var key1 uint32
	var key2 uint32
	if idx1 < length1 && idx2 < length2 {
		key1 = ra1.getKeyAtIndex(idx1)
		key2 = ra2.getKeyAtIndex(idx2)

		for key1 <= last && key2 <= last {
			if key1 < key2 {
				answer.appendCopy(*ra1, idx1)
				idx1++
				if idx1 == length1 {
					break
				}
				key1 = ra1.getKeyAtIndex(idx1)
			} else if key1 > key2 {
				answer.appendCopy(*ra2, idx2)
				idx2++
				if idx2 == length2 {
					break
				}
				key2 = ra2.getKeyAtIndex(idx2)
			} else {
				c1 := ra1.getContainerAtIndex(idx1)

				// answer.appendContainer(key1, c1.lazyOR(ra2.getContainerAtIndex(idx2)), false)
				answer.appendContainer(key1, roaring.Or(c1, ra2.getContainerAtIndex(idx2)), false)
				idx1++
				idx2++
				if idx1 == length1 || idx2 == length2 {
					break
				}

				key1 = ra1.getKeyAtIndex(idx1)
				key2 = ra2.getKeyAtIndex(idx2)
			}
		}
	}

	if idx2 < length2 {
		key2 = ra2.getKeyAtIndex(idx2)
		for key2 <= last {
			answer.appendCopy(*ra2, idx2)
			idx2++
			if idx2 == length2 {
				break
			}
			key2 = ra2.getKeyAtIndex(idx2)
		}
	}

	if idx1 < length1 {
		key1 = ra1.getKeyAtIndex(idx1)
		for key1 <= last {
			answer.appendCopy(*ra1, idx1)
			idx1++
			if idx1 == length1 {
				break
			}
			key1 = ra1.getKeyAtIndex(idx1)
		}
	}
	return answer
}

func iorOnRange(ra1, ra2 *roaringArray64, start, last uint32) *roaringArray64 {
	length1 := ra1.size()
	length2 := ra2.size()

	idx1 := 0
	idx2 := parNaiveStartAt(ra2, start, last)

	var key1 uint32
	var key2 uint32
	if idx1 < length1 && idx2 < length2 {
		key1 = ra1.getKeyAtIndex(idx1)
		key2 = ra2.getKeyAtIndex(idx2)

		for key1 <= last && key2 <= last {
			if key1 < key2 {
				idx1++
				if idx1 >= length1 {
					break
				}
				key1 = ra1.getKeyAtIndex(idx1)
			} else if key1 > key2 {
				ra1.insertNewKeyValueAt(idx1, key2, ra2.getContainerAtIndex(idx2))
				ra1.needCopyOnWrite[idx1] = true
				idx2++
				idx1++
				length1++
				if idx2 >= length2 {
					break
				}
				key2 = ra2.getKeyAtIndex(idx2)
			} else {
				c1 := ra1.getWritableContainerAtIndex(idx1)

				// ra1.containers[idx1] = c1.lazyIOR(ra2.getContainerAtIndex(idx2))
				c1.Or(ra2.getContainerAtIndex(idx2))
				ra1.setContainerAtIndex(idx1, c1)

				ra1.needCopyOnWrite[idx1] = false
				idx1++
				idx2++
				if idx1 >= length1 || idx2 >= length2 {
					break
				}

				key1 = ra1.getKeyAtIndex(idx1)
				key2 = ra2.getKeyAtIndex(idx2)
			}
		}
	}
	if idx2 < length2 {
		key2 = ra2.getKeyAtIndex(idx2)
		for key2 <= last {
			ra1.appendCopy(*ra2, idx2)
			idx2++
			if idx2 >= length2 {
				break
			}
			key2 = ra2.getKeyAtIndex(idx2)
		}
	}
	return ra1
}
