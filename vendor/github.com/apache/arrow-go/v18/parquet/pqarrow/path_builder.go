// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package pqarrow

import (
	"fmt"
	"sync/atomic"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/bitutils"
	"github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet/internal/encoding"
	"golang.org/x/xerrors"
)

type iterResult int8

const (
	iterDone iterResult = -1
	iterNext iterResult = 1
)

type elemRange struct {
	start int64
	end   int64
}

func (e elemRange) empty() bool { return e.start == e.end }
func (e elemRange) size() int64 { return e.end - e.start }

type rangeSelector interface {
	GetRange(idx int64) elemRange
}

type varRangeSelector struct {
	offsets []int32
}

func (v varRangeSelector) GetRange(idx int64) elemRange {
	return elemRange{int64(v.offsets[idx]), int64(v.offsets[idx+1])}
}

type fixedSizeRangeSelector struct {
	listSize int32
}

func (f fixedSizeRangeSelector) GetRange(idx int64) elemRange {
	start := idx * int64(f.listSize)
	return elemRange{start, start + int64(f.listSize)}
}

type pathNode interface {
	clone() pathNode
}

type allPresentTerminalNode struct {
	defLevel int16
}

func (n *allPresentTerminalNode) clone() pathNode {
	ret := *n
	return &ret
}

func (n *allPresentTerminalNode) run(rng elemRange, ctx *pathWriteCtx) iterResult {
	return ctx.AppendDefLevels(int(rng.size()), n.defLevel)
}

type allNullsTerminalNode struct {
	defLevel int16
	repLevel int16
}

func (n *allNullsTerminalNode) clone() pathNode {
	ret := *n
	return &ret
}

func (n *allNullsTerminalNode) run(rng elemRange, ctx *pathWriteCtx) iterResult {
	fillRepLevels(int(rng.size()), n.repLevel, ctx)
	return ctx.AppendDefLevels(int(rng.size()), n.defLevel)
}

type nullableTerminalNode struct {
	bitmap            []byte
	elemOffset        int64
	defLevelIfPresent int16
	defLevelIfNull    int16
}

func (n *nullableTerminalNode) clone() pathNode {
	ret := *n
	return &ret
}

func (n *nullableTerminalNode) run(rng elemRange, ctx *pathWriteCtx) iterResult {
	elems := rng.size()
	ctx.ReserveDefLevels(int(elems))

	var (
		present = (*(*[2]byte)(unsafe.Pointer(&n.defLevelIfPresent)))[:]
		null    = (*(*[2]byte)(unsafe.Pointer(&n.defLevelIfNull)))[:]
	)
	rdr := bitutils.NewBitRunReader(n.bitmap, n.elemOffset+rng.start, elems)
	for {
		run := rdr.NextRun()
		if run.Len == 0 {
			break
		}
		if run.Set {
			ctx.defLevels.UnsafeWriteCopy(int(run.Len), present)
		} else {
			ctx.defLevels.UnsafeWriteCopy(int(run.Len), null)
		}
	}
	return iterDone
}

type listNode struct {
	selector        rangeSelector
	prevRepLevel    int16
	repLevel        int16
	defLevelIfEmpty int16
	isLast          bool
}

func (n *listNode) clone() pathNode {
	ret := *n
	return &ret
}

