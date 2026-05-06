package roaring

import (
	"errors"
	"fmt"
)

type arrayContainer struct {
	content []uint16
}

var (
	ErrArrayIncorrectSort = errors.New("incorrectly sorted array")
	ErrArrayInvalidSize   = errors.New("invalid array size")
)

func (ac *arrayContainer) String() string {
	s := "{"
	for it := ac.getShortIterator(); it.hasNext(); {
		s += fmt.Sprintf("%v, ", it.next())
	}
	return s + "}"
}

func (ac *arrayContainer) fillLeastSignificant16bits(x []uint32, i int, mask uint32) int {
	if i < 0 {
		panic("negative index")
	}
	if len(ac.content) == 0 {
		return i
	}
	_ = x[len(ac.content)-1+i]
	_ = ac.content[len(ac.content)-1]
	for k := 0; k < len(ac.content); k++ {
		x[k+i] = uint32(ac.content[k]) | mask
	}
	return i + len(ac.content)
}

func (ac *arrayContainer) iterate(cb func(x uint16) bool) bool {
	iterator := shortIterator{ac.content, 0}

	for iterator.hasNext() {
		if !cb(iterator.next()) {
			return false
		}
	}

	return true
}

func (ac *arrayContainer) getShortIterator() shortPeekable {
	return &shortIterator{ac.content, 0}
}

func (ac *arrayContainer) getReverseIterator() shortIterable {
	return &reverseIterator{ac.content, len(ac.content) - 1}
}

func (ac *arrayContainer) getManyIterator() manyIterable {
	return &shortIterator{ac.content, 0}
}

func (ac *arrayContainer) minimum() uint16 {
	return ac.content[0] // assume not empty
}

func (ac *arrayContainer) safeMinimum() (uint16, error) {
	if len(ac.content) == 0 {
		return 0, errors.New("empty array")
	}

	return ac.minimum(), nil
}

func (ac *arrayContainer) maximum() uint16 {
	return ac.content[len(ac.content)-1] // assume not empty
}

func (ac *arrayContainer) safeMaximum() (uint16, error) {
	if len(ac.content) == 0 {
		return 0, errors.New("empty array")
	}

	return ac.maximum(), nil
}

func (ac *arrayContainer) getSizeInBytes() int {
	return ac.getCardinality() * 2
}

func (ac *arrayContainer) serializedSizeInBytes() int {
	return ac.getCardinality() * 2
}

func arrayContainerSizeInBytes(card int) int {
	return card * 2
}

// add the values in the range [firstOfRange,endx)
func (ac *arrayContainer) iaddRange(firstOfRange, endx int) container {
	if firstOfRange >= endx {
		return ac
	}
	indexstart := binarySearch(ac.content, uint16(firstOfRange))
	if indexstart < 0 {
		indexstart = -indexstart - 1
	}
	indexend := binarySearch(ac.content, uint16(endx-1))
	if indexend < 0 {
		indexend = -indexend - 1
	} else {
		indexend++
	}
	rangelength := endx - firstOfRange
	newcardinality := indexstart + (ac.getCardinality() - indexend) + rangelength
	if newcardinality > arrayDefaultMaxSize {
		a := ac.toBitmapContainer()
		return a.iaddRange(firstOfRange, endx)
	}
	if cap(ac.content) < newcardinality {
		tmp := make([]uint16, newcardinality, newcardinality)
		copy(tmp[:indexstart], ac.content[:indexstart])
		copy(tmp[indexstart+rangelength:], ac.content[indexend:])

		ac.content = tmp
	} else {
		ac.content = ac.content[:newcardinality]
		copy(ac.content[indexstart+rangelength:], ac.content[indexend:])

	}
	for k := 0; k < rangelength; k++ {
		ac.content[k+indexstart] = uint16(firstOfRange + k)
	}
	return ac
}

// remove the values in the range [firstOfRange,endx)
func (ac *arrayContainer) iremoveRange(firstOfRange, endx int) container {
	if firstOfRange >= endx {
		return ac
	}
	indexstart := binarySearch(ac.content, uint16(firstOfRange))
	if indexstart < 0 {
		indexstart = -indexstart - 1
	}
	indexend := binarySearch(ac.content, uint16(endx-1))
	if indexend < 0 {
		indexend = -indexend - 1
	} else {
		indexend++
	}
	rangelength := indexend - indexstart
	answer := ac
	copy(answer.content[indexstart:], ac.content[indexstart+rangelength:])
	answer.content = answer.content[:ac.getCardinality()-rangelength]
	return answer
}

// flip the values in the range [firstOfRange,endx)
func (ac *arrayContainer) not(firstOfRange, endx int) container {
	if firstOfRange >= endx {
		return ac.clone()
	}
	return ac.notClose(firstOfRange, endx-1) // remove everything in [firstOfRange,endx-1]
}

