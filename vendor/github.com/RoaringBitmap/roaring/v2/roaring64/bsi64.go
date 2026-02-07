package roaring64

import (
	"fmt"
	"io"
	"math/big"
	"runtime"
	"sync"
)

// BSI is at its simplest is an array of bitmaps that represent an encoded
// binary value.  The advantage of a BSI is that comparisons can be made
// across ranges of values whereas a bitmap can only represent the existence
// of a single value for a given column ID.  Another usage scenario involves
// storage of high cardinality values.
//
// It depends upon the bitmap libraries.  It is not thread safe, so
// upstream concurrency guards must be provided.
type BSI struct {
	bA           []Bitmap
	eBM          Bitmap // Existence BitMap
	MaxValue     int64
	MinValue     int64
	runOptimized bool
}

// NewBSI constructs a new BSI. Note that it is your responsibility to ensure that
// the min/max values are set correctly. Queries CompareValue, MinMax, etc. will not
// work correctly if the min/max values are not set correctly.
func NewBSI(maxValue int64, minValue int64) *BSI {

	bitszmin := big.NewInt(minValue).BitLen() + 1
	bitszmax := big.NewInt(maxValue).BitLen() + 1
	bitsz := bitszmin
	if bitszmax > bitsz {
		bitsz = bitszmax
	}
	ba := make([]Bitmap, bitsz)
	return &BSI{bA: ba, MaxValue: maxValue, MinValue: minValue}
}

// NewDefaultBSI constructs an auto-sized BSI
func NewDefaultBSI() *BSI {
	return NewBSI(int64(0), int64(0))
}

// RunOptimize attempts to further compress the runs of consecutive values found in the bitmap
func (b *BSI) RunOptimize() {
	b.eBM.RunOptimize()
	for i := 0; i < len(b.bA); i++ {
		b.bA[i].RunOptimize()
	}
	b.runOptimized = true
}

// HasRunCompression returns true if the bitmap benefits from run compression
func (b *BSI) HasRunCompression() bool {
	return b.runOptimized
}

// GetExistenceBitmap returns a pointer to the underlying existence bitmap of the BSI
func (b *BSI) GetExistenceBitmap() *Bitmap {
	return &b.eBM
}

// ValueExists tests whether the value exists.
func (b *BSI) ValueExists(columnID uint64) bool {

	return b.eBM.Contains(uint64(columnID))
}

// GetCardinality returns a count of unique column IDs for which a value has been set.
func (b *BSI) GetCardinality() uint64 {
	return b.eBM.GetCardinality()
}

// BitCount returns the number of bits needed to represent values.
func (b *BSI) BitCount() int {
	return len(b.bA) - 1 // Exclude sign bit
}

// IsBigUInt returns the number of bits needed to represent values.
func (b *BSI) isBig() bool {
	return len(b.bA) > 64
}

// IsNegative returns true for negative values
func (b *BSI) IsNegative(columnID uint64) bool {
	if len(b.bA) == 0 {
		return false
	}
	return b.bA[b.BitCount()].Contains(columnID)
}

// SetBigValue sets a value that exceeds 64 bits
func (b *BSI) SetBigValue(columnID uint64, value *big.Int) {
	// If max/min values are set to zero then automatically determine bit array size
	if b.MaxValue == 0 && b.MinValue == 0 {
		minBits := value.BitLen() + 1
		if minBits == 1 {
			minBits = 2
		}
		for len(b.bA) < minBits {
			b.bA = append(b.bA, Bitmap{})
		}
	}

	for i := b.BitCount(); i >= 0; i-- {
		if value.Bit(i) == 0 {
			b.bA[i].Remove(columnID)
		} else {
			b.bA[i].Add(columnID)
		}
	}
	b.eBM.Add(columnID)
}

// SetValue sets a value for a given columnID.
func (b *BSI) SetValue(columnID uint64, value int64) {
	b.SetBigValue(columnID, big.NewInt(value))
}

