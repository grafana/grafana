//  Copyright (c) 2022 Couchbase, Inc.
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

// SpatialAnalyzerPlugin is an interface for the custom spatial
// tokenizer implementations that supports the generation of spatial
// hierarchial tokens for both indexing and querying of geoJSON data.
type SpatialAnalyzerPlugin interface {
	// Type returns the plugin type. eg: "s2".
	Type() string

	// GetIndexTokens returns the tokens to be indexed for the
	// given GeoJSON type data in the document.
	GetIndexTokens(GeoJSON) []string

	// GetQueryTokens returns the tokens to be queried for the
	// given GeoJSON type data in the document.
	GetQueryTokens(GeoJSON) []string
}

// GeoJSON is generic interface for any geoJSON shapes like
// points, polygon etc.
type GeoJSON interface {
	// Returns the type of geoJSON shape.
	Type() string

	// Checks whether the given shape intersects with current shape.
	Intersects(GeoJSON) (bool, error)

	// Checks whether the given shape resides within the current shape.
	Contains(GeoJSON) (bool, error)

	// Value returns the byte value for the shape.
	Value() ([]byte, error)
}
