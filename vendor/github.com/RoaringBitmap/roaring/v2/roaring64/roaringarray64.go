package roaring64

import (
	"errors"

	"github.com/RoaringBitmap/roaring/v2"
)

type roaringArray64 struct {
	keys            []uint32
	containers      []*roaring.Bitmap
	needCopyOnWrite []bool
	copyOnWrite     bool
}

var (
	ErrKeySortOrder          = errors.New("keys were out of order")
	ErrCardinalityConstraint = errors.New("size of arrays was not coherent")
)

// runOptimize compresses the element containers to minimize space consumed.
// Q: how does this interact with copyOnWrite and needCopyOnWrite?
// A: since we aren't changing the logical content, just the representation,
//
//	we don't bother to check the needCopyOnWrite bits. We replace
//	(possibly all) elements of ra.containers in-place with space
//	optimized versions.
func (ra *roaringArray64) runOptimize() {
	for i := range ra.containers {
		ra.containers[i].RunOptimize()
	}
}

func (ra *roaringArray64) appendContainer(key uint32, value *roaring.Bitmap, mustCopyOnWrite bool) {
	ra.keys = append(ra.keys, key)
	ra.containers = append(ra.containers, value)
	ra.needCopyOnWrite = append(ra.needCopyOnWrite, mustCopyOnWrite)
}

func (ra *roaringArray64) appendWithoutCopy(sa roaringArray64, startingindex int) {
	mustCopyOnWrite := sa.needCopyOnWrite[startingindex]
	ra.appendContainer(sa.keys[startingindex], sa.containers[startingindex], mustCopyOnWrite)
}

func (ra *roaringArray64) appendCopy(sa roaringArray64, startingindex int) {
	// cow only if the two request it, or if we already have a lightweight copy
	copyonwrite := (ra.copyOnWrite && sa.copyOnWrite) || sa.needsCopyOnWrite(startingindex)
	if !copyonwrite {
		// since there is no copy-on-write, we need to clone the container (this is important)
		ra.appendContainer(sa.keys[startingindex], sa.containers[startingindex].Clone(), copyonwrite)
	} else {
		ra.appendContainer(sa.keys[startingindex], sa.containers[startingindex].Clone(), copyonwrite)
		if !sa.needsCopyOnWrite(startingindex) {
			sa.setNeedsCopyOnWrite(startingindex)
		}
	}
}

func (ra *roaringArray64) appendWithoutCopyMany(sa roaringArray64, startingindex, end int) {
	for i := startingindex; i < end; i++ {
		ra.appendWithoutCopy(sa, i)
	}
}

func (ra *roaringArray64) appendCopyMany(sa roaringArray64, startingindex, end int) {
	for i := startingindex; i < end; i++ {
		ra.appendCopy(sa, i)
	}
}

func (ra *roaringArray64) appendCopiesUntil(sa roaringArray64, stoppingKey uint32) {
	// cow only if the two request it, or if we already have a lightweight copy
	copyonwrite := ra.copyOnWrite && sa.copyOnWrite

	for i := 0; i < sa.size(); i++ {
		if sa.keys[i] >= stoppingKey {
			break
		}
		thiscopyonewrite := copyonwrite || sa.needsCopyOnWrite(i)
		if thiscopyonewrite {
			ra.appendContainer(sa.keys[i], sa.containers[i], thiscopyonewrite)
			if !sa.needsCopyOnWrite(i) {
				sa.setNeedsCopyOnWrite(i)
			}

		} else {
			// since there is no copy-on-write, we need to clone the container (this is important)
			ra.appendContainer(sa.keys[i], sa.containers[i].Clone(), thiscopyonewrite)
		}
	}
}

func (ra *roaringArray64) appendCopiesAfter(sa roaringArray64, beforeStart uint32) {
	// cow only if the two request it, or if we already have a lightweight copy
	copyonwrite := ra.copyOnWrite && sa.copyOnWrite

	startLocation := sa.getIndex(beforeStart)
	if startLocation >= 0 {
		startLocation++
	} else {
		startLocation = -startLocation - 1
	}

	for i := startLocation; i < sa.size(); i++ {
		thiscopyonewrite := copyonwrite || sa.needsCopyOnWrite(i)
		if thiscopyonewrite {
			ra.appendContainer(sa.keys[i], sa.containers[i], thiscopyonewrite)
			if !sa.needsCopyOnWrite(i) {
				sa.setNeedsCopyOnWrite(i)
			}
		} else {
			// since there is no copy-on-write, we need to clone the container (this is important)
			ra.appendContainer(sa.keys[i], sa.containers[i].Clone(), thiscopyonewrite)
		}
	}
}