// GetValue gets the value at the column ID. Second param will be false for non-existent values.
func (b *BSI) GetValue(columnID uint64) (value int64, exists bool) {
	bv, exists := b.GetBigValue(columnID)
	if !exists {
		return
	}
	if !bv.IsInt64() {
		if bv.Sign() == -1 {
			msg := fmt.Errorf("can't represent a negative %d bit value as an int64", b.BitCount())
			panic(msg)
		}
		if bv.Sign() == 1 {
			msg := fmt.Errorf("can't represent a positive %d bit value as an int64", b.BitCount())
			panic(msg)
		}
	}
	return bv.Int64(), exists
}

// GetBigValue gets the value at the column ID. Second param will be false for non-existent values.
func (b *BSI) GetBigValue(columnID uint64) (value *big.Int, exists bool) {
	exists = b.eBM.Contains(columnID)
	if !exists {
		return
	}
	val := big.NewInt(0)
	for i := b.BitCount(); i >= 0; i-- {
		if b.bA[i].Contains(columnID) {
			bigBit := big.NewInt(1)
			bigBit.Lsh(bigBit, uint(i))
			val.Or(val, bigBit)
		}
	}

	if b.IsNegative(columnID) {
		val = negativeTwosComplementToInt(val)
	}
	return val, exists
}

func negativeTwosComplementToInt(val *big.Int) *big.Int {
	inverted := new(big.Int).Not(val)
	mask := new(big.Int).Lsh(big.NewInt(1), uint(val.BitLen()))
	inverted.And(inverted, mask.Sub(mask, big.NewInt(1)))
	inverted.Add(inverted, big.NewInt(1))
	val.Neg(inverted)
	return val
}

type action func(t *task, batch []uint64, resultsChan chan *Bitmap, wg *sync.WaitGroup)

func parallelExecutor(parallelism int, t *task, e action, foundSet *Bitmap) *Bitmap {

	var n int = parallelism
	if n == 0 {
		n = runtime.NumCPU()
	}

	resultsChan := make(chan *Bitmap, n)

	card := foundSet.GetCardinality()
	x := card / uint64(n)

	remainder := card - (x * uint64(n))
	var batch []uint64
	var wg sync.WaitGroup
	iter := foundSet.ManyIterator()
	for i := 0; i < n; i++ {
		if i == n-1 {
			batch = make([]uint64, x+remainder)
		} else {
			batch = make([]uint64, x)
		}
		iter.NextMany(batch)
		wg.Add(1)
		go e(t, batch, resultsChan, &wg)
	}

	wg.Wait()

	close(resultsChan)

	ba := make([]*Bitmap, 0)
	for bm := range resultsChan {
		ba = append(ba, bm)
	}

	return ParOr(0, ba...)

}

type bsiAction func(input *BSI, filterSet *Bitmap, batch []uint64, resultsChan chan *BSI, wg *sync.WaitGroup)

func parallelExecutorBSIResults(parallelism int, input *BSI, e bsiAction, foundSet, filterSet *Bitmap, sumResults bool) *BSI {

	var n int = parallelism
	if n == 0 {
		n = runtime.NumCPU()
	}

	resultsChan := make(chan *BSI, n)

	card := foundSet.GetCardinality()
	x := card / uint64(n)

	remainder := card - (x * uint64(n))
	var batch []uint64
	var wg sync.WaitGroup
	iter := foundSet.ManyIterator()
	for i := 0; i < n; i++ {
		if i == n-1 {
			batch = make([]uint64, x+remainder)
		} else {
			batch = make([]uint64, x)
		}
		iter.NextMany(batch)
		wg.Add(1)
		go e(input, filterSet, batch, resultsChan, &wg)
	}

	wg.Wait()

	close(resultsChan)

	ba := make([]*BSI, 0)
	for bm := range resultsChan {
		ba = append(ba, bm)
	}

	results := NewDefaultBSI()
	if sumResults {
		for _, v := range ba {
			results.Add(v)
		}
	} else {
		results.ParOr(0, ba...)
	}
	return results

}

// Operation identifier
type Operation int

const (
	// LT less than
	LT Operation = 1 + iota
	// LE less than or equal
	LE
	// EQ equal
	EQ
	// GE greater than or equal
	GE
	// GT greater than
	GT
	// RANGE range
	RANGE
	// MIN find minimum
	MIN
	// MAX find maximum
	MAX
)

