// Copyright 2024 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build dedupelabels

package labels

import (
	"bytes"
	"slices"
	"strings"
	"sync"

	"github.com/cespare/xxhash/v2"
)

// Labels is implemented by a SymbolTable and string holding name/value
// pairs encoded as indexes into the table in varint encoding.
// Names are in alphabetical order.
type Labels struct {
	syms *nameTable
	data string
}

// Split SymbolTable into the part used by Labels and the part used by Builder.  Only the latter needs the map.

// This part is used by Labels. All fields are immutable after construction.
type nameTable struct {
	byNum       []string     // This slice header is never changed, even while we are building the symbol table.
	symbolTable *SymbolTable // If we need to use it in a Builder.
}

// SymbolTable is used to map strings into numbers so they can be packed together.
type SymbolTable struct {
	mx sync.Mutex
	*nameTable
	nextNum int
	byName  map[string]int
}

const defaultSymbolTableSize = 1024

func NewSymbolTable() *SymbolTable {
	t := &SymbolTable{
		nameTable: &nameTable{byNum: make([]string, defaultSymbolTableSize)},
		byName:    make(map[string]int, defaultSymbolTableSize),
	}
	t.nameTable.symbolTable = t
	return t
}

func (t *SymbolTable) Len() int {
	t.mx.Lock()
	defer t.mx.Unlock()
	return len(t.byName)
}

// ToNum maps a string to an integer, adding the string to the table if it is not already there.
// Note: copies the string before adding, in case the caller passed part of
// a buffer that should not be kept alive by this SymbolTable.
func (t *SymbolTable) ToNum(name string) int {
	t.mx.Lock()
	defer t.mx.Unlock()
	return t.toNumUnlocked(name)
}

func (t *SymbolTable) toNumUnlocked(name string) int {
	if i, found := t.byName[name]; found {
		return i
	}
	i := t.nextNum
	if t.nextNum == cap(t.byNum) {
		// Name table is full; copy to a new one. Don't touch the existing slice, as nameTable is immutable after construction.
		newSlice := make([]string, cap(t.byNum)*2)
		copy(newSlice, t.byNum)
		t.nameTable = &nameTable{byNum: newSlice, symbolTable: t}
	}
	name = strings.Clone(name)
	t.byNum[i] = name
	t.byName[name] = i
	t.nextNum++
	return i
}

func (t *SymbolTable) checkNum(name string) (int, bool) {
	t.mx.Lock()
	defer t.mx.Unlock()
	i, bool := t.byName[name]
	return i, bool
}

// ToName maps an integer to a string.
func (t *nameTable) ToName(num int) string {
	return t.byNum[num]
}

// "Varint" in this file is non-standard: we encode small numbers (up to 32767) in 2 bytes,
// because we expect most Prometheus to have more than 127 unique strings.
// And we don't encode numbers larger than 4 bytes because we don't expect more than 536,870,912 unique strings.
func decodeVarint(data string, index int) (int, int) {
	b := int(data[index]) + int(data[index+1])<<8
	index += 2
	if b < 0x8000 {
		return b, index
	}
	return decodeVarintRest(b, data, index)
}

func decodeVarintRest(b int, data string, index int) (int, int) {
	value := int(b & 0x7FFF)
	b = int(data[index])
	index++
	if b < 0x80 {
		return value | (b << 15), index
	}

	value |= (b & 0x7f) << 15
	b = int(data[index])
	index++
	return value | (b << 22), index
}

func decodeString(t *nameTable, data string, index int) (string, int) {
	// Copy decodeVarint here, because the Go compiler says it's too big to inline.
	num := int(data[index]) + int(data[index+1])<<8
	index += 2
	if num >= 0x8000 {
		num, index = decodeVarintRest(num, data, index)
	}
	return t.ToName(num), index
}

// Bytes returns ls as a byte slice.
// It uses non-printing characters and so should not be used for printing.
func (ls Labels) Bytes(buf []byte) []byte {
	b := bytes.NewBuffer(buf[:0])
	for i := 0; i < len(ls.data); {
		if i > 0 {
			b.WriteByte(sep)
		}
		var name, value string
		name, i = decodeString(ls.syms, ls.data, i)
		value, i = decodeString(ls.syms, ls.data, i)
		b.WriteString(name)
		b.WriteByte(sep)
		b.WriteString(value)
	}
	return b.Bytes()
}

// IsZero implements yaml.IsZeroer - if we don't have this then 'omitempty' fields are always omitted.
func (ls Labels) IsZero() bool {
	return len(ls.data) == 0
}

