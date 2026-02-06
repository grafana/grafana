package roaring

func difference(set1 []uint16, set2 []uint16, buffer []uint16) int {
	if len(set2) == 0 {
		buffer = buffer[:len(set1)]
		copy(buffer, set1)
		return len(set1)
	}
	if len(set1) == 0 {
		return 0
	}
	pos := 0
	k1 := 0
	k2 := 0
	buffer = buffer[:cap(buffer)]
	s1 := set1[k1]
	s2 := set2[k2]
	for {
		if s1 < s2 {
			buffer[pos] = s1
			pos++
			k1++
			if k1 >= len(set1) {
				break
			}
			s1 = set1[k1]
		} else if s1 == s2 {
			k1++
			k2++
			if k1 >= len(set1) {
				break
			}
			s1 = set1[k1]
			if k2 >= len(set2) {
				for ; k1 < len(set1); k1++ {
					buffer[pos] = set1[k1]
					pos++
				}
				break
			}
			s2 = set2[k2]
		} else { // if (val1>val2)
			k2++
			if k2 >= len(set2) {
				for ; k1 < len(set1); k1++ {
					buffer[pos] = set1[k1]
					pos++
				}
				break
			}
			s2 = set2[k2]
		}
	}
	return pos
}

func exclusiveUnion2by2(set1 []uint16, set2 []uint16, buffer []uint16) int {
	if 0 == len(set2) {
		buffer = buffer[:len(set1)]
		copy(buffer, set1[:])
		return len(set1)
	}
	if 0 == len(set1) {
		buffer = buffer[:len(set2)]
		copy(buffer, set2[:])
		return len(set2)
	}
	pos := 0
	k1 := 0
	k2 := 0
	s1 := set1[k1]
	s2 := set2[k2]
	buffer = buffer[:cap(buffer)]
	for {
		if s1 < s2 {
			buffer[pos] = s1
			pos++
			k1++
			if k1 >= len(set1) {
				for ; k2 < len(set2); k2++ {
					buffer[pos] = set2[k2]
					pos++
				}
				break
			}
			s1 = set1[k1]
		} else if s1 == s2 {
			k1++
			k2++
			if k1 >= len(set1) {
				for ; k2 < len(set2); k2++ {
					buffer[pos] = set2[k2]
					pos++
				}
				break
			}
			if k2 >= len(set2) {
				for ; k1 < len(set1); k1++ {
					buffer[pos] = set1[k1]
					pos++
				}
				break
			}
			s1 = set1[k1]
			s2 = set2[k2]
		} else { // if (val1>val2)
			buffer[pos] = s2
			pos++
			k2++
			if k2 >= len(set2) {
				for ; k1 < len(set1); k1++ {
					buffer[pos] = set1[k1]
					pos++
				}
				break
			}
			s2 = set2[k2]
		}
	}
	return pos
}

// union2by2Cardinality computes the cardinality of the union
func union2by2Cardinality(set1 []uint16, set2 []uint16) int {
	pos := 0
	k1 := 0
	k2 := 0
	if 0 == len(set2) {
		return len(set1)
	}
	if 0 == len(set1) {
		return len(set2)
	}
	s1 := set1[k1]
	s2 := set2[k2]
	for {
		if s1 < s2 {
			pos++
			k1++
			if k1 >= len(set1) {
				pos += len(set2) - k2
				break
			}
			s1 = set1[k1]
		} else if s1 == s2 {
			pos++
			k1++
			k2++
			if k1 >= len(set1) {
				pos += len(set2) - k2
				break
			}
			if k2 >= len(set2) {
				pos += len(set1) - k1
				break
			}
			s1 = set1[k1]
			s2 = set2[k2]
		} else { // if (set1[k1]>set2[k2])
			pos++
			k2++
			if k2 >= len(set2) {
				pos += len(set1) - k1
				break
			}
			s2 = set2[k2]
		}
	}
	return pos
}

