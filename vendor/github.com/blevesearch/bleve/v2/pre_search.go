//  Copyright (c) 2024 Couchbase, Inc.
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

package bleve

import (
	"github.com/blevesearch/bleve/v2/search"
)

// A preSearchResultProcessor processes the data in
// the preSearch result from multiple
// indexes in an alias and merges them together to
// create the final preSearch result
type preSearchResultProcessor interface {
	// adds the preSearch result to the processor
	add(*SearchResult, string)
	// updates the final search result with the finalized
	// data from the processor
	finalize(*SearchResult)
}

// -----------------------------------------------------------------------------
// KNN preSearchResultProcessor for handling KNN presearch results
type knnPreSearchResultProcessor struct {
	addFn      func(sr *SearchResult, indexName string)
	finalizeFn func(sr *SearchResult)
}

func (k *knnPreSearchResultProcessor) add(sr *SearchResult, indexName string) {
	if k.addFn != nil {
		k.addFn(sr, indexName)
	}
}

func (k *knnPreSearchResultProcessor) finalize(sr *SearchResult) {
	if k.finalizeFn != nil {
		k.finalizeFn(sr)
	}
}

// -----------------------------------------------------------------------------
// Synonym preSearchResultProcessor for handling Synonym presearch results
type synonymPreSearchResultProcessor struct {
	finalizedFts search.FieldTermSynonymMap
}

func newSynonymPreSearchResultProcessor() *synonymPreSearchResultProcessor {
	return &synonymPreSearchResultProcessor{}
}

func (s *synonymPreSearchResultProcessor) add(sr *SearchResult, indexName string) {
	// Check if SynonymResult or the synonym data key is nil
	if sr.SynonymResult == nil {
		return
	}

	// Attempt to cast PreSearchResults to FieldTermSynonymMap

	// Merge with finalizedFts or initialize it if nil
	if s.finalizedFts == nil {
		s.finalizedFts = sr.SynonymResult
	} else {
		s.finalizedFts.MergeWith(sr.SynonymResult)
	}
}

func (s *synonymPreSearchResultProcessor) finalize(sr *SearchResult) {
	// Set the finalized synonym data to the PreSearchResults
	if s.finalizedFts != nil {
		sr.SynonymResult = s.finalizedFts
	}
}

type bm25PreSearchResultProcessor struct {
	docCount         float64 // bm25 specific stats
	fieldCardinality map[string]int
}

func newBM25PreSearchResultProcessor() *bm25PreSearchResultProcessor {
	return &bm25PreSearchResultProcessor{
		fieldCardinality: make(map[string]int),
	}
}

// TODO How will this work for queries other than term queries?
func (b *bm25PreSearchResultProcessor) add(sr *SearchResult, indexName string) {
	if sr.BM25Stats != nil {
		b.docCount += sr.BM25Stats.DocCount
		for field, cardinality := range sr.BM25Stats.FieldCardinality {
			b.fieldCardinality[field] += cardinality
		}
	}
}

func (b *bm25PreSearchResultProcessor) finalize(sr *SearchResult) {
	sr.BM25Stats = &search.BM25Stats{
		DocCount:         b.docCount,
		FieldCardinality: b.fieldCardinality,
	}
}

// -----------------------------------------------------------------------------
// Master struct that can hold any number of presearch result processors
type compositePreSearchResultProcessor struct {
	presearchResultProcessors []preSearchResultProcessor
}

// Implements the add method, which forwards to all the internal processors
func (m *compositePreSearchResultProcessor) add(sr *SearchResult, indexName string) {
	for _, p := range m.presearchResultProcessors {
		p.add(sr, indexName)
	}
}

// Implements the finalize method, which forwards to all the internal processors
func (m *compositePreSearchResultProcessor) finalize(sr *SearchResult) {
	for _, p := range m.presearchResultProcessors {
		p.finalize(sr)
	}
}

// -----------------------------------------------------------------------------
// Function to create the appropriate preSearchResultProcessor(s)
func createPreSearchResultProcessor(req *SearchRequest, flags *preSearchFlags) preSearchResultProcessor {
	// return nil for invalid input
	if flags == nil || req == nil {
		return nil
	}
	var processors []preSearchResultProcessor
	// Add KNN processor if the request has KNN
	if flags.knn {
		if knnProcessor := newKnnPreSearchResultProcessor(req); knnProcessor != nil {
			processors = append(processors, knnProcessor)
		}
	}
	// Add Synonym processor if the request has Synonym
	if flags.synonyms {
		if synonymProcessor := newSynonymPreSearchResultProcessor(); synonymProcessor != nil {
			processors = append(processors, synonymProcessor)
		}
	}
	if flags.bm25 {
		if bm25Processtor := newBM25PreSearchResultProcessor(); bm25Processtor != nil {
			processors = append(processors, bm25Processtor)
		}
	}
	// Return based on the number of processors, optimizing for the common case of 1 processor
	// If there are no processors, return nil
	switch len(processors) {
	case 0:
		return nil
	case 1:
		return processors[0]
	default:
		return &compositePreSearchResultProcessor{
			presearchResultProcessors: processors,
		}
	}
}