// flip the values in the range [firstOfRange,lastOfRange]
func (ac *arrayContainer) notClose(firstOfRange, lastOfRange int) container {
	if firstOfRange > lastOfRange { // unlike add and remove, not uses an inclusive range [firstOfRange,lastOfRange]
		return ac.clone()
	}

	// determine the span of array indices to be affected^M
	startIndex := binarySearch(ac.content, uint16(firstOfRange))
	if startIndex < 0 {
		startIndex = -startIndex - 1
	}
	lastIndex := binarySearch(ac.content, uint16(lastOfRange))
	if lastIndex < 0 {
		lastIndex = -lastIndex - 2
	}
	currentValuesInRange := lastIndex - startIndex + 1
	spanToBeFlipped := lastOfRange - firstOfRange + 1
	newValuesInRange := spanToBeFlipped - currentValuesInRange
	cardinalityChange := newValuesInRange - currentValuesInRange
	newCardinality := len(ac.content) + cardinalityChange
	if newCardinality > arrayDefaultMaxSize {
		return ac.toBitmapContainer().not(firstOfRange, lastOfRange+1)
	}
	answer := newArrayContainer()
	answer.content = make([]uint16, newCardinality, newCardinality) // a hack for sure

	copy(answer.content, ac.content[:startIndex])
	outPos := startIndex
	inPos := startIndex
	valInRange := firstOfRange
	for ; valInRange <= lastOfRange && inPos <= lastIndex; valInRange++ {
		if uint16(valInRange) != ac.content[inPos] {
			answer.content[outPos] = uint16(valInRange)
			outPos++
		} else {
			inPos++
		}
	}

	for ; valInRange <= lastOfRange; valInRange++ {
		answer.content[outPos] = uint16(valInRange)
		outPos++
	}

	for i := lastIndex + 1; i < len(ac.content); i++ {
		answer.content[outPos] = ac.content[i]
		outPos++
	}
	answer.content = answer.content[:newCardinality]
	return answer
}

func (ac *arrayContainer) equals(o container) bool {
	srb, ok := o.(*arrayContainer)
	if ok {
		// Check if the containers are the same object.
		if ac == srb {
			return true
		}

		if len(srb.content) != len(ac.content) {
			return false
		}

		for i, v := range ac.content {
			if v != srb.content[i] {
				return false
			}
		}
		return true
	}

	// use generic comparison
	bCard := o.getCardinality()
	aCard := ac.getCardinality()
	if bCard != aCard {
		return false
	}

	ait := ac.getShortIterator()
	bit := o.getShortIterator()
	for ait.hasNext() {
		if bit.next() != ait.next() {
			return false
		}
	}
	return true
}

func (ac *arrayContainer) toBitmapContainer() *bitmapContainer {
	bc := newBitmapContainer()
	bc.loadData(ac)
	return bc
}

func (ac *arrayContainer) iadd(x uint16) (wasNew bool) {
	// Special case adding to the end of the container.
	l := len(ac.content)
	if l > 0 && l < arrayDefaultMaxSize && ac.content[l-1] < x {
		ac.content = append(ac.content, x)
		return true
	}

	loc := binarySearch(ac.content, x)

	if loc < 0 {
		s := ac.content
		i := -loc - 1
		s = append(s, 0)
		copy(s[i+1:], s[i:])
		s[i] = x
		ac.content = s
		return true
	}
	return false
}

func (ac *arrayContainer) iaddReturnMinimized(x uint16) container {
	// Special case adding to the end of the container.
	l := len(ac.content)
	if l > 0 && l < arrayDefaultMaxSize && ac.content[l-1] < x {
		ac.content = append(ac.content, x)
		return ac
	}

	loc := binarySearch(ac.content, x)

	if loc < 0 {
		if len(ac.content) >= arrayDefaultMaxSize {
			a := ac.toBitmapContainer()
			a.iadd(x)
			return a
		}
		s := ac.content
		i := -loc - 1
		s = append(s, 0)
		copy(s[i+1:], s[i:])
		s[i] = x
		ac.content = s
	}
	return ac
}

// iremoveReturnMinimized is allowed to change the return type to minimize storage.
func (ac *arrayContainer) iremoveReturnMinimized(x uint16) container {
	ac.iremove(x)
	return ac
}

func (ac *arrayContainer) iremove(x uint16) bool {
	loc := binarySearch(ac.content, x)
	if loc >= 0 {
		s := ac.content
		s = append(s[:loc], s[loc+1:]...)
		ac.content = s
		return true
	}
	return false
}

func (ac *arrayContainer) remove(x uint16) container {
	out := &arrayContainer{make([]uint16, len(ac.content))}
	copy(out.content, ac.content[:])

	loc := binarySearch(out.content, x)
	if loc >= 0 {
		s := out.content
		s = append(s[:loc], s[loc+1:]...)
		out.content = s
	}
	return out
}