func intersection2by2(
	set1 []uint16,
	set2 []uint16,
	buffer []uint16,
) int {
	if len(set1)*64 < len(set2) {
		return onesidedgallopingintersect2by2(set1, set2, buffer)
	} else if len(set2)*64 < len(set1) {
		return onesidedgallopingintersect2by2(set2, set1, buffer)
	} else {
		return localintersect2by2(set1, set2, buffer)
	}
}

// intersection2by2Cardinality computes the cardinality of the intersection
func intersection2by2Cardinality(
	set1 []uint16,
	set2 []uint16,
) int {
	if len(set1)*64 < len(set2) {
		return onesidedgallopingintersect2by2Cardinality(set1, set2)
	} else if len(set2)*64 < len(set1) {
		return onesidedgallopingintersect2by2Cardinality(set2, set1)
	} else {
		return localintersect2by2Cardinality(set1, set2)
	}
}

// intersects2by2 computes whether the two sets intersect
func intersects2by2(
	set1 []uint16,
	set2 []uint16,
) bool {
	// could be optimized if one set is much larger than the other one
	if (len(set1) == 0) || (len(set2) == 0) {
		return false
	}
	index1 := 0
	index2 := 0
	value1 := set1[index1]
	value2 := set2[index2]
mainwhile:
	for {

		if value2 < value1 {
			for {
				index2++
				if index2 == len(set2) {
					break mainwhile
				}
				value2 = set2[index2]
				if value2 >= value1 {
					break
				}
			}
		}
		if value1 < value2 {
			for {
				index1++
				if index1 == len(set1) {
					break mainwhile
				}
				value1 = set1[index1]
				if value1 >= value2 {
					break
				}
			}
		} else {
			// (set2[k2] == set1[k1])
			return true
		}
	}
	return false
}

func localintersect2by2(
	set1 []uint16,
	set2 []uint16,
	buffer []uint16,
) int {
	if (len(set1) == 0) || (len(set2) == 0) {
		return 0
	}
	k1 := 0
	k2 := 0
	pos := 0
	buffer = buffer[:cap(buffer)]
	s1 := set1[k1]
	s2 := set2[k2]
mainwhile:
	for {
		if s2 < s1 {
			for {
				k2++
				if k2 == len(set2) {
					break mainwhile
				}
				s2 = set2[k2]
				if s2 >= s1 {
					break
				}
			}
		}
		if s1 < s2 {
			for {
				k1++
				if k1 == len(set1) {
					break mainwhile
				}
				s1 = set1[k1]
				if s1 >= s2 {
					break
				}
			}
		} else {
			// (set2[k2] == set1[k1])
			buffer[pos] = s1
			pos++
			k1++
			if k1 == len(set1) {
				break
			}
			s1 = set1[k1]
			k2++
			if k2 == len(set2) {
				break
			}
			s2 = set2[k2]
		}
	}
	return pos
}

// / localintersect2by2Cardinality computes the cardinality of the intersection
func localintersect2by2Cardinality(
	set1 []uint16,
	set2 []uint16,
) int {
	if (len(set1) == 0) || (len(set2) == 0) {
		return 0
	}
	index1 := 0
	index2 := 0
	pos := 0
	value1 := set1[index1]
	value2 := set2[index2]
mainwhile:
	for {
		if value2 < value1 {
			for {
				index2++
				if index2 == len(set2) {
					break mainwhile
				}
				value2 = set2[index2]
				if value2 >= value1 {
					break
				}
			}
		}
		if value1 < value2 {
			for {
				index1++
				if index1 == len(set1) {
					break mainwhile
				}
				value1 = set1[index1]
				if value1 >= value2 {
					break
				}
			}
		} else {
			// (set2[k2] == set1[k1])
			pos++
			index1++
			if index1 == len(set1) {
				break
			}
			value1 = set1[index1]
			index2++
			if index2 == len(set2) {
				break
			}
			value2 = set2[index2]
		}
	}
	return pos
}

