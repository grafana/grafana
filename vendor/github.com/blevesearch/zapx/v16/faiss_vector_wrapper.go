//  Copyright (c) 2025 Couchbase, Inc.
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
	"encoding/json"
	"math"
	"slices"

	"github.com/RoaringBitmap/roaring/v2/roaring64"
	"github.com/bits-and-blooms/bitset"
	index "github.com/blevesearch/bleve_index_api"
	faiss "github.com/blevesearch/go-faiss"
	segment "github.com/blevesearch/scorch_segment_api/v2"
)

// MaxMultiVectorDocSearchRetries limits repeated searches when deduplicating
// multi-vector documents. Each retry excludes previously seen vectors to find
// new unique documents. Acts as a safeguard against pathological data distributions.
var MaxMultiVectorDocSearchRetries = 100

// vectorIndexWrapper conforms to scorch_segment_api's VectorIndex interface
type vectorIndexWrapper struct {
	vecIndex           *faiss.IndexImpl
	vecDocIDMap        map[int64]uint32
	docVecIDMap        map[uint32][]int64
	vectorIDsToExclude []int64
	fieldIDPlus1       uint16
	vecIndexSize       uint64

	sb *SegmentBase
}

func (v *vectorIndexWrapper) Search(qVector []float32, k int64,
	params json.RawMessage) (
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

	if v.vecIndex == nil || v.vecIndex.D() != len(qVector) {
		// vector index not found or dimensionality mismatched
		return rv, nil
	}

	if v.sb.numDocs == 0 {
		return rv, nil
	}

	rs, err := v.searchWithoutIDs(qVector, k,
		v.vectorIDsToExclude, params)
	if err != nil {
		return nil, err
	}

	v.addIDsToPostingsList(rv, rs)

	return rv, nil
}

