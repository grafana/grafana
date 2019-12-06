// Copyright [2017] LinkedIn Corp. Licensed under the Apache License, Version
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
	"os"

	"github.com/golang/snappy"
)

// OCFConfig is used to specify creation parameters for OCFWriter.
type OCFConfig struct {
	// W specifies the `io.Writer` to which to send the encoded data,
	// (required). If W is `*os.File`, then creating an OCF for writing will
	// attempt to read any existing OCF header and use the schema and
	// compression codec specified by the existing header, then advance the file
	// position to the tail end of the file for appending.
	W io.Writer

	// Codec specifies the Codec to use for the new OCFWriter, (optional). If
	// the W parameter above is an `*os.File` which contains a Codec, the Codec
	// in the existing file will be used instead. Otherwise if this Codec
	// parameter is specified, it will be used. If neither the W parameter above
	// is an `*os.File` with an existing Codec, nor this Codec parameter is
	// specified, the OCFWriter will create a new Codec from the schema string
	// specified by the Schema parameter below.
	Codec *Codec

	// Schema specifies the Avro schema for the data to be encoded, (optional).
	// If neither the W parameter above is an `*os.File` with an existing Codec,
	// nor the Codec parameter above is specified, the OCFWriter will create a
	// new Codec from the schema string specified by this Schema parameter.
	Schema string

	// CompressionName specifies the compression codec used, (optional). If
	// omitted, defaults to "null" codec. When appending to an existing OCF,
	// this field is ignored.
	CompressionName string

	//MetaData specifies application specific meta data to be added to
	//the OCF file.  When appending to an existing OCF, this field
	//is ignored
	MetaData map[string][]byte
}

// OCFWriter is used to create a new or append to an existing Avro Object
// Container File (OCF).
type OCFWriter struct {
	header *ocfHeader
	iow    io.Writer
}

// NewOCFWriter returns a new OCFWriter instance that may be used for appending
// binary Avro data, either by appending to an existing OCF file or creating a
// new OCF file.
func NewOCFWriter(config OCFConfig) (*OCFWriter, error) {
	var err error
	ocf := &OCFWriter{iow: config.W}

	switch config.W.(type) {
	case nil:
		return nil, errors.New("cannot create OCFWriter when W is nil")
	case *os.File:
		file := config.W.(*os.File)
		stat, err := file.Stat()
		if err != nil {
			return nil, fmt.Errorf("cannot create OCFWriter: %s", err)
		}
		// NOTE: When upstream provides a new file, it will already exist but
		// have a size of 0 bytes.
		if stat.Size() > 0 {
			// attempt to read existing OCF header
			if ocf.header, err = readOCFHeader(file); err != nil {
				return nil, fmt.Errorf("cannot create OCFWriter: %s", err)
			}
			// prepare for appending data to existing OCF
			if err = ocf.quickScanToTail(file); err != nil {
				return nil, fmt.Errorf("cannot create OCFWriter: %s", err)
			}
			return ocf, nil // happy case for appending to existing OCF
		}
	}

	// create new OCF header based on configuration parameters
	if ocf.header, err = newOCFHeader(config); err != nil {
		return nil, fmt.Errorf("cannot create OCFWriter: %s", err)
	}
	if err = writeOCFHeader(ocf.header, config.W); err != nil {
		return nil, fmt.Errorf("cannot create OCFWriter: %s", err)
	}
	return ocf, nil // another happy case for creation of new OCF
}

