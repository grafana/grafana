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

package bleve

import "github.com/blevesearch/bleve/v2/mapping"

// NewIndexMapping creates a new IndexMapping that will use all the default indexing rules
func NewIndexMapping() *mapping.IndexMappingImpl {
	return mapping.NewIndexMapping()
}

// NewDocumentMapping returns a new document mapping
// with all the default values.
func NewDocumentMapping() *mapping.DocumentMapping {
	return mapping.NewDocumentMapping()
}

// NewDocumentStaticMapping returns a new document
// mapping that will not automatically index parts
// of a document without an explicit mapping.
func NewDocumentStaticMapping() *mapping.DocumentMapping {
	return mapping.NewDocumentStaticMapping()
}

// NewDocumentDisabledMapping returns a new document
// mapping that will not perform any indexing.
func NewDocumentDisabledMapping() *mapping.DocumentMapping {
	return mapping.NewDocumentDisabledMapping()
}

// NewTextFieldMapping returns a default field mapping for text
func NewTextFieldMapping() *mapping.FieldMapping {
	return mapping.NewTextFieldMapping()
}

// NewKeywordFieldMapping returns a field mapping for text using the keyword
// analyzer, which essentially doesn't apply any specific text analysis.
func NewKeywordFieldMapping() *mapping.FieldMapping {
	return mapping.NewKeywordFieldMapping()
}

// NewNumericFieldMapping returns a default field mapping for numbers
func NewNumericFieldMapping() *mapping.FieldMapping {
	return mapping.NewNumericFieldMapping()
}

// NewDateTimeFieldMapping returns a default field mapping for dates
func NewDateTimeFieldMapping() *mapping.FieldMapping {
	return mapping.NewDateTimeFieldMapping()
}

// NewBooleanFieldMapping returns a default field mapping for booleans
func NewBooleanFieldMapping() *mapping.FieldMapping {
	return mapping.NewBooleanFieldMapping()
}

func NewGeoPointFieldMapping() *mapping.FieldMapping {
	return mapping.NewGeoPointFieldMapping()
}

func NewGeoShapeFieldMapping() *mapping.FieldMapping {
	return mapping.NewGeoShapeFieldMapping()
}

func NewIPFieldMapping() *mapping.FieldMapping {
	return mapping.NewIPFieldMapping()
}