type task struct {
	bsi          *BSI
	op           Operation
	valueOrStart *big.Int
	end          *big.Int
	values       map[string]struct{}
	bits         *Bitmap
}

// CompareValue compares value.
// Values should be in the range of the BSI (max, min).  If the value is outside the range, the result
// might erroneous.  The operation parameter indicates the type of comparison to be made.
// For all operations with the exception of RANGE, the value to be compared is specified by valueOrStart.
// For the RANGE parameter the comparison criteria is >= valueOrStart and <= end.
// The parallelism parameter indicates the number of CPU threads to be applied for processing.  A value
// of zero indicates that all available CPU resources will be potentially utilized.
func (b *BSI) CompareValue(parallelism int, op Operation, valueOrStart, end int64,
	foundSet *Bitmap) *Bitmap {

	return b.CompareBigValue(parallelism, op, big.NewInt(valueOrStart), big.NewInt(end), foundSet)
}

// CompareBigValue compares value.
// Values should be in the range of the BSI (max, min).  If the value is outside the range, the result
// might erroneous.  The operation parameter indicates the type of comparison to be made.
// For all operations with the exception of RANGE, the value to be compared is specified by valueOrStart.
// For the RANGE parameter the comparison criteria is >= valueOrStart and <= end.
// The parallelism parameter indicates the number of CPU threads to be applied for processing.  A value
// of zero indicates that all available CPU resources will be potentially utilized.
func (b *BSI) CompareBigValue(parallelism int, op Operation, valueOrStart, end *big.Int,
	foundSet *Bitmap) *Bitmap {

	if valueOrStart == nil {
		valueOrStart = b.MinMaxBig(parallelism, MIN, &b.eBM)
	}
	if end == nil && op == RANGE {
		end = b.MinMaxBig(parallelism, MAX, &b.eBM)
	}

	comp := &task{bsi: b, op: op, valueOrStart: valueOrStart, end: end}
	if foundSet == nil {
		return parallelExecutor(parallelism, comp, compareValue, &b.eBM)
	}
	return parallelExecutor(parallelism, comp, compareValue, foundSet)
}

// Returns a twos complement value given a value, the return will be bit extended to 'bits' length
// if the value is negative
func twosComplement(num *big.Int, bitCount int) *big.Int {
	// Check if the number is negative
	isNegative := num.Sign() < 0

	// Get the absolute value if negative
	abs := new(big.Int).Abs(num)

	// Convert to binary string
	binStr := abs.Text(2)

	// Pad with zeros to the left
	if len(binStr) < bitCount {
		binStr = fmt.Sprintf("%0*s", bitCount, binStr)
	}

	// If negative, calculate two's complement
	if isNegative {
		// Invert bits
		inverted := make([]byte, len(binStr))
		for i := range binStr {
			if binStr[i] == '0' {
				inverted[i] = '1'
			} else {
				inverted[i] = '0'
			}
		}

		// Add 1
		carry := byte(1)
		for i := len(inverted) - 1; i >= 0; i-- {
			inverted[i] += carry
			if inverted[i] == '2' {
				inverted[i] = '0'
			} else {
				break
			}
		}
		binStr = string(inverted)
	}

	bigInt := new(big.Int)
	_, _ = bigInt.SetString(binStr, 2)
	return bigInt
}

