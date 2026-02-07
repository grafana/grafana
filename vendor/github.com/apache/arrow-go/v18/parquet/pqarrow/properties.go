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
	"context"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet/internal/encoding"
)

// ArrowWriterProperties are used to determine how to manipulate the arrow data
// when writing it to a parquet file.
type ArrowWriterProperties struct {
	mem                      memory.Allocator
	timestampAsInt96         bool
	coerceTimestamps         bool
	coerceTimestampUnit      arrow.TimeUnit
	allowTruncatedTimestamps bool
	storeSchema              bool
	noMapLogicalType         bool
	// compliantNestedTypes     bool
}

// DefaultWriterProps returns the default properties for the arrow writer,
// which are to use memory.DefaultAllocator and coerceTimestampUnit: arrow.Second.
func DefaultWriterProps() ArrowWriterProperties {
	return ArrowWriterProperties{
		mem:                 memory.DefaultAllocator,
		coerceTimestampUnit: arrow.Second,
	}
}

type config struct {
	props ArrowWriterProperties
}

// WriterOption is a convenience for building up arrow writer properties
type WriterOption func(*config)

// NewArrowWriterProperties creates a new writer properties object by passing in
// a set of options to control the properties. Once created, an individual instance
// of ArrowWriterProperties is immutable.
func NewArrowWriterProperties(opts ...WriterOption) ArrowWriterProperties {
	cfg := config{DefaultWriterProps()}
	for _, o := range opts {
		o(&cfg)
	}
	return cfg.props
}

// WithAllocator specifies the allocator to be used by the writer whenever allocating
// buffers and memory.
func WithAllocator(mem memory.Allocator) WriterOption {
	return func(c *config) {
		c.props.mem = mem
	}
}

// WithDeprecatedInt96Timestamps allows specifying to enable conversion of arrow timestamps
// to int96 columns when constructing the schema. Since int96 is the impala standard, it's
// technically deprecated in terms of parquet files but is sometimes needed.
func WithDeprecatedInt96Timestamps(enabled bool) WriterOption {
	return func(c *config) {
		c.props.timestampAsInt96 = enabled
	}
}

// WithCoerceTimestamps enables coercing of timestamp units to a specific time unit
// when constructing the schema and writing data so that regardless of the unit used
// by the datatypes being written, they will be converted to the desired time unit.
func WithCoerceTimestamps(unit arrow.TimeUnit) WriterOption {
	return func(c *config) {
		c.props.coerceTimestamps = true
		c.props.coerceTimestampUnit = unit
	}
}

// WithTruncatedTimestamps called with true turns off the error that would be returned
// if coercing a timestamp unit would cause a loss of data such as converting from
// nanoseconds to seconds.
func WithTruncatedTimestamps(allow bool) WriterOption {
	return func(c *config) {
		c.props.allowTruncatedTimestamps = allow
	}
}

// WithStoreSchema enables writing a binary serialized arrow schema to the file in metadata
// to enable certain read options (like "read_dictionary") to be set automatically
//
// If called, the arrow schema is serialized and base64 encoded before being added to the
// metadata of the parquet file with the key "ARROW:schema". If the key exists when
// opening a file for read with pqarrow.FileReader, the schema will be used to choose
// types and options when constructing the arrow schema of the resulting data.
func WithStoreSchema() WriterOption {
	return func(c *config) {
		c.props.storeSchema = true
	}
}

func WithNoMapLogicalType() WriterOption {
	return func(c *config) {
		c.props.noMapLogicalType = true
	}
}

// func WithCompliantNestedTypes(enabled bool) WriterOption {
// 	return func(c *config) {
// 		c.props.compliantNestedTypes = enabled
// 	}
// }

type arrowWriteContext struct {
	props           ArrowWriterProperties
	dataBuffer      *memory.Buffer
	defLevelsBuffer encoding.Buffer
	repLevelsBuffer encoding.Buffer
}

type arrowCtxKey struct{}

// NewArrowWriteContext is for creating a re-usable context object that contains writer properties
// and other re-usable buffers for writing. The resulting context should not be used to write
// multiple columns concurrently. If nil is passed, then DefaultWriterProps will be used.
func NewArrowWriteContext(ctx context.Context, props *ArrowWriterProperties) context.Context {
	if props == nil {
		p := DefaultWriterProps()
		props = &p
	}
	return context.WithValue(ctx, arrowCtxKey{}, &arrowWriteContext{props: *props})
}

func arrowCtxFromContext(ctx context.Context) *arrowWriteContext {
	awc := ctx.Value(arrowCtxKey{})
	if awc != nil {
		return awc.(*arrowWriteContext)
	}

	return &arrowWriteContext{
		props: DefaultWriterProps(),
	}
}

// ArrowReadProperties is the properties to define how to read a parquet file
// into arrow arrays.
type ArrowReadProperties struct {
	// If Parallel is true, then functions which read multiple columns will read
	// those columns in parallel from the file with a number of readers equal
	// to the number of columns. Otherwise columns are read serially.
	Parallel bool
	// BatchSize is the size used for calls to NextBatch when reading whole columns
	BatchSize int64

	readDictIndices   map[int]struct{}
	forceLargeIndices map[int]struct{}
}

// SetForceLarge determines whether a particular column, if it is String or Binary,
// will use the LargeString/LargeBinary variants (with int64 offsets) instead of int32
// offsets. This is specifically useful if you know that particular columns contain more
// than 2GB worth of byte data which would prevent use of int32 offsets.
//
// Passing false will use the default variants while passing true will use the large
// variant. If the passed column index is not a string or binary column, then this will
// have no effect.
func (props *ArrowReadProperties) SetForceLarge(colIdx int, forceLarge bool) {
	if props.forceLargeIndices == nil {
		props.forceLargeIndices = make(map[int]struct{})
	}

	if forceLarge {
		props.forceLargeIndices[colIdx] = struct{}{}
	} else {
		delete(props.forceLargeIndices, colIdx)
	}
}

func (props *ArrowReadProperties) ForceLarge(colIdx int) bool {
	if props.forceLargeIndices == nil {
		return false
	}

	_, ok := props.forceLargeIndices[colIdx]
	return ok
}

// SetReadDict determines whether to read a particular column as dictionary
// encoded or not.
func (props *ArrowReadProperties) SetReadDict(colIdx int, readDict bool) {
	if props.readDictIndices == nil {
		props.readDictIndices = make(map[int]struct{})
	}

	if readDict {
		props.readDictIndices[colIdx] = struct{}{}
	} else {
		delete(props.readDictIndices, colIdx)
	}
}

func (props *ArrowReadProperties) ReadDict(colIdx int) bool {
	if props.readDictIndices == nil {
		return false
	}

	_, ok := props.readDictIndices[colIdx]
	return ok
}