func advanceUntil(
	array []uint16,
	pos int,
	length int,
	min uint16,
) int {
	lower := pos + 1

	if lower >= length || array[lower] >= min {
		return lower
	}

	spansize := 1

	for lower+spansize < length && array[lower+spansize] < min {
		spansize *= 2
	}
	var upper int
	if lower+spansize < length {
		upper = lower + spansize
	} else {
		upper = length - 1
	}

	if array[upper] == min {
		return upper
	}

	if array[upper] < min {
		// means
		// array
		// has no
		// item
		// >= min
		// pos = array.length;
		return length
	}

	// we know that the next-smallest span was too small
	lower += (spansize >> 1)

	mid := 0
	for lower+1 != upper {
		mid = (lower + upper) >> 1
		if array[mid] == min {
			return mid
		} else if array[mid] < min {
			lower = mid
		} else {
			upper = mid
		}
	}
	return upper
}

func onesidedgallopingintersect2by2(
	smallset []uint16,
	largeset []uint16,
	buffer []uint16,
) int {
	if 0 == len(smallset) {
		return 0
	}
	buffer = buffer[:cap(buffer)]
	k1 := 0
	k2 := 0
	pos := 0
	s1 := largeset[k1]
	s2 := smallset[k2]
mainwhile:

	for {
		if s1 < s2 {
			k1 = advanceUntil(largeset, k1, len(largeset), s2)
			if k1 == len(largeset) {
				break mainwhile
			}
			s1 = largeset[k1]
		}
		if s2 < s1 {
			k2++
			if k2 == len(smallset) {
				break mainwhile
			}
			s2 = smallset[k2]
		} else {

			buffer[pos] = s2
			pos++
			k2++
			if k2 == len(smallset) {
				break
			}
			s2 = smallset[k2]
			k1 = advanceUntil(largeset, k1, len(largeset), s2)
			if k1 == len(largeset) {
				break mainwhile
			}
			s1 = largeset[k1]
		}

	}
	return pos
}

func onesidedgallopingintersect2by2Cardinality(
	smallset []uint16,
	largeset []uint16,
) int {
	if 0 == len(smallset) {
		return 0
	}
	k1 := 0
	k2 := 0
	pos := 0
	s1 := largeset[k1]
	s2 := smallset[k2]
mainwhile:

	for {
		if s1 < s2 {
			k1 = advanceUntil(largeset, k1, len(largeset), s2)
			if k1 == len(largeset) {
				break mainwhile
			}
			s1 = largeset[k1]
		}
		if s2 < s1 {
			k2++
			if k2 == len(smallset) {
				break mainwhile
			}
			s2 = smallset[k2]
		} else {

			pos++
			k2++
			if k2 == len(smallset) {
				break
			}
			s2 = smallset[k2]
			k1 = advanceUntil(largeset, k1, len(largeset), s2)
			if k1 == len(largeset) {
				break mainwhile
			}
			s1 = largeset[k1]
		}

	}
	return pos
}

func binarySearch(array []uint16, ikey uint16) int {
	low := 0
	high := len(array) - 1
	for low+16 <= high {
		middleIndex := int(uint32(low+high) >> 1)
		middleValue := array[middleIndex]
		if middleValue < ikey {
			low = middleIndex + 1
		} else if middleValue > ikey {
			high = middleIndex - 1
		} else {
			return middleIndex
		}
	}
	for ; low <= high; low++ {
		val := array[low]
		if val >= ikey {
			if val == ikey {
				return low
			}
			break
		}
	}
	return -(low + 1)
}

// searchResult provides information about a search request.
// The values will depend on the context of the search
type searchResult struct {
	value      uint16
	index      int
	exactMatch bool
}