// MatchLabels returns a subset of Labels that matches/does not match with the provided label names based on the 'on' boolean.
// If on is set to true, it returns the subset of labels that match with the provided label names and its inverse when 'on' is set to false.
// TODO: This is only used in printing an error message
func (ls Labels) MatchLabels(on bool, names ...string) Labels {
	b := NewBuilder(ls)
	if on {
		b.Keep(names...)
	} else {
		b.Del(MetricName)
		b.Del(names...)
	}
	return b.Labels()
}

// Hash returns a hash value for the label set.
// Note: the result is not guaranteed to be consistent across different runs of Prometheus.
func (ls Labels) Hash() uint64 {
	// Use xxhash.Sum64(b) for fast path as it's faster.
	b := make([]byte, 0, 1024)
	for pos := 0; pos < len(ls.data); {
		name, newPos := decodeString(ls.syms, ls.data, pos)
		value, newPos := decodeString(ls.syms, ls.data, newPos)
		if len(b)+len(name)+len(value)+2 >= cap(b) {
			// If labels entry is 1KB+, hash the rest of them via Write().
			h := xxhash.New()
			_, _ = h.Write(b)
			for pos < len(ls.data) {
				name, pos = decodeString(ls.syms, ls.data, pos)
				value, pos = decodeString(ls.syms, ls.data, pos)
				_, _ = h.WriteString(name)
				_, _ = h.Write(seps)
				_, _ = h.WriteString(value)
				_, _ = h.Write(seps)
			}
			return h.Sum64()
		}

		b = append(b, name...)
		b = append(b, sep)
		b = append(b, value...)
		b = append(b, sep)
		pos = newPos
	}
	return xxhash.Sum64(b)
}

// HashForLabels returns a hash value for the labels matching the provided names.
// 'names' have to be sorted in ascending order.
func (ls Labels) HashForLabels(b []byte, names ...string) (uint64, []byte) {
	b = b[:0]
	j := 0
	for i := 0; i < len(ls.data); {
		var name, value string
		name, i = decodeString(ls.syms, ls.data, i)
		value, i = decodeString(ls.syms, ls.data, i)
		for j < len(names) && names[j] < name {
			j++
		}
		if j == len(names) {
			break
		}
		if name == names[j] {
			b = append(b, name...)
			b = append(b, sep)
			b = append(b, value...)
			b = append(b, sep)
		}
	}

	return xxhash.Sum64(b), b
}

// HashWithoutLabels returns a hash value for all labels except those matching
// the provided names.
// 'names' have to be sorted in ascending order.
func (ls Labels) HashWithoutLabels(b []byte, names ...string) (uint64, []byte) {
	b = b[:0]
	j := 0
	for i := 0; i < len(ls.data); {
		var name, value string
		name, i = decodeString(ls.syms, ls.data, i)
		value, i = decodeString(ls.syms, ls.data, i)
		for j < len(names) && names[j] < name {
			j++
		}
		if name == MetricName || (j < len(names) && name == names[j]) {
			continue
		}
		b = append(b, name...)
		b = append(b, sep)
		b = append(b, value...)
		b = append(b, sep)
	}
	return xxhash.Sum64(b), b
}

// BytesWithLabels is just as Bytes(), but only for labels matching names.
// 'names' have to be sorted in ascending order.
func (ls Labels) BytesWithLabels(buf []byte, names ...string) []byte {
	b := bytes.NewBuffer(buf[:0])
	j := 0
	for pos := 0; pos < len(ls.data); {
		lName, newPos := decodeString(ls.syms, ls.data, pos)
		lValue, newPos := decodeString(ls.syms, ls.data, newPos)
		for j < len(names) && names[j] < lName {
			j++
		}
		if j == len(names) {
			break
		}
		if lName == names[j] {
			if b.Len() > 1 {
				b.WriteByte(sep)
			}
			b.WriteString(lName)
			b.WriteByte(sep)
			b.WriteString(lValue)
		}
		pos = newPos
	}
	return b.Bytes()
}

// BytesWithoutLabels is just as Bytes(), but only for labels not matching names.
// 'names' have to be sorted in ascending order.
func (ls Labels) BytesWithoutLabels(buf []byte, names ...string) []byte {
	b := bytes.NewBuffer(buf[:0])
	j := 0
	for pos := 0; pos < len(ls.data); {
		lName, newPos := decodeString(ls.syms, ls.data, pos)
		lValue, newPos := decodeString(ls.syms, ls.data, newPos)
		for j < len(names) && names[j] < lName {
			j++
		}
		if j == len(names) || lName != names[j] {
			if b.Len() > 1 {
				b.WriteByte(sep)
			}
			b.WriteString(lName)
			b.WriteByte(sep)
			b.WriteString(lValue)
		}
		pos = newPos
	}
	return b.Bytes()
}

