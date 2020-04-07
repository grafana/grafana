// Copyright [2019] LinkedIn Corp. Licensed under the Apache License, Version
// 2.0 (the "License"); you may not use this file except in compliance with the
// License.  You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

package goavro

import (
	"bytes"
	"compress/flate"
	"encoding/binary"
	"errors"
	"fmt"
	"hash/crc32"
	"io"
	"io/ioutil"

	"github.com/golang/snappy"
)

// OCFReader structure is used to read Object Container Files (OCF).
type OCFReader struct {
	header              *ocfHeader
	block               []byte // buffer from which decoding takes place
	rerr                error  // most recent error that took place while reading bytes (unrecoverable)
	ior                 io.Reader
	readReady           bool  // true after Scan and before Read
	remainingBlockItems int64 // count of encoded data items remaining in block buffer to be decoded
}

// NewOCFReader initializes and returns a new structure used to read an Avro
// Object Container File (OCF).
//
//     func example(ior io.Reader) error {
//         // NOTE: Wrap provided io.Reader in a buffered reader, which improves the
//         // performance of streaming file data.
//         br := bufio.NewReader(ior)
//         ocfr, err := goavro.NewOCFReader(br)
//         if err != nil {
//             return err
//         }
//         for ocfr.Scan() {
//             datum, err := ocfr.Read()
//             if err != nil {
//                 return err
//             }
//             fmt.Println(datum)
//         }
//         return ocfr.Err()
//     }
func NewOCFReader(ior io.Reader) (*OCFReader, error) {
	header, err := readOCFHeader(ior)
	if err != nil {
		return nil, fmt.Errorf("cannot create OCFReader: %s", err)
	}
	return &OCFReader{header: header, ior: ior}, nil
}

//MetaData returns the file metadata map found within the OCF file
func (ocfr *OCFReader) MetaData() map[string][]byte {
	return ocfr.header.metadata
}

// Codec returns the codec found within the OCF file.
func (ocfr *OCFReader) Codec() *Codec {
	return ocfr.header.codec
}

// CompressionName returns the name of the compression algorithm found within
// the OCF file.
func (ocfr *OCFReader) CompressionName() string {
	switch ocfr.header.compressionID {
	case compressionNull:
		return CompressionNullLabel
	case compressionDeflate:
		return CompressionDeflateLabel
	case compressionSnappy:
		return CompressionSnappyLabel
	default:
		return "should not get here: unrecognized compression algorithm"
	}
}

// Err returns the last error encountered while reading the OCF file.  See
// `NewOCFReader` documentation for an example.
func (ocfr *OCFReader) Err() error {
	return ocfr.rerr
}

// Read consumes one datum value from the Avro OCF stream and returns it. Read
// is designed to be called only once after each invocation of the Scan method.
// See `NewOCFReader` documentation for an example.
func (ocfr *OCFReader) Read() (interface{}, error) {
	// NOTE: Test previous error before testing readReady to prevent overwriting
	// previous error.
	if ocfr.rerr != nil {
		return nil, ocfr.rerr
	}
	if !ocfr.readReady {
		ocfr.rerr = errors.New("Read called without successful Scan")
		return nil, ocfr.rerr
	}
	ocfr.readReady = false

	// decode one datum value from block
	var datum interface{}
	datum, ocfr.block, ocfr.rerr = ocfr.header.codec.NativeFromBinary(ocfr.block)
	if ocfr.rerr != nil {
		return false, ocfr.rerr
	}
	ocfr.remainingBlockItems--

	return datum, nil
}

// RemainingBlockItems returns the number of items remaining in the block being
// processed.
func (ocfr *OCFReader) RemainingBlockItems() int64 {
	return ocfr.remainingBlockItems
}