// notFound returns a bool depending the search context
// For cases `previousValue` and `nextValue` if target is present in the slice
// this function will return `true` otherwise `false`
// For `nextAbsentValue` and `previousAbsentValue` this will only return `False`
func (sr *searchResult) notFound() bool {
	return !sr.exactMatch
}

// outOfBounds indicates whether the target was outside the lower and upper bounds of the container
func (sr *searchResult) outOfBounds() bool {
	return sr.index <= -1
}

// binarySearchUntil is a helper function around binarySearchUntilWithBounds
// The user does not have to pass in the lower and upper bound
// The lower bound is taken to be `0` and the upper bound `len(array)-1`
func binarySearchUntil(array []uint16, target uint16) searchResult {
	return binarySearchUntilWithBounds(array, target, 0, len(array)-1)
}

// binarySearchUntilWithBounds returns a `searchResult`.
// If an exact match is found the `searchResult{target, <index>, true}` will be returned, where `<index>` is
// `target`s index in `array`, and `result.notFound()` evaluates to `false`.
// If a match is not found, but `target` was in-bounds then the result.index will be the closest smaller value
// Example: [ 8,9,11,12] if the target was 10, then `searchResult{9, 1, false}` will be returned.
// If `target` was out of bounds `searchResult{0, -1, false}` will be returned.
func binarySearchUntilWithBounds(array []uint16, target uint16, lowIndex int, maxIndex int) searchResult {
	highIndex := maxIndex

	closestIndex := -1

	if target < array[lowIndex] {
		return searchResult{0, closestIndex, false}
	}

	if target > array[maxIndex] {
		return searchResult{0, len(array), false}
	}

	for lowIndex <= highIndex {
		middleIndex := (lowIndex + highIndex) / 2
		middleValue := array[middleIndex]

		if middleValue == target {
			return searchResult{middleValue, middleIndex, true}
		}

		if target < middleValue {

			if middleIndex > 0 && target > array[middleIndex-1] {
				return searchResult{array[middleIndex-1], middleIndex - 1, false}
			}

			highIndex = middleIndex
		} else {
			if middleIndex < maxIndex && target < array[middleIndex+1] {
				return searchResult{middleValue, middleIndex, false}
			}
			lowIndex = middleIndex + 1
		}

	}

	return searchResult{array[closestIndex], closestIndex, false}
}

// binarySearchPast is a wrapper around binarySearchPastWithBounds
// The user does not have to pass in the lower and upper bound
// The lower bound is taken to be `0` and the upper bound `len(array)-1`
func binarySearchPast(array []uint16, target uint16) searchResult {
	return binarySearchPastWithBounds(array, target, 0, len(array)-1)
}

// binarySearchPastWithBounds looks for the smallest value larger than or equal to `target`
// If `target` is out of bounds a `searchResult` indicating out of bounds is returned
// `target` does not have to exist in the slice.
//
// Example:
// Suppose the slice is [...10,13...] with `target` equal to 11
// The searchResult will have searchResult.value = 13
func binarySearchPastWithBounds(array []uint16, target uint16, lowIndex int, maxIndex int) searchResult {
	highIndex := maxIndex

	closestIndex := -1

	if target < array[lowIndex] {
		return searchResult{0, closestIndex, false}
	}

	if target > array[maxIndex] {
		return searchResult{0, len(array), false}
	}

	for lowIndex <= highIndex {
		middleIndex := (lowIndex + highIndex) / 2
		middleValue := array[middleIndex]

		if middleValue == target {
			return searchResult{middleValue, middleIndex, true}
		}

		if target < middleValue {

			if middleIndex > 0 && target > array[middleIndex-1] {
				return searchResult{array[middleIndex], middleIndex, false}
			}

			highIndex = middleIndex
		} else {
			if middleIndex < maxIndex && target < array[middleIndex+1] {
				return searchResult{array[middleIndex+1], middleIndex + 1, false}
			}
			lowIndex = middleIndex + 1
		}

	}

	return searchResult{array[closestIndex], closestIndex, false}
}