// Copy returns a copy of the labels.
func (ls Labels) Copy() Labels {
	return Labels{syms: ls.syms, data: strings.Clone(ls.data)}
}

// Get returns the value for the label with the given name.
// Returns an empty string if the label doesn't exist.
func (ls Labels) Get(name string) string {
	if name == "" { // Avoid crash in loop if someone asks for "".
		return "" // Prometheus does not store blank label names.
	}
	for i := 0; i < len(ls.data); {
		var lName, lValue string
		lName, i = decodeString(ls.syms, ls.data, i)
		if lName == name {
			lValue, _ = decodeString(ls.syms, ls.data, i)
			return lValue
		} else if lName[0] > name[0] { // Stop looking if we've gone past.
			break
		}
		// Copy decodeVarint here, because the Go compiler says it's too big to inline.
		num := int(ls.data[i]) + int(ls.data[i+1])<<8
		i += 2
		if num >= 0x8000 {
			_, i = decodeVarintRest(num, ls.data, i)
		}
	}
	return ""
}

// Has returns true if the label with the given name is present.
func (ls Labels) Has(name string) bool {
	if name == "" { // Avoid crash in loop if someone asks for "".
		return false // Prometheus does not store blank label names.
	}
	for i := 0; i < len(ls.data); {
		var lName string
		lName, i = decodeString(ls.syms, ls.data, i)
		if lName == name {
			return true
		} else if lName[0] > name[0] { // Stop looking if we've gone past.
			break
		}
		// Copy decodeVarint here, because the Go compiler says it's too big to inline.
		num := int(ls.data[i]) + int(ls.data[i+1])<<8
		i += 2
		if num >= 0x8000 {
			_, i = decodeVarintRest(num, ls.data, i)
		}
	}
	return false
}

// HasDuplicateLabelNames returns whether ls has duplicate label names.
// It assumes that the labelset is sorted.
func (ls Labels) HasDuplicateLabelNames() (string, bool) {
	prevNum := -1
	for i := 0; i < len(ls.data); {
		var lNum int
		lNum, i = decodeVarint(ls.data, i)
		_, i = decodeVarint(ls.data, i)
		if lNum == prevNum {
			return ls.syms.ToName(lNum), true
		}
		prevNum = lNum
	}
	return "", false
}

// WithoutEmpty returns the labelset without empty labels.
// May return the same labelset.
func (ls Labels) WithoutEmpty() Labels {
	if ls.IsEmpty() {
		return ls
	}
	// Idea: have a constant symbol for blank, then we don't have to look it up.
	blank, ok := ls.syms.symbolTable.checkNum("")
	if !ok { // Symbol table has no entry for blank - none of the values can be blank.
		return ls
	}
	for pos := 0; pos < len(ls.data); {
		_, newPos := decodeVarint(ls.data, pos)
		lValue, newPos := decodeVarint(ls.data, newPos)
		if lValue != blank {
			pos = newPos
			continue
		}
		// Do not copy the slice until it's necessary.
		// TODO: could optimise the case where all blanks are at the end.
		// Note: we size the new buffer on the assumption there is exactly one blank value.
		buf := make([]byte, pos, pos+(len(ls.data)-newPos))
		copy(buf, ls.data[:pos]) // copy the initial non-blank labels
		pos = newPos             // move past the first blank value
		for pos < len(ls.data) {
			var newPos int
			_, newPos = decodeVarint(ls.data, pos)
			lValue, newPos = decodeVarint(ls.data, newPos)
			if lValue != blank {
				buf = append(buf, ls.data[pos:newPos]...)
			}
			pos = newPos
		}
		return Labels{syms: ls.syms, data: yoloString(buf)}
	}
	return ls
}

// Equal returns whether the two label sets are equal.
func Equal(a, b Labels) bool {
	if a.syms == b.syms {
		return a.data == b.data
	}

	la, lb := len(a.data), len(b.data)
	ia, ib := 0, 0
	for ia < la && ib < lb {
		var aValue, bValue string
		aValue, ia = decodeString(a.syms, a.data, ia)
		bValue, ib = decodeString(b.syms, b.data, ib)
		if aValue != bValue {
			return false
		}
	}
	if ia != la || ib != lb {
		return false
	}
	return true
}

