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

// Package parquet provides an implementation of Apache Parquet for Go.
//
// Apache Parquet is an open-source columnar data storage format using the record
// shredding and assembly algorithm to accommodate complex data structures which
// can then be used to efficiently store the data.
//
// While the go.mod states go1.18, everything here should be compatible
// with go versions 1.17 and 1.16.
//
// This implementation is a native go implementation for reading and writing the
// parquet file format.
//
// # Install
//
// You can download the library and cli utilities via:
//
//	go get -u github.com/apache/arrow-go/v18/parquet
//	go install github.com/apache/arrow-go/v18/parquet/cmd/parquet_reader@latest
//	go install github.com/apache/arrow-go/v18/parquet/cmd/parquet_schema@latest
//
// # Modules
//
// This top level parquet package contains the basic common types and reader/writer
// properties along with some utilities that are used throughout the other modules.
//
// The file module contains the functions for directly reading/writing parquet files
// including Column Readers and Column Writers.
//
// The metadata module contains the types for managing the lower level file/rowgroup/column
// metadata inside of a ParquetFile including inspecting the statistics.
//
// The pqarrow module contains helper functions and types for converting directly
// between Parquet and Apache Arrow formats.
//
// The schema module contains the types for manipulating / inspecting / creating
// parquet file schemas.
//
// # Primitive Types
//
// The Parquet Primitive Types and their corresponding Go types are Boolean (bool),
// Int32 (int32), Int64 (int64), Int96 (parquet.Int96), Float (float32), Double (float64),
// ByteArray (parquet.ByteArray) and FixedLenByteArray (parquet.FixedLenByteArray).
//
// # Encodings
//
// The encoding types supported in this package are:
//
//   - Plain
//
//   - Plain/RLE Dictionary
//
//   - Delta Binary Packed (only integer types)
//
//   - Delta Byte Array (only ByteArray)
//
//   - Delta Length Byte Array (only ByteArray)
//
//   - Byte Stream Split (Float, Double, Int32, Int64, FixedLenByteArray)
//
// Tip: Some platforms don't necessarily support all kinds of encodings. If you're not
// sure what to use, just use Plain and Dictionary encoding.
package parquet

//go:generate go run golang.org/x/tools/cmd/stringer -type=Version -linecomment
//go:generate thrift -o internal -r --gen go ../parquet.thrift