func (ac *arrayContainer) or(a container) container {
	switch x := a.(type) {
	case *arrayContainer:
		return ac.orArray(x)
	case *bitmapContainer:
		return x.orArray(ac)
	case *runContainer16:
		if x.isFull() {
			return x.clone()
		}
		return x.orArray(ac)
	}
	panic("unsupported container type")
}

func (ac *arrayContainer) orCardinality(a container) int {
	switch x := a.(type) {
	case *arrayContainer:
		return ac.orArrayCardinality(x)
	case *bitmapContainer:
		return x.orArrayCardinality(ac)
	case *runContainer16:
		return x.orArrayCardinality(ac)
	}
	panic("unsupported container type")
}

func (ac *arrayContainer) ior(a container) container {
	switch x := a.(type) {
	case *arrayContainer:
		return ac.iorArray(x)
	case *bitmapContainer:
		return a.(*bitmapContainer).orArray(ac)
	case *runContainer16:
		if x.isFull() {
			return x.clone()
		}
		return ac.iorRun16(x)
	}
	panic("unsupported container type")
}

func (ac *arrayContainer) iorArray(value2 *arrayContainer) container {
	value1 := ac
	len1 := value1.getCardinality()
	len2 := value2.getCardinality()
	maxPossibleCardinality := len1 + len2
	if maxPossibleCardinality > cap(value1.content) {
		// doubling the capacity reduces new slice allocations in the case of
		// repeated calls to iorArray().
		newSize := 2 * maxPossibleCardinality
		// the second check is to handle overly large array containers
		// and should not occur in normal usage,
		// as all array containers should be at most arrayDefaultMaxSize
		if newSize > 2*arrayDefaultMaxSize && maxPossibleCardinality <= 2*arrayDefaultMaxSize {
			newSize = 2 * arrayDefaultMaxSize
		}
		newcontent := make([]uint16, 0, newSize)
		copy(newcontent[len2:maxPossibleCardinality], ac.content[0:len1])
		ac.content = newcontent
	} else {
		copy(ac.content[len2:maxPossibleCardinality], ac.content[0:len1])
	}
	nl := union2by2(value1.content[len2:maxPossibleCardinality], value2.content, ac.content)
	ac.content = ac.content[:nl] // reslice to match actual used capacity

	if nl > arrayDefaultMaxSize {
		// Only converting to a bitmap when arrayDefaultMaxSize
		// is actually exceeded minimizes conversions in the case of repeated
		// calls to iorArray().
		return ac.toBitmapContainer()
	}
	return ac
}

// Note: such code does not make practical sense, except for lazy evaluations
func (ac *arrayContainer) iorBitmap(bc2 *bitmapContainer) container {
	bc1 := ac.toBitmapContainer()
	bc1.iorBitmap(bc2)
	*ac = *newArrayContainerFromBitmap(bc1)
	return ac
}

func (ac *arrayContainer) iorRun16(rc *runContainer16) container {
	runCardinality := rc.getCardinality()
	// heuristic for if the container should maybe be an
	// array container.
	if runCardinality < ac.getCardinality() &&
		runCardinality+ac.getCardinality() < arrayDefaultMaxSize {
		var result container
		result = ac
		for _, run := range rc.iv {
			result = result.iaddRange(int(run.start), int(run.start)+int(run.length)+1)
		}
		return result
	}
	return rc.orArray(ac)
}

func (ac *arrayContainer) lazyIOR(a container) container {
	switch x := a.(type) {
	case *arrayContainer:
		return ac.lazyIorArray(x)
	case *bitmapContainer:
		return ac.lazyIorBitmap(x)
	case *runContainer16:
		if x.isFull() {
			return x.clone()
		}
		return ac.lazyIorRun16(x)

	}
	panic("unsupported container type")
}

func (ac *arrayContainer) lazyIorArray(ac2 *arrayContainer) container {
	// TODO actually make this lazy
	return ac.iorArray(ac2)
}

func (ac *arrayContainer) lazyIorBitmap(bc *bitmapContainer) container {
	// TODO actually make this lazy
	return ac.iorBitmap(bc)
}

func (ac *arrayContainer) lazyIorRun16(rc *runContainer16) container {
	// TODO actually make this lazy
	return ac.iorRun16(rc)
}

func (ac *arrayContainer) lazyOR(a container) container {
	switch x := a.(type) {
	case *arrayContainer:
		return ac.lazyorArray(x)
	case *bitmapContainer:
		return a.lazyOR(ac)
	case *runContainer16:
		if x.isFull() {
			return x.clone()
		}
		return x.orArray(ac)
	}
	panic("unsupported container type")
}