func compareValue(e *task, batch []uint64, resultsChan chan *Bitmap, wg *sync.WaitGroup) {

	defer wg.Done()

	results := NewBitmap()
	if e.bsi.runOptimized {
		results.RunOptimize()
	}

	startIsNegative := e.valueOrStart.Sign() == -1
	endIsNegative := true
	if e.end != nil {
		endIsNegative = e.end.Sign() == -1
	}

	for i := 0; i < len(batch); i++ {
		cID := batch[i]
		eq1, eq2 := true, true
		lt1, lt2, gt1 := false, false, false
		j := e.bsi.BitCount()
		isNegative := e.bsi.IsNegative(cID)
		compStartValue := e.valueOrStart
		compEndValue := e.end
		if isNegative != startIsNegative {
			compStartValue = twosComplement(e.valueOrStart, e.bsi.BitCount()+1)
		}
		if isNegative != endIsNegative && e.end != nil {
			compEndValue = twosComplement(e.end, e.bsi.BitCount()+1)
		}

		for ; j >= 0; j-- {
			sliceContainsBit := e.bsi.bA[j].Contains(cID)

			if compStartValue.Bit(j) == 1 {
				// BIT in value is SET
				if !sliceContainsBit {
					if eq1 {
						if (e.op == GT || e.op == GE || e.op == RANGE) && startIsNegative && !isNegative {
							gt1 = true
						}
						if e.op == LT || e.op == LE {
							if !startIsNegative || (startIsNegative == isNegative) {
								lt1 = true
							}
						}
						eq1 = false
						if e.op != RANGE {
							break
						}
					}
				}
			} else {
				// BIT in value is CLEAR
				if sliceContainsBit {
					if eq1 {
						if (e.op == LT || e.op == LE) && isNegative && !startIsNegative {
							lt1 = true
						}
						if e.op == GT || e.op == GE || e.op == RANGE {
							if startIsNegative || (startIsNegative == isNegative) {
								gt1 = true
							}
						}
						eq1 = false

						if e.op != RANGE {
							break
						}
					}
				}
			}

			if e.op == RANGE && compEndValue.Bit(j) == 1 {
				// BIT in value is SET
				if !sliceContainsBit {
					if eq2 {
						if !endIsNegative || (endIsNegative == isNegative) {
							lt2 = true
						}
						eq2 = false
						if startIsNegative && !endIsNegative {
							break
						}
					}
				}
			} else if e.op == RANGE {
				// BIT in value is CLEAR
				if sliceContainsBit {
					if eq2 {
						if isNegative && !endIsNegative {
							lt2 = true
						}
						eq2 = false
					}
				}
			}
		}

		switch e.op {
		case LT:
			if lt1 {
				results.Add(cID)
			}
		case LE:
			if lt1 || (eq1 && (!startIsNegative || (startIsNegative && isNegative))) {
				results.Add(cID)
			}
		case EQ:
			if eq1 {
				results.Add(cID)
			}
		case GE:
			if gt1 || (eq1 && (startIsNegative || (!startIsNegative && !isNegative))) {
				results.Add(cID)
			}
		case GT:
			if gt1 {
				results.Add(cID)
			}
		case RANGE:
			if (eq1 || gt1) && (eq2 || lt2) {
				results.Add(cID)
			}
		default:
			panic(fmt.Sprintf("Operation [%v] not supported here", e.op))
		}
	}

	resultsChan <- results
}

// MinMax - Find minimum or maximum int64 value.
func (b *BSI) MinMax(parallelism int, op Operation, foundSet *Bitmap) int64 {
	return b.MinMaxBig(parallelism, op, foundSet).Int64()
}

// MinMaxBig - Find minimum or maximum value.
func (b *BSI) MinMaxBig(parallelism int, op Operation, foundSet *Bitmap) *big.Int {

	var n int = parallelism
	if n == 0 {
		n = runtime.NumCPU()
	}

	resultsChan := make(chan *big.Int, n)

	if foundSet == nil {
		foundSet = &b.eBM
	}

	card := foundSet.GetCardinality()
	x := card / uint64(n)

	remainder := card - (x * uint64(n))
	var batch []uint64
	var wg sync.WaitGroup
	iter := foundSet.ManyIterator()
	for i := 0; i < n; i++ {
		if i == n-1 {
			batch = make([]uint64, x+remainder)
		} else {
			batch = make([]uint64, x)
		}
		iter.NextMany(batch)
		wg.Add(1)
		go b.minOrMax(op, batch, resultsChan, &wg)
	}

	wg.Wait()

	close(resultsChan)
	var minMax *big.Int
	minSigned, maxSigned := minMaxSignedInt(b.BitCount() + 1)
	if op == MAX {
		minMax = minSigned
	} else {
		minMax = maxSigned
	}

	for val := range resultsChan {
		if (op == MAX && val.Cmp(minMax) > 0) || (op == MIN && val.Cmp(minMax) <= 0) {
			minMax = val
		}
	}
	return minMax
}