func (n *listNode) run(rng, childRng *elemRange, ctx *pathWriteCtx) iterResult {
	if rng.empty() {
		return iterDone
	}

	// find the first non-empty list (skipping a run of empties)
	start := rng.start
	for {
		// retrieve the range of elements that this list contains
		*childRng = n.selector.GetRange(rng.start)
		if !childRng.empty() {
			break
		}
		rng.start++
		if rng.empty() {
			break
		}
	}

	// loops post-condition:
	// * rng is either empty (we're done processing this node)
	//     or start corresponds to a non-empty list
	// * if rng is non-empty, childRng contains the bounds of the non-empty list

	// handle any skipped over empty lists
	emptyElems := rng.start - start
	if emptyElems > 0 {
		fillRepLevels(int(emptyElems), n.prevRepLevel, ctx)
		ctx.AppendDefLevels(int(emptyElems), n.defLevelIfEmpty)
	}

	// start of a new list, note that for nested lists adding the element
	// here effectively suppresses this code until we either encounter null
	// elements or empty lists between here and the innermost list (since we
	// make the rep levels repetition and definition levels unequal).
	// similarly when we are backtracking up the stack, the repetition
	// and definition levels are again equal so if we encounter an intermediate
	// list, with more elements, this will detect it as a new list
	if ctx.equalRepDeflevlsLen() && !rng.empty() {
		ctx.AppendRepLevel(n.prevRepLevel)
	}

	if rng.empty() {
		return iterDone
	}

	rng.start++
	if n.isLast {
		// if this is the last repeated node, we can try
		// to extend the child range as wide as possible,
		// before continuing to the next node
		return n.fillForLast(rng, childRng, ctx)
	}

	return iterNext
}

func (n *listNode) fillForLast(rng, childRng *elemRange, ctx *pathWriteCtx) iterResult {
	fillRepLevels(int(childRng.size()), n.repLevel, ctx)
	// once we've reached this point the following preconditions should hold:
	// 1. there are no more repeated path nodes to deal with
	// 2. all elements in |range| represent contiguous elements in the child
	//    array (null values would have shortened the range to ensure all
	//    remaining list elements are present, though they may be empty)
	// 3. no element of range spans a parent list (intermediate list nodes
	//    only handle one list entry at a time)
	//
	// given these preconditions, it should be safe to fill runs on non-empty lists
	// here and expand the range in the child node accordingly
	for !rng.empty() {
		sizeCheck := n.selector.GetRange(rng.start)
		if sizeCheck.empty() {
			// the empty range will need to be handled after we pass down the accumulated
			// range because it affects def level placement and we need to get the children
			// def levels entered first
			break
		}

		// this is the start of a new list. we can be sure that it only applies to the
		// previous list (and doesn't jump to the start of any list further up in nesting
		// due to the constraints mentioned earlier)
		ctx.AppendRepLevel(n.prevRepLevel)
		ctx.AppendRepLevels(int(sizeCheck.size())-1, n.repLevel)
		childRng.end = sizeCheck.end
		rng.start++
	}

	// do book-keeping to track the elements of the arrays that are actually visited
	// beyond this point. this is necessary to identify "gaps" in values that should
	// not be processed (written out to parquet)
	ctx.recordPostListVisit(*childRng)
	return iterNext
}

type nullableNode struct {
	bitmap         []byte
	entryOffset    int64
	repLevelIfNull int16
	defLevelIfNull int16

	validBitsReader bitutils.BitRunReader
	newRange        bool
}

func (n *nullableNode) clone() pathNode {
	var ret = *n
	return &ret
}

func (n *nullableNode) run(rng, childRng *elemRange, ctx *pathWriteCtx) iterResult {
	if n.newRange {
		n.validBitsReader = bitutils.NewBitRunReader(n.bitmap, n.entryOffset+rng.start, rng.size())
	}
	childRng.start = rng.start
	run := n.validBitsReader.NextRun()
	if !run.Set {
		rng.start += run.Len
		fillRepLevels(int(run.Len), n.repLevelIfNull, ctx)
		ctx.AppendDefLevels(int(run.Len), n.defLevelIfNull)
		run = n.validBitsReader.NextRun()
	}

	if rng.empty() {
		n.newRange = true
		return iterDone
	}
	childRng.start = rng.start
	childRng.end = childRng.start
	childRng.end += run.Len
	rng.start += childRng.size()
	n.newRange = false
	return iterNext
}

type pathInfo struct {
	path           []pathNode
	primitiveArr   arrow.Array
	maxDefLevel    int16
	maxRepLevel    int16
	leafIsNullable bool
}

func (p pathInfo) clone() pathInfo {
	ret := p
	ret.path = make([]pathNode, len(p.path))
	for idx, n := range p.path {
		ret.path[idx] = n.clone()
	}
	return ret
}

type pathBuilder struct {
	info             pathInfo
	paths            []pathInfo
	nullableInParent bool

	refCount *atomic.Int64
}

