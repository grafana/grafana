//  Copyright (c) 2023 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build vectors
// +build vectors

package zap

import (
	"encoding/binary"
	"encoding/json"
	"math"
	"reflect"

	"github.com/RoaringBitmap/roaring/v2"
	"github.com/RoaringBitmap/roaring/v2/roaring64"
	"github.com/bits-and-blooms/bitset"
	faiss "github.com/blevesearch/go-faiss"
	segment "github.com/blevesearch/scorch_segment_api/v2"
)

var reflectStaticSizeVecPostingsList int
var reflectStaticSizeVecPostingsIterator int
var reflectStaticSizeVecPosting int

func init() {
	var pl VecPostingsList
	reflectStaticSizeVecPostingsList = int(reflect.TypeOf(pl).Size())
	var pi VecPostingsIterator
	reflectStaticSizeVecPostingsIterator = int(reflect.TypeOf(pi).Size())
	var p VecPosting
	reflectStaticSizeVecPosting = int(reflect.TypeOf(p).Size())
}

type VecPosting struct {
	docNum uint64
	score  float32
}

func (vp *VecPosting) Number() uint64 {
	return vp.docNum
}

func (vp *VecPosting) Score() float32 {
	return vp.score
}

func (vp *VecPosting) Size() int {
	sizeInBytes := reflectStaticSizePosting

	return sizeInBytes
}

// =============================================================================

// the vector postings list is supposed to store the docNum and its similarity
// score as a vector postings entry in it.
// The way in which is it stored is using a roaring64 bitmap.
// the docNum is stored in high 32 and the lower 32 bits contains the score value.
// the score is actually a float32 value and in order to store it as a uint32 in
// the bitmap, we use the IEEE 754 floating point format.
//
// each entry in the roaring64 bitmap of the vector postings list is a 64 bit
// number which looks like this:
// MSB                         LSB
// |64 63 62 ... 32| 31 30 ... 0|
// |    <docNum>   |   <score>  |
type VecPostingsList struct {
	// todo: perhaps we don't even need to store a bitmap if there is only
	// one similar vector the query, but rather store it as a field value
	// in the struct
	except   *roaring64.Bitmap
	postings *roaring64.Bitmap
}

var emptyVecPostingsIterator = &VecPostingsIterator{}
var emptyVecPostingsList = &VecPostingsList{}

func (vpl *VecPostingsList) Iterator(prealloc segment.VecPostingsIterator) segment.VecPostingsIterator {
	if vpl.postings == nil {
		return emptyVecPostingsIterator
	}
	// tbd: do we check the cardinality of postings and scores?
	var preallocPI *VecPostingsIterator
	pi, ok := prealloc.(*VecPostingsIterator)
	if ok && pi != nil {
		preallocPI = pi
	}
	if preallocPI == emptyVecPostingsIterator {
		preallocPI = nil
	}

	return vpl.iterator(preallocPI)
}

func (p *VecPostingsList) iterator(rv *VecPostingsIterator) *VecPostingsIterator {
	if rv == nil {
		rv = &VecPostingsIterator{}
	} else {
		*rv = VecPostingsIterator{} // clear the struct
	}
	// think on some of the edge cases over here.
	if p.postings == nil {
		return rv
	}
	rv.postings = p
	rv.all = p.postings.Iterator()
	if p.except != nil {
		rv.ActualBM = roaring64.AndNot(p.postings, p.except)
		rv.Actual = rv.ActualBM.Iterator()
	} else {
		rv.ActualBM = p.postings
		rv.Actual = rv.all // Optimize to use same iterator for all & Actual.
	}
	return rv
}

func (p *VecPostingsList) Size() int {
	sizeInBytes := reflectStaticSizeVecPostingsList + SizeOfPtr

	if p.except != nil {
		sizeInBytes += int(p.except.GetSizeInBytes())
	}

	return sizeInBytes
}