func minMaxSignedInt(bits int) (*big.Int, *big.Int) {
	// Calculate the maximum value
	max := new(big.Int).Lsh(big.NewInt(1), uint(bits-1))
	max.Sub(max, big.NewInt(1))

	// Calculate the minimum value
	min := new(big.Int).Neg(max)
	min.Sub(min, big.NewInt(1))

	return min, max
}

func (b *BSI) minOrMax(op Operation, batch []uint64, resultsChan chan *big.Int, wg *sync.WaitGroup) {

	defer wg.Done()

	x := b.BitCount() + 1
	var value *big.Int
	minSigned, maxSigned := minMaxSignedInt(x)
	if op == MAX {
		value = minSigned
	} else {
		value = maxSigned
	}

	for i := 0; i < len(batch); i++ {
		cID := batch[i]
		eq := true
		lt, gt := false, false
		j := b.BitCount()
		cVal := new(big.Int)
		valueIsNegative := value.Sign() == -1
		isNegative := b.IsNegative(cID)

		compValue := value
		if isNegative != valueIsNegative {
			// convert compValue to twos complement
			inverted := new(big.Int).Not(compValue)
			mask := new(big.Int).Lsh(big.NewInt(1), uint(compValue.BitLen()))
			inverted.And(inverted, mask.Sub(mask, big.NewInt(1)))
			inverted.Add(inverted, big.NewInt(1))
		}

		done := false
		for ; j >= 0; j-- {
			sliceContainsBit := b.bA[j].Contains(cID)
			if sliceContainsBit {
				bigBit := big.NewInt(1)
				bigBit.Lsh(bigBit, uint(j))
				cVal.Or(cVal, bigBit)
				if isNegative {
					cVal = negativeTwosComplementToInt(cVal)
				}
			}
			if done {
				continue
			}
			if compValue.Bit(j) == 1 {
				// BIT in value is SET
				if !sliceContainsBit {
					if eq {
						eq = false
						if op == MAX && valueIsNegative && !isNegative {
							gt = true
							done = true
						}
						if op == MIN && (!valueIsNegative || (valueIsNegative == isNegative)) {
							lt = true
						}
					}
				}
			} else {
				// BIT in value is CLEAR
				if sliceContainsBit {
					if eq {
						eq = false
						if op == MIN && isNegative && !valueIsNegative {
							lt = true
						}
						if op == MAX && (valueIsNegative || (valueIsNegative == isNegative)) {
							gt = true
							done = true
						}
					}
				}
			}
		}

		if lt || gt {
			value = cVal
		}
	}

	resultsChan <- value
}

// Sum all values contained within the foundSet.   As a convenience, the cardinality of the foundSet
// is also returned (for calculating the average).
func (b *BSI) Sum(foundSet *Bitmap) (int64, uint64) {
	val, count := b.SumBigValues(foundSet)
	return val.Int64(), count
}

// SumBigValues - Sum all values contained within the foundSet.   As a convenience, the cardinality of the foundSet
// is also returned (for calculating the average).   This method will sum arbitrarily large values.
func (b *BSI) SumBigValues(foundSet *Bitmap) (sum *big.Int, count uint64) {
	if foundSet == nil {
		foundSet = &b.eBM
	}
	sum = new(big.Int)
	count = foundSet.GetCardinality()
	resultsChan := make(chan int64, b.BitCount())
	var wg sync.WaitGroup
	for i := 0; i < b.BitCount(); i++ {
		wg.Add(1)
		go func(j int) {
			defer wg.Done()
			resultsChan <- int64(foundSet.AndCardinality(&b.bA[j]) << uint(j))
		}(i)
	}
	wg.Wait()
	close(resultsChan)

	for val := range resultsChan {
		sum.Add(sum, big.NewInt(val))
	}
	sum.Sub(sum, big.NewInt(int64(foundSet.AndCardinality(&b.bA[b.BitCount()])<<uint(b.BitCount()))))

	return sum, count
}

// Transpose calls b.IntersectAndTranspose(0, b.eBM)
func (b *BSI) Transpose() *Bitmap {
	return b.IntersectAndTranspose(0, &b.eBM)
}