func (ra *roaringArray64) removeIndexRange(begin, end int) {
	if end <= begin {
		return
	}

	r := end - begin

	copy(ra.keys[begin:], ra.keys[end:])
	copy(ra.containers[begin:], ra.containers[end:])
	copy(ra.needCopyOnWrite[begin:], ra.needCopyOnWrite[end:])

	ra.resize(len(ra.keys) - r)
}

func (ra *roaringArray64) resize(newsize int) {
	for k := newsize; k < len(ra.containers); k++ {
		ra.keys[k] = 0
		ra.needCopyOnWrite[k] = false
		ra.containers[k] = nil
	}

	ra.keys = ra.keys[:newsize]
	ra.containers = ra.containers[:newsize]
	ra.needCopyOnWrite = ra.needCopyOnWrite[:newsize]
}

func (ra *roaringArray64) clear() {
	ra.resize(0)
	ra.copyOnWrite = false
}

func (ra *roaringArray64) clone() *roaringArray64 {
	sa := roaringArray64{}
	sa.copyOnWrite = ra.copyOnWrite

	// this is where copyOnWrite is used.
	if ra.copyOnWrite {
		sa.keys = make([]uint32, len(ra.keys))
		copy(sa.keys, ra.keys)
		sa.containers = make([]*roaring.Bitmap, len(ra.containers))
		copy(sa.containers, ra.containers)
		sa.needCopyOnWrite = make([]bool, len(ra.needCopyOnWrite))

		ra.markAllAsNeedingCopyOnWrite()
		sa.markAllAsNeedingCopyOnWrite()

		// sa.needCopyOnWrite is shared
	} else {
		// make a full copy

		sa.keys = make([]uint32, len(ra.keys))
		copy(sa.keys, ra.keys)

		sa.containers = make([]*roaring.Bitmap, len(ra.containers))
		for i := range sa.containers {
			sa.containers[i] = ra.containers[i].Clone()
		}

		sa.needCopyOnWrite = make([]bool, len(ra.needCopyOnWrite))
	}
	return &sa
}

// clone all containers which have needCopyOnWrite set to true
// This can be used to make sure it is safe to munmap a []byte
// that the roaring array may still have a reference to.
func (ra *roaringArray64) cloneCopyOnWriteContainers() {
	for i, needCopyOnWrite := range ra.needCopyOnWrite {
		if needCopyOnWrite {
			ra.containers[i] = ra.containers[i].Clone()
			ra.needCopyOnWrite[i] = false
		}
	}
}

// unused function:
// func (ra *roaringArray64) containsKey(x uint32) bool {
//	return (ra.binarySearch(0, int64(len(ra.keys)), x) >= 0)
// }

func (ra *roaringArray64) getContainer(x uint32) *roaring.Bitmap {
	i := ra.binarySearch(0, int64(len(ra.keys)), x)
	if i < 0 {
		return nil
	}
	return ra.containers[i]
}

func (ra *roaringArray64) getContainerAtIndex(i int) *roaring.Bitmap {
	return ra.containers[i]
}

func (ra *roaringArray64) getWritableContainerAtIndex(i int) *roaring.Bitmap {
	if ra.needCopyOnWrite[i] {
		ra.containers[i] = ra.containers[i].Clone()
		ra.needCopyOnWrite[i] = false
	}
	return ra.containers[i]
}

func (ra *roaringArray64) getIndex(x uint32) int {
	// before the binary search, we optimize for frequent cases
	size := len(ra.keys)
	if (size == 0) || (ra.keys[size-1] == x) {
		return size - 1
	}
	return ra.binarySearch(0, int64(size), x)
}

func (ra *roaringArray64) getKeyAtIndex(i int) uint32 {
	return ra.keys[i]
}

func (ra *roaringArray64) insertNewKeyValueAt(i int, key uint32, value *roaring.Bitmap) {
	ra.keys = append(ra.keys, 0)
	ra.containers = append(ra.containers, nil)

	copy(ra.keys[i+1:], ra.keys[i:])
	copy(ra.containers[i+1:], ra.containers[i:])

	ra.keys[i] = key
	ra.containers[i] = value

	ra.needCopyOnWrite = append(ra.needCopyOnWrite, false)
	copy(ra.needCopyOnWrite[i+1:], ra.needCopyOnWrite[i:])
	ra.needCopyOnWrite[i] = false
}

func (ra *roaringArray64) remove(key uint32) bool {
	i := ra.binarySearch(0, int64(len(ra.keys)), key)
	if i >= 0 { // if a new key
		ra.removeAtIndex(i)
		return true
	}
	return false
}

func (ra *roaringArray64) removeAtIndex(i int) {
	copy(ra.keys[i:], ra.keys[i+1:])
	copy(ra.containers[i:], ra.containers[i+1:])

	copy(ra.needCopyOnWrite[i:], ra.needCopyOnWrite[i+1:])

	ra.resize(len(ra.keys) - 1)
}