func (p *VecPostingsList) Count() uint64 {
	if p.postings != nil {
		n := p.postings.GetCardinality()
		var e uint64
		if p.except != nil {
			e = p.postings.AndCardinality(p.except)
		}
		return n - e
	}
	return 0
}

func (vpl *VecPostingsList) ResetBytesRead(val uint64) {

}

func (vpl *VecPostingsList) BytesRead() uint64 {
	return 0
}

func (vpl *VecPostingsList) BytesWritten() uint64 {
	return 0
}

// =============================================================================

type VecPostingsIterator struct {
	postings *VecPostingsList
	all      roaring64.IntPeekable64
	Actual   roaring64.IntPeekable64
	ActualBM *roaring64.Bitmap

	next VecPosting // reused across Next() calls
}

func (i *VecPostingsIterator) nextCodeAtOrAfterClean(atOrAfter uint64) (uint64, bool, error) {
	i.Actual.AdvanceIfNeeded(atOrAfter)

	if !i.Actual.HasNext() {
		return 0, false, nil // couldn't find anything
	}

	return i.Actual.Next(), true, nil
}

func (i *VecPostingsIterator) nextCodeAtOrAfter(atOrAfter uint64) (uint64, bool, error) {
	if i.Actual == nil || !i.Actual.HasNext() {
		return 0, false, nil
	}

	if i.postings == nil || i.postings == emptyVecPostingsList {
		// couldn't find anything
		return 0, false, nil
	}

	if i.postings.postings == i.ActualBM {
		return i.nextCodeAtOrAfterClean(atOrAfter)
	}

	i.Actual.AdvanceIfNeeded(atOrAfter)

	if !i.Actual.HasNext() || !i.all.HasNext() {
		// couldn't find anything
		return 0, false, nil
	}

	n := i.Actual.Next()
	allN := i.all.Next()

	// n is the next actual hit (excluding some postings), and
	// allN is the next hit in the full postings, and
	// if they don't match, move 'all' forwards until they do.
	for allN != n {
		if !i.all.HasNext() {
			return 0, false, nil
		}
		allN = i.all.Next()
	}

	return uint64(n), true, nil
}

// a transformation function which stores both the score and the docNum as a single
// entry which is a uint64 number.
func getVectorCode(docNum uint32, score float32) uint64 {
	return uint64(docNum)<<32 | uint64(math.Float32bits(score))
}

// Next returns the next posting on the vector postings list, or nil at the end
func (i *VecPostingsIterator) nextAtOrAfter(atOrAfter uint64) (segment.VecPosting, error) {
	// transform the docNum provided to the vector code format and use that to
	// get the next entry. the comparison still happens docNum wise since after
	// the transformation, the docNum occupies the upper 32 bits just an entry in
	// the postings list
	atOrAfter = getVectorCode(uint32(atOrAfter), 0)
	code, exists, err := i.nextCodeAtOrAfter(atOrAfter)
	if err != nil || !exists {
		return nil, err
	}

	i.next = VecPosting{} // clear the struct
	rv := &i.next
	rv.score = math.Float32frombits(uint32(code))
	rv.docNum = code >> 32

	return rv, nil
}

func (itr *VecPostingsIterator) Next() (segment.VecPosting, error) {
	return itr.nextAtOrAfter(0)
}

func (itr *VecPostingsIterator) Advance(docNum uint64) (segment.VecPosting, error) {
	return itr.nextAtOrAfter(docNum)
}

func (i *VecPostingsIterator) Size() int {
	sizeInBytes := reflectStaticSizePostingsIterator + SizeOfPtr +
		i.next.Size()

	return sizeInBytes
}

func (vpl *VecPostingsIterator) ResetBytesRead(val uint64) {

}

func (vpl *VecPostingsIterator) BytesRead() uint64 {
	return 0
}

func (vpl *VecPostingsIterator) BytesWritten() uint64 {
	return 0
}