// IntersectAndTranspose is a matrix transpose function.  Return a bitmap such that the values are represented as column IDs
// in the returned bitmap. This is accomplished by iterating over the foundSet and only including
// the column IDs in the source (foundSet) as compared with this BSI.  This can be useful for
// vectoring one set of integers to another.
//
// TODO: This implementation is functional but not performant, needs to be re-written perhaps using SIMD SSE2 instructions.
func (b *BSI) IntersectAndTranspose(parallelism int, foundSet *Bitmap) *Bitmap {
	if foundSet == nil {
		foundSet = &b.eBM
	}
	trans := &task{bsi: b}
	return parallelExecutor(parallelism, trans, transpose, foundSet)
}

func transpose(e *task, batch []uint64, resultsChan chan *Bitmap, wg *sync.WaitGroup) {

	defer wg.Done()

	results := NewBitmap()
	if e.bsi.runOptimized {
		results.RunOptimize()
	}
	for _, cID := range batch {
		if value, ok := e.bsi.GetValue(uint64(cID)); ok {
			results.Add(uint64(value))
		}
	}
	resultsChan <- results
}

// ParOr is intended primarily to be a concatenation function to be used during bulk load operations.
// Care should be taken to make sure that columnIDs do not overlap (unless overlapping values are
// identical).
func (b *BSI) ParOr(parallelism int, bsis ...*BSI) {

	// Consolidate sets
	bits := len(b.bA)
	for i := 0; i < len(bsis); i++ {
		if len(bsis[i].bA) > bits {
			bits = len(bsis[i].bA )
		}
	}

	// Make sure we have enough bit slices
	for bits > len(b.bA) {
		bm := Bitmap{}
		bm.RunOptimize()
		b.bA = append(b.bA, bm)
	}

	a := make([][]*Bitmap, bits)
	for i := range a {
		a[i] = make([]*Bitmap, 0)
		for _, x := range bsis {
			if len(x.bA) > i {
				a[i] = append(a[i], &x.bA[i])
			} else {
				if b.runOptimized {
					a[i][0].RunOptimize()
				}
			}
		}
	}

	// Consolidate existence bit maps
	ebms := make([]*Bitmap, len(bsis))
	for i := range ebms {
		ebms[i] = &bsis[i].eBM
	}

	// First merge all the bit slices from all bsi maps that exist in target
	var wg sync.WaitGroup
	for i := 0; i < bits; i++ {
		wg.Add(1)
		go func(j int) {
			defer wg.Done()
			x := []*Bitmap{&b.bA[j]}
			x = append(x, a[j]...)
			b.bA[j] = *ParOr(parallelism, x...)
		}(i)
	}
	wg.Wait()

	// merge all the EBM maps
	x := []*Bitmap{&b.eBM}
	x = append(x, ebms...)
	b.eBM = *ParOr(parallelism, x...)
}

// UnmarshalBinary de-serialize a BSI.  The value at bitData[0] is the EBM.  Other indices are in least to most
// significance order starting at bitData[1] (bit position 0).
func (b *BSI) UnmarshalBinary(bitData [][]byte) error {

	for i := 1; i < len(bitData); i++ {
		if bitData == nil || len(bitData[i]) == 0 {
			continue
		}
		if b.BitCount() < i {
			newBm := Bitmap{}
			if b.runOptimized {
				newBm.RunOptimize()
			}
			b.bA = append(b.bA, newBm)
		}
		if err := b.bA[i-1].UnmarshalBinary(bitData[i]); err != nil {
			return err
		}
		if b.runOptimized {
			b.bA[i-1].RunOptimize()
		}

	}
	// First element of bitData is the EBM
	if bitData[0] == nil {
		b.eBM = Bitmap{}
		if b.runOptimized {
			b.eBM.RunOptimize()
		}
		return nil
	}
	if err := b.eBM.UnmarshalBinary(bitData[0]); err != nil {
		return err
	}
	if b.runOptimized {
		b.eBM.RunOptimize()
	}
	return nil
}