// EmptyLabels returns an empty Labels value, for convenience.
func EmptyLabels() Labels {
	return Labels{}
}

// New returns a sorted Labels from the given labels.
// The caller has to guarantee that all label names are unique.
// Note this function is not efficient; should not be used in performance-critical places.
func New(ls ...Label) Labels {
	slices.SortFunc(ls, func(a, b Label) int { return strings.Compare(a.Name, b.Name) })
	syms := NewSymbolTable()
	var stackSpace [16]int
	size, nums := mapLabelsToNumbers(syms, ls, stackSpace[:])
	buf := make([]byte, size)
	marshalNumbersToSizedBuffer(nums, buf)
	return Labels{syms: syms.nameTable, data: yoloString(buf)}
}

// FromStrings creates new labels from pairs of strings.
func FromStrings(ss ...string) Labels {
	if len(ss)%2 != 0 {
		panic("invalid number of strings")
	}
	ls := make([]Label, 0, len(ss)/2)
	for i := 0; i < len(ss); i += 2 {
		ls = append(ls, Label{Name: ss[i], Value: ss[i+1]})
	}

	return New(ls...)
}

// Compare compares the two label sets.
// The result will be 0 if a==b, <0 if a < b, and >0 if a > b.
func Compare(a, b Labels) int {
	la, lb := len(a.data), len(b.data)
	ia, ib := 0, 0
	for ia < la && ib < lb {
		var aName, bName string
		aName, ia = decodeString(a.syms, a.data, ia)
		bName, ib = decodeString(b.syms, b.data, ib)
		if aName != bName {
			if aName < bName {
				return -1
			}
			return 1
		}
		var aValue, bValue string
		aValue, ia = decodeString(a.syms, a.data, ia)
		bValue, ib = decodeString(b.syms, b.data, ib)
		if aValue != bValue {
			if aValue < bValue {
				return -1
			}
			return 1
		}
	}
	// If all labels so far were in common, the set with fewer labels comes first.
	return (la - ia) - (lb - ib)
}

// Copy labels from b on top of whatever was in ls previously, reusing memory or expanding if needed.
func (ls *Labels) CopyFrom(b Labels) {
	*ls = b // Straightforward memberwise copy is all we need.
}

// IsEmpty returns true if ls represents an empty set of labels.
func (ls Labels) IsEmpty() bool {
	return len(ls.data) == 0
}

// Len returns the number of labels; it is relatively slow.
func (ls Labels) Len() int {
	count := 0
	for i := 0; i < len(ls.data); {
		_, i = decodeVarint(ls.data, i)
		_, i = decodeVarint(ls.data, i)
		count++
	}
	return count
}

// Range calls f on each label.
func (ls Labels) Range(f func(l Label)) {
	for i := 0; i < len(ls.data); {
		var lName, lValue string
		lName, i = decodeString(ls.syms, ls.data, i)
		lValue, i = decodeString(ls.syms, ls.data, i)
		f(Label{Name: lName, Value: lValue})
	}
}

// Validate calls f on each label. If f returns a non-nil error, then it returns that error cancelling the iteration.
func (ls Labels) Validate(f func(l Label) error) error {
	for i := 0; i < len(ls.data); {
		var lName, lValue string
		lName, i = decodeString(ls.syms, ls.data, i)
		lValue, i = decodeString(ls.syms, ls.data, i)
		err := f(Label{Name: lName, Value: lValue})
		if err != nil {
			return err
		}
	}
	return nil
}

// InternStrings calls intern on every string value inside ls, replacing them with what it returns.
func (ls *Labels) InternStrings(intern func(string) string) {
	// TODO: remove these calls as there is nothing to do.
}

// ReleaseStrings calls release on every string value inside ls.
func (ls Labels) ReleaseStrings(release func(string)) {
	// TODO: remove these calls as there is nothing to do.
}

// DropMetricName returns Labels with "__name__" removed.
func (ls Labels) DropMetricName() Labels {
	for i := 0; i < len(ls.data); {
		lName, i2 := decodeString(ls.syms, ls.data, i)
		_, i2 = decodeVarint(ls.data, i2)
		if lName == MetricName {
			if i == 0 { // Make common case fast with no allocations.
				ls.data = ls.data[i2:]
			} else {
				ls.data = ls.data[:i] + ls.data[i2:]
			}
			break
		} else if lName[0] > MetricName[0] { // Stop looking if we've gone past.
			break
		}
		i = i2
	}
	return ls
}