// quickScanToTail advances the stream reader to the tail end of the
// file. Rather than reading each encoded block, optionally decompressing it,
// and then decoding it, this method reads the block count, ignoring it, then
// reads the block size, then skips ahead to the followig block. It does this
// repeatedly until attempts to read the file return io.EOF.
func (ocfw *OCFWriter) quickScanToTail(ior io.Reader) error {
	sync := make([]byte, ocfSyncLength)
	for {
		// Read and validate block count
		blockCount, err := longBinaryReader(ior)
		if err != nil {
			if err == io.EOF {
				return nil // merely end of file, rather than error
			}
			return fmt.Errorf("cannot read block count: %s", err)
		}
		if blockCount <= 0 {
			return fmt.Errorf("cannot read when block count is not greater than 0: %d", blockCount)
		}
		if blockCount > MaxBlockCount {
			return fmt.Errorf("cannot read when block count exceeds MaxBlockCount: %d > %d", blockCount, MaxBlockCount)
		}
		// Read block size
		blockSize, err := longBinaryReader(ior)
		if err != nil {
			return fmt.Errorf("cannot read block size: %s", err)
		}
		if blockSize <= 0 {
			return fmt.Errorf("cannot read when block size is not greater than 0: %d", blockSize)
		}
		if blockSize > MaxBlockSize {
			return fmt.Errorf("cannot read when block size exceeds MaxBlockSize: %d > %d", blockSize, MaxBlockSize)
		}
		// Advance reader to end of block
		if _, err = io.CopyN(ioutil.Discard, ior, blockSize); err != nil {
			return fmt.Errorf("cannot seek to next block: %s", err)
		}
		// Read and validate sync marker
		var n int
		if n, err = io.ReadFull(ior, sync); err != nil {
			return fmt.Errorf("cannot read sync marker: read %d out of %d bytes: %s", n, ocfSyncLength, err)
		}
		if !bytes.Equal(sync, ocfw.header.syncMarker[:]) {
			return fmt.Errorf("sync marker mismatch: %v != %v", sync, ocfw.header.syncMarker)
		}
	}
}

// Append appends one or more data items to an OCF file in a block. If there are
// more data items in the slice than MaxBlockCount allows, the data slice will
// be chunked into multiple blocks, each not having more than MaxBlockCount
// items.
func (ocfw *OCFWriter) Append(data interface{}) error {
	arrayValues, err := convertArray(data)
	if err != nil {
		return err
	}

	// Chunk data so no block has more than MaxBlockCount items.
	for int64(len(arrayValues)) > MaxBlockCount {
		if err := ocfw.appendDataIntoBlock(arrayValues[:MaxBlockCount]); err != nil {
			return err
		}
		arrayValues = arrayValues[MaxBlockCount:]
	}
	return ocfw.appendDataIntoBlock(arrayValues)
}

func (ocfw *OCFWriter) appendDataIntoBlock(data []interface{}) error {
	var block []byte // working buffer for encoding data values
	var err error

	// Encode and concatenate each data item into the block
	for _, datum := range data {
		if block, err = ocfw.header.codec.BinaryFromNative(block, datum); err != nil {
			return fmt.Errorf("cannot translate datum to binary: %v; %s", datum, err)
		}
	}

	switch ocfw.header.compressionID {
	case compressionNull:
		// no-op

	case compressionDeflate:
		// compress into new bytes buffer.
		bb := bytes.NewBuffer(make([]byte, 0, len(block)))

		cw, _ := flate.NewWriter(bb, flate.DefaultCompression)
		// writing bytes to cw will compress bytes and send to bb.
		if _, err := cw.Write(block); err != nil {
			return err
		}
		if err := cw.Close(); err != nil {
			return err
		}
		block = bb.Bytes()

	case compressionSnappy:
		compressed := snappy.Encode(nil, block)

		// OCF requires snappy to have CRC32 checksum after each snappy block
		compressed = append(compressed, 0, 0, 0, 0)                                           // expand slice by 4 bytes so checksum will fit
		binary.BigEndian.PutUint32(compressed[len(compressed)-4:], crc32.ChecksumIEEE(block)) // checksum of decompressed block

		block = compressed

	default:
		return fmt.Errorf("should not get here: cannot compress block using unrecognized compression: %d", ocfw.header.compressionID)

	}

	// create file data block
	buf := make([]byte, 0, len(block)+ocfBlockConst) // pre-allocate block bytes
	buf, _ = longBinaryFromNative(buf, len(data))    // block count (number of data items)
	buf, _ = longBinaryFromNative(buf, len(block))   // block size (number of bytes in block)
	buf = append(buf, block...)                      // serialized objects
	buf = append(buf, ocfw.header.syncMarker[:]...)  // sync marker

	_, err = ocfw.iow.Write(buf)
	return err
}

// Codec returns the codec used by OCFWriter. This function provided because
// upstream may be appending to existing OCF which uses a different schema than
// requested during instantiation.
func (ocfw *OCFWriter) Codec() *Codec {
	return ocfw.header.codec
}

// CompressionName returns the name of the compression algorithm used by
// OCFWriter. This function provided because upstream may be appending to
// existing OCF which uses a different compression algorithm than requested
// during instantiation.  the OCF file.
func (ocfw *OCFWriter) CompressionName() string {
	switch ocfw.header.compressionID {
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