func (p *pathBuilder) Retain() {
	p.refCount.Add(1)
}

func (p *pathBuilder) Release() {
	if p.refCount.Add(-1) == 0 {
		for idx := range p.paths {
			p.paths[idx].primitiveArr.Release()
			p.paths[idx].primitiveArr = nil
		}
	}
}

// calling NullN on the arr directly will compute the nulls
// if we have "UnknownNullCount", calling NullN on the data
// object directly will just return the value the data has.
// thus we might bet array.UnknownNullCount as the result here.
func lazyNullCount(arr arrow.Array) int64 {
	return int64(arr.Data().NullN())
}

func lazyNoNulls(arr arrow.Array) bool {
	nulls := lazyNullCount(arr)
	return nulls == 0 || (nulls == array.UnknownNullCount && arr.NullBitmapBytes() == nil)
}

type fixupVisitor struct {
	maxRepLevel    int
	repLevelIfNull int16
}

func (f *fixupVisitor) visit(n pathNode) {
	switch n := n.(type) {
	case *listNode:
		if n.repLevel == int16(f.maxRepLevel) {
			n.isLast = true
			f.repLevelIfNull = -1
		} else {
			f.repLevelIfNull = n.repLevel
		}
	case *nullableTerminalNode:
	case *allPresentTerminalNode:
	case *allNullsTerminalNode:
		if f.repLevelIfNull != -1 {
			n.repLevel = f.repLevelIfNull
		}
	case *nullableNode:
		if f.repLevelIfNull != -1 {
			n.repLevelIfNull = f.repLevelIfNull
		}
	}
}

func fixup(info pathInfo) pathInfo {
	// we only need to fixup the path if there were repeated elems
	if info.maxRepLevel == 0 {
		return info
	}

	visitor := fixupVisitor{maxRepLevel: int(info.maxRepLevel)}
	if visitor.maxRepLevel > 0 {
		visitor.repLevelIfNull = 0
	} else {
		visitor.repLevelIfNull = -1
	}

	for _, p := range info.path {
		visitor.visit(p)
	}
	return info
}

// visitListLike handles the common logic for LIST, MAP, and FIXED_SIZE_LIST types.
// Extracting this ensures nullableInParent is always set before visiting children.
// defLevelOffset is applied to maxDefLevel AFTER all increments to compute defLevelIfEmpty.
func (p *pathBuilder) visitListLike(arr arrow.Array, selector rangeSelector, defLevelOffset int16, childValues arrow.Array) error {
	p.maybeAddNullable(arr)
	p.info.maxDefLevel++
	p.info.maxRepLevel++
	p.info.path = append(p.info.path, &listNode{
		selector:        selector,
		prevRepLevel:    p.info.maxRepLevel - 1,
		repLevel:        p.info.maxRepLevel,
		defLevelIfEmpty: p.info.maxDefLevel + defLevelOffset,
	})
	p.nullableInParent = arr.DataType().(arrow.ListLikeType).ElemField().Nullable
	return p.Visit(childValues)
}