// vectorIndexWrapper conforms to scorch_segment_api's VectorIndex interface
type vectorIndexWrapper struct {
	search func(qVector []float32, k int64,
		params json.RawMessage) (segment.VecPostingsList, error)
	searchWithFilter func(qVector []float32, k int64, eligibleDocIDs []uint64,
		params json.RawMessage) (segment.VecPostingsList, error)
	close func()
	size  func() uint64
}

func (i *vectorIndexWrapper) Search(qVector []float32, k int64,
	params json.RawMessage) (
	segment.VecPostingsList, error) {
	return i.search(qVector, k, params)
}

func (i *vectorIndexWrapper) SearchWithFilter(qVector []float32, k int64,
	eligibleDocIDs []uint64, params json.RawMessage) (
	segment.VecPostingsList, error) {
	return i.searchWithFilter(qVector, k, eligibleDocIDs, params)
}

func (i *vectorIndexWrapper) Close() {
	i.close()
}

func (i *vectorIndexWrapper) Size() uint64 {
	return i.size()
}

// InterpretVectorIndex returns a construct of closures (vectorIndexWrapper)
// that will allow the caller to -
// (1) search within an attached vector index
// (2) search limited to a subset of documents within an attached vector index
// (3) close attached vector index
// (4) get the size of the attached vector index
func (sb *SegmentBase) InterpretVectorIndex(field string, requiresFiltering bool,
	except *roaring.Bitmap) (
	segment.VectorIndex, error) {
	// Params needed for the closures
	var vecIndex *faiss.IndexImpl
	var vecDocIDMap map[int64]uint32
	var docVecIDMap map[uint32][]int64
	var vectorIDsToExclude []int64
	var fieldIDPlus1 uint16
	var vecIndexSize uint64

	// Utility function to add the corresponding docID and scores for each vector
	// returned after the kNN query to the newly
	// created vecPostingsList
	addIDsToPostingsList := func(pl *VecPostingsList, ids []int64, scores []float32) {
		for i := 0; i < len(ids); i++ {
			vecID := ids[i]
			// Checking if it's present in the vecDocIDMap.
			// If -1 is returned as an ID(insufficient vectors), this will ensure
			// it isn't added to the final postings list.
			if docID, ok := vecDocIDMap[vecID]; ok {
				code := getVectorCode(docID, scores[i])
				pl.postings.Add(uint64(code))
			}
		}
	}

	var (
		wrapVecIndex = &vectorIndexWrapper{
			search: func(qVector []float32, k int64, params json.RawMessage) (
				segment.VecPostingsList, error) {
				// 1. returned postings list (of type PostingsList) has two types of information - docNum and its score.
				// 2. both the values can be represented using roaring bitmaps.
				// 3. the Iterator (of type PostingsIterator) returned would operate in terms of VecPostings.
				// 4. VecPostings would just have the docNum and the score. Every call of Next()
				//    and Advance just returns the next VecPostings. The caller would do a vp.Number()
				//    and the Score() to get the corresponding values
				rv := &VecPostingsList{
					except:   nil, // todo: handle the except bitmap within postings iterator.
					postings: roaring64.New(),
				}

				if vecIndex == nil || vecIndex.D() != len(qVector) {
					// vector index not found or dimensionality mismatched
					return rv, nil
				}

				scores, ids, err := vecIndex.SearchWithoutIDs(qVector, k,
					vectorIDsToExclude, params)
				if err != nil {
					return nil, err
				}

				addIDsToPostingsList(rv, ids, scores)

				return rv, nil
			},
			searchWithFilter: func(qVector []float32, k int64,
				eligibleDocIDs []uint64, params json.RawMessage) (
				segment.VecPostingsList, error) {
				// 1. returned postings list (of type PostingsList) has two types of information - docNum and its score.
				// 2. both the values can be represented using roaring bitmaps.
				// 3. the Iterator (of type PostingsIterator) returned would operate in terms of VecPostings.
				// 4. VecPostings would just have the docNum and the score. Every call of Next()
				//    and Advance just returns the next VecPostings. The caller would do a vp.Number()
				//    and the Score() to get the corresponding values
				rv := &VecPostingsList{
					except:   nil, // todo: handle the except bitmap within postings iterator.
					postings: roaring64.New(),
				}
				if vecIndex == nil || vecIndex.D() != len(qVector) {
					// vector index not found or dimensionality mismatched
					return rv, nil
				}
				// Check and proceed only if non-zero documents eligible per the filter query.
				if len(eligibleDocIDs) == 0 {
					return rv, nil
				}
				// If every element in the index is eligible (full selectivity),
				// then this can basically be considered unfiltered kNN.
				if len(eligibleDocIDs) == int(sb.numDocs) {
					scores, ids, err := vecIndex.SearchWithoutIDs(qVector, k,
						vectorIDsToExclude, params)
					if err != nil {
						return nil, err
					}
					addIDsToPostingsList(rv, ids, scores)
					return rv, nil
				}
				// vector IDs corresponding to the local doc numbers to be
				// considered for the search
				vectorIDsToInclude := make([]int64, 0, len(eligibleDocIDs))
				for _, id := range eligibleDocIDs {
					vecIDs := docVecIDMap[uint32(id)]
					// In the common case where vecIDs has only one element, which occurs
					// when a document has only one vector field, we can
					// avoid the unnecessary overhead of slice unpacking (append(vecIDs...)).
					// Directly append the single element for efficiency.
					if len(vecIDs) == 1 {
						vectorIDsToInclude = append(vectorIDsToInclude, vecIDs[0])
					} else {
						vectorIDsToInclude = append(vectorIDsToInclude, vecIDs...)
					}
				}
				// In case a doc has invalid vector fields but valid non-vector fields,
				// filter hit IDs may be ineligible for the kNN since the document does
				// not have any/valid vectors.
				if len(vectorIDsToInclude) == 0 {
					return rv, nil
				}
				// If the index is not an IVF index, then the search can be
				// performed directly, using the Flat index.
				if !vecIndex.IsIVFIndex() {
					// vector IDs corresponding to the local doc numbers to be
					// considered for the search
					scores, ids, err := vecIndex.SearchWithIDs(qVector, k,
						vectorIDsToInclude, params)
					if err != nil {
						return nil, err
					}
					addIDsToPostingsList(rv, ids, scores)
					return rv, nil
				}
				// Determining which clusters, identified by centroid ID,
				// have at least one eligible vector and hence, ought to be
				// probed.
				clusterVectorCounts, err := vecIndex.ObtainClusterVectorCountsFromIVFIndex(vectorIDsToInclude)
				if err != nil {
					return nil, err
				}
				var selector faiss.Selector
				// If there are more elements to be included than excluded, it
				// might be quicker to use an exclusion selector as a filter
				// instead of an inclusion selector.
				if float32(len(eligibleDocIDs))/float32(len(docVecIDMap)) > 0.5 {
					// Use a bitset to efficiently track eligible document IDs.
					// This reduces the lookup cost when checking if a document ID is eligible,
					// compared to using a map or slice.
					bs := bitset.New(uint(len(eligibleDocIDs)))
					for _, docID := range eligibleDocIDs {
						bs.Set(uint(docID))
					}
					ineligibleVectorIDs := make([]int64, 0, len(vecDocIDMap)-len(vectorIDsToInclude))
					for docID, vecIDs := range docVecIDMap {
						// Check if the document ID is NOT in the eligible set, marking it as ineligible.
						if !bs.Test(uint(docID)) {
							// In the common case where vecIDs has only one element, which occurs
							// when a document has only one vector field, we can
							// avoid the unnecessary overhead of slice unpacking (append(vecIDs...)).
							// Directly append the single element for efficiency.
							if len(vecIDs) == 1 {
								ineligibleVectorIDs = append(ineligibleVectorIDs, vecIDs[0])
							} else {
								ineligibleVectorIDs = append(ineligibleVectorIDs, vecIDs...)
							}
						}
					}
					selector, err = faiss.NewIDSelectorNot(ineligibleVectorIDs)
				} else {
					selector, err = faiss.NewIDSelectorBatch(vectorIDsToInclude)
				}
				if err != nil {
					return nil, err
				}
				// If no error occured during the creation of the selector, then
				// it should be deleted once the search is complete.
				defer selector.Delete()
				// Ordering the retrieved centroid IDs by increasing order
				// of distance i.e. decreasing order of proximity to query vector.
				centroidIDs := make([]int64, 0, len(clusterVectorCounts))
				for centroidID := range clusterVectorCounts {
					centroidIDs = append(centroidIDs, centroidID)
				}
				closestCentroidIDs, centroidDistances, err :=
					vecIndex.ObtainClustersWithDistancesFromIVFIndex(qVector, centroidIDs)
				if err != nil {
					return nil, err
				}
				// Getting the nprobe value set at index time.
				nprobe := int(vecIndex.GetNProbe())
				// Determining the minimum number of centroids to be probed
				// to ensure that at least 'k' vectors are collected while
				// examining at least 'nprobe' centroids.
				var eligibleDocsTillNow int64
				minEligibleCentroids := len(closestCentroidIDs)
				for i, centroidID := range closestCentroidIDs {
					eligibleDocsTillNow += clusterVectorCounts[centroidID]
					// Stop once we've examined at least 'nprobe' centroids and
					// collected at least 'k' vectors.
					if eligibleDocsTillNow >= k && i+1 >= nprobe {
						minEligibleCentroids = i + 1
						break
					}
				}
				// Search the clusters specified by 'closestCentroidIDs' for
				// vectors whose IDs are present in 'vectorIDsToInclude'
				scores, ids, err := vecIndex.SearchClustersFromIVFIndex(
					selector, closestCentroidIDs, minEligibleCentroids,
					k, qVector, centroidDistances, params)
				if err != nil {
					return nil, err
				}
				addIDsToPostingsList(rv, ids, scores)
				return rv, nil
			},
			close: func() {
				// skipping the closing because the index is cached and it's being
				// deferred to a later point of time.
				sb.vecIndexCache.decRef(fieldIDPlus1)
			},
			size: func() uint64 {
				return vecIndexSize
			},
		}

		err error
	)

	fieldIDPlus1 = sb.fieldsMap[field]
	if fieldIDPlus1 <= 0 {
		return wrapVecIndex, nil
	}

	vectorSection := sb.fieldsSectionsMap[fieldIDPlus1-1][SectionFaissVectorIndex]
	// check if the field has a vector section in the segment.
	if vectorSection <= 0 {
		return wrapVecIndex, nil
	}

	pos := int(vectorSection)

	// the below loop loads the following:
	// 1. doc values(first 2 iterations) - adhering to the sections format. never
	// valid values for vector section
	// 2. index optimization type.
	for i := 0; i < 3; i++ {
		_, n := binary.Uvarint(sb.mem[pos : pos+binary.MaxVarintLen64])
		pos += n
	}

	vecIndex, vecDocIDMap, docVecIDMap, vectorIDsToExclude, err =
		sb.vecIndexCache.loadOrCreate(fieldIDPlus1, sb.mem[pos:], requiresFiltering,
			except)

	if vecIndex != nil {
		vecIndexSize = vecIndex.Size()
	}

	return wrapVecIndex, err
}

func (sb *SegmentBase) UpdateFieldStats(stats segment.FieldStats) {
	for _, fieldName := range sb.fieldsInv {
		pos := int(sb.fieldsSectionsMap[sb.fieldsMap[fieldName]-1][SectionFaissVectorIndex])
		if pos == 0 {
			continue
		}

		for i := 0; i < 3; i++ {
			_, n := binary.Uvarint(sb.mem[pos : pos+binary.MaxVarintLen64])
			pos += n
		}
		numVecs, _ := binary.Uvarint(sb.mem[pos : pos+binary.MaxVarintLen64])

		stats.Store("num_vectors", fieldName, numVecs)
	}
}