func (ac *arrayContainer) orArray(value2 *arrayContainer) container {
	value1 := ac
	maxPossibleCardinality := value1.getCardinality() + value2.getCardinality()
	if maxPossibleCardinality > arrayDefaultMaxSize { // it could be a bitmap!
		bc := newBitmapContainer()
		for k := 0; k < len(value2.content); k++ {
			v := value2.content[k]
			i := uint(v) >> 6
			mask := uint64(1) << (v % 64)
			bc.bitmap[i] |= mask
		}
		for k := 0; k < len(ac.content); k++ {
			v := ac.content[k]
			i := uint(v) >> 6
			mask := uint64(1) << (v % 64)
			bc.bitmap[i] |= mask
		}
		bc.cardinality = int(popcntSlice(bc.bitmap))
		if bc.cardinality <= arrayDefaultMaxSize {
			return bc.toArrayContainer()
		}
		return bc
	}
	answer := newArrayContainerCapacity(maxPossibleCardinality)
	nl := union2by2(value1.content, value2.content, answer.content)
	answer.content = answer.content[:nl] // reslice to match actual used capacity
	return answer
}

func (ac *arrayContainer) orArrayCardinality(value2 *arrayContainer) int {
	return union2by2Cardinality(ac.content, value2.content)
}

func (ac *arrayContainer) lazyorArray(value2 *arrayContainer) container {
	value1 := ac
	maxPossibleCardinality := value1.getCardinality() + value2.getCardinality()
	if maxPossibleCardinality > arrayLazyLowerBound { // it could be a bitmap!
		bc := newBitmapContainer()
		for k := 0; k < len(value2.content); k++ {
			v := value2.content[k]
			i := uint(v) >> 6
			mask := uint64(1) << (v % 64)
			bc.bitmap[i] |= mask
		}
		for k := 0; k < len(ac.content); k++ {
			v := ac.content[k]
			i := uint(v) >> 6
			mask := uint64(1) << (v % 64)
			bc.bitmap[i] |= mask
		}
		bc.cardinality = invalidCardinality
		return bc
	}
	answer := newArrayContainerCapacity(maxPossibleCardinality)
	nl := union2by2(value1.content, value2.content, answer.content)
	answer.content = answer.content[:nl] // reslice to match actual used capacity
	return answer
}

func (ac *arrayContainer) and(a container) container {
	switch x := a.(type) {
	case *arrayContainer:
		return ac.andArray(x)
	case *bitmapContainer:
		return x.and(ac)
	case *runContainer16:
		if x.isFull() {
			return ac.clone()
		}
		return x.andArray(ac)
	}
	panic("unsupported container type")
}

func (ac *arrayContainer) andCardinality(a container) int {
	switch x := a.(type) {
	case *arrayContainer:
		return ac.andArrayCardinality(x)
	case *bitmapContainer:
		return x.andCardinality(ac)
	case *runContainer16:
		return x.andArrayCardinality(ac)
	}
	panic("unsupported container type")
}

func (ac *arrayContainer) intersects(a container) bool {
	switch x := a.(type) {
	case *arrayContainer:
		return ac.intersectsArray(x)
	case *bitmapContainer:
		return x.intersects(ac)
	case *runContainer16:
		return x.intersects(ac)
	}
	panic("unsupported container type")
}

func (ac *arrayContainer) iand(a container) container {
	switch x := a.(type) {
	case *arrayContainer:
		return ac.iandArray(x)
	case *bitmapContainer:
		return ac.iandBitmap(x)
	case *runContainer16:
		if x.isFull() {
			return ac
		}
		return x.andArray(ac)
	}
	panic("unsupported container type")
}

func (ac *arrayContainer) iandBitmap(bc *bitmapContainer) container {
	pos := 0
	c := ac.getCardinality()
	for k := 0; k < c; k++ {
		// branchless
		v := ac.content[k]
		ac.content[pos] = v
		pos += int(bc.bitValue(v))
	}
	ac.content = ac.content[:pos]
	return ac
}

func (ac *arrayContainer) xor(a container) container {
	switch x := a.(type) {
	case *arrayContainer:
		return ac.xorArray(x)
	case *bitmapContainer:
		return a.xor(ac)
	case *runContainer16:
		return x.xorArray(ac)
	}
	panic("unsupported container type")
}

func (ac *arrayContainer) xorArray(value2 *arrayContainer) container {
	value1 := ac
	totalCardinality := value1.getCardinality() + value2.getCardinality()
	if totalCardinality > arrayDefaultMaxSize { // it could be a bitmap!
		bc := newBitmapContainer()
		for k := 0; k < len(value2.content); k++ {
			v := value2.content[k]
			i := uint(v) >> 6
			bc.bitmap[i] ^= (uint64(1) << (v % 64))
		}
		for k := 0; k < len(ac.content); k++ {
			v := ac.content[k]
			i := uint(v) >> 6
			bc.bitmap[i] ^= (uint64(1) << (v % 64))
		}
		bc.computeCardinality()
		if bc.cardinality <= arrayDefaultMaxSize {
			return bc.toArrayContainer()
		}
		return bc
	}
	desiredCapacity := totalCardinality
	answer := newArrayContainerCapacity(desiredCapacity)
	length := exclusiveUnion2by2(value1.content, value2.content, answer.content)
	answer.content = answer.content[:length]
	return answer
}