func (p *pathBuilder) Visit(arr arrow.Array) error {
	switch arr.DataType().ID() {
	case arrow.LIST, arrow.MAP:
		larr, ok := arr.(*array.List)
		if !ok {
			larr = arr.(*array.Map).List
		}
		return p.visitListLike(arr,
			varRangeSelector{larr.Offsets()[larr.Data().Offset():]},
			-1, // defLevelIfEmpty = maxDefLevel - 1 (after all increments)
			larr.ListValues())
	case arrow.FIXED_SIZE_LIST:
		larr := arr.(*array.FixedSizeList)
		listSize := larr.DataType().(*arrow.FixedSizeListType).Len()
		return p.visitListLike(arr,
			fixedSizeRangeSelector{listSize},
			0, // defLevelIfEmpty = maxDefLevel (after all increments)
			larr.ListValues())
	case arrow.DICTIONARY:
		// only currently handle dictionaryarray where the dictionary
		// is a primitive type
		dictArr := arr.(*array.Dictionary)
		valType := dictArr.DataType().(*arrow.DictionaryType).ValueType
		if _, ok := valType.(arrow.NestedType); ok {
			return fmt.Errorf("%w: writing DictionaryArray with nested dictionary type not yet supported",
				arrow.ErrNotImplemented)
		}
		if dictArr.Dictionary().NullN() > 0 {
			return fmt.Errorf("%w: writing DictionaryArray with null encoded in dictionary not yet supported",
				arrow.ErrNotImplemented)
		}
		p.addTerminalInfo(arr)
		return nil
	case arrow.STRUCT:
		p.maybeAddNullable(arr)
		infoBackup := p.info
		dt := arr.DataType().(*arrow.StructType)
		for idx, f := range dt.Fields() {
			p.nullableInParent = f.Nullable
			if err := p.Visit(arr.(*array.Struct).Field(idx)); err != nil {
				return err
			}
			p.info = infoBackup
		}
		return nil
	case arrow.EXTENSION:
		return p.Visit(arr.(array.ExtensionArray).Storage())
	case arrow.SPARSE_UNION, arrow.DENSE_UNION:
		return xerrors.New("union types aren't supported in parquet")
	default:
		p.addTerminalInfo(arr)
		return nil
	}
}

func (p *pathBuilder) addTerminalInfo(arr arrow.Array) {
	p.info.leafIsNullable = p.nullableInParent
	if p.nullableInParent {
		p.info.maxDefLevel++
	}

	// we don't use null_count because if the null_count isn't known
	// and the array does in fact contain nulls, we will end up traversing
	// the null bitmap twice.
	if lazyNoNulls(arr) {
		p.info.path = append(p.info.path, &allPresentTerminalNode{p.info.maxDefLevel})
		p.info.leafIsNullable = false
	} else if lazyNullCount(arr) == int64(arr.Len()) {
		p.info.path = append(p.info.path, &allNullsTerminalNode{p.info.maxDefLevel - 1, -1})
	} else {
		p.info.path = append(p.info.path, &nullableTerminalNode{bitmap: arr.NullBitmapBytes(), elemOffset: int64(arr.Data().Offset()), defLevelIfPresent: p.info.maxDefLevel, defLevelIfNull: p.info.maxDefLevel - 1})
	}
	arr.Retain()
	p.info.primitiveArr = arr
	p.paths = append(p.paths, fixup(p.info.clone()))
}

func (p *pathBuilder) maybeAddNullable(arr arrow.Array) {
	if !p.nullableInParent {
		return
	}

	p.info.maxDefLevel++
	if lazyNoNulls(arr) {
		return
	}

	if lazyNullCount(arr) == int64(arr.Len()) {
		p.info.path = append(p.info.path, &allNullsTerminalNode{p.info.maxDefLevel - 1, -1})
		return
	}

	p.info.path = append(p.info.path, &nullableNode{
		bitmap: arr.NullBitmapBytes(), entryOffset: int64(arr.Data().Offset()),
		defLevelIfNull: p.info.maxDefLevel - 1, repLevelIfNull: -1,
		newRange: true,
	})
}

type multipathLevelBuilder struct {
	rootRange elemRange
	data      arrow.ArrayData
	builder   pathBuilder

	refCount *atomic.Int64
}

func (m *multipathLevelBuilder) Retain() {
	m.refCount.Add(1)
}

func (m *multipathLevelBuilder) Release() {
	if m.refCount.Add(-1) == 0 {
		m.data.Release()
		m.data = nil
		m.builder.Release()
		m.builder = pathBuilder{}
	}
}

func newMultipathLevelBuilder(arr arrow.Array, fieldNullable bool) (*multipathLevelBuilder, error) {
	ret := &multipathLevelBuilder{
		refCount:  utils.NewRefCount(1),
		rootRange: elemRange{int64(0), int64(arr.Data().Len())},
		data:      arr.Data(),
		builder:   pathBuilder{nullableInParent: fieldNullable, paths: make([]pathInfo, 0), refCount: utils.NewRefCount(1)},
	}
	if err := ret.builder.Visit(arr); err != nil {
		return nil, err
	}
	arr.Data().Retain()
	return ret, nil
}

