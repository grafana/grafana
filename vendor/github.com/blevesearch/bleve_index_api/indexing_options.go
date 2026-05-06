//  Copyright (c) 2014 Couchbase, Inc.
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

package index

type FieldIndexingOptions int

const (
	IndexField FieldIndexingOptions = 1 << iota
	StoreField
	IncludeTermVectors
	DocValues
	SkipFreqNorm
)

const (
	BM25Scoring  = "bm25"
	TFIDFScoring = "tfidf"
)

// Scoring model indicates the algorithm used to rank documents fetched
// for a query performed on a text field.
const DefaultScoringModel = TFIDFScoring

// Supported similarity models
var SupportedScoringModels = map[string]struct{}{
	BM25Scoring:  {},
	TFIDFScoring: {},
}

func (o FieldIndexingOptions) IsIndexed() bool {
	return o&IndexField != 0
}

func (o FieldIndexingOptions) IsStored() bool {
	return o&StoreField != 0
}

func (o FieldIndexingOptions) IncludeTermVectors() bool {
	return o&IncludeTermVectors != 0
}

func (o FieldIndexingOptions) IncludeDocValues() bool {
	return o&DocValues != 0
}

func (o FieldIndexingOptions) SkipFreqNorm() bool {
	return o&SkipFreqNorm != 0
}

func (o FieldIndexingOptions) String() string {
	rv := ""
	if o.IsIndexed() {
		rv += "INDEXED"
	}
	if o.IsStored() {
		if rv != "" {
			rv += ", "
		}
		rv += "STORE"
	}
	if o.IncludeTermVectors() {
		if rv != "" {
			rv += ", "
		}
		rv += "TV"
	}
	if o.IncludeDocValues() {
		if rv != "" {
			rv += ", "
		}
		rv += "DV"
	}
	if !o.SkipFreqNorm() {
		if rv != "" {
			rv += ", "
		}
		rv += "FN"
	}
	return rv
}