// Builder allows modifying Labels.
type Builder struct {
	syms *SymbolTable
	nums []int
	base Labels
	del  []string
	add  []Label
}

// NewBuilderWithSymbolTable returns a new LabelsBuilder not based on any labels, but with the SymbolTable.
func NewBuilderWithSymbolTable(s *SymbolTable) *Builder {
	return &Builder{
		syms: s,
	}
}

// Reset clears all current state for the builder.
func (b *Builder) Reset(base Labels) {
	if base.syms != nil { // If base has a symbol table, use that.
		b.syms = base.syms.symbolTable
	} else if b.syms == nil { // Or continue using previous symbol table in builder.
		b.syms = NewSymbolTable() // Don't do this in performance-sensitive code.
	}

	b.base = base
	b.del = b.del[:0]
	b.add = b.add[:0]
	base.Range(func(l Label) {
		if l.Value == "" {
			b.del = append(b.del, l.Name)
		}
	})
}

// Labels returns the labels from the builder.
// If no modifications were made, the original labels are returned.
func (b *Builder) Labels() Labels {
	if len(b.del) == 0 && len(b.add) == 0 {
		return b.base
	}

	slices.SortFunc(b.add, func(a, b Label) int { return strings.Compare(a.Name, b.Name) })
	slices.Sort(b.del)
	a, d, newSize := 0, 0, 0

	newSize, b.nums = mapLabelsToNumbers(b.syms, b.add, b.nums)
	bufSize := len(b.base.data) + newSize
	buf := make([]byte, 0, bufSize)
	for pos := 0; pos < len(b.base.data); {
		oldPos := pos
		var lName string
		lName, pos = decodeString(b.base.syms, b.base.data, pos)
		_, pos = decodeVarint(b.base.data, pos)
		for d < len(b.del) && b.del[d] < lName {
			d++
		}
		if d < len(b.del) && b.del[d] == lName {
			continue // This label has been deleted.
		}
		for ; a < len(b.add) && b.add[a].Name < lName; a++ {
			buf = appendLabelTo(b.nums[a*2], b.nums[a*2+1], buf) // Insert label that was not in the base set.
		}
		if a < len(b.add) && b.add[a].Name == lName {
			buf = appendLabelTo(b.nums[a*2], b.nums[a*2+1], buf)
			a++
			continue // This label has been replaced.
		}
		buf = append(buf, b.base.data[oldPos:pos]...) // If base had a symbol-table we are using it, so we don't need to look up these symbols.
	}
	// We have come to the end of the base set; add any remaining labels.
	for ; a < len(b.add); a++ {
		buf = appendLabelTo(b.nums[a*2], b.nums[a*2+1], buf)
	}
	return Labels{syms: b.syms.nameTable, data: yoloString(buf)}
}

func marshalNumbersToSizedBuffer(nums []int, data []byte) int {
	i := len(data)
	for index := len(nums) - 1; index >= 0; index-- {
		i = encodeVarint(data, i, nums[index])
	}
	return len(data) - i
}

func sizeVarint(x uint64) (n int) {
	// Most common case first
	if x < 1<<15 {
		return 2
	}
	if x < 1<<22 {
		return 3
	}
	if x >= 1<<29 {
		panic("Number too large to represent")
	}
	return 4
}

func encodeVarintSlow(data []byte, offset int, v uint64) int {
	offset -= sizeVarint(v)
	base := offset
	data[offset] = uint8(v)
	v >>= 8
	offset++
	for v >= 1<<7 {
		data[offset] = uint8(v&0x7f | 0x80)
		v >>= 7
		offset++
	}
	data[offset] = uint8(v)
	return base
}

// Special code for the common case that a value is less than 32768
func encodeVarint(data []byte, offset, v int) int {
	if v < 1<<15 {
		offset -= 2
		data[offset] = uint8(v)
		data[offset+1] = uint8(v >> 8)
		return offset
	}
	return encodeVarintSlow(data, offset, uint64(v))
}

// Map all the strings in lbls to the symbol table; return the total size required to hold them and all the individual mappings.
func mapLabelsToNumbers(t *SymbolTable, lbls []Label, buf []int) (totalSize int, nums []int) {
	nums = buf[:0]
	t.mx.Lock()
	defer t.mx.Unlock()
	// we just encode name/value/name/value, without any extra tags or length bytes
	for _, m := range lbls {
		// strings are encoded as a single varint, the index into the symbol table.
		i := t.toNumUnlocked(m.Name)
		nums = append(nums, i)
		totalSize += sizeVarint(uint64(i))
		i = t.toNumUnlocked(m.Value)
		nums = append(nums, i)
		totalSize += sizeVarint(uint64(i))
	}
	return totalSize, nums
}