func (m *multipathLevelBuilder) leafCount() int {
	return len(m.builder.paths)
}

func (m *multipathLevelBuilder) write(leafIdx int, ctx *arrowWriteContext) (multipathLevelResult, error) {
	return writePath(m.rootRange, &m.builder.paths[leafIdx], ctx)
}

func (m *multipathLevelBuilder) writeAll(ctx *arrowWriteContext) (res []multipathLevelResult, err error) {
	res = make([]multipathLevelResult, m.leafCount())
	for idx := range res {
		res[idx], err = m.write(idx, ctx)
		if err != nil {
			break
		}
	}
	return
}

type multipathLevelResult struct {
	leafArr         arrow.Array
	defLevels       []int16
	defLevelsBuffer encoding.Buffer
	repLevels       []int16
	repLevelsBuffer encoding.Buffer
	// contains the element ranges of the required visiting on the descendants of the
	// final list ancestor for any leaf node.
	//
	// the algorithm will attempt to consolidate the visited ranges into the smallest number
	//
	// this data is necessary to pass along because after producing the def-rep levels for each
	// leaf array, it is impossible to determine which values have to be sent to parquet when a
	// null list value in a nullable listarray is non-empty
	//
	// this allows for the parquet writing to determine which values ultimately need to be written
	postListVisitedElems []elemRange

	leafIsNullable bool
}

func (m *multipathLevelResult) Release() {
	m.defLevels = nil
	if m.defLevelsBuffer != nil {
		m.defLevelsBuffer.Release()
	}
	if m.repLevels != nil {
		m.repLevels = nil
		m.repLevelsBuffer.Release()
	}
}

type pathWriteCtx struct {
	mem          memory.Allocator
	defLevels    *int16BufferBuilder
	repLevels    *int16BufferBuilder
	visitedElems []elemRange
}

func (p *pathWriteCtx) ReserveDefLevels(elems int) iterResult {
	p.defLevels.Reserve(elems)
	return iterDone
}

func (p *pathWriteCtx) AppendDefLevel(lvl int16) iterResult {
	p.defLevels.Append(lvl)
	return iterDone
}

func (p *pathWriteCtx) AppendDefLevels(count int, defLevel int16) iterResult {
	p.defLevels.AppendCopies(count, defLevel)
	return iterDone
}

func (p *pathWriteCtx) UnsafeAppendDefLevel(v int16) iterResult {
	p.defLevels.UnsafeAppend(v)
	return iterDone
}

func (p *pathWriteCtx) AppendRepLevel(lvl int16) iterResult {
	p.repLevels.Append(lvl)
	return iterDone
}

func (p *pathWriteCtx) AppendRepLevels(count int, lvl int16) iterResult {
	p.repLevels.AppendCopies(count, lvl)
	return iterDone
}

func (p *pathWriteCtx) equalRepDeflevlsLen() bool { return p.defLevels.Len() == p.repLevels.Len() }

func (p *pathWriteCtx) recordPostListVisit(rng elemRange) {
	if len(p.visitedElems) > 0 && rng.start == p.visitedElems[len(p.visitedElems)-1].end {
		p.visitedElems[len(p.visitedElems)-1].end = rng.end
		return
	}
	p.visitedElems = append(p.visitedElems, rng)
}

type int16BufferBuilder struct {
	*encoding.PooledBufferWriter
}

func (b *int16BufferBuilder) Values() []int16 {
	return arrow.Int16Traits.CastFromBytes(b.Bytes())
}

func (b *int16BufferBuilder) Value(i int) int16 {
	return b.Values()[i]
}

func (b *int16BufferBuilder) Reserve(n int) {
	b.PooledBufferWriter.Reserve(n * arrow.Int16SizeBytes)
}

func (b *int16BufferBuilder) Len() int { return b.PooledBufferWriter.Len() / arrow.Int16SizeBytes }

func (b *int16BufferBuilder) AppendCopies(count int, val int16) {
	b.Reserve(count)
	b.UnsafeWriteCopy(count, (*(*[2]byte)(unsafe.Pointer(&val)))[:])
}