func (ra *roaringArray64) setContainerAtIndex(i int, c *roaring.Bitmap) {
	ra.containers[i] = c
}

func (ra *roaringArray64) replaceKeyAndContainerAtIndex(i int, key uint32, c *roaring.Bitmap, mustCopyOnWrite bool) {
	ra.keys[i] = key
	ra.containers[i] = c
	ra.needCopyOnWrite[i] = mustCopyOnWrite
}

func (ra *roaringArray64) size() int {
	return len(ra.keys)
}

func (ra *roaringArray64) binarySearch(begin, end int64, ikey uint32) int {
	low := begin
	high := end - 1
	for low+16 <= high {
		middleIndex := low + (high-low)/2 // avoid overflow
		middleValue := ra.keys[middleIndex]

		if middleValue < ikey {
			low = middleIndex + 1
		} else if middleValue > ikey {
			high = middleIndex - 1
		} else {
			return int(middleIndex)
		}
	}
	for ; low <= high; low++ {
		val := ra.keys[low]
		if val >= ikey {
			if val == ikey {
				return int(low)
			}
			break
		}
	}
	return -int(low + 1)
}

func (ra *roaringArray64) equals(o interface{}) bool {
	srb, ok := o.(roaringArray64)
	if ok {

		if srb.size() != ra.size() {
			return false
		}
		for i, k := range ra.keys {
			if k != srb.keys[i] {
				return false
			}
		}

		for i, c := range ra.containers {
			if !c.Equals(srb.containers[i]) {
				return false
			}
		}
		return true
	}
	return false
}

func (ra *roaringArray64) hasRunCompression() bool {
	for _, c := range ra.containers {
		if c.HasRunCompression() {
			return true
		}
	}
	return false
}

/**
 * Find the smallest integer index strictly larger than pos such that array[index].key&gt;=min. If none can
 * be found, return size. Based on code by O. Kaser.
 *
 * @param min minimal value
 * @param pos index to exceed
 * @return the smallest index greater than pos such that array[index].key is at least as large as
 *         min, or size if it is not possible.
 */
func (ra *roaringArray64) advanceUntil(min uint32, pos int) int {
	lower := pos + 1

	if lower >= len(ra.keys) || ra.keys[lower] >= min {
		return lower
	}

	spansize := 1

	for lower+spansize < len(ra.keys) && ra.keys[lower+spansize] < min {
		spansize *= 2
	}
	var upper int
	if lower+spansize < len(ra.keys) {
		upper = lower + spansize
	} else {
		upper = len(ra.keys) - 1
	}

	if ra.keys[upper] == min {
		return upper
	}

	if ra.keys[upper] < min {
		// means
		// array
		// has no
		// item
		// >= min
		// pos = array.length;
		return len(ra.keys)
	}

	// we know that the next-smallest span was too small
	lower += (spansize >> 1)

	mid := 0
	for lower+1 != upper {
		mid = (lower + upper) >> 1
		if ra.keys[mid] == min {
			return mid
		} else if ra.keys[mid] < min {
			lower = mid
		} else {
			upper = mid
		}
	}
	return upper
}

func (ra *roaringArray64) markAllAsNeedingCopyOnWrite() {
	for i := range ra.needCopyOnWrite {
		ra.needCopyOnWrite[i] = true
	}
}

func (ra *roaringArray64) needsCopyOnWrite(i int) bool {
	return ra.needCopyOnWrite[i]
}

func (ra *roaringArray64) setNeedsCopyOnWrite(i int) {
	ra.needCopyOnWrite[i] = true
}

// should be dirt cheap
func (ra *roaringArray64) serializedSizeInBytes() uint64 {
	answer := uint64(8)
	for _, c := range ra.containers {
		answer += 4
		answer += c.GetSerializedSizeInBytes()
	}
	return answer
}

func (ra *roaringArray64) checkKeysSorted() bool {
	if len(ra.keys) == 0 || len(ra.keys) == 1 {
		return true
	}
	previous := ra.keys[0]
	for nextIdx := 1; nextIdx < len(ra.keys); nextIdx++ {
		next := ra.keys[nextIdx]
		if previous >= next {
			return false
		}
		previous = next

	}
	return true
}

// validate checks the referential integrity
// ensures len(keys) == len(containers), recurses and checks each container type
func (ra *roaringArray64) validate() error {
	if !ra.checkKeysSorted() {
		return ErrKeySortOrder
	}

	if len(ra.keys) != len(ra.containers) {
		return ErrCardinalityConstraint
	}

	if len(ra.keys) != len(ra.needCopyOnWrite) {
		return ErrCardinalityConstraint
	}

	for _, maps := range ra.containers {
		err := maps.Validate()
		if err != nil {
			return err
		}
		if maps.IsEmpty() {
			return errors.New("empty container")
		}
	}

	return nil
}
