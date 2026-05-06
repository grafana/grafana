//  Copyright (c) 2015 Couchbase, Inc.
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

import (
	"net"
	"time"
)

type Document interface {
	ID() string
	Size() int

	VisitFields(visitor FieldVisitor)
	VisitComposite(visitor CompositeFieldVisitor)
	HasComposite() bool

	NumPlainTextBytes() uint64

	AddIDField()

	StoredFieldsBytes() uint64

	Indexed() bool
}

type FieldVisitor func(Field)

type Field interface {
	Name() string
	Value() []byte
	ArrayPositions() []uint64

	EncodedFieldType() byte

	Analyze()

	Options() FieldIndexingOptions

	AnalyzedLength() int
	AnalyzedTokenFrequencies() TokenFrequencies

	NumPlainTextBytes() uint64
}

type CompositeFieldVisitor func(field CompositeField)

type CompositeField interface {
	Field

	Compose(field string, length int, freq TokenFrequencies)
}

type TextField interface {
	Text() string
}

type NumericField interface {
	Number() (float64, error)
}

type DateTimeField interface {
	DateTime() (time.Time, string, error)
}

type BooleanField interface {
	Boolean() (bool, error)
}

type GeoPointField interface {
	Lon() (float64, error)
	Lat() (float64, error)
}

type GeoShapeField interface {
	GeoShape() (GeoJSON, error)
	EncodedShape() []byte
}

type IPField interface {
	IP() (net.IP, error)
}

// TokenizableSpatialField is an optional interface for fields that
// supports pluggable custom hierarchial spatial token generation.
type TokenizableSpatialField interface {
	// SetSpatialAnalyzerPlugin lets the index implementations to
	// initialise relevant spatial analyzer plugins for the field
	// to override the spatial token generations during the analysis phase.
	SetSpatialAnalyzerPlugin(SpatialAnalyzerPlugin)
}

// SynonymField represents a field that contains a list of synonyms for a set of terms.
// Each SynonymField is generated from a single synonym definition, and its name corresponds
// to the synonym source to which the synonym definition belongs.
type SynonymField interface {
	Field
	// IterateSynonyms iterates over the synonyms for the term in the field.
	// The provided visitor function is called with each term and its corresponding synonyms.
	IterateSynonyms(visitor func(term string, synonyms []string))
}

// SynonymFieldVisitor is a function type used to visit a SynonymField within a document.
type SynonymFieldVisitor func(SynonymField)

// SynonymDocument represents a special type of document that contains synonym fields.
// Each SynonymField is a field with a list of synonyms for a set of terms.
// These fields are derived from synonym definitions, and their names correspond to the synonym sources.
type SynonymDocument interface {
	Document
	// VisitSynonymFields allows iteration over all synonym fields in the document.
	// The provided visitor function is called for each synonym field.
	VisitSynonymFields(visitor SynonymFieldVisitor)
}