func (ac *arrayContainer) andNot(a container) container {
	switch x := a.(type) {
	case *arrayContainer:
		return ac.andNotArray(x)
	case *bitmapContainer:
		return ac.andNotBitmap(x)
	case *runContainer16:
		return ac.andNotRun16(x)
	}
	panic("unsupported container type")
}

func (ac *arrayContainer) andNotRun16(rc *runContainer16) container {
	acb := ac.toBitmapContainer()
	rcb := rc.toBitmapContainer()
	return acb.andNotBitmap(rcb)
}

func (ac *arrayContainer) iandNot(a container) container {
	switch x := a.(type) {
	case *arrayContainer:
		return ac.iandNotArray(x)
	case *bitmapContainer:
		return ac.iandNotBitmap(x)
	case *runContainer16:
		return ac.iandNotRun16(x)
	}
	panic("unsupported container type")
}

func (ac *arrayContainer) iandNotRun16(rc *runContainer16) container {
	// Fast path: if either the array container or the run container is empty, the result is the array.
	if ac.isEmpty() || rc.isEmpty() {
		// Empty
		return ac
	}
	// Fast path: if the run container is full, the result is empty.
	if rc.isFull() {
		ac.content = ac.content[:0]
		return ac
	}
	current_run := 0
	// All values in [start_run, end_end] are part of the run
	start_run := rc.iv[current_run].start
	end_end := start_run + rc.iv[current_run].length
	// We are going to read values in the array at index i, and we are
	// going to write them at index pos. So we do in-place processing.
	// We always have that pos <= i by construction. So we can either
	// overwrite a value just read, or a value that was previous read.
	pos := 0
	i := 0
	for ; i < len(ac.content); i++ {
		if ac.content[i] < start_run {
			// the value in the array appears before the run [start_run, end_end]
			ac.content[pos] = ac.content[i]
			pos++
		} else if ac.content[i] <= end_end {
			// nothing to do, the value is in the array but also in the run.
		} else {
			// We have the value in the array after the run. We cannot tell
			// whether we need to keep it or not. So let us move to another run.
			if current_run+1 < len(rc.iv) {
				current_run++
				start_run = rc.iv[current_run].start
				end_end = start_run + rc.iv[current_run].length
				i-- // retry with the same i
			} else {
				// We have exhausted the number of runs. We can keep the rest of the values
				// from i to len(ac.content) - 1 inclusively.
				break // We are done, the rest of the array will be kept
			}
		}
	}
	for ; i < len(ac.content); i++ {
		ac.content[pos] = ac.content[i]
		pos++
	}
	// We 'shink' the slice.
	ac.content = ac.content[:pos]
	return ac
}

func (ac *arrayContainer) andNotArray(value2 *arrayContainer) container {
	value1 := ac
	desiredcapacity := value1.getCardinality()
	answer := newArrayContainerCapacity(desiredcapacity)
	length := difference(value1.content, value2.content, answer.content)
	answer.content = answer.content[:length]
	return answer
}

func (ac *arrayContainer) iandNotArray(value2 *arrayContainer) container {
	length := difference(ac.content, value2.content, ac.content)
	ac.content = ac.content[:length]
	return ac
}

func (ac *arrayContainer) andNotBitmap(value2 *bitmapContainer) container {
	desiredcapacity := ac.getCardinality()
	answer := newArrayContainerCapacity(desiredcapacity)
	answer.content = answer.content[:desiredcapacity]
	pos := 0
	for _, v := range ac.content {
		answer.content[pos] = v
		pos += 1 - int(value2.bitValue(v))
	}
	answer.content = answer.content[:pos]
	return answer
}

func (ac *arrayContainer) andBitmap(value2 *bitmapContainer) container {
	desiredcapacity := ac.getCardinality()
	answer := newArrayContainerCapacity(desiredcapacity)
	answer.content = answer.content[:desiredcapacity]
	pos := 0
	for _, v := range ac.content {
		answer.content[pos] = v
		pos += int(value2.bitValue(v))
	}
	answer.content = answer.content[:pos]
	return answer
}

func (ac *arrayContainer) iandNotBitmap(value2 *bitmapContainer) container {
	pos := 0
	for _, v := range ac.content {
		ac.content[pos] = v
		pos += 1 - int(value2.bitValue(v))
	}
	ac.content = ac.content[:pos]
	return ac
}

func copyOf(array []uint16, size int) []uint16 {
	result := make([]uint16, size)
	for i, x := range array {
		if i == size {
			break
		}
		result[i] = x
	}
	return result
}

// flip the values in the range [firstOfRange,endx)
func (ac *arrayContainer) inot(firstOfRange, endx int) container {
	if firstOfRange >= endx {
		return ac
	}
	return ac.inotClose(firstOfRange, endx-1) // remove everything in [firstOfRange,endx-1]
}