// ReadFrom reads a serialized version of this BSI from stream.
func (b *BSI) ReadFrom(stream io.Reader) (p int64, err error) {
	bm, n, err := readBSIContainerFromStream(stream)
	p += n
	if err != nil {
		err = fmt.Errorf("reading existence bitmap: %w", err)
		return
	}
	b.eBM = bm
	b.bA = b.bA[:0]
	for {
		// This forces a new memory location to be allocated and if we're lucky it only escapes if
		// there's no error.
		var bm Bitmap
		bm, n, err = readBSIContainerFromStream(stream)
		p += n
		if err == io.EOF {
			err = nil
			return
		}
		if err != nil {
			err = fmt.Errorf("reading bit slice index %v: %w", len(b.bA), err)
			return
		}
		b.bA = append(b.bA, bm)
	}
}

func readBSIContainerFromStream(r io.Reader) (bm Bitmap, p int64, err error) {
	p, err = bm.ReadFrom(r)
	return
}

// MarshalBinary serializes a BSI
func (b *BSI) MarshalBinary() ([][]byte, error) {

	var err error
	data := make([][]byte, b.BitCount()+1)
	// Add extra element for EBM (BitCount() + 1)
	for i := 1; i < b.BitCount()+1; i++ {
		data[i], err = b.bA[i-1].MarshalBinary()
		if err != nil {
			return nil, err
		}
	}
	// Marshal EBM
	data[0], err = b.eBM.MarshalBinary()
	if err != nil {
		return nil, err
	}
	return data, nil
}

// WriteTo writes a serialized version of this BSI to stream.
func (b *BSI) WriteTo(w io.Writer) (n int64, err error) {
	n1, err := b.eBM.WriteTo(w)
	n += n1
	if err != nil {
		return
	}
	for _, bm := range b.bA {
		n1, err = bm.WriteTo(w)
		n += n1
		if err != nil {
			return
		}
	}
	return
}

// BatchEqual returns a bitmap containing the column IDs where the values are contained within the list of values provided.
func (b *BSI) BatchEqual(parallelism int, values []int64) *Bitmap {
	//convert list of int64 values to big.Int(s)
	bigValues := make([]*big.Int, len(values))
	for i, v := range values {
		bigValues[i] = big.NewInt(v)
	}
	return b.BatchEqualBig(parallelism, bigValues)
}

// BatchEqualBig returns a bitmap containing the column IDs where the values are contained within the list of values provided.
func (b *BSI) BatchEqualBig(parallelism int, values []*big.Int) *Bitmap {

	valMap := make(map[string]struct{}, len(values))
	for i := 0; i < len(values); i++ {
		valMap[string(values[i].Bytes())] = struct{}{}
	}
	comp := &task{bsi: b, values: valMap}
	return parallelExecutor(parallelism, comp, batchEqual, &b.eBM)
}

func batchEqual(e *task, batch []uint64, resultsChan chan *Bitmap,
	wg *sync.WaitGroup) {

	defer wg.Done()

	results := NewBitmap()
	if e.bsi.runOptimized {
		results.RunOptimize()
	}

	for i := 0; i < len(batch); i++ {
		cID := batch[i]
		if value, ok := e.bsi.GetBigValue(uint64(cID)); ok {
			if _, yes := e.values[string(value.Bytes())]; yes {
				results.Add(cID)
			}
		}
	}
	resultsChan <- results
}

// ClearBits cleared the bits that exist in the target if they are also in the found set.
func ClearBits(foundSet, target *Bitmap) {
	iter := foundSet.Iterator()
	for iter.HasNext() {
		cID := iter.Next()
		target.Remove(cID)
	}
}

// ClearValues removes the values found in foundSet
func (b *BSI) ClearValues(foundSet *Bitmap) {

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		ClearBits(foundSet, &b.eBM)
	}()
	for i := 0; i < b.BitCount(); i++ {
		wg.Add(1)
		go func(j int) {
			defer wg.Done()
			ClearBits(foundSet, &b.bA[j])
		}(i)
	}
	wg.Wait()
}