// Scan returns true when there is at least one more data item to be read from
// the Avro OCF. Scan ought to be called prior to calling the Read method each
// time the Read method is invoked.  See `NewOCFReader` documentation for an
// example.
func (ocfr *OCFReader) Scan() bool {
	ocfr.readReady = false

	if ocfr.rerr != nil {
		return false
	}

	// NOTE: If there are no more remaining data items from the existing block,
	// then attempt to slurp in the next block.
	if ocfr.remainingBlockItems <= 0 {
		if count := len(ocfr.block); count != 0 {
			ocfr.rerr = fmt.Errorf("extra bytes between final datum in previous block and block sync marker: %d", count)
			return false
		}

		// Read the block count and update the number of remaining items for
		// this block
		ocfr.remainingBlockItems, ocfr.rerr = longBinaryReader(ocfr.ior)
		if ocfr.rerr != nil {
			if ocfr.rerr == io.EOF {
				ocfr.rerr = nil // merely end of file, rather than error
			} else {
				ocfr.rerr = fmt.Errorf("cannot read block count: %s", ocfr.rerr)
			}
			return false
		}
		if ocfr.remainingBlockItems <= 0 {
			ocfr.rerr = fmt.Errorf("cannot decode when block count is not greater than 0: %d", ocfr.remainingBlockItems)
			return false
		}
		if ocfr.remainingBlockItems > MaxBlockCount {
			ocfr.rerr = fmt.Errorf("cannot decode when block count exceeds MaxBlockCount: %d > %d", ocfr.remainingBlockItems, MaxBlockCount)
		}

		var blockSize int64
		blockSize, ocfr.rerr = longBinaryReader(ocfr.ior)
		if ocfr.rerr != nil {
			ocfr.rerr = fmt.Errorf("cannot read block size: %s", ocfr.rerr)
			return false
		}
		if blockSize <= 0 {
			ocfr.rerr = fmt.Errorf("cannot decode when block size is not greater than 0: %d", blockSize)
			return false
		}
		if blockSize > MaxBlockSize {
			ocfr.rerr = fmt.Errorf("cannot decode when block size exceeds MaxBlockSize: %d > %d", blockSize, MaxBlockSize)
			return false
		}

		// read entire block into buffer
		ocfr.block = make([]byte, blockSize)
		_, ocfr.rerr = io.ReadFull(ocfr.ior, ocfr.block)
		if ocfr.rerr != nil {
			ocfr.rerr = fmt.Errorf("cannot read block: %s", ocfr.rerr)
			return false
		}

		switch ocfr.header.compressionID {
		case compressionNull:
			// no-op

		case compressionDeflate:
			// NOTE: flate.NewReader wraps with io.ByteReader if argument does
			// not implement that interface.
			rc := flate.NewReader(bytes.NewBuffer(ocfr.block))
			ocfr.block, ocfr.rerr = ioutil.ReadAll(rc)
			if ocfr.rerr != nil {
				_ = rc.Close()
				return false
			}
			if ocfr.rerr = rc.Close(); ocfr.rerr != nil {
				return false
			}

		case compressionSnappy:
			index := len(ocfr.block) - 4 // last 4 bytes is crc32 of decoded block
			if index <= 0 {
				ocfr.rerr = fmt.Errorf("cannot decompress snappy without CRC32 checksum: %d", len(ocfr.block))
				return false
			}
			decoded, err := snappy.Decode(nil, ocfr.block[:index])
			if err != nil {
				ocfr.rerr = fmt.Errorf("cannot decompress: %s", err)
				return false
			}
			actualCRC := crc32.ChecksumIEEE(decoded)
			expectedCRC := binary.BigEndian.Uint32(ocfr.block[index : index+4])
			if actualCRC != expectedCRC {
				ocfr.rerr = fmt.Errorf("snappy CRC32 checksum mismatch: %x != %x", actualCRC, expectedCRC)
				return false
			}
			ocfr.block = decoded

		default:
			ocfr.rerr = fmt.Errorf("should not get here: cannot compress block using unrecognized compression: %d", ocfr.header.compressionID)
			return false

		}

		// read and ensure sync marker matches
		sync := make([]byte, ocfSyncLength)
		var n int
		if n, ocfr.rerr = io.ReadFull(ocfr.ior, sync); ocfr.rerr != nil {
			ocfr.rerr = fmt.Errorf("cannot read sync marker: read %d out of %d bytes: %s", n, ocfSyncLength, ocfr.rerr)
			return false
		}
		if !bytes.Equal(sync, ocfr.header.syncMarker[:]) {
			ocfr.rerr = fmt.Errorf("sync marker mismatch: %v != %v", sync, ocfr.header.syncMarker)
			return false
		}
	}

	ocfr.readReady = true
	return true
}

// SkipThisBlockAndReset can be called after an error occurs while reading or
// decoding datum values from an OCF stream. OCF specifies each OCF stream
// contain one or more blocks of data. Each block consists of a block count, the
// number of bytes for the block, followed be the possibly compressed
// block. Inside each decompressed block is all of the binary encoded datum
// values concatenated together. In other words, OCF framing is at a block level
// rather than a datum level. If there is an error while reading or decoding a
// datum, the reader is not able to skip to the next datum value, because OCF
// does not have any markers for where each datum ends and the next one
// begins. Therefore, the reader is only able to skip this datum value and all
// subsequent datum values in the current block, move to the next block and
// start decoding datum values there.
func (ocfr *OCFReader) SkipThisBlockAndReset() {
	// ??? is it an error to call method unless the reader has had an error
	ocfr.remainingBlockItems = 0
	ocfr.block = ocfr.block[:0]
	ocfr.rerr = nil
}
