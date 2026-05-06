//  Copyright (c) 2020 The Bluge Authors.
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

package segment

type CollectionStats interface {

	// TotalDocumentCount returns the number of documents, regardless of whether or not
	// they have any terms for this field
	TotalDocumentCount() uint64

	// DocumentCount returns the number of documents with at least one term for this field
	DocumentCount() uint64

	// SumTotalTermFrequency returns to total number of tokens across all documents
	SumTotalTermFrequency() uint64

	// SumDocumentFrequency returns the sum of all posting list entries for this field
	// SumDocumentFrequency() int

	Merge(CollectionStats)
}

type TermStats interface {

	// DocumentFrequency returns the number of documents using this term
	DocumentFrequency() uint64

	// TotalTermFrequency returns the total number of occurrences of this term
	// TotalTermFrequency() int
}