func appendLabelTo(nameNum, valueNum int, buf []byte) []byte {
	size := sizeVarint(uint64(nameNum)) + sizeVarint(uint64(valueNum))
	sizeRequired := len(buf) + size
	if cap(buf) >= sizeRequired {
		buf = buf[:sizeRequired]
	} else {
		bufSize := cap(buf)
		// Double size of buffer each time it needs to grow, to amortise copying cost.
		for bufSize < sizeRequired {
			bufSize = bufSize*2 + 1
		}
		newBuf := make([]byte, sizeRequired, bufSize)
		copy(newBuf, buf)
		buf = newBuf
	}
	i := sizeRequired
	i = encodeVarint(buf, i, valueNum)
	i = encodeVarint(buf, i, nameNum)
	return buf
}

// ScratchBuilder allows efficient construction of a Labels from scratch.
type ScratchBuilder struct {
	syms            *SymbolTable
	nums            []int
	add             []Label
	output          Labels
	overwriteBuffer []byte
}

// NewScratchBuilder creates a ScratchBuilder initialized for Labels with n entries.
// Warning: expensive; don't call in tight loops.
func NewScratchBuilder(n int) ScratchBuilder {
	return ScratchBuilder{syms: NewSymbolTable(), add: make([]Label, 0, n)}
}

// NewScratchBuilderWithSymbolTable creates a ScratchBuilder initialized for Labels with n entries.
func NewScratchBuilderWithSymbolTable(s *SymbolTable, n int) ScratchBuilder {
	return ScratchBuilder{syms: s, add: make([]Label, 0, n)}
}

func (b *ScratchBuilder) SetSymbolTable(s *SymbolTable) {
	b.syms = s
}

func (b *ScratchBuilder) Reset() {
	b.add = b.add[:0]
	b.output = EmptyLabels()
}

// Add a name/value pair.
// Note if you Add the same name twice you will get a duplicate label, which is invalid.
func (b *ScratchBuilder) Add(name, value string) {
	b.add = append(b.add, Label{Name: name, Value: value})
}

// Add a name/value pair, using []byte instead of string to reduce memory allocations.
// The values must remain live until Labels() is called.
func (b *ScratchBuilder) UnsafeAddBytes(name, value []byte) {
	b.add = append(b.add, Label{Name: yoloString(name), Value: yoloString(value)})
}

// Sort the labels added so far by name.
func (b *ScratchBuilder) Sort() {
	slices.SortFunc(b.add, func(a, b Label) int { return strings.Compare(a.Name, b.Name) })
}

// Assign is for when you already have a Labels which you want this ScratchBuilder to return.
func (b *ScratchBuilder) Assign(l Labels) {
	b.output = l
}

// Labels returns the name/value pairs added as a Labels object. Calling Add() after Labels() has no effect.
// Note: if you want them sorted, call Sort() first.
func (b *ScratchBuilder) Labels() Labels {
	if b.output.IsEmpty() {
		var size int
		size, b.nums = mapLabelsToNumbers(b.syms, b.add, b.nums)
		buf := make([]byte, size)
		marshalNumbersToSizedBuffer(b.nums, buf)
		b.output = Labels{syms: b.syms.nameTable, data: yoloString(buf)}
	}
	return b.output
}

// Write the newly-built Labels out to ls, reusing an internal buffer.
// Callers must ensure that there are no other references to ls, or any strings fetched from it.
func (b *ScratchBuilder) Overwrite(ls *Labels) {
	var size int
	size, b.nums = mapLabelsToNumbers(b.syms, b.add, b.nums)
	if size <= cap(b.overwriteBuffer) {
		b.overwriteBuffer = b.overwriteBuffer[:size]
	} else {
		b.overwriteBuffer = make([]byte, size)
	}
	marshalNumbersToSizedBuffer(b.nums, b.overwriteBuffer)
	ls.syms = b.syms.nameTable
	ls.data = yoloString(b.overwriteBuffer)
}

// SizeOfLabels returns the approximate space required for n copies of a label.
func SizeOfLabels(name, value string, n uint64) uint64 {
	return uint64(len(name)+len(value)) + n*4 // Assuming most symbol-table entries are 2 bytes long.
}