// flip the values in the range [firstOfRange,lastOfRange]
func (ac *arrayContainer) inotClose(firstOfRange, lastOfRange int) container {
	if firstOfRange > lastOfRange { // unlike add and remove, not uses an inclusive range [firstOfRange,lastOfRange]
		return ac
	}
	// determine the span of array indices to be affected
	startIndex := binarySearch(ac.content, uint16(firstOfRange))
	if startIndex < 0 {
		startIndex = -startIndex - 1
	}
	lastIndex := binarySearch(ac.content, uint16(lastOfRange))
	if lastIndex < 0 {
		lastIndex = -lastIndex - 1 - 1
	}
	currentValuesInRange := lastIndex - startIndex + 1
	spanToBeFlipped := lastOfRange - firstOfRange + 1

	newValuesInRange := spanToBeFlipped - currentValuesInRange
	buffer := make([]uint16, newValuesInRange)
	cardinalityChange := newValuesInRange - currentValuesInRange
	newCardinality := len(ac.content) + cardinalityChange
	if cardinalityChange > 0 {
		if newCardinality > len(ac.content) {
			if newCardinality > arrayDefaultMaxSize {
				bcRet := ac.toBitmapContainer()
				bcRet.inot(firstOfRange, lastOfRange+1)
				*ac = *bcRet.toArrayContainer()
				return bcRet
			}
			ac.content = copyOf(ac.content, newCardinality)
		}
		base := lastIndex + 1
		copy(ac.content[lastIndex+1+cardinalityChange:], ac.content[base:base+len(ac.content)-1-lastIndex])
		ac.negateRange(buffer, startIndex, lastIndex, firstOfRange, lastOfRange+1)
	} else { // no expansion needed
		ac.negateRange(buffer, startIndex, lastIndex, firstOfRange, lastOfRange+1)
		if cardinalityChange < 0 {
			for i := startIndex + newValuesInRange; i < newCardinality; i++ {
				ac.content[i] = ac.content[i-cardinalityChange]
			}
		}
	}
	ac.content = ac.content[:newCardinality]
	return ac
}

func (ac *arrayContainer) negateRange(buffer []uint16, startIndex, lastIndex, startRange, lastRange int) {
	// compute the negation into buffer
	outPos := 0
	inPos := startIndex // value here always >= valInRange,
	// until it is exhausted
	// n.b., we can start initially exhausted.

	valInRange := startRange
	for ; valInRange < lastRange && inPos <= lastIndex; valInRange++ {
		if uint16(valInRange) != ac.content[inPos] {
			buffer[outPos] = uint16(valInRange)
			outPos++
		} else {
			inPos++
		}
	}

	// if there are extra items (greater than the biggest
	// pre-existing one in range), buffer them
	for ; valInRange < lastRange; valInRange++ {
		buffer[outPos] = uint16(valInRange)
		outPos++
	}

	if outPos != len(buffer) {
		panic("negateRange: internal bug")
	}

	for i, item := range buffer {
		ac.content[i+startIndex] = item
	}
}

func (ac *arrayContainer) isFull() bool {
	return false
}

func (ac *arrayContainer) andArray(value2 *arrayContainer) container {
	desiredcapacity := minOfInt(ac.getCardinality(), value2.getCardinality())
	answer := newArrayContainerCapacity(desiredcapacity)
	length := intersection2by2(
		ac.content,
		value2.content,
		answer.content)
	answer.content = answer.content[:length]
	return answer
}

func (ac *arrayContainer) andArrayCardinality(value2 *arrayContainer) int {
	return intersection2by2Cardinality(
		ac.content,
		value2.content)
}

func (ac *arrayContainer) intersectsArray(value2 *arrayContainer) bool {
	return intersects2by2(
		ac.content,
		value2.content)
}

func (ac *arrayContainer) iandArray(value2 *arrayContainer) container {
	length := intersection2by2(
		ac.content,
		value2.content,
		ac.content)
	ac.content = ac.content[:length]
	return ac
}

func (ac *arrayContainer) getCardinality() int {
	return len(ac.content)
}

func (ac *arrayContainer) isEmpty() bool {
	return len(ac.content) == 0
}

func (ac *arrayContainer) rank(x uint16) int {
	answer := binarySearch(ac.content, x)
	if answer >= 0 {
		return answer + 1
	}
	return -answer - 1
}

func (ac *arrayContainer) selectInt(x uint16) int {
	return int(ac.content[x])
}

func (ac *arrayContainer) clone() container {
	ptr := arrayContainer{make([]uint16, len(ac.content))}
	copy(ptr.content, ac.content[:])
	return &ptr
}

func (ac *arrayContainer) contains(x uint16) bool {
	return binarySearch(ac.content, x) >= 0
}

func (ac *arrayContainer) loadData(bitmapContainer *bitmapContainer) {
	ac.content = make([]uint16, bitmapContainer.cardinality, bitmapContainer.cardinality)
	bitmapContainer.fillArray(ac.content)
}