func (v *vectorIndexWrapper) SearchWithFilter(qVector []float32, k int64,
	eligibleDocIDs []uint64, params json.RawMessage) (
	segment.VecPostingsList, error) {
	// If every element in the index is eligible (full selectivity),
	// then this can basically be considered unfiltered kNN.
	if len(eligibleDocIDs) == int(v.sb.numDocs) {
		return v.Search(qVector, k, params)
	}
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
	if v.vecIndex == nil || v.vecIndex.D() != len(qVector) {
		// vector index not found or dimensionality mismatched
		return rv, nil
	}
	// Check and proceed only if non-zero documents eligible per the filter query.
	if len(eligibleDocIDs) == 0 {
		return rv, nil
	}

	// vector IDs corresponding to the local doc numbers to be
	// considered for the search
	vectorIDsToInclude := make([]int64, 0, len(eligibleDocIDs))
	for _, id := range eligibleDocIDs {
		vecIDs := v.docVecIDMap[uint32(id)]
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
	if !v.vecIndex.IsIVFIndex() {
		// vector IDs corresponding to the local doc numbers to be
		// considered for the search
		rs, err := v.searchWithIDs(qVector, k,
			vectorIDsToInclude, params)
		if err != nil {
			return nil, err
		}
		v.addIDsToPostingsList(rv, rs)
		return rv, nil
	}
	// Determining which clusters, identified by centroid ID,
	// have at least one eligible vector and hence, ought to be
	// probed.
	clusterVectorCounts, err := v.vecIndex.ObtainClusterVectorCountsFromIVFIndex(vectorIDsToInclude)
	if err != nil {
		return nil, err
	}
	var ids []int64
	var include bool
	// If there are more elements to be included than excluded, it
	// might be quicker to use an exclusion selector as a filter
	// instead of an inclusion selector.
	if float32(len(eligibleDocIDs))/float32(len(v.docVecIDMap)) > 0.5 {
		// Use a bitset to efficiently track eligible document IDs.
		// This reduces the lookup cost when checking if a document ID is eligible,
		// compared to using a map or slice.
		bs := bitset.New(uint(v.sb.numDocs))
		for _, docID := range eligibleDocIDs {
			bs.Set(uint(docID))
		}
		ineligibleVectorIDs := make([]int64, 0, len(v.vecDocIDMap)-len(vectorIDsToInclude))
		for docID, vecIDs := range v.docVecIDMap {
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
		ids = ineligibleVectorIDs
		include = false
	} else {
		ids = vectorIDsToInclude
		include = true
	}
	// Ordering the retrieved centroid IDs by increasing order
	// of distance i.e. decreasing order of proximity to query vector.
	centroidIDs := make([]int64, 0, len(clusterVectorCounts))
	for centroidID := range clusterVectorCounts {
		centroidIDs = append(centroidIDs, centroidID)
	}
	closestCentroidIDs, centroidDistances, err :=
		v.vecIndex.ObtainClustersWithDistancesFromIVFIndex(qVector, centroidIDs)
	if err != nil {
		return nil, err
	}
	// Getting the nprobe value set at index time.
	nprobe := int(v.vecIndex.GetNProbe())
	// Determining the minimum number of centroids to be probed
	// to ensure that at least 'k' vectors are collected while
	// examining at least 'nprobe' centroids.
	// centroidsToProbe range: [nprobe, number of eligible centroids]
	var eligibleVecsTillNow int64
	centroidsToProbe := len(closestCentroidIDs)
	for i, centroidID := range closestCentroidIDs {
		eligibleVecsTillNow += clusterVectorCounts[centroidID]
		// Stop once we've examined at least 'nprobe' centroids and
		// collected at least 'k' vectors.
		if eligibleVecsTillNow >= k && i+1 >= nprobe {
			centroidsToProbe = i + 1
			break
		}
	}
	// Search the clusters specified by 'closestCentroidIDs' for
	// vectors whose IDs are present in 'vectorIDsToInclude'
	rs, err := v.searchClustersFromIVFIndex(
		ids, include, closestCentroidIDs, centroidsToProbe,
		k, qVector, centroidDistances, params)
	if err != nil {
		return nil, err
	}
	v.addIDsToPostingsList(rv, rs)
	return rv, nil
}
func (v *vectorIndexWrapper) Close() {
	// skipping the closing because the index is cached and it's being
	// deferred to a later point of time.
	v.sb.vecIndexCache.decRef(v.fieldIDPlus1)
}

func (v *vectorIndexWrapper) Size() uint64 {
	return v.vecIndexSize
}

func (v *vectorIndexWrapper) ObtainKCentroidCardinalitiesFromIVFIndex(limit int, descending bool) (
	[]index.CentroidCardinality, error) {
	if v.vecIndex == nil || !v.vecIndex.IsIVFIndex() {
		return nil, nil
	}

	cardinalities, centroids, err := v.vecIndex.ObtainKCentroidCardinalitiesFromIVFIndex(limit, descending)
	if err != nil {
		return nil, err
	}
	centroidCardinalities := make([]index.CentroidCardinality, len(cardinalities))
	for i, cardinality := range cardinalities {
		centroidCardinalities[i] = index.CentroidCardinality{
			Centroid:    centroids[i],
			Cardinality: cardinality,
		}
	}
	return centroidCardinalities, nil
}

// Utility function to add the corresponding docID and scores for each unique
// docID retrieved from the vector index search to the newly created vecPostingsList
func (v *vectorIndexWrapper) addIDsToPostingsList(pl *VecPostingsList, rs resultSet) {
	rs.iterate(func(docID uint32, score float32) {
		// transform the docID and score to vector code format
		code := getVectorCode(docID, score)
		// add to postings list, this ensures ordered storage
		// based on the docID since it occupies the upper 32 bits
		pl.postings.Add(code)
	})
}

// docSearch performs a search on the vector index to retrieve
// top k documents based on the provided search function.
// It handles deduplication of documents that may have multiple
// vectors associated with them.
// The prepareNextIter function is used to set up the state
// for the next iteration, if more searches are needed to find
// k unique documents. The callback recieves the number of iterations
// done so far and the vector ids retrieved in the last search. While preparing
// the next iteration, if its decided that no further searches are needed,
// the prepareNextIter function can decide whether to continue searching or not
func (v *vectorIndexWrapper) docSearch(k int64, numDocs uint64,
	search func() (scores []float32, labels []int64, err error),
	prepareNextIter func(numIter int, labels []int64) bool) (resultSet, error) {
	// create a result set to hold top K docIDs and their scores
	rs := newResultSet(k, numDocs)
	// flag to indicate if we have exhausted the vector index
	var exhausted bool
	// keep track of number of iterations done, we execute the loop more than once only when
	// we have multi-vector documents leading to duplicates in docIDs retrieved
	numIter := 0
	// get the metric type of the index to help with deduplication logic
	metricType := v.vecIndex.MetricType()
	// we keep searching until we have k unique docIDs or we have exhausted the vector index
	// or we have reached the maximum number of deduplication iterations allowed
	for numIter < MaxMultiVectorDocSearchRetries && rs.size() < k && !exhausted {
		// search the vector index
		numIter++
		scores, labels, err := search()
		if err != nil {
			return nil, err
		}
		// process the retrieved ids and scores, getting the corresponding docIDs
		// for each vector id retrieved, and storing the best score for each unique docID
		// the moment we see a -1 for a vector id, we stop processing further since
		// it indicates there are no more vectors to be retrieved and break out of the loop
		// by setting the exhausted flag
		for i, vecID := range labels {
			if vecID == -1 {
				exhausted = true
				break
			}
			docID, exists := v.getDocIDForVectorID(vecID)
			if !exists {
				continue
			}
			score := scores[i]
			prevScore, exists := rs.get(docID)
			if !exists {
				// first time seeing this docID, so just store it
				rs.put(docID, score)
				continue
			}
			// we have seen this docID before, so we must compare scores
			// check the index metric type first to check how we compare distances/scores
			// and store the best score for the docID accordingly
			// for inner product, higher the score, better the match
			// for euclidean distance, lower the score/distance, better the match
			// so we invert the comparison accordingly
			switch metricType {
			case faiss.MetricInnerProduct: // similarity metrics like dot product => higher is better
				if score > prevScore {
					rs.put(docID, score)
				}
			case faiss.MetricL2:
				fallthrough
			default: // distance metrics like euclidean distance => lower is better
				if score < prevScore {
					rs.put(docID, score)
				}
			}
		}
		// if we still have less than k unique docIDs, prepare for the next iteration, provided
		// we have not exhausted the index
		if rs.size() < k && !exhausted {
			// prepare state for next iteration
			shouldContinue := prepareNextIter(numIter, labels)
			if !shouldContinue {
				break
			}
		}
	}
	// at this point we either have k unique docIDs or we have exhausted
	// the vector index or we have reached the maximum number of deduplication iterations allowed
	// or the prepareNextIter function decided to break out of the loop
	return rs, nil
}

// searchWithoutIDs performs a search on the vector index to retrieve the top K documents while
// excluding any vector IDs specified in the exclude slice.
func (v *vectorIndexWrapper) searchWithoutIDs(qVector []float32, k int64, exclude []int64, params json.RawMessage) (
	resultSet, error) {
	return v.docSearch(k, v.sb.numDocs,
		func() ([]float32, []int64, error) {
			return v.vecIndex.SearchWithoutIDs(qVector, k, exclude, params)
		},
		func(numIter int, labels []int64) bool {
			// if this is the first loop iteration and we have < k unique docIDs,
			// we must clone the existing exclude slice before appending to it
			// to avoid modifying the original slice passed in by the caller
			if numIter == 1 {
				exclude = slices.Clone(exclude)
			}
			// prepare the exclude list for the next iteration by adding
			// the vector ids retrieved in this iteration
			exclude = append(exclude, labels...)
			// with exclude list updated, we can proceed to the next iteration
			return true
		})
}

// searchWithIDs performs a search on the vector index to retrieve the top K documents while only
// considering the vector IDs specified in the include slice.
func (v *vectorIndexWrapper) searchWithIDs(qVector []float32, k int64, include []int64, params json.RawMessage) (
	resultSet, error) {
	// if the number of iterations > 1, we will be modifying the include slice
	// to exclude vector ids already seen, so we use this set to track the
	// include set for the next iteration, this is reused across iterations
	// and allocated only once, when numIter == 1
	var includeSet map[int64]struct{}
	return v.docSearch(k, v.sb.numDocs,
		func() ([]float32, []int64, error) {
			return v.vecIndex.SearchWithIDs(qVector, k, include, params)
		},
		func(numIter int, labels []int64) bool {
			// if this is the first loop iteration and we have < k unique docIDs,
			// we clone the existing include slice before modifying it
			if numIter == 1 {
				include = slices.Clone(include)
				// build the include set for subsequent iterations
				includeSet = make(map[int64]struct{}, len(include))
				for _, id := range include {
					includeSet[id] = struct{}{}
				}
			}
			// prepare the include list for the next iteration
			// by removing the vector ids retrieved in this iteration
			// from the include set
			for _, id := range labels {
				delete(includeSet, id)
			}
			// now build the next include slice from the set
			include = include[:0]
			for id := range includeSet {
				include = append(include, id)
			}
			// only continue searching if we still have vector ids to include
			return len(include) != 0
		})
}

// searchClustersFromIVFIndex performs a search on the IVF vector index to retrieve the top K documents
// while either including or excluding the vector IDs specified in the ids slice, depending on the include flag.
// It takes into account the eligible centroid IDs and ensures that at least centroidsToProbe are probed.
// If after a few iterations we haven't found enough documents, it dynamically increases the number of
// clusters searched (up to the number of eligible centroids) to ensure we can find k unique documents.
func (v *vectorIndexWrapper) searchClustersFromIVFIndex(ids []int64, include bool, eligibleCentroidIDs []int64,
	centroidsToProbe int, k int64, x, centroidDis []float32, params json.RawMessage) (
	resultSet, error) {
	// if the number of iterations > 1, we will be modifying the include slice
	// to exclude vector ids already seen, so we use this set to track the
	// include set for the next iteration, this is reused across iterations
	// and allocated only once, when numIter == 1
	var includeSet map[int64]struct{}
	var totalEligibleCentroids = len(eligibleCentroidIDs)
	// Threshold for when to start increasing: after 2 iterations without
	// finding enough documents, we start increasing up to the number of centroidsToProbe
	// up to the total number of eligible centroids available
	const nprobeIncreaseThreshold = 2
	return v.docSearch(k, v.sb.numDocs,
		func() ([]float32, []int64, error) {
			// build the selector based on whatever ids is as of now and the
			// include/exclude flag
			selector, err := v.getSelector(ids, include)
			if err != nil {
				return nil, nil, err
			}
			// once the main search is done we must free the selector
			defer selector.Delete()
			return v.vecIndex.SearchClustersFromIVFIndex(selector, eligibleCentroidIDs,
				centroidsToProbe, k, x, centroidDis, params)
		},
		func(numIter int, labels []int64) bool {
			// if this is the first loop iteration and we have < k unique docIDs,
			// we must clone the existing ids slice before modifying it to avoid
			// modifying the original slice passed in by the caller
			if numIter == 1 {
				ids = slices.Clone(ids)
				if include {
					// build the include set for subsequent iterations
					// by adding all the ids initially present in the ids slice
					includeSet = make(map[int64]struct{}, len(ids))
					for _, id := range ids {
						includeSet[id] = struct{}{}
					}
				}
			}
			// if we have iterated atleast nprobeIncreaseThreshold times
			// and still have not found enough unique docIDs, we increase
			// the number of centroids to probe for the next iteration
			// to try and find more vectors/documents
			if numIter >= nprobeIncreaseThreshold && centroidsToProbe < len(eligibleCentroidIDs) {
				// Calculate how much to increase: increase by 50% of the remaining centroids to probe,
				// but at least by 1 to ensure progress.
				increaseAmount := max((totalEligibleCentroids-centroidsToProbe)/2, 1)
				// Update centroidsToProbe, ensuring it does not exceed the total eligible centroids
				centroidsToProbe = min(centroidsToProbe+increaseAmount, len(eligibleCentroidIDs))
			}
			// prepare the exclude/include list for the next iteration
			if include {
				// removing the vector ids retrieved in this iteration
				// from the include set and rebuild the ids slice from the set
				for _, id := range labels {
					delete(includeSet, id)
				}
				// now build the next include slice from the set
				ids = ids[:0]
				for id := range includeSet {
					ids = append(ids, id)
				}
				// only continue searching if we still have vector ids to include
				return len(ids) != 0
			} else {
				// appending the vector ids retrieved in this iteration
				// to the exclude list
				ids = append(ids, labels...)
				// with exclude list updated, we can proceed to the next iteration
				return true
			}
		})
}

// Utility function to get a faiss.Selector based on the include/exclude flag
// and the vector ids provided, if include is true, it returns an inclusion selector,
// else it returns an exclusion selector. The caller must ensure to free the selector
// by calling selector.Delete() when done using it.
func (v *vectorIndexWrapper) getSelector(ids []int64, include bool) (selector faiss.Selector, err error) {
	if include {
		selector, err = faiss.NewIDSelectorBatch(ids)
	} else {
		selector, err = faiss.NewIDSelectorNot(ids)
	}
	if err != nil {
		return nil, err
	}
	return selector, nil
}

// Utility function to get the docID for a given vectorID, used for the
// deduplication logic, to map vectorIDs back to their corresponding docIDs
func (v *vectorIndexWrapper) getDocIDForVectorID(vecID int64) (uint32, bool) {
	docID, exists := v.vecDocIDMap[vecID]
	return docID, exists
}

// resultSet is a data structure to hold (docID, score) pairs while ensuring
// that each docID is unique. It supports efficient insertion, retrieval,
// and iteration over the stored pairs.
type resultSet interface {
	// Add a (docID, score) pair to the result set.
	put(docID uint32, score float32)
	// Get the score for a given docID. Returns false if docID not present.
	get(docID uint32) (float32, bool)
	// Iterate over all (docID, score) pairs in the result set.
	iterate(func(docID uint32, score float32))
	// Get the size of the result set.
	size() int64
}

// resultSetSliceThreshold defines the threshold ratio of k to total documents
// in the index, below which a map-based resultSet is used, and above which
// a slice-based resultSet is used.
// It is derived using the following reasoning:
//
// Let N = total number of documents
// Let K = number of top K documents to retrieve
//
// Memory usage if the Result Set uses a map[uint32]float32 of size K underneath:
//
//	~20 bytes per entry (key + value + map overhead)
//	Total ≈ 20 * K bytes
//
// Memory usage if the Result Set uses a slice of float32 of size N underneath:
//
//	4 bytes per entry
//	Total ≈ 4 * N bytes
//
// We want the threshold below which a map is more memory-efficient than a slice:
//
//	20K < 4N
//	K/N < 4/20
//
// Therefore, if the ratio of K to N is less than 0.2 (4/20), we use a map-based resultSet.
const resultSetSliceThreshold float64 = 0.2

// newResultSet creates a new resultSet
func newResultSet(k int64, numDocs uint64) resultSet {
	// if numDocs is zero (empty index), just use map-based resultSet as its a no-op
	// else decide based the percent of documents being retrieved. If we require
	// greater than 20% of total documents, use slice-based resultSet for better memory efficiency
	// else use map-based resultSet
	if numDocs == 0 || float64(k)/float64(numDocs) < resultSetSliceThreshold {
		return newResultSetMap(k)
	}
	return newResultSetSlice(numDocs)
}

type resultSetMap struct {
	data map[uint32]float32
}

func newResultSetMap(k int64) resultSet {
	return &resultSetMap{
		data: make(map[uint32]float32, k),
	}
}

func (rs *resultSetMap) put(docID uint32, score float32) {
	rs.data[docID] = score
}

func (rs *resultSetMap) get(docID uint32) (float32, bool) {
	score, exists := rs.data[docID]
	return score, exists
}

func (rs *resultSetMap) iterate(f func(docID uint32, score float32)) {
	for docID, score := range rs.data {
		f(docID, score)
	}
}

func (rs *resultSetMap) size() int64 {
	return int64(len(rs.data))
}

type resultSetSlice struct {
	count int64
	data  []float32
}

func newResultSetSlice(numDocs uint64) resultSet {
	data := make([]float32, numDocs)
	// scores can be negative, so initialize to a sentinel value which is NaN
	sentinel := float32(math.NaN())
	for i := range data {
		data[i] = sentinel
	}
	return &resultSetSlice{
		count: 0,
		data:  data,
	}
}

func (rs *resultSetSlice) put(docID uint32, score float32) {
	// only increment count if this docID was not already present
	if math.IsNaN(float64(rs.data[docID])) {
		rs.count++
	}
	rs.data[docID] = score
}

func (rs *resultSetSlice) get(docID uint32) (float32, bool) {
	score := rs.data[docID]
	if math.IsNaN(float64(score)) {
		return 0, false
	}
	return score, true
}

func (rs *resultSetSlice) iterate(f func(docID uint32, score float32)) {
	for docID, score := range rs.data {
		if !math.IsNaN(float64(score)) {
			f(uint32(docID), score)
		}
	}
}

func (rs *resultSetSlice) size() int64 {
	return rs.count
}