// NewBSIRetainSet - Construct a new BSI from a clone of existing BSI, retain only values contained in foundSet
func (b *BSI) NewBSIRetainSet(foundSet *Bitmap) *BSI {

	newBSI := NewDefaultBSI()
	newBSI.bA = make([]Bitmap, b.BitCount()+1)
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		newBSI.eBM = *b.eBM.Clone()
		newBSI.eBM.And(foundSet)
	}()
	for i := 0; i < b.BitCount(); i++ {
		wg.Add(1)
		go func(j int) {
			defer wg.Done()
			newBSI.bA[j] = *b.bA[j].Clone()
			newBSI.bA[j].And(foundSet)
		}(i)
	}
	wg.Wait()
	return newBSI
}

// Clone performs a deep copy of BSI contents.
func (b *BSI) Clone() *BSI {
	return b.NewBSIRetainSet(&b.eBM)
}

// Add - In-place sum the contents of another BSI with this BSI, column wise.
func (b *BSI) Add(other *BSI) {

	b.eBM.Or(&other.eBM)
	for i := 0; i < len(other.bA); i++ {
		b.addDigit(&other.bA[i], i)
	}
}

func (b *BSI) addDigit(foundSet *Bitmap, i int) {

	if i >= b.BitCount()+1 || b.BitCount() == 0 {
		b.bA = append(b.bA, Bitmap{})
	}
	carry := And(&b.bA[i], foundSet)
	b.bA[i].Xor(foundSet)
	if !carry.IsEmpty() {
		if i+1 >= b.BitCount() {
			b.bA = append(b.bA, Bitmap{})
		}
		b.addDigit(carry, i+1)
	}
}

// TransposeWithCounts is a matrix transpose function that returns a BSI that has a columnID system defined by the values
// contained within the input BSI.   Given that for BSIs, different columnIDs can have the same value.  TransposeWithCounts
// is useful for situations where there is a one-to-many relationship between the vectored integer sets.  The resulting BSI
// contains the number of times a particular value appeared in the input BSI.
func (b *BSI) TransposeWithCounts(parallelism int, foundSet, filterSet *Bitmap) *BSI {
	if foundSet == nil {
		foundSet = &b.eBM
	}
	if filterSet == nil {
		filterSet = &b.eBM
	}
	return parallelExecutorBSIResults(parallelism, b, transposeWithCounts, foundSet, filterSet, true)
}

func transposeWithCounts(input *BSI, filterSet *Bitmap, batch []uint64, resultsChan chan *BSI, wg *sync.WaitGroup) {

	defer wg.Done()

	results := NewDefaultBSI()
	if input.runOptimized {
		results.RunOptimize()
	}
	for _, cID := range batch {
		if value, ok := input.GetValue(uint64(cID)); ok {
			if !filterSet.Contains(uint64(value)) {
				continue
			}
			if val, ok2 := results.GetValue(uint64(value)); !ok2 {
				results.SetValue(uint64(value), 1)
			} else {
				val++
				results.SetValue(uint64(value), val)
			}
		}
	}
	resultsChan <- results
}

// Increment - In-place increment of values in a BSI.  Found set select columns for incrementing.
func (b *BSI) Increment(foundSet *Bitmap) {
	if foundSet == nil {
		foundSet = &b.eBM
	}
	b.addDigit(foundSet, 0)
	b.eBM.Or(foundSet)
}

// IncrementAll - In-place increment of all values in a BSI.
func (b *BSI) IncrementAll() {
	b.Increment(b.GetExistenceBitmap())
}

// Equals - Check for semantic equality of two BSIs.
func (b *BSI) Equals(other *BSI) bool {
	if !b.eBM.Equals(&other.eBM) {
		return false
	}
	for i := 0; i < len(b.bA) || i < len(other.bA); i++ {
		if i >= len(b.bA) {
			if !other.bA[i].IsEmpty() {
				return false
			}
		} else if i >= len(other.bA) {
			if !b.bA[i].IsEmpty() {
				return false
			}
		} else {
			if !b.bA[i].Equals(&other.bA[i]) {
				return false
			}
		}
	}
	return true
}

// GetSizeInBytes - the size in bytes of the data structure
func (b *BSI) GetSizeInBytes() int {
	size := b.eBM.GetSizeInBytes()
	for _, bm := range b.bA {
		size += bm.GetSizeInBytes()
	}
	return int(size)
}
