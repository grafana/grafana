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

package document

import (
	"reflect"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeSynonymField int

func init() {
	var f SynonymField
	reflectStaticSizeSynonymField = int(reflect.TypeOf(f).Size())
}

const DefaultSynonymIndexingOptions = index.IndexField

type SynonymField struct {
	name              string
	analyzer          analysis.Analyzer
	options           index.FieldIndexingOptions
	input             []string
	synonyms          []string
	numPlainTextBytes uint64

	// populated during analysis
	synonymMap map[string][]string
}

func (s *SynonymField) Size() int {
	return reflectStaticSizeSynonymField + size.SizeOfPtr +
		len(s.name)
}

func (s *SynonymField) Name() string {
	return s.name
}

func (s *SynonymField) ArrayPositions() []uint64 {
	return nil
}

func (s *SynonymField) Options() index.FieldIndexingOptions {
	return s.options
}

func (s *SynonymField) NumPlainTextBytes() uint64 {
	return s.numPlainTextBytes
}

func (s *SynonymField) AnalyzedLength() int {
	return 0
}

func (s *SynonymField) EncodedFieldType() byte {
	return 'y'
}

func (s *SynonymField) AnalyzedTokenFrequencies() index.TokenFrequencies {
	return nil
}

func (s *SynonymField) Analyze() {
	var analyzedInput []string
	if len(s.input) > 0 {
		analyzedInput = make([]string, 0, len(s.input))
		for _, term := range s.input {
			analyzedTerm := analyzeSynonymTerm(term, s.analyzer)
			if analyzedTerm != "" {
				analyzedInput = append(analyzedInput, analyzedTerm)
			}
		}
	}
	analyzedSynonyms := make([]string, 0, len(s.synonyms))
	for _, syn := range s.synonyms {
		analyzedTerm := analyzeSynonymTerm(syn, s.analyzer)
		if analyzedTerm != "" {
			analyzedSynonyms = append(analyzedSynonyms, analyzedTerm)
		}
	}
	s.synonymMap = processSynonymData(analyzedInput, analyzedSynonyms)
}

func (s *SynonymField) Value() []byte {
	return nil
}

func (s *SynonymField) IterateSynonyms(visitor func(term string, synonyms []string)) {
	for term, synonyms := range s.synonymMap {
		visitor(term, synonyms)
	}
}

func NewSynonymField(name string, analyzer analysis.Analyzer, input []string, synonyms []string) *SynonymField {
	return &SynonymField{
		name:     name,
		analyzer: analyzer,
		options:  DefaultSynonymIndexingOptions,
		input:    input,
		synonyms: synonyms,
	}
}

func processSynonymData(input []string, synonyms []string) map[string][]string {
	var synonymMap map[string][]string
	if len(input) > 0 {
		// Map each term to the same list of synonyms.
		synonymMap = make(map[string][]string, len(input))
		for _, term := range input {
			synonymMap[term] = synonyms
		}
	} else {
		synonymMap = make(map[string][]string, len(synonyms))
		// Precompute a map where each synonym points to all other synonyms.
		for i, elem := range synonyms {
			synonymMap[elem] = make([]string, 0, len(synonyms)-1)
			for j, otherElem := range synonyms {
				if i != j {
					synonymMap[elem] = append(synonymMap[elem], otherElem)
				}
			}
		}
	}
	return synonymMap
}

func analyzeSynonymTerm(term string, analyzer analysis.Analyzer) string {
	tokenStream := analyzer.Analyze([]byte(term))
	if len(tokenStream) == 1 {
		return string(tokenStream[0].Term)
	}
	return ""
}