func (ac *arrayContainer) resetTo(a container) {
	switch x := a.(type) {
	case *arrayContainer:
		ac.realloc(len(x.content))
		copy(ac.content, x.content)

	case *bitmapContainer:
		ac.realloc(x.cardinality)
		x.fillArray(ac.content)

	case *runContainer16:
		card := int(x.getCardinality())
		ac.realloc(card)
		cur := 0
		for _, r := range x.iv {
			for val := r.start; val <= r.last(); val++ {
				ac.content[cur] = val
				cur++
			}
		}

	default:
		panic("unsupported container type")
	}
}

func (ac *arrayContainer) realloc(size int) {
	if cap(ac.content) < size {
		ac.content = make([]uint16, size)
	} else {
		ac.content = ac.content[:size]
	}
}

// previousValue returns either the target if found or the previous smaller present value.
// If the target is out of bounds a -1 is returned.
// Ex: target=4 ac=[2,3,4,6,7] returns 4
// Ex: target=5 ac=[2,3,4,6,7] returns 4
// Ex: target=6 ac=[2,3,4,6,7] returns 6
// Ex: target=8 ac=[2,3,4,6,7] returns 7
// Ex: target=1 ac=[2,3,4,6,7] returns -1
// Ex: target=0 ac=[2,3,4,6,7] returns -1
func (ac *arrayContainer) previousValue(target uint16) int {
	result := binarySearchUntil(ac.content, target)

	if result.index == len(ac.content) {
		return int(ac.maximum())
	}

	if result.outOfBounds() {
		return -1
	}

	return int(result.value)
}

// previousAbsentValue returns either the target if not found or the next larger missing value.
// If the target is out of bounds a -1 is returned
// Ex: target=4 ac=[1,2,3,4,6,7] returns 0
// Ex: target=5 ac=[1,2,3,4,6,7] returns 5
// Ex: target=6 ac=[1,2,3,4,6,7] returns 5
// Ex: target=8 ac=[1,2,3,4,6,7] returns 8
func (ac *arrayContainer) previousAbsentValue(target uint16) int {
	cardinality := len(ac.content)

	if cardinality == 0 {
		return int(target)
	}

	if target > ac.maximum() {
		return int(target)
	}

	result := binarySearchPast(ac.content, target)

	if result.notFound() {
		return int(target)
	}

	// If the target was found at index 1, then the next value down must be result.value-1
	if result.index == 1 {
		if ac.minimum() != result.value-1 {
			return int(result.value - 1)
		}
	}

	low := -1
	high := result.index

	// This uses the pigeon-hole principle.
	// the if statement compares the difference in indices vs
	// the difference in values. Suppose mid = 10 and result.index = 5
	// with ac.content[mid] = 100 and target = 10
	// then we have 5 slots for values but we need to fit in 90 values
	// so some of the values must be missing
	for low+1 < high {
		midIndex := (high + low) >> 1
		indexDifference := result.index - midIndex
		valueDifference := target - ac.content[midIndex]
		if indexDifference < int(valueDifference) {
			low = midIndex
		} else {
			high = midIndex
		}
	}

	if high == 0 {
		return int(ac.minimum()) - 1
	}

	return int(ac.content[high] - 1)
}

// nextAbsentValue returns either the target if not found or the next larger missing value.
// If the target is out of bounds a -1 is returned
// Ex: target=4 ac=[1,2,3,4,6,7] returns 5
// Ex: target=5 ac=[1,2,3,4,6,7] returns 5
// Ex: target=0 ac=[1,2,3,4,6,7] returns 0
// Ex: target=8 ac=[1,2,3,4,6,7] returns 8
func (ac *arrayContainer) nextAbsentValue(target uint16) int {
	cardinality := len(ac.content)

	if cardinality == 0 {
		return int(target)
	}
	if target < ac.minimum() {
		return int(target)
	}

	result := binarySearchPast(ac.content, target)

	if result.notFound() {
		return int(target)
	}

	if result.index == cardinality-2 {
		if ac.maximum() != result.value+1 {
			return int(result.value + 1)
		}
	}

	low := result.index
	high := len(ac.content)

	// This uses the pigeon-hole principle.
	// the if statement compares the difference in indices vs
	// the difference in values. Suppose mid = 10 and result.index = 5
	// with ac.content[mid] = 100 and target = 10
	// then we have 5 slots for values but we need to fit in 90 values
	// so some of the values must be missing
	for low+1 < high {
		midIndex := (high + low) >> 1
		indexDifference := midIndex - result.index
		valueDifference := ac.content[midIndex] - target
		if indexDifference < int(valueDifference) {
			high = midIndex
		} else {
			low = midIndex
		}
	}

	if low == cardinality-1 {
		return int(ac.content[cardinality-1] + 1)
	}

	return int(ac.content[low] + 1)
}