func (b *int16BufferBuilder) UnsafeAppend(v int16) {
	b.UnsafeWrite((*(*[2]byte)(unsafe.Pointer(&v)))[:])
}

func (b *int16BufferBuilder) Append(v int16) {
	b.PooledBufferWriter.Reserve(arrow.Int16SizeBytes)
	b.Write((*(*[2]byte)(unsafe.Pointer(&v)))[:])
}

func fillRepLevels(count int, repLvl int16, ctx *pathWriteCtx) {
	if repLvl == -1 {
		return
	}

	fillCount := count
	// this condition occurs (rep and def levels equals), in one of a few cases:
	// 1. before any list is encountered
	// 2. after rep-level has been filled in due to null/empty values above
	// 3. after finishing a list
	if !ctx.equalRepDeflevlsLen() {
		fillCount--
	}
	ctx.AppendRepLevels(fillCount, repLvl)
}

func writePath(rootRange elemRange, info *pathInfo, arrCtx *arrowWriteContext) (multipathLevelResult, error) {
	stack := make([]elemRange, len(info.path))
	buildResult := multipathLevelResult{
		leafArr:        info.primitiveArr,
		leafIsNullable: info.leafIsNullable,
	}

	if info.maxDefLevel == 0 {
		// this case only occurs when there are no nullable or repeated columns in the path from the root to the leaf
		leafLen := buildResult.leafArr.Len()
		buildResult.postListVisitedElems = []elemRange{{0, int64(leafLen)}}
		return buildResult, nil
	}

	stack[0] = rootRange
	if arrCtx.defLevelsBuffer != nil {
		arrCtx.defLevelsBuffer.Release()
		arrCtx.defLevelsBuffer = nil
	}
	if arrCtx.repLevelsBuffer != nil {
		arrCtx.repLevelsBuffer.Release()
		arrCtx.repLevelsBuffer = nil
	}

	ctx := pathWriteCtx{arrCtx.props.mem,
		&int16BufferBuilder{encoding.NewPooledBufferWriter(0)},
		&int16BufferBuilder{encoding.NewPooledBufferWriter(0)},
		make([]elemRange, 0)}

	ctx.defLevels.Reserve(int(rootRange.size()))
	if info.maxRepLevel > 0 {
		ctx.repLevels.Reserve(int(rootRange.size()))
	}

	stackBase := 0
	stackPos := stackBase
	for stackPos >= stackBase {
		var res iterResult
		switch n := info.path[stackPos].(type) {
		case *nullableNode:
			res = n.run(&stack[stackPos], &stack[stackPos+1], &ctx)
		case *listNode:
			res = n.run(&stack[stackPos], &stack[stackPos+1], &ctx)
		case *nullableTerminalNode:
			res = n.run(stack[stackPos], &ctx)
		case *allPresentTerminalNode:
			res = n.run(stack[stackPos], &ctx)
		case *allNullsTerminalNode:
			res = n.run(stack[stackPos], &ctx)
		}
		stackPos += int(res)
	}

	if ctx.repLevels.Len() > 0 {
		// this case only occurs when there was a repeated element somewhere
		buildResult.repLevels = ctx.repLevels.Values()
		buildResult.repLevelsBuffer = ctx.repLevels.Finish()

		buildResult.postListVisitedElems, ctx.visitedElems = ctx.visitedElems, buildResult.postListVisitedElems
		// if it is possible when processing lists that all lists were empty. in this
		// case, no elements would have been added to the postListVisitedElements. by
		// adding an empty element, we avoid special casing later
		if len(buildResult.postListVisitedElems) == 0 {
			buildResult.postListVisitedElems = append(buildResult.postListVisitedElems, elemRange{0, 0})
		}
	} else {
		buildResult.postListVisitedElems = append(buildResult.postListVisitedElems, elemRange{0, int64(buildResult.leafArr.Len())})
		buildResult.repLevels = nil
	}

	buildResult.defLevels = ctx.defLevels.Values()
	buildResult.defLevelsBuffer = ctx.defLevels.Finish()
	return buildResult, nil
}