// nextValue returns either the target if found or the next larger value.
// if the target is out of bounds a -1 is returned
//
// Ex: target=4 ac=[1,2,3,4,6,7] returns 4
// Ex: target=5 ac=[1,2,3,4,6,7] returns 6
// Ex: target=6 ac=[1,2,3,4,6,7] returns 6
// Ex: target=0 ac=[1,2,3,4,6,7] returns 1
// Ex: target=100 ac=[1,2,3,4,6,7] returns -1
func (ac *arrayContainer) nextValue(target uint16) int {
	cardinality := len(ac.content)
	if cardinality == 0 {
		return -1
	}

	//if target < ac.minimum() {
	//	return -1
	//}
	//if target > ac.maximum() {
	//		return -1
	//	}

	result := binarySearchUntil(ac.content, target)
	if result.exactMatch {
		return int(result.value)
	}

	if !result.exactMatch && result.index == -1 {
		return int(ac.content[0])
	}
	if result.outOfBounds() {
		return -1
	}

	if result.index < len(ac.content)-1 {
		return int(ac.content[result.index+1])
	}
	return -1
}

func newArrayContainer() *arrayContainer {
	p := new(arrayContainer)
	return p
}

func newArrayContainerFromBitmap(bc *bitmapContainer) *arrayContainer {
	ac := &arrayContainer{}
	ac.loadData(bc)
	return ac
}

func newArrayContainerCapacity(size int) *arrayContainer {
	p := new(arrayContainer)
	p.content = make([]uint16, 0, size)
	return p
}

func newArrayContainerSize(size int) *arrayContainer {
	p := new(arrayContainer)
	p.content = make([]uint16, size, size)
	return p
}

func newArrayContainerRange(firstOfRun, lastOfRun int) *arrayContainer {
	valuesInRange := lastOfRun - firstOfRun + 1
	this := newArrayContainerCapacity(valuesInRange)
	for i := 0; i < valuesInRange; i++ {
		this.content = append(this.content, uint16(firstOfRun+i))
	}
	return this
}

func (ac *arrayContainer) numberOfRuns() (nr int) {
	n := len(ac.content)
	var runlen uint16
	var cur, prev uint16

	switch n {
	case 0:
		return 0
	case 1:
		return 1
	default:
		for i := 1; i < n; i++ {
			prev = ac.content[i-1]
			cur = ac.content[i]

			if cur == prev+1 {
				runlen++
			} else {
				if cur < prev {
					panic("the fundamental arrayContainer assumption of sorted ac.content was broken")
				}
				if cur == prev {
					panic("the fundamental arrayContainer assumption of deduplicated content was broken")
				} else {
					nr++
					runlen = 0
				}
			}
		}
		nr++
	}
	return
}

// convert to run or array *if needed*
func (ac *arrayContainer) toEfficientContainer() container {
	numRuns := ac.numberOfRuns()
	sizeAsRunContainer := runContainer16SerializedSizeInBytes(numRuns)
	sizeAsBitmapContainer := bitmapContainerSizeInBytes()
	card := ac.getCardinality()
	sizeAsArrayContainer := arrayContainerSizeInBytes(card)
	if sizeAsRunContainer < minOfInt(sizeAsBitmapContainer, sizeAsArrayContainer) {
		return newRunContainer16FromArray(ac)
	}
	if card <= arrayDefaultMaxSize {
		return ac
	}
	return ac.toBitmapContainer()
}

func (ac *arrayContainer) containerType() contype {
	return arrayContype
}

func (ac *arrayContainer) addOffset(x uint16) (container, container) {
	var low, high *arrayContainer

	if len(ac.content) == 0 {
		return nil, nil
	}

	if y := uint32(ac.content[0]) + uint32(x); highbits(y) == 0 {
		// Some elements will fall into low part, allocate a container.
		// Checking the first one is enough because they are ordered.
		low = &arrayContainer{}
	}
	if y := uint32(ac.content[len(ac.content)-1]) + uint32(x); highbits(y) > 0 {
		// Some elements will fall into high part, allocate a container.
		// Checking the last one is enough because they are ordered.
		high = &arrayContainer{}
	}

	for _, val := range ac.content {
		y := uint32(val) + uint32(x)
		if highbits(y) > 0 {
			// OK, if high == nil then highbits(y) == 0 for all y.
			high.content = append(high.content, lowbits(y))
		} else {
			// OK, if low == nil then highbits(y) > 0 for all y.
			low.content = append(low.content, lowbits(y))
		}
	}

	// Ensure proper nil interface.
	if low == nil {
		return nil, high
	}
	if high == nil {
		return low, nil
	}

	return low, high
}

// validate checks cardinality and sort order of the array container
func (ac *arrayContainer) validate() error {
	cardinality := ac.getCardinality()

	if cardinality <= 0 {
		return ErrArrayInvalidSize
	}

	if cardinality > arrayDefaultMaxSize {
		return ErrArrayInvalidSize
	}

	previous := ac.content[0]
	for i := 1; i < len(ac.content); i++ {
		next := ac.content[i]
		if previous > next {
			return ErrArrayIncorrectSort
		}
		previous = next

	}

	return nil
}
